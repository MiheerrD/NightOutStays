'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { calculateBookingPrice } from '../../lib/pricing';

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
  date.setDate(date.getDate() + days);

  return date.toISOString().slice(0, 10);
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function formatTime(value) {
  if (!value) return '—';

  const [hour, minute] =
    String(value)
      .slice(0, 5)
      .split(':');

  const date = new Date();

  date.setHours(Number(hour));
  date.setMinutes(Number(minute));

  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function dateDayNumber(dateString) {
  return new Date(
    `${dateString}T12:00:00`
  ).getDay();
}

function getStayDates(checkIn, checkOut) {
  if (!checkIn || !checkOut) {
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
      current
        .toISOString()
        .slice(0, 10)
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

  if (!offer.is_active) {
    return false;
  }

  if (
    offer.guest_selectable ===
    false
  ) {
    return false;
  }

  if (
    nights <
    Number(
      offer.min_nights || 1
    )
  ) {
    return false;
  }

  const stayDates =
    getStayDates(
      checkIn,
      checkOut
    );

  const startDate =
    offer.start_date || null;

  const endDate =
    offer.end_date || null;

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
            dateDayNumber(date)
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
          dateDayNumber(date)
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
                night.rate || 0
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
            pricing.nights || 1
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
      (Number(
        offer.discount_value ||
          0
      ) /
        100);
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
        eligibleAmount * 100
      ) / 100,

    discountAmount:
      Math.round(
        discountAmount * 100
      ) / 100,
  };
}

export default function PropertyPage() {
  const params =
    useParams();

  const slug =
    params?.slug;

  const [property, setProperty] =
    useState(null);

  const [photos, setPhotos] =
    useState([]);

  const [
    pricingRules,
    setPricingRules,
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

  const [session, setSession] =
    useState(null);

  const [
    guestProfile,
    setGuestProfile,
  ] = useState(null);

  const [
    authChecking,
    setAuthChecking,
  ] = useState(true);

  const [loading, setLoading] =
    useState(true);

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

  useEffect(() => {
    checkGuestLogin();
  }, []);

  useEffect(() => {
    if (slug) {
      loadProperty();
    }
  }, [slug]);

  async function checkGuestLogin() {
    setAuthChecking(true);

    try {
      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      setSession(session);

      if (!session) {
        return;
      }

      const {
        data: guest,
        error,
      } =
        await supabase
          .from('guests')
          .select('*')
          .eq(
            'user_id',
            session.user.id
          )
          .maybeSingle();

      if (error) {
        console.error(error);
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
          guest.phone || ''
        );

        setGuestEmail(
          guest.email ||
            session.user.email ||
            ''
        );
      } else {
        const fallbackName =
          session.user
            .user_metadata
            ?.full_name ||
          '';

        setGuestName(
          fallbackName
        );

        setGuestEmail(
          session.user.email ||
            ''
        );
      }
    } finally {
      setAuthChecking(false);
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
              'check_in, check_out, booking_status'
            )
            .eq(
              'property_id',
              propertyData.id
            )
            .not(
              'booking_status',
              'in',
              '("cancelled")'
            ),
        ]);

      setPhotos(
        photoResult.data ||
          []
      );

      setPropertyOffers(
        offerResult.data ||
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
      console.error(error);

      setPageError(
        error.message
      );
    } finally {
      setLoading(false);
    }
  }

  const nights =
    useMemo(() => {
      if (
        !checkIn ||
        !checkOut
      ) {
        return 0;
      }

      const start =
        new Date(
          `${checkIn}T12:00:00`
        );

      const end =
        new Date(
          `${checkOut}T12:00:00`
        );

      return Math.round(
        (end - start) /
          (
            1000 *
            60 *
            60 *
            24
          )
      );
    }, [
      checkIn,
      checkOut,
    ]);

  const availableOffers =
    useMemo(() => {
      return propertyOffers.filter(
        (offer) =>
          offerEligibleForBooking(
            offer,
            checkIn,
            checkOut,
            nights
          )
      );
    }, [
      propertyOffers,
      checkIn,
      checkOut,
      nights,
    ]);

  useEffect(() => {
    if (
      selectedOfferId &&
      !availableOffers.some(
        (offer) =>
          offer.id ===
          selectedOfferId
      )
    ) {
      setSelectedOfferId('');
    }
  }, [
    availableOffers,
    selectedOfferId,
  ]);

  const selectedOffer =
    useMemo(() => {
      return (
        availableOffers.find(
          (offer) =>
            offer.id ===
            selectedOfferId
        ) || null
      );
    }, [
      availableOffers,
      selectedOfferId,
    ]);

  const basePricing =
    useMemo(() => {
      if (
        !property ||
        !checkIn ||
        !checkOut
      ) {
        return null;
      }

      return calculateBookingPrice({
        property,
        guestCount,
        checkIn,
        checkOut,
        pricingRules,
        offer: null,
        gstRate: 18,
      });
    }, [
      property,
      guestCount,
      checkIn,
      checkOut,
      pricingRules,
    ]);

  const pricing =
    useMemo(() => {
      if (
        !basePricing ||
        !basePricing.valid
      ) {
        return basePricing;
      }

      const {
        discountAmount,
      } =
        calculateRegularDiscount(
          basePricing,
          selectedOffer,
          checkIn,
          checkOut
        );

      const taxableBeforeDiscount =
        Number(
          basePricing.staySubtotal ||
            0
        ) +
        Number(
          basePricing.cleaningFee ||
            0
        );

      const taxableAmount =
        Math.max(
          0,
          taxableBeforeDiscount -
            discountAmount
        );

      const gstRate = 18;

      const gstAmount =
        taxableAmount *
        (gstRate / 100);

      const amountIncludingGst =
        taxableAmount +
        gstAmount;

      const securityDeposit =
        Number(
          basePricing.securityDeposit ||
            0
        );

      const totalPayable =
        amountIncludingGst +
        securityDeposit;

      return {
        ...basePricing,

        autoDiscountAmount:
          Math.round(
            discountAmount * 100
          ) / 100,

        taxableAmount:
          Math.round(
            taxableAmount * 100
          ) / 100,

        gstRate,

        gstAmount:
          Math.round(
            gstAmount * 100
          ) / 100,

        amountIncludingGst:
          Math.round(
            amountIncludingGst *
              100
          ) / 100,

        totalPayable:
          Math.round(
            totalPayable * 100
          ) / 100,
      };
    }, [
      basePricing,
      selectedOffer,
      checkIn,
      checkOut,
    ]);

  const availability =
    useMemo(() => {
      if (
        !checkIn ||
        !checkOut
      ) {
        return {
          available: true,
          message: '',
        };
      }

      if (
        checkOut <= checkIn
      ) {
        return {
          available:
            false,

          message:
            'Check-out must be after check-in.',
        };
      }

      const manuallyBlocked =
        blockedDates.some(
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

      if (
        manuallyBlocked
      ) {
        return {
          available:
            false,

          message:
            'These dates are unavailable.',
        };
      }

      const bookingConflict =
        existingBookings.some(
          (booking) =>
            rangesOverlap(
              checkIn,
              checkOut,
              booking.check_in,
              booking.check_out
            )
        );

      if (
        bookingConflict
      ) {
        return {
          available:
            false,

          message:
            'These dates already have a booking/request.',
        };
      }

      return {
        available:
          true,

        message:
          'Dates are currently available.',
      };
    }, [
      checkIn,
      checkOut,
      blockedDates,
      existingBookings,
    ]);

  function redirectToLogin() {
    const currentPath =
      window.location.pathname +
      window.location.search;

    window.location.href =
      `/login?redirect=${encodeURIComponent(
        currentPath
      )}`;
  }

  async function getOrCreateGuestProfile() {
    if (!session?.user) {
      throw new Error(
        'Login required.'
      );
    }

    const {
      data:
        existingGuest,
      error:
        existingError,
    } =
      await supabase
        .from('guests')
        .select('*')
        .eq(
          'user_id',
          session.user.id
        )
        .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    const profileData = {
      user_id:
        session.user.id,

      full_name:
        guestName.trim(),

      phone:
        guestPhone.trim(),

      email:
        session.user.email ||
        guestEmail.trim(),
    };

    if (
      existingGuest
    ) {
      const {
        data:
          updatedGuest,
        error:
          updateError,
      } =
        await supabase
          .from('guests')
          .update(
            profileData
          )
          .eq(
            'id',
            existingGuest.id
          )
          .select('*')
          .single();

      if (
        updateError
      ) {
        throw updateError;
      }

      setGuestProfile(
        updatedGuest
      );

      return updatedGuest;
    }

    const {
      data:
        createdGuest,
      error:
        createError,
    } =
      await supabase
        .from('guests')
        .insert(
          profileData
        )
        .select('*')
        .single();

    if (
      createError
    ) {
      throw createError;
    }

    setGuestProfile(
      createdGuest
    );

    return createdGuest;
  }

  async function sendBookingRequest(
    event
  ) {
    event.preventDefault();

    setBookingError('');
    setBookingSuccess(null);

    /*
      LOGIN IS MANDATORY FROM THIS POINT.
    */

    if (
      !session?.user
    ) {
      redirectToLogin();
      return;
    }

    if (
      !pricing?.valid
    ) {
      setBookingError(
        pricing?.error ||
          'Please check your booking details.'
      );
      return;
    }

    if (
      !availability.available
    ) {
      setBookingError(
        availability.message
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
        'Please enter your contact number.'
      );
      return;
    }

    setBookingLoading(
      true
    );

    try {
      const guest =
        await getOrCreateGuestProfile();

      const averageNightlyRate =
        pricing.nights > 0
          ? Number(
              pricing.staySubtotal ||
                0
            ) /
            pricing.nights
          : 0;

      const {
        data:
          bookingData,
        error:
          bookingInsertError,
      } =
        await supabase
          .from('bookings')
          .insert({
            property_id:
              property.id,

            guest_id:
              guest.id,

            property_offer_id:
              selectedOffer?.id ||
              null,

            check_in:
              checkIn,

            check_out:
              checkOut,

            guests_count:
              Number(
                guestCount
              ),

            nights:
              pricing.nights,

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

            base_amount:
              Number(
                pricing.baseAmount ??
                  pricing.staySubtotal ??
                  0
              ),

            auto_discount_amount:
              Number(
                pricing.autoDiscountAmount ||
                  0
              ),

            host_discount_amount:
              0,

            taxable_amount:
              Number(
                pricing.taxableAmount ||
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
                pricing.amountIncludingGst ||
                  0
              ),

            final_payable_amount:
              Number(
                pricing.totalPayable ||
                  0
              ),

            total_amount:
              Number(
                pricing.totalPayable ||
                  0
              ),

            booking_status:
              'pending',

            host_decision:
              'pending',

            payment_status:
              'unpaid',

            verification_status:
              'not_required',

            offer_status:
              selectedOffer
                ? 'auto_applied'
                : 'none',

            offer_note:
              selectedOffer
                ? selectedOffer.title
                : null,

            /*
              Guest message now lives in booking_messages.
              We do not duplicate it in bookings.notes.
            */
            notes:
              null,
          })
          .select(
            'id, booking_code'
          )
          .single();

      if (
        bookingInsertError
      ) {
        throw bookingInsertError;
      }

      /*
        Every new booking automatically gets
        its own Messages thread.
      */

      if (
        guestMessage.trim()
      ) {
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
                bookingData.id,

              sender_type:
                'guest',

              sender_name:
                guest.full_name,

              message:
                guestMessage.trim(),

              message_type:
                'booking_request',

              is_read:
                false,
            });

        if (
          messageError
        ) {
          console.error(
            messageError
          );
        }
      } else {
        /*
          Even with no written message,
          create the conversation thread.
        */

        const {
          error:
            systemMessageError,
        } =
          await supabase
            .from(
              'booking_messages'
            )
            .insert({
              booking_id:
                bookingData.id,

              sender_type:
                'system',

              sender_name:
                'NightOutStays',

              message:
                `Booking request ${bookingData.booking_code} received.`,

              message_type:
                'booking_request',

              is_read:
                false,
            });

        if (
          systemMessageError
        ) {
          console.error(
            systemMessageError
          );
        }
      }

      setBookingSuccess({
        id:
          bookingData.id,

        bookingCode:
          bookingData.booking_code,

        amount:
          pricing.totalPayable,
      });

      setGuestMessage('');

      /*
        Refresh availability so the newly requested
        dates are immediately blocked.
      */

      setExistingBookings(
        (previous) => [
          ...previous,
          {
            check_in:
              checkIn,

            check_out:
              checkOut,

            booking_status:
              'pending',
          },
        ]
      );
    } catch (error) {
      console.error(error);

      setBookingError(
        `Unable to send booking request: ${
          error.message ||
          'Unknown error'
        }`
      );
    } finally {
      setBookingLoading(
        false
      );
    }
  }

  async function logoutGuest() {
    await supabase.auth.signOut();

    setSession(null);
    setGuestProfile(null);

    setGuestName('');
    setGuestPhone('');
    setGuestEmail('');
  }

  if (loading) {
    return (
      <main style={styles.loading}>
        Loading property...
      </main>
    );
  }

  if (
    pageError ||
    !property
  ) {
    return (
      <main style={styles.loading}>
        <h2>
          Property unavailable
        </h2>

        <p>
          {pageError}
        </p>
      </main>
    );
  }

  const selectedPhoto =
    photos[
      activePhoto
    ] ||
    photos.find(
      (item) =>
        item.is_cover
    ) ||
    photos[0];

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <a
          href="/"
          style={styles.brand}
        >
          NightOutStays
        </a>

        <div style={styles.accountArea}>
          {authChecking ? (
            <span style={styles.muted}>
              Checking account...
            </span>
          ) : session ? (
            <>
              <div>
                <strong>
                  {guestProfile?.full_name ||
                    guestName ||
                    'Guest'}
                </strong>

                <div style={styles.smallMuted}>
                  Signed in
                </div>
              </div>

              <a
                href="/account/bookings"
                style={styles.accountLink}
              >
                My Bookings
              </a>

              <button
                type="button"
                onClick={
                  logoutGuest
                }
                style={styles.logoutButton}
              >
                Logout
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={
                redirectToLogin
              }
              style={styles.loginButton}
            >
              Login / Sign Up
            </button>
          )}
        </div>
      </header>

      <section style={styles.container}>
        <div style={styles.propertyHeader}>
          <div>
            <h1 style={styles.title}>
              {property.name}
            </h1>

            <div style={styles.location}>
              📍{' '}
              {property.location_name}
            </div>
          </div>

          <div style={styles.priceHeader}>
            <strong>
              {money(
                property.base_price
              )}
            </strong>

            <span>
              {' / night'}
            </span>
          </div>
        </div>

        {selectedPhoto && (
          <section style={styles.gallery}>
            <img
              src={
                selectedPhoto.image_url
              }
              alt={
                selectedPhoto.alt_text ||
                property.name
              }
              style={styles.mainPhoto}
            />

            {photos.length > 1 && (
              <div style={styles.thumbnails}>
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
                        alt=""
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
        )}

        <div style={styles.layout}>
          <div>
            <Section title="About this stay">
              <p style={styles.description}>
                {property.description ||
                  property.short_description ||
                  ''}
              </p>

              <div style={styles.factGrid}>
                <Fact
                  label="Bedrooms"
                  value={
                    property.bedrooms
                  }
                />

                <Fact
                  label="Bathrooms"
                  value={
                    property.bathrooms
                  }
                />

                <Fact
                  label="Maximum Guests"
                  value={
                    property.max_guests
                  }
                />

                <Fact
                  label="Minimum Stay"
                  value={`${property.min_stay_nights || 1} night(s)`}
                />
              </div>
            </Section>

            <Section title="Sleeping Arrangement">
              <div style={styles.featureGrid}>
                {Number(
                  property.queen_bed_count
                ) > 0 && (
                  <Feature>
                    {property.queen_bed_count}{' '}
                    Queen Size Bed
                  </Feature>
                )}

                {Number(
                  property.single_bed_count
                ) > 0 && (
                  <Feature>
                    {property.single_bed_count}{' '}
                    Single Bed
                  </Feature>
                )}

                {Number(
                  property.sofa_cum_bed_count
                ) > 0 && (
                  <Feature>
                    {property.sofa_cum_bed_count}{' '}
                    Sofa-cum-Bed
                  </Feature>
                )}
              </div>
            </Section>

            <Section title="Facilities & Amenities">
              <div style={styles.featureGrid}>
                {property.wifi_available && (
                  <Feature>
                    Wi-Fi
                  </Feature>
                )}

                {property.tv_available && (
                  <Feature>
                    TV
                  </Feature>
                )}

                {property.fridge_available && (
                  <Feature>
                    Fridge
                  </Feature>
                )}

                {property.washing_machine_available && (
                  <Feature>
                    Washing Machine
                  </Feature>
                )}

                {property.ac_available && (
                  <Feature>
                    Air Conditioning
                    {Number(
                      property.ac_count
                    ) > 0
                      ? ` (${property.ac_count})`
                      : ''}
                  </Feature>
                )}

                {Number(
                  property.water_heater_count
                ) > 0 && (
                  <Feature>
                    Water Heater / Geyser
                    {' '}
                    ({property.water_heater_count})
                  </Feature>
                )}

                {(property.amenities ||
                  []).map(
                  (item) => (
                    <Feature
                      key={
                        item
                      }
                    >
                      {item}
                    </Feature>
                  )
                )}
              </div>
            </Section>

            {(property.kitchen_features ||
              []).length > 0 && (
              <Section title="Kitchen Features">
                <div style={styles.featureGrid}>
                  {property.kitchen_features.map(
                    (item) => (
                      <Feature
                        key={
                          item
                        }
                      >
                        {item}
                      </Feature>
                    )
                  )}
                </div>
              </Section>
            )}

            <Section title="Stay Rules">
              <div style={styles.featureGrid}>
                <Rule
                  label="Pets"
                  allowed={
                    property.pets_allowed
                  }
                />

                <Rule
                  label="Parties"
                  allowed={
                    property.parties_allowed
                  }
                />

                <Rule
                  label="Couples"
                  allowed={
                    property.couples_allowed
                  }
                />

                <Rule
                  label="Alcohol"
                  allowed={
                    property.alcohol_allowed
                  }
                />

                <Rule
                  label="Smoking"
                  allowed={
                    property.smoking_allowed
                  }
                />
              </div>

              {property.quiet_hours_enabled && (
                <div style={styles.quietBox}>
                  Quiet hours:{' '}
                  {formatTime(
                    property.quiet_hours_start
                  )}
                  {' – '}
                  {formatTime(
                    property.quiet_hours_end
                  )}
                </div>
              )}
            </Section>

            <Section title="Check-in & Check-out">
              <div style={styles.factGrid}>
                <Fact
                  label="Check-in"
                  value={
                    formatTime(
                      property.check_in_time
                    )
                  }
                />

                <Fact
                  label="Check-out"
                  value={
                    formatTime(
                      property.check_out_time
                    )
                  }
                />

                <Fact
                  label="Late checkout"
                  value={
                    Number(
                      property.late_checkout_hourly_fee
                    ) > 0
                      ? `${money(
                          property.late_checkout_hourly_fee
                        )} / hour`
                      : 'Contact host'
                  }
                />
              </div>
            </Section>
          </div>

          <aside style={styles.bookingCard}>
            <h2 style={styles.bookingHeading}>
              Request Your Stay
            </h2>

            <div style={styles.basePrice}>
              {money(
                property.base_price
              )}{' '}
              / base night
            </div>

            {!session && (
              <div style={styles.loginNotice}>
                <strong>
                  Login required to request a booking
                </strong>

                <div style={{ marginTop: 6 }}>
                  You can select your dates and see the complete price first.
                </div>
              </div>
            )}

            <form
              onSubmit={
                sendBookingRequest
              }
            >
              <div style={styles.twoColumns}>
                <InputGroup label="CHECK-IN">
                  <input
                    type="date"
                    min={
                      todayString()
                    }
                    value={
                      checkIn
                    }
                    onChange={(
                      event
                    ) => {
                      const value =
                        event.target.value;

                      setCheckIn(
                        value
                      );

                      if (
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
                    }}
                    style={
                      styles.input
                    }
                  />
                </InputGroup>

                <InputGroup label="CHECK-OUT">
                  <input
                    type="date"
                    min={
                      checkIn
                        ? addDays(
                            checkIn,
                            1
                          )
                        : todayString()
                    }
                    value={
                      checkOut
                    }
                    onChange={(
                      event
                    ) =>
                      setCheckOut(
                        event.target.value
                      )
                    }
                    style={
                      styles.input
                    }
                  />
                </InputGroup>
              </div>

              <InputGroup label="GUESTS">
                <select
                  value={
                    guestCount
                  }
                  onChange={(
                    event
                  ) =>
                    setGuestCount(
                      Number(
                        event.target.value
                      )
                    )
                  }
                  style={
                    styles.input
                  }
                >
                  {Array.from(
                    {
                      length:
                        Number(
                          property.max_guests
                        ) -
                        Number(
                          property.min_guests
                        ) +
                        1,
                    },
                    (
                      _,
                      index
                    ) =>
                      Number(
                        property.min_guests
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
                        guest
                        {count ===
                        1
                          ? ''
                          : 's'}
                      </option>
                    )
                  )}
                </select>
              </InputGroup>

              {checkIn &&
                checkOut && (
                  <div
                    style={
                      availability.available
                        ? styles.available
                        : styles.unavailable
                    }
                  >
                    {
                      availability.message
                    }
                  </div>
                )}

              {availableOffers.length > 0 && (
                <div style={styles.offersBox}>
                  <div style={styles.offerHeading}>
                    Available Discounts
                  </div>

                  <label style={styles.offerOption}>
                    <input
                      type="radio"
                      name="regularOffer"
                      checked={
                        selectedOfferId ===
                        ''
                      }
                      onChange={() =>
                        setSelectedOfferId(
                          ''
                        )
                      }
                    />

                    No discount
                  </label>

                  {availableOffers.map(
                    (offer) => (
                      <label
                        key={
                          offer.id
                        }
                        style={styles.offerOption}
                      >
                        <input
                          type="radio"
                          name="regularOffer"
                          checked={
                            selectedOfferId ===
                            offer.id
                          }
                          onChange={() =>
                            setSelectedOfferId(
                              offer.id
                            )
                          }
                        />

                        <span>
                          <strong>
                            {offer.title}
                          </strong>

                          {' — '}

                          {offer.discount_type ===
                          'percent'
                            ? `${Number(
                                offer.discount_value
                              )}% OFF`
                            : `${money(
                                offer.discount_value
                              )} OFF`}
                        </span>
                      </label>
                    )
                  )}

                  <div style={styles.offerRule}>
                    You may select only one regular discount. A Host Special Offer, if given later, can be added separately.
                  </div>
                </div>
              )}

              {pricing?.valid && (
                <div style={styles.priceBox}>
                  <PriceRow
                    label={`Stay (${pricing.nights} night${
                      pricing.nights ===
                      1
                        ? ''
                        : 's'
                    })`}
                    value={
                      pricing.staySubtotal
                    }
                  />

                  {Number(
                    pricing.cleaningFee
                  ) > 0 && (
                    <PriceRow
                      label="Cleaning fee"
                      value={
                        pricing.cleaningFee
                      }
                    />
                  )}

                  {Number(
                    pricing.autoDiscountAmount
                  ) > 0 && (
                    <PriceRow
                      label={
                        selectedOffer?.title ||
                        'Discount'
                      }
                      value={
                        -Number(
                          pricing.autoDiscountAmount
                        )
                      }
                      discount
                    />
                  )}

                  <PriceRow
                    label="Taxable amount"
                    value={
                      pricing.taxableAmount
                    }
                  />

                  <PriceRow
                    label="GST @ 18%"
                    value={
                      pricing.gstAmount
                    }
                  />

                  <PriceRow
                    label="Amount incl. GST"
                    value={
                      pricing.amountIncludingGst
                    }
                  />

                  {Number(
                    pricing.securityDeposit
                  ) > 0 && (
                    <PriceRow
                      label="Refundable security deposit"
                      value={
                        pricing.securityDeposit
                      }
                    />
                  )}

                  <div style={styles.totalRow}>
                    <span>
                      Final Payable
                    </span>

                    <strong>
                      {money(
                        pricing.totalPayable
                      )}
                    </strong>
                  </div>
                </div>
              )}

              <hr style={styles.line} />

              {session && (
                <>
                  <InputGroup label="FULL NAME">
                    <input
                      value={
                        guestName
                      }
                      onChange={(
                        event
                      ) =>
                        setGuestName(
                          event.target.value
                        )
                      }
                      style={
                        styles.input
                      }
                    />
                  </InputGroup>

                  <InputGroup label="CONTACT NUMBER">
                    <input
                      value={
                        guestPhone
                      }
                      onChange={(
                        event
                      ) =>
                        setGuestPhone(
                          event.target.value
                        )
                      }
                      style={
                        styles.input
                      }
                    />
                  </InputGroup>

                  <InputGroup label="EMAIL">
                    <input
                      value={
                        guestEmail
                      }
                      disabled
                      style={{
                        ...styles.input,
                        background:
                          '#eef3fa',
                      }}
                    />
                  </InputGroup>

                  <InputGroup label="MESSAGE TO HOST">
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
                      placeholder="Questions, special requests, etc."
                      style={
                        styles.textarea
                      }
                    />
                  </InputGroup>
                </>
              )}

              {bookingError && (
                <div style={styles.error}>
                  {
                    bookingError
                  }
                </div>
              )}

              {bookingSuccess && (
                <div style={styles.success}>
                  <strong>
                    Booking request sent successfully.
                  </strong>

                  <div style={{ marginTop: 7 }}>
                    Booking reference:{' '}
                    <strong>
                      {
                        bookingSuccess.bookingCode
                      }
                    </strong>
                  </div>

                  <div style={{ marginTop: 7 }}>
                    Current booking total:{' '}
                    <strong>
                      {money(
                        bookingSuccess.amount
                      )}
                    </strong>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    The host will review your request before payment is requested.
                  </div>

                  <a
                    href="/account/bookings"
                    style={
                      styles.myBookingsButton
                    }
                  >
                    View My Booking
                  </a>
                </div>
              )}

              {!session ? (
                <button
                  type="button"
                  onClick={
                    redirectToLogin
                  }
                  style={
                    styles.requestButton
                  }
                >
                  Login / Sign Up to Request Booking
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={
                    bookingLoading ||
                    !pricing?.valid ||
                    !availability.available
                  }
                  style={{
                    ...styles.requestButton,

                    opacity:
                      bookingLoading ||
                      !pricing?.valid ||
                      !availability.available
                        ? 0.55
                        : 1,
                  }}
                >
                  {bookingLoading
                    ? 'Sending Request...'
                    : 'Send Booking Request'}
                </button>
              )}

              <div style={styles.paymentNote}>
                No payment is collected until the host approves the booking request.
              </div>
            </form>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Section({
  title,
  children,
}) {
  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>
        {title}
      </h2>

      {children}
    </section>
  );
}

function Fact({
  label,
  value,
}) {
  return (
    <div style={styles.fact}>
      <div style={styles.factLabel}>
        {label}
      </div>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function Feature({
  children,
}) {
  return (
    <div style={styles.feature}>
      ✓ {children}
    </div>
  );
}

function Rule({
  label,
  allowed,
}) {
  return (
    <div style={styles.feature}>
      {allowed
        ? '✓'
        : '✕'}{' '}
      {label}{' '}
      {allowed
        ? 'Allowed'
        : 'Not Allowed'}
    </div>
  );
}

function InputGroup({
  label,
  children,
}) {
  return (
    <div style={styles.inputGroup}>
      <label style={styles.label}>
        {label}
      </label>

      {children}
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
          ? styles.discount
          : {}),
      }}
    >
      <span>
        {label}
      </span>

      <strong>
        {Number(value) < 0
          ? `-${money(
              Math.abs(
                Number(value)
              )
            )}`
          : money(value)}
      </strong>
    </div>
  );
}

const styles = {
  page: {
    minHeight:
      '100vh',
    background:
      '#f6f7f9',
    color:
      '#11213c',
    fontFamily:
      'Arial, sans-serif',
  },

  loading: {
    minHeight:
      '100vh',
    padding:
      '60px 7vw',
    background:
      '#f6f7f9',
    fontFamily:
      'Arial, sans-serif',
  },

  header: {
    minHeight:
      68,
    padding:
      '12px 5vw',
    background:
      '#ffffff',
    borderBottom:
      '1px solid #e2e5e8',
    display:
      'flex',
    justifyContent:
      'space-between',
    alignItems:
      'center',
    gap:
      20,
  },

  brand: {
    color:
      '#17457f',
    fontSize:
      24,
    fontWeight:
      900,
    textDecoration:
      'none',
  },

  accountArea: {
    display:
      'flex',
    alignItems:
      'center',
    gap:
      12,
  },

  accountLink: {
    color:
      '#17457f',
    fontWeight:
      800,
    textDecoration:
      'none',
  },

  loginButton: {
    border:
      0,
    background:
      '#17457f',
    color:
      '#ffffff',
    padding:
      '11px 17px',
    borderRadius:
      9,
    fontWeight:
      800,
    cursor:
      'pointer',
  },

  logoutButton: {
    border:
      '1px solid #ccd1d8',
    background:
      '#ffffff',
    padding:
      '9px 13px',
    borderRadius:
      9,
    cursor:
      'pointer',
  },

  container: {
    maxWidth:
      1350,
    margin:
      '0 auto',
    padding:
      '28px 5vw 80px',
  },

  propertyHeader: {
    display:
      'flex',
    justifyContent:
      'space-between',
    alignItems:
      'flex-end',
    gap:
      20,
    flexWrap:
      'wrap',
    marginBottom:
      24,
  },

  title: {
    margin:
      0,
    fontSize:
      34,
  },

  location: {
    marginTop:
      8,
    color:
      '#687080',
  },

  priceHeader: {
    color:
      '#17457f',
    fontSize:
      24,
  },

  gallery: {
    marginBottom:
      28,
  },

  mainPhoto: {
    width:
      '100%',
    height:
      520,
    objectFit:
      'cover',
    borderRadius:
      18,
  },

  thumbnails: {
    display:
      'flex',
    gap:
      9,
    overflowX:
      'auto',
    paddingTop:
      10,
  },

  thumbnailButton: {
    border:
      '2px solid transparent',
    background:
      '#ffffff',
    borderRadius:
      9,
    padding:
      2,
    cursor:
      'pointer',
  },

  activeThumbnail: {
    border:
      '2px solid #17457f',
  },

  thumbnail: {
    width:
      95,
    height:
      65,
    borderRadius:
      7,
    objectFit:
      'cover',
    display:
      'block',
  },

  layout: {
    display:
      'grid',
    gridTemplateColumns:
      'minmax(0, 1.5fr) minmax(350px, 0.7fr)',
    gap:
      28,
    alignItems:
      'start',
  },

  section: {
    background:
      '#ffffff',
    border:
      '1px solid #e2e5e8',
    borderRadius:
      16,
    padding:
      24,
    marginBottom:
      18,
  },

  sectionTitle: {
    marginTop:
      0,
  },

  description: {
    lineHeight:
      1.7,
    whiteSpace:
      'pre-line',
  },

  factGrid: {
    display:
      'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(160px, 1fr))',
    gap:
      12,
  },

  fact: {
    background:
      '#f7f8fa',
    padding:
      14,
    borderRadius:
      10,
  },

  factLabel: {
    color:
      '#687080',
    fontSize:
      11,
    marginBottom:
      5,
  },

  featureGrid: {
    display:
      'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(200px, 1fr))',
    gap:
      10,
  },

  feature: {
    background:
      '#f7f8fa',
    padding:
      12,
    borderRadius:
      10,
  },

  quietBox: {
    marginTop:
      15,
    padding:
      13,
    background:
      '#fff4d7',
    borderRadius:
      9,
    fontWeight:
      700,
  },

  bookingCard: {
    position:
      'sticky',
    top:
      18,
    background:
      '#ffffff',
    border:
      '1px solid #dfe3e8',
    borderRadius:
      17,
    padding:
      22,
    boxShadow:
      '0 8px 30px rgba(16,24,40,0.07)',
  },

  bookingHeading: {
    marginTop:
      0,
  },

  basePrice: {
    color:
      '#687080',
    marginBottom:
      16,
  },

  loginNotice: {
    padding:
      13,
    background:
      '#eef4ff',
    color:
      '#17457f',
    borderRadius:
      10,
    marginBottom:
      15,
    fontSize:
      13,
  },

  twoColumns: {
    display:
      'grid',
    gridTemplateColumns:
      '1fr 1fr',
    gap:
      10,
  },

  inputGroup: {
    marginBottom:
      14,
  },

  label: {
    display:
      'block',
    fontSize:
      10,
    fontWeight:
      900,
    letterSpacing:
      1,
    marginBottom:
      6,
  },

  input: {
    width:
      '100%',
    boxSizing:
      'border-box',
    padding:
      12,
    border:
      '1px solid #ccd1d8',
    borderRadius:
      9,
  },

  textarea: {
    width:
      '100%',
    boxSizing:
      'border-box',
    minHeight:
      80,
    resize:
      'vertical',
    padding:
      12,
    border:
      '1px solid #ccd1d8',
    borderRadius:
      9,
  },

  available: {
    padding:
      11,
    background:
      '#eaf8ee',
    color:
      '#25663a',
    borderRadius:
      9,
    marginBottom:
      12,
    fontWeight:
      700,
  },

  unavailable: {
    padding:
      11,
    background:
      '#ffeaea',
    color:
      '#8b2020',
    borderRadius:
      9,
    marginBottom:
      12,
    fontWeight:
      700,
  },

  offersBox: {
    padding:
      14,
    background:
      '#fff9e8',
    border:
      '1px solid #efdfad',
    borderRadius:
      11,
    marginBottom:
      15,
  },

  offerHeading: {
    fontWeight:
      900,
    marginBottom:
      10,
  },

  offerOption: {
    display:
      'flex',
    alignItems:
      'center',
    gap:
      8,
    padding:
      '8px 0',
    cursor:
      'pointer',
  },

  offerRule: {
    marginTop:
      9,
    fontSize:
      11,
    color:
      '#74632f',
  },

  priceBox: {
    padding:
      15,
    background:
      '#f7f8fa',
    borderRadius:
      11,
    marginBottom:
      15,
  },

  priceRow: {
    display:
      'flex',
    justifyContent:
      'space-between',
    gap:
      12,
    marginBottom:
      9,
  },

  discount: {
    color:
      '#208142',
  },

  totalRow: {
    display:
      'flex',
    justifyContent:
      'space-between',
    borderTop:
      '1px solid #d9dde3',
    marginTop:
      7,
    paddingTop:
      12,
    fontSize:
      18,
  },

  line: {
    border:
      0,
    borderTop:
      '1px solid #e5e7eb',
    margin:
      '19px 0',
  },

  error: {
    padding:
      12,
    background:
      '#ffeaea',
    color:
      '#8b2020',
    borderRadius:
      9,
    marginBottom:
      12,
    fontWeight:
      700,
  },

  success: {
    padding:
      14,
    background:
      '#eaf8ee',
    color:
      '#25663a',
    borderRadius:
      10,
    marginBottom:
      13,
  },

  myBookingsButton: {
    display:
      'inline-block',
    marginTop:
      12,
    padding:
      '9px 13px',
    background:
      '#ffffff',
    border:
      '1px solid #25663a',
    color:
      '#25663a',
    borderRadius:
      8,
    fontWeight:
      800,
    textDecoration:
      'none',
  },

  requestButton: {
    width:
      '100%',
    border:
      0,
    padding:
      15,
    borderRadius:
      10,
    background:
      '#17457f',
    color:
      '#ffffff',
    fontWeight:
      900,
    fontSize:
      15,
    cursor:
      'pointer',
  },

  paymentNote: {
    marginTop:
      10,
    textAlign:
      'center',
    color:
      '#687080',
    fontSize:
      11,
  },

  muted: {
    color:
      '#687080',
  },

  smallMuted: {
    color:
      '#687080',
    fontSize:
      11,
  },
};