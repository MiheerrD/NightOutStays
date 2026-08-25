'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { calculateBookingPrice } from '../../lib/pricing';
import GuestAvailabilityCalendar from './GuestAvailabilityCalendar';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function todayString() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function addDays(dateString, days) {
  if (!dateString) return '';

  const date = new Date(`${dateString}T12:00:00`);

  date.setDate(
    date.getDate() + days
  );

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
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

function formatTime(value) {
  if (!value) return '—';

  const [hour, minute] =
    String(value)
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

function dateDayNumber(
  dateString
) {
  return new Date(
    `${dateString}T12:00:00`
  ).getDay();
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

  let current =
    new Date(
      `${checkIn}T12:00:00`
    );

  const end =
    new Date(
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
    !offer.is_active ||
    offer.guest_selectable ===
      false
  ) {
    return false;
  }

  const offerCategory =
    String(
      offer.offer_category ||
        ''
    ).toLowerCase();

  const offerTitle =
    String(
      offer.title ||
        offer.name ||
        ''
    ).toLowerCase();

  let requiredNights =
    Number(
      offer.min_nights || 1
    );

  if (
    offerCategory ===
      'monthly' ||
    offerTitle.includes(
      'monthly'
    )
  ) {
    requiredNights =
      Math.max(
        requiredNights,
        20
      );
  } else if (
    offerCategory ===
      'fortnightly' ||
    offerTitle.includes(
      'fortnight'
    )
  ) {
    requiredNights =
      Math.max(
        requiredNights,
        12
      );
  } else if (
    offerCategory ===
      'weekly' ||
    offerTitle.includes(
      'weekly'
    )
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

  const startDate =
    offer.start_date ||
    null;

  const endDate =
    offer.end_date ||
    null;

  const allowedDays =
    Array.isArray(
      offer.applicable_days
    )
      ? offer.applicable_days
      : [];

  const eligibleDates =
    stayDates.filter(
      (date) => {
        if (
          startDate &&
          date < startDate
        ) {
          return false;
        }

        if (
          endDate &&
          date > endDate
        ) {
          return false;
        }

        if (
          allowedDays.length &&
          !allowedDays.includes(
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
    eligibleDates.length >
    0
  );
}

function calculateRegularDiscount(
  pricing,
  offer,
  checkIn,
  checkOut
) {
  if (
    !pricing?.valid ||
    !offer
  ) {
    return {
      discountAmount: 0,
      eligibleAmount: 0,
    };
  }

  const stayDates =
    getStayDates(
      checkIn,
      checkOut
    );

  const allowedDays =
    Array.isArray(
      offer.applicable_days
    )
      ? offer.applicable_days
      : [];

  const dateIsEligible =
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

      if (
        allowedDays.length &&
        !allowedDays.includes(
          dateDayNumber(
            date
          )
        )
      ) {
        return false;
      }

      return true;
    };

  let eligibleAmount = 0;

  if (
    offer.apply_scope ===
    'entire_booking'
  ) {
    eligibleAmount =
      Number(
        pricing.staySubtotal ||
          0
      );
  } else {
    const breakdown =
      Array.isArray(
        pricing.nightlyBreakdown
      )
        ? pricing.nightlyBreakdown
        : [];

    if (
      breakdown.length
    ) {
      breakdown.forEach(
        (night) => {
          if (
            dateIsEligible(
              night.date
            )
          ) {
            eligibleAmount +=
              Number(
                night.rate ||
                  0
              );
          }
        }
      );
    } else {
      const eligibleNightCount =
        stayDates.filter(
          dateIsEligible
        ).length;

      const averageNight =
        Number(
          pricing.staySubtotal ||
            0
        ) /
        Math.max(
          Number(
            pricing.nights ||
              1
          ),
          1
        );

      eligibleAmount =
        averageNight *
        eligibleNightCount;
    }
  }

  let discountAmount = 0;

  if (
    offer.discount_type ===
    'percent'
  ) {
    discountAmount =
      eligibleAmount *
      (
        Number(
          offer.discount_value ||
            0
        ) / 100
      );
  } else {
    discountAmount =
      Number(
        offer.discount_value ||
          0
      );
  }

  discountAmount =
    Math.max(
      0,
      Math.min(
        discountAmount,
        eligibleAmount
      )
    );

  return {
    eligibleAmount:
      Math.round(
        eligibleAmount *
          100
      ) / 100,

    discountAmount:
      Math.round(
        discountAmount *
          100
      ) / 100,
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
  ] =
    useState(null);

  const [
    photos,
    setPhotos,
  ] =
    useState([]);

  const [
    pricingRules,
    setPricingRules,
  ] =
    useState([]);

  const [
    rateOverrides,
    setRateOverrides,
  ] =
    useState([]);

  const [
    propertyOffers,
    setPropertyOffers,
  ] =
    useState([]);

  const [
    blockedDates,
    setBlockedDates,
  ] =
    useState([]);

  const [
    existingBookings,
    setExistingBookings,
  ] =
    useState([]);

  const [
    session,
    setSession,
  ] =
    useState(null);

  const [
    guestProfile,
    setGuestProfile,
  ] =
    useState(null);

  const [
    authChecking,
    setAuthChecking,
  ] =
    useState(true);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    pageError,
    setPageError,
  ] =
    useState('');

  const [
    activePhoto,
    setActivePhoto,
  ] =
    useState(0);

  const [
    checkIn,
    setCheckIn,
  ] =
    useState('');

  const [
    checkOut,
    setCheckOut,
  ] =
    useState('');

  const [
    guestCount,
    setGuestCount,
  ] =
    useState(1);

  const [
    selectedOfferId,
    setSelectedOfferId,
  ] =
    useState('');

  const [
    guestName,
    setGuestName,
  ] =
    useState('');

  const [
    guestPhone,
    setGuestPhone,
  ] =
    useState('');

  const [
    guestEmail,
    setGuestEmail,
  ] =
    useState('');

  const [
    guestMessage,
    setGuestMessage,
  ] =
    useState('');

  const [
    bookingLoading,
    setBookingLoading,
  ] =
    useState(false);

  const [
    bookingError,
    setBookingError,
  ] =
    useState('');

  const [
    bookingSuccess,
    setBookingSuccess,
  ] =
    useState(null);

  useEffect(() => {
    checkGuestLogin();
  }, []);

  useEffect(() => {
    if (slug) {
      loadProperty();
    }
  }, [slug]);

  async function checkGuestLogin() {
    setAuthChecking(
      true
    );

    try {
      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      setSession(
        session
      );

      if (
        !session?.user
      ) {
        return;
      }

      const authEmail =
        String(
          session.user.email ||
            ''
        )
          .trim()
          .toLowerCase();

      if (authEmail) {
        const {
          data:
            guestRows,
          error,
        } =
          await supabase
            .from(
              'guests'
            )
            .select('*')
            .eq(
              'email',
              authEmail
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
          console.error(
            'Guest lookup error:',
            error
          );
        }

        const guest =
          guestRows?.[0] ||
          null;

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
              authEmail
          );

          return;
        }
      }

      setGuestName(
        session.user
          .user_metadata
          ?.full_name ||
          ''
      );

      setGuestEmail(
        authEmail
      );
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
          .from(
            'properties'
          )
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
          'Property not found or currently unavailable.'
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
        rateOverrideResult,
        blockedResult,
        bookingResult,
      ] =
        await Promise.all([
          supabase
            .from(
              'property_photos'
            )
            .select(
              'id, property_id, image_url, alt_text, sort_order, is_cover'
            )
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
            )
            .order(
              'priority',
              {
                ascending:
                  false,
              }
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
            )
            .order(
              'start_date',
              {
                ascending:
                  true,
              }
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

          supabase
            .from(
              'bookings'
            )
            .select(
              'check_in, check_out, booking_status, payment_status'
            )
            .eq(
              'property_id',
              propertyData.id
            )
            .eq(
              'booking_status',
              'confirmed'
            )
            .eq(
              'payment_status',
              'paid'
            ),
        ]);

      if (
        photoResult.error
      ) {
        console.error(
          'Photo loading error:',
          photoResult.error
        );
      }

      setPhotos(
        (
          photoResult.data ||
          []
        ).filter(
          (photo) =>
            Boolean(
              photo.image_url
            )
        )
      );

      setPropertyOffers(
        offerResult.data ||
          []
      );

      setRateOverrides(
        rateOverrideResult.data ||
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

      const mappedRules =
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
        );

      setPricingRules(
        mappedRules
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

  useEffect(() => {
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
  }, [
    availableOffers,
    selectedOfferId,
  ]);

  const selectedOffer =
    useMemo(
      () =>
        availableOffers.find(
          (offer) =>
            offer.id ===
            selectedOfferId
        ) ||
        null,
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
          const result =
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

              gstRate: 18,
            });

          if (
            !result ||
            result.valid ===
              false
          ) {
            return (
              result || {
                valid: false,
              }
            );
          }

          let regularDiscount =
            {
              discountAmount:
                0,

              eligibleAmount:
                0,
            };

          if (
            selectedOffer
          ) {
            regularDiscount =
              calculateRegularDiscount(
                result,
                selectedOffer,
                checkIn,
                checkOut
              );
          }

          const discountAmount =
            Number(
              regularDiscount.discountAmount ||
                0
            );

          const subtotalBeforeDiscount =
            Number(
              result.amountBeforeDiscount ??
                result.staySubtotal ??
                0
            );

          const subtotalAfterDiscount =
            Math.max(
              0,
              subtotalBeforeDiscount -
                discountAmount
            );

          const gstAmount =
            Math.round(
              subtotalAfterDiscount *
                0.18 *
                100
            ) / 100;

          const totalPayable =
            Math.round(
              (
                subtotalAfterDiscount +
                gstAmount +
                Number(
                  result.securityDeposit ||
                    0
                )
              ) *
                100
            ) / 100;

          return {
            ...result,

            regularDiscountAmount:
              discountAmount,

            selectedOffer,

            subtotalBeforeDiscount,

            subtotalAfterDiscount,

            gstAmount,

            total:
              totalPayable,

            totalPayable,
          };
        } catch (error) {
          console.error(
            'Pricing calculation failed:',
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

    const manuallyBlocked =
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

    if (
      manuallyBlocked
    ) {
      return true;
    }

    return existingBookings.some(
      (booking) =>
        booking.booking_status ===
          'confirmed' &&
        booking.payment_status ===
          'paid' &&
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

  function changeCheckIn(
    value
  ) {
    setCheckIn(
      value
    );

    setBookingError(
      ''
    );

    setBookingSuccess(
      null
    );

    if (
      value &&
      checkOut &&
      checkOut <=
        value
    ) {
      setCheckOut(
        addDays(
          value,
          1
        )
      );
    }
  }

  function changeCheckOut(
    value
  ) {
    setCheckOut(
      value
    );

    setBookingError(
      ''
    );

    setBookingSuccess(
      null
    );
  }

  function changeGuests(
    value
  ) {
    const minimum =
      Math.max(
        Number(
          property?.min_guests ||
            1
        ),
        1
      );

    const maximum =
      Math.max(
        Number(
          property?.max_guests ||
            minimum
        ),
        minimum
      );

    const nextValue =
      Math.min(
        maximum,
        Math.max(
          minimum,
          Number(
            value ||
              minimum
          )
        )
      );

    setGuestCount(
      nextValue
    );

    setBookingError(
      ''
    );

    setBookingSuccess(
      null
    );
  }

  function redirectToLogin() {
    if (
      typeof window ===
      'undefined'
    ) {
      return;
    }

    const returnUrl =
      `${window.location.pathname}${window.location.search}`;

    window.location.href =
      `/login?redirect=${encodeURIComponent(
        returnUrl
      )}`;
  }

  async function ensureGuestProfile() {
    if (
      !session?.user
    ) {
      return null;
    }

    if (
      guestProfile
    ) {
      return guestProfile;
    }

    const email =
      String(
        guestEmail ||
          session.user.email ||
          ''
      )
        .trim()
        .toLowerCase();

    if (email) {
      const {
        data:
          existingRows,
        error:
          existingError,
      } =
        await supabase
          .from(
            'guests'
          )
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

      if (
        existingError
      ) {
        throw existingError;
      }

      const existingGuest =
        existingRows?.[0] ||
        null;

      if (
        existingGuest
      ) {
        setGuestProfile(
          existingGuest
        );

        return existingGuest;
      }
    }

    const {
      data:
        newGuest,
      error:
        createError,
    } =
      await supabase
        .from(
          'guests'
        )
        .insert({
          full_name:
            guestName.trim() ||
            session.user
              .user_metadata
              ?.full_name ||
            session.user.email
              ?.split('@')[0] ||
            'Guest',

          email:
            email ||
            null,

          phone:
            guestPhone.trim() ||
            null,
        })
        .select('*')
        .single();

    if (
      createError
    ) {
      throw createError;
    }

    setGuestProfile(
      newGuest
    );

    return newGuest;
  }

  async function updateGuestDetails(
    guest
  ) {
    if (
      !guest?.id
    ) {
      return guest;
    }

    const payload = {
      full_name:
        guestName.trim(),

      phone:
        guestPhone.trim(),

      email:
        guestEmail
          .trim()
          .toLowerCase(),
    };

    const {
      data,
      error,
    } =
      await supabase
        .from(
          'guests'
        )
        .update(
          payload
        )
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
      data
    );

    return data;
  }

  async function submitBookingRequest(
    event
  ) {
    event.preventDefault();

    setBookingError(
      ''
    );

    setBookingSuccess(
      null
    );

    if (
      authChecking
    ) {
      return;
    }

    if (
      !session?.user
    ) {
      redirectToLogin();

      return;
    }

    if (
      !property
    ) {
      setBookingError(
        'Property information is unavailable.'
      );

      return;
    }

    if (
      !checkIn ||
      !checkOut
    ) {
      setBookingError(
        'Please select check-in and check-out dates.'
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
      checkIn <
      todayString()
    ) {
      setBookingError(
        'Check-in date cannot be in the past.'
      );

      return;
    }

    const nights =
      getStayDates(
        checkIn,
        checkOut
      ).length;

    if (
      nights <
      Number(
        property.min_stay_nights ||
          1
      )
    ) {
      setBookingError(
        `Minimum stay is ${
          property.min_stay_nights ||
          1
        } night(s).`
      );

      return;
    }

    if (
      property.max_stay_nights &&
      nights >
        Number(
          property.max_stay_nights
        )
    ) {
      setBookingError(
        `Maximum stay is ${property.max_stay_nights} nights.`
      );

      return;
    }

    if (
      Number(
        guestCount
      ) <
      Number(
        property.min_guests ||
          1
      )
    ) {
      setBookingError(
        `Minimum guests: ${
          property.min_guests ||
          1
        }.`
      );

      return;
    }

    if (
      Number(
        guestCount
      ) >
      Number(
        property.max_guests ||
          guestCount
      )
    ) {
      setBookingError(
        `Maximum guests: ${property.max_guests}.`
      );

      return;
    }

    if (
      !guestName.trim()
    ) {
      setBookingError(
        'Please enter your full name.'
      );

      return;
    }

    if (
      !guestPhone.trim()
    ) {
      setBookingError(
        'Please enter your phone number.'
      );

      return;
    }

    if (
      !guestEmail.trim()
    ) {
      setBookingError(
        'Please enter your email address.'
      );

      return;
    }

    if (
      selectedOffer &&
      !offerEligibleForBooking(
        selectedOffer,
        checkIn,
        checkOut,
        nights
      )
    ) {
      setSelectedOfferId(
        ''
      );

      setBookingError(
        'The selected discount is not eligible for these booking dates or stay duration.'
      );

      return;
    }

    if (
      selectedDatesUnavailable
    ) {
      setBookingError(
        'These dates are already booked or blocked.'
      );

      return;
    }

    if (
      !pricing?.valid
    ) {
      setBookingError(
        pricing?.error ||
          'Unable to calculate booking price.'
      );

      return;
    }

    setBookingLoading(
      true
    );

    try {
      const [
        latestBlockedResult,
        latestBookingsResult,
      ] =
        await Promise.all([
          supabase
            .from(
              'blocked_dates'
            )
            .select(
              'start_date, end_date'
            )
            .eq(
              'property_id',
              property.id
            ),

          supabase
            .from(
              'bookings'
            )
            .select(
              'id, check_in, check_out, booking_status, payment_status'
            )
            .eq(
              'property_id',
              property.id
            )
            .eq(
              'booking_status',
              'confirmed'
            )
            .eq(
              'payment_status',
              'paid'
            ),
        ]);

      if (
        latestBlockedResult.error
      ) {
        throw latestBlockedResult.error;
      }

      if (
        latestBookingsResult.error
      ) {
        throw latestBookingsResult.error;
      }

      const latestManualConflict =
        (
          latestBlockedResult.data ||
          []
        ).some(
          (block) =>
            rangesOverlap(
              checkIn,
              checkOut,
              block.start_date,
              addDays(
                block.end_date,
                1
              )
            )
        );

      const latestBookingConflict =
        (
          latestBookingsResult.data ||
          []
        ).some(
          (booking) =>
            booking.booking_status ===
              'confirmed' &&
            booking.payment_status ===
              'paid' &&
            rangesOverlap(
              checkIn,
              checkOut,
              booking.check_in,
              booking.check_out
            )
        );

      if (
        latestManualConflict ||
        latestBookingConflict
      ) {
        setBookingError(
          'These dates are already booked or blocked.'
        );

        setExistingBookings(
          latestBookingsResult.data ||
            []
        );

        setBlockedDates(
          latestBlockedResult.data ||
            []
        );

        return;
      }

      let guest =
        await ensureGuestProfile();

      guest =
        await updateGuestDetails(
          guest
        );

      /*
        IMPORTANT:
        These field names match the
        current bookings table.
      */

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
          Number(
            pricing.nights ||
              nights ||
              1
          ),

        booking_status:
          'pending',

        payment_status:
          'unpaid',

        taxable_amount:
          Number(
            pricing.subtotalAfterDiscount ||
              0
          ),

        gst_rate:
          18,

        gst_amount:
          Number(
            pricing.gstAmount ||
              0
          ),

        amount_including_gst:
          Number(
            pricing.totalPayable ||
              pricing.total ||
              0
          ),
      };

      const {
        data:
          createdBooking,
        error:
          bookingInsertError,
      } =
        await supabase
          .from(
            'bookings'
          )
          .insert(
            bookingPayload
          )
          .select('*')
          .single();

      if (
        bookingInsertError
      ) {
        throw bookingInsertError;
      }

      setBookingSuccess(
        createdBooking
      );

      setGuestMessage(
        ''
      );
    } catch (error) {
      console.error(
        'Booking request failed:',
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
            styles.centerMessage
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
            styles.centerMessage
          }
        >
          <h2>
            Property unavailable
          </h2>

          <p>
            {pageError ||
              'This property could not be loaded.'}
          </p>

          <a
            href="/"
            style={
              styles.homeLink
            }
          >
            Back to NightOutStays
          </a>
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

  const minimumCheckout =
    checkIn
      ? addDays(
          checkIn,
          Math.max(
            Number(
              property.min_stay_nights ||
                1
            ),
            1
          )
        )
      : todayString();

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
            styles.headerActions
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
            <a
              href={`/login?redirect=${encodeURIComponent(
                `/property/${property.slug}`
              )}`}
              style={
                styles.loginButton
              }
            >
              Guest Login
            </a>
          )}
        </div>
      </header>

      <div
        style={
          styles.container
        }
      >
        <section
          style={
            styles.titleSection
          }
        >
          <div>
            <h1
              style={
                styles.propertyTitle
              }
            >
              {property.name}
            </h1>

            <div
              style={
                styles.location
              }
            >
              {
                property.location_name
              }
            </div>
          </div>

          <div
            style={
              styles.basePrice
            }
          >
            <strong>
              {money(
                property.base_price
              )}
            </strong>

            <span>
              {' '}
              / night
            </span>
          </div>
        </section>

        <section
          style={
            styles.gallery
          }
        >
          <div
            style={
              styles.mainPhotoBox
            }
          >
            {coverPhoto?.image_url ? (
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
                  styles.noPhoto
                }
              >
                Property photo
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
                    type="button"
                    key={
                      photo.id ||
                      index
                    }
                    onClick={() =>
                      setActivePhoto(
                        index
                      )
                    }
                    style={{
                      ...styles.thumbnailButton,

                      ...(index ===
                      activePhoto
                        ? styles.activeThumbnail
                        : {}),
                    }}
                  >
                    <img
                      src={
                        photo.image_url
                      }
                      alt={
                        photo.alt_text ||
                        `${property.name} ${
                          index + 1
                        }`
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
        </section>

        <div
          style={
            styles.contentGrid
          }
        >
          <div>
            <section
              style={
                styles.infoCard
              }
            >
              <h2>
                About this stay
              </h2>

              {property.short_description && (
                <p
                  style={
                    styles.description
                  }
                >
                  {
                    property.short_description
                  }
                </p>
              )}

              {property.description && (
                <p
                  style={
                    styles.description
                  }
                >
                  {
                    property.description
                  }
                </p>
              )}

              <div
                style={
                  styles.quickFacts
                }
              >
                <Fact
                  label="Bedrooms"
                  value={
                    property.bedrooms ||
                    0
                  }
                />

                <Fact
                  label="Bathrooms"
                  value={
                    property.bathrooms ||
                    0
                  }
                />

                <Fact
                  label="Guests"
                  value={`Up to ${
                    property.max_guests ||
                    1
                  }`}
                />

                <Fact
                  label="Minimum stay"
                  value={`${
                    property.min_stay_nights ||
                    1
                  } night(s)`}
                />
              </div>
            </section>

            <section
              style={
                styles.infoCard
              }
            >
              <h2>
                Stay details
              </h2>

              <div
                style={
                  styles.detailGrid
                }
              >
                <Detail
                  label="Check-in"
                  value={
                    formatTime(
                      property.check_in_time
                    )
                  }
                />

                <Detail
                  label="Check-out"
                  value={
                    formatTime(
                      property.check_out_time
                    )
                  }
                />

                <Detail
                  label="Base rate"
                  value={
                    money(
                      property.base_price
                    )
                  }
                />

                <Detail
                  label="Maximum guests"
                  value={
                    property.max_guests ||
                    1
                  }
                />
              </div>
            </section>

            {property.amenities && (
              <section
                style={
                  styles.infoCard
                }
              >
                <h2>
                  Amenities
                </h2>

                <p
                  style={
                    styles.description
                  }
                >
                  {Array.isArray(
                    property.amenities
                  )
                    ? property.amenities.join(
                        ' • '
                      )
                    : property.amenities}
                </p>
              </section>
            )}

            {property.house_rules && (
              <section
                style={
                  styles.infoCard
                }
              >
                <h2>
                  House rules
                </h2>

                <p
                  style={
                    styles.description
                  }
                >
                  {Array.isArray(
                    property.house_rules
                  )
                    ? property.house_rules.join(
                        ' • '
                      )
                    : property.house_rules}
                </p>
              </section>
            )}

            <section
              style={
                styles.infoCard
              }
            >
              <h2>
                Availability
              </h2>

              <p
                style={
                  styles.description
                }
              >
                Check live availability and nightly rates below.
                Rates can vary by date. Host special rates are
                automatically shown. Pending booking requests
                do not block dates.
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
                  changeCheckIn
                }
                onCheckOutChange={
                  changeCheckOut
                }
              />
            </section>
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
                    ) =>
                      changeCheckIn(
                        event.target
                          .value
                      )
                    }
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
                      minimumCheckout
                    }
                    onChange={(
                      event
                    ) =>
                      changeCheckOut(
                        event.target
                          .value
                      )
                    }
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
                  ) =>
                    changeGuests(
                      event.target
                        .value
                    )
                  }
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
                    (count) => (
                      <option
                        key={
                          count
                        }
                        value={
                          count
                        }
                      >
                        {count}{' '}
                        {count ===
                        1
                          ? 'guest'
                          : 'guests'}
                      </option>
                    )
                  )}
                </select>
              </label>

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

              {selectedDatesUnavailable && (
                <div
                  style={
                    styles.errorBox
                  }
                >
                  These dates are booked or blocked.
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
                        ) =>
                          setSelectedOfferId(
                            event
                              .target
                              .value
                          )
                        }
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
                                'Special offer'}
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
                            'Special offer'}
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
                          pricing.subtotalBeforeDiscount ||
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
                      property.cleaning_fee ||
                      0
                  ) > 0 && (
                    <PriceRow
                      label="Cleaning fee"
                      value={
                        money(
                          pricing.cleaningFee ||
                            property.cleaning_fee
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
                        pricing.subtotalAfterDiscount ||
                          0
                      )
                    }
                  />

                  <PriceRow
                    label="GST (18%)"
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
                          pricing.total ||
                          0
                      )}
                    </strong>
                  </div>
                </div>
              )}

              <label
                style={
                  styles.label
                }
              >
                FULL NAME

                <input
                  type="text"
                  value={
                    guestName
                  }
                  onChange={(
                    event
                  ) =>
                    setGuestName(
                      event.target
                        .value
                    )
                  }
                  style={
                    styles.input
                  }
                  placeholder="Your full name"
                />
              </label>

              <label
                style={
                  styles.label
                }
              >
                PHONE

                <input
                  type="tel"
                  value={
                    guestPhone
                  }
                  onChange={(
                    event
                  ) =>
                    setGuestPhone(
                      event.target
                        .value
                    )
                  }
                  style={
                    styles.input
                  }
                  placeholder="Mobile number"
                />
              </label>

              <label
                style={
                  styles.label
                }
              >
                EMAIL

                <input
                  type="email"
                  value={
                    guestEmail
                  }
                  onChange={(
                    event
                  ) =>
                    setGuestEmail(
                      event.target
                        .value
                    )
                  }
                  style={
                    styles.input
                  }
                  placeholder="Email address"
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
                      event.target
                        .value
                    )
                  }
                  style={
                    styles.textarea
                  }
                  placeholder="Tell the host anything important about your stay."
                />
              </label>

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

              <button
                type="submit"
                disabled={
                  bookingLoading ||
                  selectedDatesUnavailable
                }
                style={{
                  ...styles.bookButton,

                  ...(bookingLoading ||
                  selectedDatesUnavailable
                    ? styles.disabledButton
                    : {}),
                }}
              >
                {bookingLoading
                  ? 'Sending Request...'
                  : session
                  ? 'Request Booking'
                  : 'Login to Request Booking'}
              </button>

              <div
                style={
                  styles.bookingNote
                }
              >
                Sending a request does not immediately reserve or block the dates.
              </div>
            </form>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Fact({
  label,
  value,
}) {
  return (
    <div
      style={
        styles.fact
      }
    >
      <div
        style={
          styles.factValue
        }
      >
        {value}
      </div>

      <div
        style={
          styles.factLabel
        }
      >
        {label}
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}) {
  return (
    <div
      style={
        styles.detail
      }
    >
      <div
        style={
          styles.detailLabel
        }
      >
        {label}
      </div>

      <div
        style={
          styles.detailValue
        }
      >
        {value}
      </div>
    </div>
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

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f6f7f9',
    color: '#0b2447',
    fontFamily:
      'Arial, sans-serif',
  },

  header: {
    height: 72,
    background: '#ffffff',
    borderBottom:
      '1px solid #e4e7ec',
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      'space-between',
    padding: '0 5%',
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },

  logo: {
    fontSize: 24,
    fontWeight: 800,
    textDecoration: 'none',
    color: '#174f91',
  },

  headerActions: {
    display: 'flex',
    gap: 18,
    alignItems: 'center',
  },

  headerLink: {
    color: '#174f91',
    textDecoration: 'none',
    fontWeight: 600,
  },

  loginButton: {
    background: '#174f91',
    color: '#ffffff',
    padding: '10px 18px',
    borderRadius: 8,
    textDecoration: 'none',
    fontWeight: 700,
  },

  container: {
    width: '90%',
    maxWidth: 1220,
    margin: '0 auto',
    padding: '30px 0 70px',
  },

  centerMessage: {
    width: '90%',
    maxWidth: 700,
    margin: '100px auto',
    background: '#ffffff',
    padding: 40,
    borderRadius: 18,
    textAlign: 'center',
    boxShadow:
      '0 10px 35px rgba(0,0,0,0.06)',
  },

  homeLink: {
    color: '#174f91',
    fontWeight: 700,
  },

  titleSection: {
    display: 'flex',
    justifyContent:
      'space-between',
    gap: 20,
    alignItems: 'flex-end',
    marginBottom: 24,
    flexWrap: 'wrap',
  },

  propertyTitle: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.2,
  },

  location: {
    marginTop: 8,
    color: '#667085',
  },

  basePrice: {
    fontSize: 16,
    color: '#667085',
  },

  gallery: {
    marginBottom: 30,
  },

  mainPhotoBox: {
    width: '100%',
    height: 520,
    borderRadius: 18,
    overflow: 'hidden',
    background: '#e9edf2',
  },

  mainPhoto: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },

  noPhoto: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      'center',
    color: '#667085',
  },

  thumbnailRow: {
    display: 'flex',
    gap: 10,
    marginTop: 10,
    overflowX: 'auto',
    paddingBottom: 4,
  },

  thumbnailButton: {
    width: 105,
    height: 75,
    flex: '0 0 auto',
    padding: 0,
    border:
      '2px solid transparent',
    borderRadius: 10,
    overflow: 'hidden',
    background: '#ffffff',
    cursor: 'pointer',
  },

  activeThumbnail: {
    border:
      '2px solid #174f91',
  },

  thumbnail: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },

  contentGrid: {
    display: 'grid',
    gridTemplateColumns:
      'minmax(0, 1fr) 385px',
    gap: 28,
    alignItems: 'start',
  },

  infoCard: {
    background: '#ffffff',
    border:
      '1px solid #e4e7ec',
    borderRadius: 18,
    padding: 24,
    marginBottom: 20,
  },

  description: {
    lineHeight: 1.7,
    color: '#475467',
  },

  quickFacts: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(130px, 1fr))',
    gap: 12,
    marginTop: 20,
  },

  fact: {
    background: '#f7f8fa',
    borderRadius: 12,
    padding: 16,
  },

  factValue: {
    fontWeight: 800,
    fontSize: 18,
  },

  factLabel: {
    color: '#667085',
    marginTop: 5,
    fontSize: 13,
  },

  detailGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
  },

  detail: {
    border:
      '1px solid #e4e7ec',
    borderRadius: 12,
    padding: 14,
  },

  detailLabel: {
    fontSize: 12,
    color: '#667085',
    marginBottom: 8,
  },

  detailValue: {
    fontWeight: 800,
    fontSize: 17,
  },

  bookingColumn: {
    position: 'relative',
  },

  bookingCard: {
    position: 'sticky',
    top: 92,
    background: '#ffffff',
    border:
      '1px solid #dfe3e8',
    borderRadius: 18,
    padding: 22,
    boxShadow:
      '0 12px 35px rgba(16,24,40,0.08)',
    display: 'grid',
    gap: 16,
  },

  bookingPrice: {
    fontSize: 28,
    fontWeight: 800,
    color: '#174f91',
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns:
      '1fr 1fr',
    gap: 10,
  },

  label: {
    display: 'grid',
    gap: 7,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.5,
    color: '#0b2447',
  },

  input: {
    width: '100%',
    boxSizing:
      'border-box',
    border:
      '1px solid #cfd6df',
    borderRadius: 9,
    padding: '12px 12px',
    background: '#ffffff',
    color: '#101828',
    fontSize: 14,
    outline: 'none',
  },

  textarea: {
    width: '100%',
    minHeight: 100,
    resize: 'vertical',
    boxSizing:
      'border-box',
    border:
      '1px solid #cfd6df',
    borderRadius: 9,
    padding: 12,
    background: '#ffffff',
    color: '#101828',
    fontSize: 14,
    outline: 'none',
  },

  availableBox: {
    padding: 12,
    background: '#eaf7ee',
    color: '#24723a',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 13,
  },

  discountBox: {
    background: '#fff8e7',
    border:
      '1px solid #efd493',
    borderRadius: 12,
    padding: 12,
    display: 'grid',
    gap: 10,
  },

  offerDescription: {
    background: '#fff1c9',
    padding: 10,
    borderRadius: 8,
    fontSize: 12,
    color: '#805b00',
    lineHeight: 1.5,
  },

  priceSummary: {
    background: '#f7f8fa',
    borderRadius: 12,
    padding: 14,
    display: 'grid',
    gap: 10,
  },

  priceRow: {
    display: 'flex',
    justifyContent:
      'space-between',
    gap: 14,
    color: '#344054',
    fontSize: 13,
  },

  discountRow: {
    color: '#24723a',
    fontWeight: 700,
  },

  totalRow: {
    display: 'flex',
    justifyContent:
      'space-between',
    gap: 14,
    paddingTop: 12,
    marginTop: 3,
    borderTop:
      '1px solid #dfe3e8',
    fontSize: 17,
  },

  errorBox: {
    padding: 12,
    background: '#fdeaea',
    color: '#a12828',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.5,
  },

  successBox: {
    padding: 12,
    background: '#eaf7ee',
    color: '#24723a',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.5,
  },

  loginNotice: {
    padding: 12,
    background: '#fff8e7',
    color: '#805b00',
    borderRadius: 10,
    fontSize: 13,
  },

  bookButton: {
    width: '100%',
    border: 0,
    borderRadius: 10,
    padding: '15px 16px',
    background: '#174f91',
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
  },

  disabledButton: {
    opacity: 0.55,
    cursor:
      'not-allowed',
  },

  bookingNote: {
    textAlign: 'center',
    color: '#667085',
    fontSize: 11,
    lineHeight: 1.5,
  },
};