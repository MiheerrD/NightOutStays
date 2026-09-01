'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useParams,
} from 'next/navigation';

import {
  createClient,
} from '@supabase/supabase-js';

import {
  calculateBookingPrice,
} from '../../lib/pricing';

import GuestAvailabilityCalendar
  from './GuestAvailabilityCalendar';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

function money(value) {
  return `₹${Number(
    value || 0
  ).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function roundMoney(value) {
  return (
    Math.round(
      Number(value || 0) * 100
    ) / 100
  );
}

function todayString() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(
      now.getMonth() + 1
    ).padStart(2, '0'),
    String(
      now.getDate()
    ).padStart(2, '0'),
  ].join('-');
}

function addDays(
  dateString,
  days
) {
  if (!dateString) {
    return '';
  }

  const date = new Date(
    `${dateString}T12:00:00`
  );

  date.setDate(
    date.getDate() +
      Number(days || 0)
  );

  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1
    ).padStart(2, '0'),
    String(
      date.getDate()
    ).padStart(2, '0'),
  ].join('-');
}

function rangesOverlap(
  startA,
  endA,
  startB,
  endB
) {
  return (
    startA < endB &&
    endA > startB
  );
}

function getStayDates(
  checkIn,
  checkOut
) {
  if (
    !checkIn ||
    !checkOut
  ) {
    return [];
  }

  const dates = [];

  let current = new Date(
    `${checkIn}T12:00:00`
  );

  const end = new Date(
    `${checkOut}T12:00:00`
  );

  while (current < end) {
    dates.push(
      [
        current.getFullYear(),
        String(
          current.getMonth() + 1
        ).padStart(2, '0'),
        String(
          current.getDate()
        ).padStart(2, '0'),
      ].join('-')
    );

    current.setDate(
      current.getDate() + 1
    );
  }

  return dates;
}

function dateDayNumber(
  dateString
) {
  return new Date(
    `${dateString}T12:00:00`
  ).getDay();
}

function isValidEmail(
  value
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(
      value || ''
    ).trim()
  );
}

function cleanPhone(
  value
) {
  return String(
    value || ''
  ).replace(
    /\D/g,
    ''
  );
}

function formatTime(value) {
  if (!value) {
    return '—';
  }

  const [
    hour,
    minute,
  ] = String(value)
    .slice(0, 5)
    .split(':');

  const date = new Date();

  date.setHours(
    Number(hour)
  );

  date.setMinutes(
    Number(minute)
  );

  return date.toLocaleTimeString(
    'en-IN',
    {
      hour: 'numeric',
      minute: '2-digit',
    }
  );
}

/*
  Host gets 24 hours from
  booking request creation
  to approve or decline.
*/
function getHostResponseDeadline(
  booking
) {
  if (!booking?.created_at) {
    return null;
  }

  const createdAt = new Date(
    booking.created_at
  );

  if (
    Number.isNaN(
      createdAt.getTime()
    )
  ) {
    return null;
  }

  return new Date(
    createdAt.getTime() +
      24 * 60 * 60 * 1000
  );
}

function formatDateTime(value) {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—';
  }

  return new Intl.DateTimeFormat(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }
  ).format(date);
}

/* =========================
   OFFER ELIGIBILITY
========================= */

function offerEligibleForBooking(
  offer,
  checkIn,
  checkOut,
  nights
) {
  if (
    !offer ||
    !checkIn ||
    !checkOut ||
    nights <= 0
  ) {
    return false;
  }

  if (
    offer.is_active === false
  ) {
    return false;
  }

  const category =
    String(
      offer.offer_category ||
        ''
    ).toLowerCase();

  const title =
    String(
      offer.title ||
        offer.name ||
        ''
    ).toLowerCase();

  let requiredNights =
    Math.max(
      Number(
        offer.min_nights ||
          1
      ),
      1
    );

  if (
    category === 'monthly' ||
    title.includes('monthly')
  ) {
    requiredNights =
      Math.max(
        requiredNights,
        20
      );
  } else if (
    category === 'fortnightly' ||
    title.includes('fortnight')
  ) {
    requiredNights =
      Math.max(
        requiredNights,
        12
      );
  } else if (
    category === 'weekly' ||
    title.includes('weekly')
  ) {
    requiredNights =
      Math.max(
        requiredNights,
        6
      );
  }

  if (
    nights <
    requiredNights
  ) {
    return false;
  }

  const stayDates =
    getStayDates(
      checkIn,
      checkOut
    );

  const eligibleDates =
    stayDates.filter(
      (date) => {
        if (
          offer.start_date &&
          date <
            offer.start_date
        ) {
          return false;
        }

        if (
          offer.end_date &&
          date >
            offer.end_date
        ) {
          return false;
        }

        const days =
          Array.isArray(
            offer.applicable_days
          )
            ? offer.applicable_days
            : [];

        if (
          days.length &&
          !days.includes(
            dateDayNumber(
              date
            )
          )
        ) {
          return false;
        }

        return true;
      }
    );

  if (
    offer.apply_scope ===
    'entire_booking'
  ) {
    return (
      eligibleDates.length ===
      stayDates.length
    );
  }

  return (
    eligibleDates.length > 0
  );
}

/* =========================
   DISCOUNT + NIGHTLY GST
========================= */

function buildFinalPricing({
  basePricing,
  offer,
  checkIn,
  checkOut,
  property,
}) {
  if (!basePricing?.valid) {
    return {
      valid: false,
    };
  }

  const stayDates =
    getStayDates(
      checkIn,
      checkOut
    );

  const rawBreakdown =
    Array.isArray(
      basePricing.nightlyBreakdown
    ) &&
    basePricing.nightlyBreakdown.length
      ? basePricing.nightlyBreakdown.map(
          (
            item,
            index
          ) => ({
            date:
              item.date ||
              stayDates[index],

            rate:
              Number(
                item.rate || 0
              ),
          })
        )
      : stayDates.map(
          (date) => ({
            date,

            rate:
              Number(
                basePricing.staySubtotal ||
                  0
              ) /
              Math.max(
                stayDates.length,
                1
              ),
          })
        );

  const eligibleForOffer =
    (date) => {
      if (!offer) {
        return false;
      }

      if (
        offer.start_date &&
        date <
          offer.start_date
      ) {
        return false;
      }

      if (
        offer.end_date &&
        date >
          offer.end_date
      ) {
        return false;
      }

      const days =
        Array.isArray(
          offer.applicable_days
        )
          ? offer.applicable_days
          : [];

      if (
        days.length &&
        !days.includes(
          dateDayNumber(
            date
          )
        )
      ) {
        return false;
      }

      return true;
    };

  let discountAmount = 0;

  let discountedNights =
    rawBreakdown.map(
      (item) => ({
        ...item,
        discount: 0,
        discountedRate:
          Number(
            item.rate
          ),
      })
    );

  if (offer) {
    const eligibleIndexes =
      discountedNights
        .map(
          (
            item,
            index
          ) =>
            eligibleForOffer(
              item.date
            )
              ? index
              : null
        )
        .filter(
          (index) =>
            index !== null
        );

    const eligibleAmount =
      eligibleIndexes.reduce(
        (
          sum,
          index
        ) =>
          sum +
          Number(
            discountedNights[
              index
            ].rate || 0
          ),
        0
      );

    if (
      eligibleAmount > 0
    ) {
      if (
        offer.discount_type ===
        'percent'
      ) {
        eligibleIndexes.forEach(
          (index) => {
            const original =
              Number(
                discountedNights[
                  index
                ].rate || 0
              );

            const discount =
              roundMoney(
                original *
                  Number(
                    offer.discount_value ||
                      0
                  ) /
                  100
              );

            discountedNights[
              index
            ].discount =
              discount;

            discountedNights[
              index
            ].discountedRate =
              Math.max(
                0,
                roundMoney(
                  original -
                    discount
                )
              );

            discountAmount +=
              discount;
          }
        );
      } else {
        const fixedDiscount =
          Math.min(
            Number(
              offer.discount_value ||
                0
            ),
            eligibleAmount
          );

        let allocated = 0;

        eligibleIndexes.forEach(
          (
            index,
            position
          ) => {
            const original =
              Number(
                discountedNights[
                  index
                ].rate || 0
              );

            let share;

            if (
              position ===
              eligibleIndexes.length -
                1
            ) {
              share =
                roundMoney(
                  fixedDiscount -
                    allocated
                );
            } else {
              share =
                roundMoney(
                  fixedDiscount *
                    (
                      original /
                      eligibleAmount
                    )
                );

              allocated +=
                share;
            }

            discountedNights[
              index
            ].discount =
              share;

            discountedNights[
              index
            ].discountedRate =
              Math.max(
                0,
                roundMoney(
                  original -
                    share
                )
              );
          }
        );

        discountAmount =
          fixedDiscount;
      }
    }
  }

  discountAmount =
    roundMoney(
      discountAmount
    );

  const staySubtotal =
    roundMoney(
      discountedNights.reduce(
        (
          sum,
          item
        ) =>
          sum +
          Number(
            item.rate || 0
          ),
        0
      )
    );

  const discountedStaySubtotal =
    roundMoney(
      discountedNights.reduce(
        (
          sum,
          item
        ) =>
          sum +
          Number(
            item.discountedRate ||
              0
          ),
        0
      )
    );

  const cleaningFee =
    Number(
      basePricing.cleaningFee ??
        property.cleaning_fee ??
        0
    );

  const extraGuestCharge =
    Number(
      basePricing.extraGuestCharge ||
        0
    );

  const securityDeposit =
    Number(
      basePricing.securityDeposit ??
        property.security_deposit ??
        0
    );

  const sharedCharges =
    roundMoney(
      cleaningFee +
        extraGuestCharge
    );

  const shareBasis =
    discountedStaySubtotal > 0
      ? discountedStaySubtotal
      : discountedNights.length;

  let allocatedShared = 0;
  let totalGST = 0;

  const nightlyTaxBreakdown =
    discountedNights.map(
      (
        item,
        index
      ) => {
        let sharedPart = 0;

        if (
          sharedCharges > 0
        ) {
          if (
            index ===
            discountedNights.length -
              1
          ) {
            sharedPart =
              roundMoney(
                sharedCharges -
                  allocatedShared
              );
          } else if (
            discountedStaySubtotal >
            0
          ) {
            sharedPart =
              roundMoney(
                sharedCharges *
                  (
                    Number(
                      item.discountedRate ||
                        0
                    ) /
                    shareBasis
                  )
              );

            allocatedShared +=
              sharedPart;
          } else {
            sharedPart =
              roundMoney(
                sharedCharges /
                  discountedNights.length
              );

            allocatedShared +=
              sharedPart;
          }
        }

        const effectiveNightRate =
          roundMoney(
            item.discountedRate
          );

        const gstRate =
          effectiveNightRate <
          7000
            ? 5
            : 18;

        const taxableForNight =
          roundMoney(
            effectiveNightRate +
              sharedPart
          );

        const gst =
          roundMoney(
            taxableForNight *
              gstRate /
              100
          );

        totalGST += gst;

        return {
          date:
            item.date,

          originalRate:
            roundMoney(
              item.rate
            ),

          discount:
            roundMoney(
              item.discount
            ),

          effectiveRate:
            effectiveNightRate,

          sharedCharges:
            sharedPart,

          taxableAmount:
            taxableForNight,

          gstRate,

          gst,
        };
      }
    );

  totalGST =
    roundMoney(
      totalGST
    );

  const taxableAmount =
    roundMoney(
      discountedStaySubtotal +
        sharedCharges
    );

  const totalPayable =
    roundMoney(
      taxableAmount +
        totalGST +
        securityDeposit
    );

  const uniqueGstRates = [
    ...new Set(
      nightlyTaxBreakdown.map(
        (item) =>
          item.gstRate
      )
    ),
  ];

  return {
    ...basePricing,

    valid: true,

    staySubtotal,

    discountedStaySubtotal,

    cleaningFee:
      roundMoney(
        cleaningFee
      ),

    extraGuestCharge:
      roundMoney(
        extraGuestCharge
      ),

    securityDeposit:
      roundMoney(
        securityDeposit
      ),

    regularDiscountAmount:
      discountAmount,

    taxableAmount,

    gstAmount:
      totalGST,

    gstRate:
      uniqueGstRates.length ===
      1
        ? uniqueGstRates[0]
        : 0,

    total:
      totalPayable,

    totalPayable,

    selectedOffer:
      offer,

    nightlyTaxBreakdown,
  };
}

export default function PropertyPage() {
  const params =
    useParams();

  const slug =
    params?.slug;

  const [
    property,
    setProperty,
  ] = useState(null);

  const [
    photos,
    setPhotos,
  ] = useState([]);

  const [
    pricingRules,
    setPricingRules,
  ] = useState([]);

  const [
    rateOverrides,
    setRateOverrides,
  ] = useState([]);

  const [
    propertyOffers,
    setPropertyOffers,
  ] = useState([]);

  const [
    blockedDates,
    setBlockedDates,
  ] = useState([]);

  const [
    existingBookings,
    setExistingBookings,
  ] = useState([]);

  const [
    session,
    setSession,
  ] = useState(null);

  const [
    guestProfile,
    setGuestProfile,
  ] = useState(null);

  const [
    authChecking,
    setAuthChecking,
  ] = useState(true);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    pageError,
    setPageError,
  ] = useState('');

  const [
    activePhoto,
    setActivePhoto,
  ] = useState(0);

  const [
    checkIn,
    setCheckIn,
  ] = useState('');

  const [
    checkOut,
    setCheckOut,
  ] = useState('');

  const [
    guestCount,
    setGuestCount,
  ] = useState(1);

  const [
    selectedOfferId,
    setSelectedOfferId,
  ] = useState('');

  const [
    guestName,
    setGuestName,
  ] = useState('');

  const [
    guestPhone,
    setGuestPhone,
  ] = useState('');

  const [
    guestEmail,
    setGuestEmail,
  ] = useState('');

  const [
    guestMessage,
    setGuestMessage,
  ] = useState('');

  const [
    bookingLoading,
    setBookingLoading,
  ] = useState(false);

  const [
    bookingError,
    setBookingError,
  ] = useState('');

  const [
    bookingSuccess,
    setBookingSuccess,
  ] = useState(null);

  /*
    Existing request for same
    guest/property/overlapping
    dates.

    This is what prevents
    duplicate booking rows and
    duplicate chat threads.
  */
  const [
    duplicateBooking,
    setDuplicateBooking,
  ] = useState(null);

  const [
    checkingDuplicate,
    setCheckingDuplicate,
  ] = useState(false);

  const [
    reminderLoading,
    setReminderLoading,
  ] = useState(false);

  const [
    reminderSuccess,
    setReminderSuccess,
  ] = useState('');

  useEffect(
    () => {
      checkGuestLogin();
    },
    []
  );

  useEffect(
    () => {
      if (slug) {
        loadProperty();
      }
    },
    [slug]
  );

  /*
    Whenever guest/property/dates
    change, check whether the guest
    already has a request covering
    these dates.
  */
  useEffect(
    () => {
      if (
        !property?.id ||
        !guestProfile?.id ||
        !checkIn ||
        !checkOut ||
        checkOut <= checkIn
      ) {
        setDuplicateBooking(
          null
        );

        return;
      }

      checkForExistingRequest(
        guestProfile.id,
        property.id,
        checkIn,
        checkOut
      );
    },
    [
      property?.id,
      guestProfile?.id,
      checkIn,
      checkOut,
    ]
  );

  async function checkGuestLogin() {
    setAuthChecking(true);

    try {
      const {
        data: {
          session:
            currentSession,
        },
      } =
        await supabase.auth.getSession();

      setSession(
        currentSession
      );

      if (
        !currentSession?.user
      ) {
        return;
      }

      const email =
        String(
          currentSession.user
            .email || ''
        )
          .trim()
          .toLowerCase();

      if (!email) {
        return;
      }

      /*
        Prefer user_id because
        guest auth is now linked
        directly to guests.
      */
      const {
        data:
          guestByUserId,
        error:
          guestByUserIdError,
      } =
        await supabase
          .from('guests')
          .select('*')
          .eq(
            'user_id',
            currentSession.user.id
          )
          .maybeSingle();

      if (
        guestByUserIdError
      ) {
        console.warn(
          guestByUserIdError
        );
      }

      let guest =
        guestByUserId ||
        null;

      /*
        Compatibility fallback for
        any older guest record that
        has not yet been linked.
      */
      if (!guest) {
        const {
          data:
            guestRows,
        } =
          await supabase
            .from('guests')
            .select('*')
            .eq(
              'email',
              email
            )
            .order(
              'created_at',
              {
                ascending:
                  true,
              }
            )
            .limit(1);

        guest =
          guestRows?.[0] ||
          null;
      }

      if (guest) {
        setGuestProfile(
          guest
        );

        setGuestName(
          guest.full_name ||
            ''
        );

        setGuestPhone(
          guest.phone ||
            ''
        );

        setGuestEmail(
          guest.email ||
            email
        );
      } else {
        setGuestName(
          currentSession.user
            .user_metadata
            ?.full_name ||
            ''
        );

        setGuestPhone(
          currentSession.user
            .user_metadata
            ?.phone ||
            ''
        );

        setGuestEmail(
          email
        );
      }
    } finally {
      setAuthChecking(
        false
      );
    }
  }

  async function loadProperty() {
    setLoading(true);
    setPageError('');

    try {
      const {
        data:
          propertyData,
        error:
          propertyError,
      } =
        await supabase
          .from('properties')
          .select('*')
          .eq(
            'slug',
            slug
          )
          .eq(
            'is_active',
            true
          )
          .single();

      if (
        propertyError ||
        !propertyData
      ) {
        throw new Error(
          'Property not found.'
        );
      }

      setProperty(
        propertyData
      );

      setGuestCount(
        Math.max(
          Number(
            propertyData.min_guests ||
              1
          ),
          1
        )
      );

      const [
        photoResult,
        offerResult,
        pricingResult,
        overrideResult,
        blockedResult,
        bookingResult,
      ] =
        await Promise.all([
          supabase
            .from(
              'property_photos'
            )
            .select('*')
            .eq(
              'property_id',
              propertyData.id
            )
            .order(
              'is_cover',
              {
                ascending:
                  false,
              }
            )
            .order(
              'sort_order',
              {
                ascending:
                  true,
              }
            ),

          supabase
            .from(
              'property_offers'
            )
            .select('*')
            .eq(
              'property_id',
              propertyData.id
            )
            .eq(
              'is_active',
              true
            ),

          supabase
            .from(
              'pricing_rules'
            )
            .select('*')
            .eq(
              'property_id',
              propertyData.id
            )
            .eq(
              'is_active',
              true
            ),

          supabase
            .from(
              'property_rate_overrides'
            )
            .select('*')
            .eq(
              'property_id',
              propertyData.id
            )
            .eq(
              'is_active',
              true
            ),

          supabase
            .from(
              'blocked_dates'
            )
            .select(
              'start_date, end_date'
            )
            .eq(
              'property_id',
              propertyData.id
            ),

          /*
            Inventory is blocked only
            by successful paid booking.
          */
          supabase
            .from('bookings')
            .select(
              'check_in, check_out, booking_status, payment_status'
            )
            .eq(
              'property_id',
              propertyData.id
            )
            .eq(
              'payment_status',
              'paid'
            ),
        ]);

      setPhotos(
        (
          photoResult.data ||
          []
        ).filter(
          (photo) =>
            photo.image_url
        )
      );

      setPropertyOffers(
        offerResult.data ||
          []
      );

      setRateOverrides(
        overrideResult.data ||
          []
      );

      setBlockedDates(
        blockedResult.data ||
          []
      );

      setExistingBookings(
        bookingResult.data ||
          []
      );

      setPricingRules(
        (
          pricingResult.data ||
          []
        ).map(
          (rule) => ({
            ...rule,

            type:
              rule.rule_type,

            percent:
              rule.adjustment_type ===
              'percent'
                ? Number(
                    rule.adjustment_value ||
                      0
                  )
                : undefined,

            value:
              Number(
                rule.adjustment_value ||
                  0
              ),

            label:
              rule.name,

            adjustmentType:
              rule.adjustment_type,
          })
        )
      );
    } catch (error) {
      console.error(
        error
      );

      setPageError(
        error.message
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  const availableOffers =
    useMemo(
      () => {
        if (
          !checkIn ||
          !checkOut
        ) {
          return [];
        }

        const nights =
          getStayDates(
            checkIn,
            checkOut
          ).length;

        return propertyOffers.filter(
          (offer) =>
            offerEligibleForBooking(
              offer,
              checkIn,
              checkOut,
              nights
            )
        );
      },
      [
        propertyOffers,
        checkIn,
        checkOut,
      ]
    );

  useEffect(
    () => {
      if (
        selectedOfferId &&
        !availableOffers.some(
          (offer) =>
            offer.id ===
            selectedOfferId
        )
      ) {
        setSelectedOfferId(
          ''
        );
      }
    },
    [
      selectedOfferId,
      availableOffers,
    ]
  );

  const selectedOffer =
    useMemo(
      () =>
        availableOffers.find(
          (offer) =>
            offer.id ===
            selectedOfferId
        ) || null,
      [
        availableOffers,
        selectedOfferId,
      ]
    );

  const pricing =
    useMemo(
      () => {
        if (
          !property ||
          !checkIn ||
          !checkOut
        ) {
          return {
            valid: false,
          };
        }

        try {
          const basePricing =
            calculateBookingPrice({
              property,

              guestCount:
                Number(
                  guestCount ||
                    1
                ),

              checkIn,

              checkOut,

              pricingRules,

              rateOverrides,

              gstRate: 0,
            });

          return buildFinalPricing({
            basePricing,
            offer:
              selectedOffer,
            checkIn,
            checkOut,
            property,
          });
        } catch (error) {
          console.error(
            error
          );

          return {
            valid: false,

            error:
              error.message ||
              'Unable to calculate booking price.',
          };
        }
      },
      [
        property,
        checkIn,
        checkOut,
        guestCount,
        pricingRules,
        rateOverrides,
        selectedOffer,
      ]
    );

  function datesUnavailable(
    start,
    end
  ) {
    if (
      !start ||
      !end
    ) {
      return false;
    }

    const blocked =
      blockedDates.some(
        (block) =>
          rangesOverlap(
            start,
            end,
            block.start_date,
            addDays(
              block.end_date,
              1
            )
          )
      );

    if (blocked) {
      return true;
    }

    return existingBookings.some(
      (booking) =>
        rangesOverlap(
          start,
          end,
          booking.check_in,
          booking.check_out
        )
    );
  }

  const selectedDatesUnavailable =
    useMemo(
      () =>
        datesUnavailable(
          checkIn,
          checkOut
        ),
      [
        checkIn,
        checkOut,
        blockedDates,
        existingBookings,
      ]
    );

  function redirectToLogin() {
    const returnUrl =
      window.location.pathname +
      window.location.search;

    window.location.href =
      `/login?redirect=${encodeURIComponent(
        returnUrl
      )}`;
  }

  /*
    ==================================================
    DUPLICATE REQUEST PROTECTION
    ==================================================

    Same guest + same property +
    overlapping stay dates cannot
    create multiple active booking
    requests.

    We intentionally look at all
    non-cancelled records for the
    guest/property and perform the
    overlap test here.
  */
  async function checkForExistingRequest(
    guestId,
    propertyId,
    requestedCheckIn,
    requestedCheckOut
  ) {
    if (
      !guestId ||
      !propertyId ||
      !requestedCheckIn ||
      !requestedCheckOut
    ) {
      setDuplicateBooking(
        null
      );

      return null;
    }

    setCheckingDuplicate(
      true
    );

    try {
      const {
        data,
        error,
      } =
        await supabase
          .from('bookings')
          .select(`
            id,
            booking_code,
            property_id,
            guest_id,
            check_in,
            check_out,
            booking_status,
            payment_status,
            host_decision,
            host_decided_at,
            created_at,
            updated_at,
            offer_status
          `)
          .eq(
            'guest_id',
            guestId
          )
          .eq(
            'property_id',
            propertyId
          )
          .order(
            'created_at',
            {
              ascending:
                false,
            }
          );

      if (error) {
        throw error;
      }

      const matching =
        (data || []).find(
          (booking) => {
            const status =
              String(
                booking.booking_status ||
                  ''
              ).toLowerCase();

            /*
              Cancelled or expired
              requests may be replaced
              with a new request.

              Declined requests remain
              closed and are not treated
              as an active duplicate.
            */
            if (
              status ===
                'cancelled' ||
              status ===
                'declined' ||
              status ===
                'completed'
            ) {
              return false;
            }

            return rangesOverlap(
              requestedCheckIn,
              requestedCheckOut,
              booking.check_in,
              booking.check_out
            );
          }
        ) || null;

      setDuplicateBooking(
        matching
      );

      return matching;
    } catch (error) {
      console.error(
        'Duplicate booking check:',
        error
      );

      /*
        Do not silently create another
        request when duplicate checking
        itself fails.
      */
      throw new Error(
        'Unable to verify your existing booking requests. Please try again.'
      );
    } finally {
      setCheckingDuplicate(
        false
      );
    }
  }

  async function ensureGuestProfile() {
    if (
      !session?.user
    ) {
      throw new Error(
        'Please login first.'
      );
    }

    const name =
      String(
        guestName || ''
      ).trim();

    const email =
      String(
        guestEmail || ''
      )
        .trim()
        .toLowerCase();

    const phone =
      cleanPhone(
        guestPhone
      );

    if (!name) {
      throw new Error(
        'Please enter your full name.'
      );
    }

    if (
      phone.length < 10
    ) {
      throw new Error(
        'Please enter a valid mobile number.'
      );
    }

    if (
      !isValidEmail(
        email
      )
    ) {
      throw new Error(
        'Please enter a valid email.'
      );
    }

    let guest =
      guestProfile;

    /*
      Always prefer auth user_id.
    */
    if (!guest?.id) {
      const {
        data:
          userGuest,
        error:
          userGuestError,
      } =
        await supabase
          .from('guests')
          .select('*')
          .eq(
            'user_id',
            session.user.id
          )
          .maybeSingle();

      if (
        userGuestError
      ) {
        throw userGuestError;
      }

      guest =
        userGuest ||
        null;
    }

    /*
      Fallback for old profile.
    */
    if (!guest?.id) {
      const {
        data:
          rows,
        error,
      } =
        await supabase
          .from('guests')
          .select('*')
          .eq(
            'email',
            email
          )
          .order(
            'created_at',
            {
              ascending:
                true,
            }
          )
          .limit(1);

      if (error) {
        throw error;
      }

      guest =
        rows?.[0] ||
        null;
    }

    if (guest?.id) {
      const {
        data:
          updated,
        error,
      } =
        await supabase
          .from('guests')
          .update({
            full_name:
              name,

            phone,

            email,

            /*
              Make sure an older guest
              profile is linked to the
              logged-in auth account.
            */
            user_id:
              session.user.id,
          })
          .eq(
            'id',
            guest.id
          )
          .select('*')
          .single();

      if (error) {
        throw error;
      }

      setGuestProfile(
        updated
      );

      return updated;
    }

    const {
      data:
        created,
      error,
    } =
      await supabase
        .from('guests')
        .insert({
          user_id:
            session.user.id,

          full_name:
            name,

          phone,

          email,
        })
        .select('*')
        .single();

    if (error) {
      throw error;
    }

    setGuestProfile(
      created
    );

    return created;
  }

  /*
    ==================================================
    REMIND HOST
    ==================================================

    This does NOT create another
    booking.

    It adds a normal message to the
    SAME booking conversation.
  */
  async function remindHost() {
    if (
      !duplicateBooking?.id ||
      !guestProfile?.id
    ) {
      return;
    }

    const hostDecision =
      String(
        duplicateBooking.host_decision ||
          'pending'
      ).toLowerCase();

    const bookingStatus =
      String(
        duplicateBooking.booking_status ||
          ''
      ).toLowerCase();

    if (
      hostDecision !==
        'pending' ||
      bookingStatus !==
        'pending'
    ) {
      setBookingError(
        'The host has already responded to this booking request. Please continue from Messages.'
      );

      return;
    }

    const deadline =
      getHostResponseDeadline(
        duplicateBooking
      );

    if (
      deadline &&
      deadline.getTime() <=
        Date.now()
    ) {
      setBookingError(
        'The host response period has expired. This request must be closed before a new request can be submitted.'
      );

      return;
    }

    setReminderLoading(
      true
    );

    setReminderSuccess('');
    setBookingError('');

    try {
      /*
        Avoid accidental rapid duplicate
        reminders. Check the latest
        messages first.
      */
      const {
        data:
          latestMessages,
        error:
          latestError,
      } =
        await supabase
          .from(
            'booking_messages'
          )
          .select(
            'id, sender_type, message, created_at'
          )
          .eq(
            'booking_id',
            duplicateBooking.id
          )
          .order(
            'created_at',
            {
              ascending:
                false,
            }
          )
          .limit(1);

      if (latestError) {
        throw latestError;
      }

      const latest =
        latestMessages?.[0];

      if (
        latest &&
        latest.sender_type ===
          'guest' &&
        String(
          latest.message || ''
        ).includes(
          'Reminder: Please respond to my booking request.'
        )
      ) {
        const lastTime =
          new Date(
            latest.created_at
          ).getTime();

        /*
          Keep reminders sensible:
          one reminder at most every
          60 minutes.
        */
        if (
          Date.now() -
            lastTime <
          60 * 60 * 1000
        ) {
          throw new Error(
            'A reminder was already sent recently. Please allow the host some time to respond.'
          );
        }
      }

      const {
        error:
          reminderError,
      } =
        await supabase
          .from(
            'booking_messages'
          )
          .insert({
            booking_id:
              duplicateBooking.id,

            sender_type:
              'guest',

            sender_name:
              guestProfile.full_name ||
              guestName ||
              'Guest',

            message:
              'Reminder: Please respond to my booking request.',

            message_type:
              'message',

            is_read:
              false,
          });

      if (reminderError) {
        throw reminderError;
      }

      setReminderSuccess(
        'Reminder sent to host in the existing conversation.'
      );
    } catch (error) {
      console.error(
        error
      );

      setBookingError(
        error.message ||
          'Unable to send reminder.'
      );
    } finally {
      setReminderLoading(
        false
      );
    }
  }

  async function submitBookingRequest(
    event
  ) {
    event.preventDefault();

    setBookingError('');
    setBookingSuccess(null);
    setReminderSuccess('');

    if (authChecking) {
      return;
    }

    if (
      !session?.user
    ) {
      redirectToLogin();
      return;
    }

    if (
      !guestName.trim()
    ) {
      setBookingError(
        'Full Name is required.'
      );

      return;
    }

    if (
      cleanPhone(
        guestPhone
      ).length < 10
    ) {
      setBookingError(
        'Valid mobile number is required.'
      );

      return;
    }

    if (
      !isValidEmail(
        guestEmail
      )
    ) {
      setBookingError(
        'Valid email is required.'
      );

      return;
    }

    if (
      !checkIn ||
      !checkOut
    ) {
      setBookingError(
        'Select check-in and check-out dates.'
      );

      return;
    }

    if (
      checkOut <=
      checkIn
    ) {
      setBookingError(
        'Check-out must be after check-in.'
      );

      return;
    }

    if (
      selectedDatesUnavailable
    ) {
      setBookingError(
        'Selected dates are unavailable.'
      );

      return;
    }

    if (
      !pricing?.valid
    ) {
      setBookingError(
        pricing?.error ||
          'Unable to calculate price.'
      );

      return;
    }

    setBookingLoading(
      true
    );

    try {
      const guest =
        await ensureGuestProfile();

      /*
        CRITICAL:

        Re-check duplicates immediately
        before INSERT.

        We do not rely only on the UI
        check because the guest could
        click quickly or have another
        browser tab open.
      */
      const existingRequest =
        await checkForExistingRequest(
          guest.id,
          property.id,
          checkIn,
          checkOut
        );

      if (
        existingRequest
      ) {
        setDuplicateBooking(
          existingRequest
        );

        const hostDecision =
          String(
            existingRequest.host_decision ||
              'pending'
          ).toLowerCase();

        if (
          hostDecision ===
          'pending'
        ) {
          throw new Error(
            'You already have an active request for this property and these dates. Please use Remind Host instead of creating another request.'
          );
        }

        throw new Error(
          'You already have a booking request for this property and these dates. Please continue from the existing conversation.'
        );
      }

      const bookingNights =
        Math.max(
          Number(
            pricing.nights ||
              getStayDates(
                checkIn,
                checkOut
              ).length ||
              1
          ),
          1
        );

      const averageNightlyRate =
        roundMoney(
          Number(
            pricing.discountedStaySubtotal ||
              pricing.staySubtotal ||
              0
          ) /
            bookingNights
        );

      const finalAmount =
        Number(
          pricing.totalPayable ||
            0
        );

      const bookingPayload = {
        property_id:
          property.id,

        guest_id:
          guest.id,

        check_in:
          checkIn,

        check_out:
          checkOut,

        guests_count:
          Number(
            guestCount
          ),

        nights:
          bookingNights,

        nightly_rate:
          averageNightlyRate,

        cleaning_fee:
          Number(
            pricing.cleaningFee ||
              0
          ),

        security_deposit:
          Number(
            pricing.securityDeposit ||
              0
          ),

        total_amount:
          finalAmount,

        booking_status:
          'pending',

        payment_status:
          'unpaid',

        notes:
          guestMessage.trim() ||
          null,

        base_amount:
          Number(
            pricing.staySubtotal ||
              0
          ),

        auto_discount_amount:
          Number(
            pricing.regularDiscountAmount ||
              0
          ),

        host_discount_amount:
          0,

        final_payable_amount:
          finalAmount,

        offer_note:
          null,

        offer_status:
          selectedOffer
            ? 'auto_applied'
            : 'none',

        host_decision:
          'pending',

        guest_discount_requested:
          false,

        verification_status:
          'not_required',

        taxable_amount:
          Number(
            pricing.taxableAmount ||
              0
          ),

        gst_rate:
          Number(
            pricing.gstRate ||
              0
          ),

        gst_amount:
          Number(
            pricing.gstAmount ||
              0
          ),

        amount_including_gst:
          finalAmount,

        property_offer_id:
          selectedOffer?.id ||
          null,
      };

      const {
        data:
          createdBooking,
        error:
          createdBookingError,
      } =
        await supabase
          .from('bookings')
          .insert(
            bookingPayload
          )
          .select('*')
          .single();

      if (
        createdBookingError
      ) {
        throw createdBookingError;
      }

      const initialMessage =
        guestMessage.trim()
          ? guestMessage.trim()
          : 'Booking request received';

      const {
        error:
          messageError,
      } =
        await supabase
          .from(
            'booking_messages'
          )
          .insert({
            booking_id:
              createdBooking.id,

            sender_type:
              'guest',

            sender_name:
              guest.full_name ||
              'Guest',

            message:
              initialMessage,

            message_type:
              'booking_request',

            is_read:
              false,
          });

      if (messageError) {
        console.warn(
          messageError
        );
      }

      /*
        Add a system message so both
        sides clearly understand the
        host's response deadline.
      */
      const hostDeadline =
        getHostResponseDeadline(
          createdBooking
        );

      if (hostDeadline) {
        const {
          error:
            deadlineMessageError,
        } =
          await supabase
            .from(
              'booking_messages'
            )
            .insert({
              booking_id:
                createdBooking.id,

              sender_type:
                'system',

              sender_name:
                'NightOutStays',

              message:
                `Host has 24 hours to approve or decline this booking request. Response deadline: ${formatDateTime(
                  hostDeadline
                )}.`,

              message_type:
                'system',

              is_read:
                false,
            });

        if (
          deadlineMessageError
        ) {
          console.warn(
            deadlineMessageError
          );
        }
      }

      setBookingSuccess(
        createdBooking
      );

      setDuplicateBooking(
        createdBooking
      );

      setGuestMessage('');
    } catch (error) {
      console.error(
        error
      );

      setBookingError(
        error.message ||
          'Unable to send booking request.'
      );
    } finally {
      setBookingLoading(
        false
      );
    }
  }

  if (loading) {
    return (
      <main
        style={
          styles.page
        }
      >
        <div
          style={
            styles.center
          }
        >
          Loading property...
        </div>
      </main>
    );
  }

  if (
    pageError ||
    !property
  ) {
    return (
      <main
        style={
          styles.page
        }
      >
        <div
          style={
            styles.center
          }
        >
          <h2>
            Property unavailable
          </h2>

          <p>
            {pageError}
          </p>
        </div>
      </main>
    );
  }

  const coverPhoto =
    photos[
      activePhoto
    ] ||
    photos[0] ||
    null;

  const duplicateHostDecision =
    String(
      duplicateBooking?.host_decision ||
        'pending'
    ).toLowerCase();

  const duplicateBookingStatus =
    String(
      duplicateBooking?.booking_status ||
        ''
    ).toLowerCase();

  const duplicateDeadline =
    duplicateBooking
      ? getHostResponseDeadline(
          duplicateBooking
        )
      : null;

  const canRemindHost =
    Boolean(
      duplicateBooking &&
      duplicateHostDecision ===
        'pending' &&
      duplicateBookingStatus ===
        'pending' &&
      (
        !duplicateDeadline ||
        duplicateDeadline.getTime() >
          Date.now()
      )
    );

  return (
    <main
      style={
        styles.page
      }
    >
      <header
        style={
          styles.header
        }
      >
        <a
          href="/"
          style={
            styles.logo
          }
        >
          NightOutStays
        </a>

        <div
          style={
            styles.headerLinks
          }
        >
          {session ? (
            <>
              <a
                href="/account/bookings"
                style={
                  styles.headerLink
                }
              >
                My Bookings
              </a>

              <a
                href="/account/messages"
                style={
                  styles.headerLink
                }
              >
                Messages
              </a>
            </>
          ) : (
            <button
              type="button"
              onClick={
                redirectToLogin
              }
              style={
                styles.loginButton
              }
            >
              Guest Login
            </button>
          )}
        </div>
      </header>

      <div
        style={
          styles.container
        }
      >
        <div
          style={
            styles.titleRow
          }
        >
          <div>
            <h1>
              {property.name}
            </h1>

            <div
              style={
                styles.muted
              }
            >
              {
                property.location_name
              }
            </div>
          </div>

          <strong
            style={
              styles.topPrice
            }
          >
            {money(
              property.base_price
            )}
            /night
          </strong>
        </div>

        <div
          style={
            styles.mainPhotoBox
          }
        >
          {coverPhoto ? (
            <img
              src={
                coverPhoto.image_url
              }
              alt={
                coverPhoto.alt_text ||
                property.name
              }
              style={
                styles.mainPhoto
              }
            />
          ) : (
            <div
              style={
                styles.center
              }
            >
              No photo
            </div>
          )}
        </div>

        {photos.length >
          1 && (
          <div
            style={
              styles.thumbnailRow
            }
          >
            {photos.map(
              (
                photo,
                index
              ) => (
                <button
                  key={
                    photo.id
                  }
                  type="button"
                  onClick={() =>
                    setActivePhoto(
                      index
                    )
                  }
                  style={{
                    ...styles.thumbnailButton,

                    ...(activePhoto ===
                    index
                      ? styles.thumbnailActive
                      : {}),
                  }}
                >
                  <img
                    src={
                      photo.image_url
                    }
                    alt={
                      photo.alt_text ||
                      ''
                    }
                    style={
                      styles.thumbnail
                    }
                  />
                </button>
              )
            )}
          </div>
        )}

        <div
          style={
            styles.contentGrid
          }
        >
          <div>
            <Section
              title="Amenities"
            >
              {Array.isArray(
                property.amenities
              )
                ? property.amenities.join(
                    ' • '
                  )
                : property.amenities ||
                  '—'}
            </Section>

            <Section
              title="House rules"
            >
              {Array.isArray(
                property.house_rules
              )
                ? property.house_rules.join(
                    ' • '
                  )
                : property.house_rules ||
                  '—'}
            </Section>

            <Section
              title="Availability"
            >
              <p
                style={
                  styles.muted
                }
              >
                Dates are blocked after successful payment. Booking requests do not block inventory.
              </p>

              <GuestAvailabilityCalendar
                property={
                  property
                }
                pricingRules={
                  pricingRules
                }
                rateOverrides={
                  rateOverrides
                }
                blockedDates={
                  blockedDates
                }
                existingBookings={
                  existingBookings
                }
                guestCount={
                  guestCount
                }
                checkIn={
                  checkIn
                }
                checkOut={
                  checkOut
                }
                onCheckInChange={
                  setCheckIn
                }
                onCheckOutChange={
                  setCheckOut
                }
              />
            </Section>
          </div>

          <aside
            style={
              styles.bookingColumn
            }
          >
            <form
              onSubmit={
                submitBookingRequest
              }
              style={
                styles.bookingCard
              }
            >
              <div
                style={
                  styles.bookingPrice
                }
              >
                {money(
                  property.base_price
                )}

                <span>
                  {' '}
                  / night
                </span>
              </div>

              <div
                style={
                  styles.formGrid
                }
              >
                <label
                  style={
                    styles.label
                  }
                >
                  CHECK-IN

                  <input
                    type="date"
                    value={
                      checkIn
                    }
                    min={
                      todayString()
                    }
                    onChange={(
                      event
                    ) => {
                      setCheckIn(
                        event.target.value
                      );

                      setBookingError('');
                      setBookingSuccess(null);
                      setReminderSuccess('');
                    }}
                    style={
                      styles.input
                    }
                  />
                </label>

                <label
                  style={
                    styles.label
                  }
                >
                  CHECK-OUT

                  <input
                    type="date"
                    value={
                      checkOut
                    }
                    min={
                      checkIn
                        ? addDays(
                            checkIn,
                            1
                          )
                        : todayString()
                    }
                    onChange={(
                      event
                    ) => {
                      setCheckOut(
                        event.target.value
                      );

                      setBookingError('');
                      setBookingSuccess(null);
                      setReminderSuccess('');
                    }}
                    style={
                      styles.input
                    }
                  />
                </label>
              </div>

              <label
                style={
                  styles.label
                }
              >
                GUESTS

                <select
                  value={
                    guestCount
                  }
                  onChange={(
                    event
                  ) => {
                    setGuestCount(
                      Number(
                        event.target.value
                      )
                    );

                    setBookingError('');
                    setBookingSuccess(null);
                  }}
                  style={
                    styles.input
                  }
                >
                  {Array.from(
                    {
                      length:
                        Math.max(
                          Number(
                            property.max_guests ||
                              1
                          ) -
                            Math.max(
                              Number(
                                property.min_guests ||
                                  1
                              ),
                              1
                            ) +
                            1,
                          1
                        ),
                    },
                    (
                      _,
                      index
                    ) =>
                      Math.max(
                        Number(
                          property.min_guests ||
                            1
                        ),
                        1
                      ) +
                      index
                  ).map(
                    (
                      count
                    ) => (
                      <option
                        key={
                          count
                        }
                        value={
                          count
                        }
                      >
                        {count}{' '}
                        {count === 1
                          ? 'guest'
                          : 'guests'}
                      </option>
                    )
                  )}
                </select>
              </label>

              {checkIn &&
                checkOut &&
                selectedDatesUnavailable && (
                  <div
                    style={
                      styles.errorBox
                    }
                  >
                    These dates are already booked or blocked.
                  </div>
                )}

              {checkIn &&
                checkOut &&
                !selectedDatesUnavailable && (
                  <div
                    style={
                      styles.availableBox
                    }
                  >
                    Dates are currently available.
                  </div>
                )}

              {checkingDuplicate && (
                <div
                  style={
                    styles.checkingBox
                  }
                >
                  Checking your existing requests...
                </div>
              )}

              {duplicateBooking && (
                <div
                  style={
                    styles.existingRequestBox
                  }
                >
                  <strong>
                    You already have a request for these dates.
                  </strong>

                  {duplicateBooking.booking_code && (
                    <div>
                      Booking ID:{' '}
                      <strong>
                        {
                          duplicateBooking.booking_code
                        }
                      </strong>
                    </div>
                  )}

                  {duplicateHostDecision ===
                    'pending' ? (
                    <>
                      <div>
                        Waiting for host response.
                      </div>

                      {duplicateDeadline && (
                        <div>
                          Host response deadline:{' '}
                          <strong>
                            {formatDateTime(
                              duplicateDeadline
                            )}
                          </strong>
                        </div>
                      )}

                      <div
                        style={
                          styles.existingRequestActions
                        }
                      >
                        {canRemindHost && (
                          <button
                            type="button"
                            onClick={
                              remindHost
                            }
                            disabled={
                              reminderLoading
                            }
                            style={{
                              ...styles.remindButton,

                              ...(reminderLoading
                                ? styles.disabledButton
                                : {}),
                            }}
                          >
                            {reminderLoading
                              ? 'Sending Reminder...'
                              : 'Remind Host'}
                          </button>
                        )}

                        <a
                          href="/account/messages"
                          style={
                            styles.openMessagesButton
                          }
                        >
                          Open Messages
                        </a>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        The host has already responded to this request.
                      </div>

                      <a
                        href="/account/messages"
                        style={
                          styles.openMessagesButton
                        }
                      >
                        Continue in Messages
                      </a>
                    </>
                  )}
                </div>
              )}

              {reminderSuccess && (
                <div
                  style={
                    styles.successBox
                  }
                >
                  {reminderSuccess}
                </div>
              )}

              {checkIn &&
                checkOut &&
                availableOffers.length >
                  0 && (
                  <div
                    style={
                      styles.discountBox
                    }
                  >
                    <label
                      style={
                        styles.label
                      }
                    >
                      AVAILABLE DISCOUNT

                      <select
                        value={
                          selectedOfferId
                        }
                        onChange={(
                          event
                        ) => {
                          setSelectedOfferId(
                            event.target.value
                          );

                          setBookingError('');
                          setBookingSuccess(null);
                        }}
                        style={
                          styles.input
                        }
                      >
                        <option value="">
                          No discount
                        </option>

                        {availableOffers.map(
                          (
                            offer
                          ) => (
                            <option
                              key={
                                offer.id
                              }
                              value={
                                offer.id
                              }
                            >
                              {offer.title ||
                                offer.name ||
                                'Offer'}

                              {' — '}

                              {offer.discount_type ===
                              'percent'
                                ? `${Number(
                                    offer.discount_value ||
                                      0
                                  )}% OFF`
                                : `${money(
                                    offer.discount_value
                                  )} OFF`}
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    {selectedOffer && (
                      <div
                        style={
                          styles.offerDescription
                        }
                      >
                        <strong>
                          {selectedOffer.title ||
                            selectedOffer.name ||
                            'Offer'}
                        </strong>

                        <br />

                        {selectedOffer.discount_type ===
                        'percent'
                          ? `${Number(
                              selectedOffer.discount_value ||
                                0
                            )}% discount`
                          : `${money(
                              selectedOffer.discount_value
                            )} discount`}
                      </div>
                    )}
                  </div>
                )}

              {pricing?.valid && (
                <div
                  style={
                    styles.priceSummary
                  }
                >
                  <PriceRow
                    label={`Stay (${
                      pricing.nights ||
                      getStayDates(
                        checkIn,
                        checkOut
                      ).length
                    } night${
                      Number(
                        pricing.nights ||
                          getStayDates(
                            checkIn,
                            checkOut
                          ).length
                      ) === 1
                        ? ''
                        : 's'
                    })`}
                    value={
                      money(
                        pricing.staySubtotal ||
                          0
                      )
                    }
                  />

                  {Number(
                    pricing.extraGuestCharge ||
                      0
                  ) > 0 && (
                    <PriceRow
                      label="Extra guest charge"
                      value={
                        money(
                          pricing.extraGuestCharge
                        )
                      }
                    />
                  )}

                  {Number(
                    pricing.cleaningFee ||
                      0
                  ) > 0 && (
                    <PriceRow
                      label="Cleaning fee"
                      value={
                        money(
                          pricing.cleaningFee
                        )
                      }
                    />
                  )}

                  {Number(
                    pricing.regularDiscountAmount ||
                      0
                  ) > 0 && (
                    <PriceRow
                      label={
                        selectedOffer?.title ||
                        selectedOffer?.name ||
                        'Discount'
                      }
                      value={`-${money(
                        pricing.regularDiscountAmount
                      )}`}
                      discount
                    />
                  )}

                  <PriceRow
                    label="Taxable amount"
                    value={
                      money(
                        pricing.taxableAmount ||
                          0
                      )
                    }
                  />

                  {Array.isArray(
                    pricing.nightlyTaxBreakdown
                  ) &&
                    pricing.nightlyTaxBreakdown.length >
                      0 && (
                      <div
                        style={
                          styles.gstBreakdown
                        }
                      >
                        <div
                          style={
                            styles.gstTitle
                          }
                        >
                          GST by night
                        </div>

                        {pricing.nightlyTaxBreakdown.map(
                          (
                            item,
                            index
                          ) => (
                            <div
                              key={`${item.date}-${index}`}
                              style={
                                styles.gstNightRow
                              }
                            >
                              <span>
                                {item.date}
                              </span>

                              <span>
                                {money(
                                  item.effectiveRate
                                )}
                                {' @ '}
                                {item.gstRate}%
                              </span>

                              <span>
                                {money(
                                  item.gst
                                )}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    )}

                  <PriceRow
                    label={
                      pricing.gstRate > 0
                        ? `GST (${pricing.gstRate}%)`
                        : 'GST'
                    }
                    value={
                      money(
                        pricing.gstAmount ||
                          0
                      )
                    }
                  />

                  {Number(
                    pricing.securityDeposit ||
                      0
                  ) > 0 && (
                    <PriceRow
                      label="Security deposit"
                      value={
                        money(
                          pricing.securityDeposit
                        )
                      }
                    />
                  )}

                  <div
                    style={
                      styles.totalRow
                    }
                  >
                    <strong>
                      Total
                    </strong>

                    <strong>
                      {money(
                        pricing.totalPayable ||
                          0
                      )}
                    </strong>
                  </div>

                  <div
                    style={
                      styles.taxRule
                    }
                  >
                    GST is calculated per night. Effective nightly rate below ₹7,000 attracts 5% GST. ₹7,000 and above attracts 18% GST.
                  </div>
                </div>
              )}
              <label
                style={
                  styles.label
                }
              >
                FULL NAME *

                <input
                  type="text"
                  value={
                    guestName
                  }
                  onChange={(
                    event
                  ) => {
                    setGuestName(
                      event.target.value
                    );

                    setBookingError('');
                  }}
                  required
                  autoComplete="name"
                  placeholder="Full name"
                  style={
                    styles.input
                  }
                />
              </label>

              <label
                style={
                  styles.label
                }
              >
                PHONE *

                <input
                  type="tel"
                  value={
                    guestPhone
                  }
                  onChange={(
                    event
                  ) => {
                    setGuestPhone(
                      event.target.value
                    );

                    setBookingError('');
                  }}
                  required
                  autoComplete="tel"
                  placeholder="Mobile number"
                  style={
                    styles.input
                  }
                />
              </label>

              <label
                style={
                  styles.label
                }
              >
                EMAIL *

                <input
                  type="email"
                  value={
                    guestEmail
                  }
                  onChange={(
                    event
                  ) => {
                    setGuestEmail(
                      event.target.value
                    );

                    setBookingError('');
                  }}
                  required
                  autoComplete="email"
                  placeholder="Email address"
                  style={
                    styles.input
                  }
                />
              </label>

              <label
                style={
                  styles.label
                }
              >
                MESSAGE TO HOST

                <textarea
                  value={
                    guestMessage
                  }
                  onChange={(
                    event
                  ) =>
                    setGuestMessage(
                      event.target.value
                    )
                  }
                  placeholder="Tell the host anything important about your stay."
                  style={
                    styles.textarea
                  }
                />
              </label>

              <div
                style={
                  styles.requiredNote
                }
              >
                * Full Name, Phone and Email are required before a booking request can be sent.
              </div>

              {bookingError && (
                <div
                  style={
                    styles.errorBox
                  }
                >
                  {
                    bookingError
                  }
                </div>
              )}

              {bookingSuccess && (
                <div
                  style={
                    styles.successBox
                  }
                >
                  Booking request sent successfully.

                  {bookingSuccess.booking_code && (
                    <>
                      <br />

                      Booking ID:{' '}

                      <strong>
                        {
                          bookingSuccess.booking_code
                        }
                      </strong>
                    </>
                  )}

                  <br />

                  The host has 24 hours to approve or decline your request.

                  <br />

                  <a
                    href="/account/messages"
                    style={
                      styles.messageLink
                    }
                  >
                    Open Messages
                  </a>
                </div>
              )}

              {!session &&
                !authChecking && (
                  <div
                    style={
                      styles.loginNotice
                    }
                  >
                    Please login before sending a booking request.
                  </div>
                )}

              {/*
                IMPORTANT:

                Once an existing active
                request is detected we do
                not allow another submit.

                The guest gets Remind Host
                / Messages instead.
              */}

              {!duplicateBooking && (
                <button
                  type="submit"
                  disabled={
                    bookingLoading ||
                    checkingDuplicate ||
                    selectedDatesUnavailable ||
                    authChecking
                  }
                  style={{
                    ...styles.bookButton,

                    ...(bookingLoading ||
                    checkingDuplicate ||
                    selectedDatesUnavailable ||
                    authChecking
                      ? styles.disabledButton
                      : {}),
                  }}
                >
                  {authChecking
                    ? 'Checking account...'
                    : checkingDuplicate
                    ? 'Checking Existing Request...'
                    : bookingLoading
                    ? 'Sending Request...'
                    : session
                    ? 'Request Booking'
                    : 'Login to Request Booking'}
                </button>
              )}

              {duplicateBooking && (
                <div
                  style={
                    styles.duplicateSubmitNotice
                  }
                >
                  Another booking request will not be created for these dates.

                  {canRemindHost
                    ? ' Use Remind Host above if you want to follow up.'
                    : ' Continue from your existing booking conversation.'}
                </div>
              )}

              <div
                style={
                  styles.bookingNote
                }
              >
                Sending a booking request does not reserve the dates. Dates are blocked only after successful payment.
              </div>
            </form>
          </aside>
        </div>
      </div>
    </main>
  );
}

/* =========================
   SMALL COMPONENTS
========================= */

function Section({
  title,
  children,
}) {
  return (
    <section
      style={
        styles.section
      }
    >
      <h2
        style={
          styles.sectionTitle
        }
      >
        {title}
      </h2>

      <div
        style={
          styles.sectionContent
        }
      >
        {children}
      </div>
    </section>
  );
}

function PriceRow({
  label,
  value,
  discount = false,
}) {
  return (
    <div
      style={{
        ...styles.priceRow,

        ...(discount
          ? styles.discountRow
          : {}),
      }}
    >
      <span>
        {label}
      </span>

      <span>
        {value}
      </span>
    </div>
  );
}

/* =========================
   STYLES
========================= */

const styles = {
  page: {
    minHeight:
      '100vh',

    background:
      '#f6f7f9',

    color:
      '#0b2447',

    fontFamily:
      'Arial, sans-serif',
  },

  header: {
    minHeight:
      72,

    background:
      '#ffffff',

    borderBottom:
      '1px solid #e4e7ec',

    display:
      'flex',

    alignItems:
      'center',

    justifyContent:
      'space-between',

    gap:
      14,

    padding:
      '0 5%',

    position:
      'sticky',

    top:
      0,

    zIndex:
      50,

    flexWrap:
      'wrap',
  },

  logo: {
    fontSize:
      24,

    fontWeight:
      800,

    textDecoration:
      'none',

    color:
      '#174f91',
  },

  headerLinks: {
    display:
      'flex',

    alignItems:
      'center',

    gap:
      14,

    flexWrap:
      'wrap',
  },

  headerLink: {
    color:
      '#174f91',

    textDecoration:
      'none',

    fontWeight:
      700,

    fontSize:
      14,
  },

  loginButton: {
    border:
      0,

    background:
      '#174f91',

    color:
      '#ffffff',

    padding:
      '10px 15px',

    borderRadius:
      8,

    fontWeight:
      700,

    cursor:
      'pointer',
  },

  container: {
    width:
      '92%',

    maxWidth:
      1220,

    margin:
      '0 auto',

    padding:
      '28px 0 70px',
  },

  titleRow: {
    display:
      'flex',

    alignItems:
      'flex-end',

    justifyContent:
      'space-between',

    gap:
      20,

    flexWrap:
      'wrap',

    marginBottom:
      22,
  },

  topPrice: {
    fontSize:
      19,

    color:
      '#174f91',
  },

  muted: {
    color:
      '#667085',

    lineHeight:
      1.6,
  },

  mainPhotoBox: {
    width:
      '100%',

    height:
      'clamp(260px, 42vw, 500px)',

    background:
      '#e9edf2',

    borderRadius:
      18,

    overflow:
      'hidden',
  },

  mainPhoto: {
    width:
      '100%',

    height:
      '100%',

    objectFit:
      'cover',

    display:
      'block',
  },

  thumbnailRow: {
    display:
      'flex',

    gap:
      9,

    overflowX:
      'auto',

    marginTop:
      10,

    paddingBottom:
      4,
  },

  thumbnailButton: {
    width:
      105,

    height:
      72,

    flex:
      '0 0 auto',

    padding:
      0,

    border:
      '2px solid transparent',

    borderRadius:
      9,

    overflow:
      'hidden',

    background:
      '#ffffff',

    cursor:
      'pointer',
  },

  thumbnailActive: {
    border:
      '2px solid #174f91',
  },

  thumbnail: {
    width:
      '100%',

    height:
      '100%',

    objectFit:
      'cover',

    display:
      'block',
  },

  contentGrid: {
    display:
      'grid',

    gridTemplateColumns:
      'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',

    gap:
      26,

    alignItems:
      'start',

    marginTop:
      28,
  },

  section: {
    background:
      '#ffffff',

    border:
      '1px solid #e3e7ec',

    borderRadius:
      16,

    padding:
      20,

    marginBottom:
      18,
  },

  sectionTitle: {
    margin:
      '0 0 14px',

    fontSize:
      21,
  },

  sectionContent: {
    lineHeight:
      1.7,

    color:
      '#344054',

    minWidth:
      0,
  },

  bookingColumn: {
    position:
      'relative',

    minWidth:
      0,
  },

  bookingCard: {
    position:
      'sticky',

    top:
      92,

    background:
      '#ffffff',

    border:
      '1px solid #dfe3e8',

    borderRadius:
      18,

    padding:
      20,

    boxShadow:
      '0 12px 35px rgba(16,24,40,0.08)',

    display:
      'grid',

    gap:
      14,

    minWidth:
      0,
  },

  bookingPrice: {
    fontSize:
      26,

    fontWeight:
      800,

    color:
      '#174f91',
  },

  formGrid: {
    display:
      'grid',

    gridTemplateColumns:
      'repeat(auto-fit, minmax(130px, 1fr))',

    gap:
      10,
  },

  label: {
    display:
      'grid',

    gap:
      6,

    fontSize:
      11,

    fontWeight:
      800,

    letterSpacing:
      0.4,

    color:
      '#0b2447',

    minWidth:
      0,
  },

  input: {
    width:
      '100%',

    boxSizing:
      'border-box',

    border:
      '1px solid #cfd5dd',

    borderRadius:
      9,

    padding:
      '11px 12px',

    background:
      '#ffffff',

    color:
      '#101828',

    fontSize:
      14,

    outline:
      'none',
  },

  textarea: {
    width:
      '100%',

    minHeight:
      90,

    resize:
      'vertical',

    boxSizing:
      'border-box',

    border:
      '1px solid #cfd5dd',

    borderRadius:
      9,

    padding:
      '11px 12px',

    background:
      '#ffffff',

    color:
      '#101828',

    fontSize:
      14,

    fontFamily:
      'inherit',

    outline:
      'none',
  },

  requiredNote: {
    fontSize:
      11,

    color:
      '#667085',

    lineHeight:
      1.5,
  },

  availableBox: {
    background:
      '#ecfdf3',

    color:
      '#027a48',

    border:
      '1px solid #abefc6',

    padding:
      11,

    borderRadius:
      9,

    fontSize:
      13,

    fontWeight:
      700,
  },

  checkingBox: {
    background:
      '#f2f4f7',

    color:
      '#475467',

    border:
      '1px solid #d0d5dd',

    padding:
      11,

    borderRadius:
      9,

    fontSize:
      13,

    fontWeight:
      700,
  },

  existingRequestBox: {
    display:
      'grid',

    gap:
      9,

    padding:
      14,

    borderRadius:
      11,

    background:
      '#fff8e7',

    border:
      '1px solid #f3cf79',

    color:
      '#7a4b00',

    fontSize:
      13,

    lineHeight:
      1.5,
  },

  existingRequestActions: {
    display:
      'flex',

    gap:
      8,

    alignItems:
      'center',

    flexWrap:
      'wrap',

    marginTop:
      3,
  },

  remindButton: {
    border:
      0,

    borderRadius:
      8,

    padding:
      '10px 13px',

    background:
      '#174f91',

    color:
      '#ffffff',

    fontWeight:
      800,

    cursor:
      'pointer',

    fontSize:
      13,
  },

  openMessagesButton: {
    display:
      'inline-flex',

    alignItems:
      'center',

    justifyContent:
      'center',

    textDecoration:
      'none',

    border:
      '1px solid #174f91',

    borderRadius:
      8,

    padding:
      '9px 12px',

    background:
      '#ffffff',

    color:
      '#174f91',

    fontWeight:
      800,

    fontSize:
      13,
  },

  duplicateSubmitNotice: {
    background:
      '#f2f4f7',

    border:
      '1px solid #d0d5dd',

    borderRadius:
      9,

    padding:
      11,

    color:
      '#475467',

    fontSize:
      12,

    lineHeight:
      1.5,

    fontWeight:
      600,
  },

  discountBox: {
    background:
      '#f8fafc',

    border:
      '1px solid #e4e7ec',

    borderRadius:
      11,

    padding:
      12,

    display:
      'grid',

    gap:
      10,
  },

  offerDescription: {
    color:
      '#344054',

    fontSize:
      12,

    lineHeight:
      1.5,
  },

  priceSummary: {
    display:
      'grid',

    gap:
      9,

    borderTop:
      '1px solid #eaecf0',

    paddingTop:
      14,
  },

  priceRow: {
    display:
      'flex',

    justifyContent:
      'space-between',

    alignItems:
      'flex-start',

    gap:
      12,

    color:
      '#475467',

    fontSize:
      13,
  },

  discountRow: {
    color:
      '#027a48',

    fontWeight:
      700,
  },

  totalRow: {
    display:
      'flex',

    justifyContent:
      'space-between',

    gap:
      12,

    paddingTop:
      11,

    borderTop:
      '1px solid #d0d5dd',

    fontSize:
      18,

    color:
      '#101828',
  },

  gstBreakdown: {
    background:
      '#f8fafc',

    border:
      '1px solid #eaecf0',

    borderRadius:
      8,

    padding:
      9,

    display:
      'grid',

    gap:
      5,
  },

  gstTitle: {
    fontSize:
      11,

    fontWeight:
      800,

    color:
      '#344054',
  },

  gstNightRow: {
    display:
      'grid',

    gridTemplateColumns:
      '1fr auto auto',

    gap:
      8,

    alignItems:
      'center',

    color:
      '#667085',

    fontSize:
      10,
  },

  taxRule: {
    color:
      '#667085',

    fontSize:
      10,

    lineHeight:
      1.5,
  },

  errorBox: {
    background:
      '#fef3f2',

    border:
      '1px solid #fecdca',

    color:
      '#b42318',

    padding:
      11,

    borderRadius:
      9,

    fontSize:
      13,

    lineHeight:
      1.5,
  },

  successBox: {
    background:
      '#ecfdf3',

    border:
      '1px solid #abefc6',

    color:
      '#027a48',

    padding:
      11,

    borderRadius:
      9,

    fontSize:
      13,

    lineHeight:
      1.6,
  },

  loginNotice: {
    background:
      '#eff8ff',

    border:
      '1px solid #b2ddff',

    color:
      '#175cd3',

    padding:
      11,

    borderRadius:
      9,

    fontSize:
      12,

    lineHeight:
      1.5,
  },

  bookButton: {
    width:
      '100%',

    border:
      0,

    borderRadius:
      10,

    background:
      '#174f91',

    color:
      '#ffffff',

    padding:
      '14px 16px',

    fontSize:
      15,

    fontWeight:
      800,

    cursor:
      'pointer',
  },

  disabledButton: {
    opacity:
      0.55,

    cursor:
      'not-allowed',
  },

  bookingNote: {
    color:
      '#667085',

    fontSize:
      10,

    lineHeight:
      1.5,

    textAlign:
      'center',
  },

  messageLink: {
    color:
      '#027a48',

    fontWeight:
      800,

    textDecoration:
      'underline',
  },

  center: {
    minHeight:
      220,

    display:
      'flex',

    alignItems:
      'center',

    justifyContent:
      'center',

    flexDirection:
      'column',

    textAlign:
      'center',

    padding:
      24,
  },
};