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
  date.setDate(date.getDate() + days);

  return date.toISOString().slice(0, 10);
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function formatTime(value) {
  if (!value) return '—';

  const [hour, minute] = String(value).slice(0, 5).split(':');
  const date = new Date();

  date.setHours(Number(hour));
  date.setMinutes(Number(minute));

  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function dateDayNumber(dateString) {
  return new Date(`${dateString}T12:00:00`).getDay();
}

function getStayDates(checkIn, checkOut) {
  if (!checkIn || !checkOut) return [];

  const dates = [];
  let current = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);

  while (current < end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function offerEligibleForBooking(
  offer,
  checkIn,
  checkOut,
  nights
) {
  if (!offer || !checkIn || !checkOut || nights <= 0) {
    return false;
  }

  if (!offer.is_active || offer.guest_selectable === false) {
    return false;
  }

  const offerCategory = String(
    offer.offer_category || ''
  ).toLowerCase();

  let requiredNights = Number(offer.min_nights || 1);

  if (offerCategory === 'monthly') {
    requiredNights = Math.max(requiredNights, 20);
  } else if (offerCategory === 'fortnightly') {
    requiredNights = Math.max(requiredNights, 12);
  } else if (offerCategory === 'weekly') {
    requiredNights = Math.max(requiredNights, 6);
  }

  if (nights < requiredNights) return false;

  const stayDates = getStayDates(checkIn, checkOut);
  const startDate = offer.start_date || null;
  const endDate = offer.end_date || null;

  const allowedDays = Array.isArray(offer.applicable_days)
    ? offer.applicable_days
    : [];

  const eligibleDates = stayDates.filter((date) => {
    if (startDate && date < startDate) return false;
    if (endDate && date > endDate) return false;

    if (
      allowedDays.length &&
      !allowedDays.includes(dateDayNumber(date))
    ) {
      return false;
    }

    return true;
  });

  if (offer.apply_scope === 'entire_booking') {
    return eligibleDates.length === stayDates.length;
  }

  return eligibleDates.length > 0;
}

function calculateRegularDiscount(
  pricing,
  offer,
  checkIn,
  checkOut
) {
  if (!pricing?.valid || !offer) {
    return {
      discountAmount: 0,
      eligibleAmount: 0,
    };
  }

  const stayDates = getStayDates(checkIn, checkOut);

  const allowedDays = Array.isArray(offer.applicable_days)
    ? offer.applicable_days
    : [];

  const dateIsEligible = (date) => {
    if (offer.start_date && date < offer.start_date) return false;
    if (offer.end_date && date > offer.end_date) return false;

    if (
      allowedDays.length &&
      !allowedDays.includes(dateDayNumber(date))
    ) {
      return false;
    }

    return true;
  };

  let eligibleAmount = 0;

  if (offer.apply_scope === 'entire_booking') {
    eligibleAmount = Number(pricing.staySubtotal || 0);
  } else {
    const breakdown = Array.isArray(pricing.nightlyBreakdown)
      ? pricing.nightlyBreakdown
      : [];

    if (breakdown.length) {
      breakdown.forEach((night) => {
        if (dateIsEligible(night.date)) {
          eligibleAmount += Number(night.rate || 0);
        }
      });
    } else {
      const eligibleNightCount =
        stayDates.filter(dateIsEligible).length;

      const averageNight =
        Number(pricing.staySubtotal || 0) /
        Math.max(Number(pricing.nights || 1), 1);

      eligibleAmount = averageNight * eligibleNightCount;
    }
  }

  let discountAmount = 0;

  if (offer.discount_type === 'percent') {
    discountAmount =
      eligibleAmount *
      (Number(offer.discount_value || 0) / 100);
  } else {
    discountAmount = Number(offer.discount_value || 0);
  }

  discountAmount = Math.max(
    0,
    Math.min(discountAmount, eligibleAmount)
  );

  return {
    eligibleAmount:
      Math.round(eligibleAmount * 100) / 100,

    discountAmount:
      Math.round(discountAmount * 100) / 100,
  };
}

export default function PropertyPage() {
  const params = useParams();
  const slug = params?.slug;

  const [property, setProperty] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [rateOverrides, setRateOverrides] = useState([]);
  const [propertyOffers, setPropertyOffers] = useState([]);
  const [blockedDates, setBlockedDates] = useState([]);
  const [existingBookings, setExistingBookings] = useState([]);

  const [session, setSession] = useState(null);
  const [guestProfile, setGuestProfile] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [activePhoto, setActivePhoto] = useState(0);

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestCount, setGuestCount] = useState(1);
  const [selectedOfferId, setSelectedOfferId] = useState('');

  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestMessage, setGuestMessage] = useState('');

  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(null);

  useEffect(() => {
    checkGuestLogin();
  }, []);

  useEffect(() => {
    if (slug) loadProperty();
  }, [slug]);

  async function checkGuestLogin() {
    setAuthChecking(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);

      if (!session) return;

      const { data: guest, error } = await supabase
        .from('guests')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error) console.error(error);

      if (guest) {
        setGuestProfile(guest);
        setGuestName(guest.full_name || '');
        setGuestPhone(guest.phone || '');

        setGuestEmail(
          guest.email ||
            session.user.email ||
            ''
        );
      } else {
        const fallbackName =
          session.user.user_metadata?.full_name || '';

        setGuestName(fallbackName);
        setGuestEmail(session.user.email || '');
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
        data: propertyData,
        error: propertyError,
      } = await supabase
        .from('properties')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (propertyError || !propertyData) {
        throw new Error(
          'Property not found or currently unavailable.'
        );
      }

      setProperty(propertyData);

      setGuestCount(
        Math.max(Number(propertyData.min_guests || 1), 1)
      );

      const [
        photoResult,
        offerResult,
        pricingResult,
        rateOverrideResult,
        blockedResult,
        bookingResult,
      ] = await Promise.all([
        supabase
          .from('property_photos')
          .select('*')
          .eq('property_id', propertyData.id)
          .order('is_cover', { ascending: false })
          .order('sort_order', { ascending: true }),

        supabase
          .from('property_offers')
          .select('*')
          .eq('property_id', propertyData.id)
          .eq('is_active', true),

        supabase
          .from('pricing_rules')
          .select('*')
          .eq('property_id', propertyData.id)
          .eq('is_active', true)
          .order('priority', { ascending: false }),

        supabase
          .from('property_rate_overrides')
          .select('*')
          .eq('property_id', propertyData.id)
          .eq('is_active', true)
          .order('start_date', { ascending: true }),

        supabase
          .from('blocked_dates')
          .select('start_date, end_date')
          .eq('property_id', propertyData.id),

        supabase
          .from('bookings')
          .select(
            'check_in, check_out, booking_status, payment_status'
          )
          .eq('property_id', propertyData.id)
          .eq('booking_status', 'confirmed')
          .eq('payment_status', 'paid'),
      ]);

      setPhotos(photoResult.data || []);
      setPropertyOffers(offerResult.data || []);
      setRateOverrides(rateOverrideResult.data || []);
      setBlockedDates(blockedResult.data || []);
      setExistingBookings(bookingResult.data || []);

      const mappedRules = (pricingResult.data || []).map(
        (rule) => ({
          ...rule,
          type: rule.rule_type,

          percent:
            rule.adjustment_type === 'percent'
              ? Number(rule.adjustment_value || 0)
              : undefined,

          value: Number(rule.adjustment_value || 0),
          label: rule.name,
          adjustmentType: rule.adjustment_type,
        })
      );

      setPricingRules(mappedRules);
    } catch (error) {
      console.error(error);
      setPageError(error.message);
    } finally {
      setLoading(false);
    }
  }

  const availableOffers = useMemo(() => {
    if (!checkIn || !checkOut) return [];

    const nights = getStayDates(checkIn, checkOut).length;

    return propertyOffers.filter((offer) =>
      offerEligibleForBooking(
        offer,
        checkIn,
        checkOut,
        nights
      )
    );
  }, [propertyOffers, checkIn, checkOut]);

  useEffect(() => {
    if (
      selectedOfferId &&
      !availableOffers.some(
        (offer) => offer.id === selectedOfferId
      )
    ) {
      setSelectedOfferId('');
    }
  }, [availableOffers, selectedOfferId]);

  const selectedOffer = useMemo(
    () =>
      availableOffers.find(
        (offer) => offer.id === selectedOfferId
      ) || null,
    [availableOffers, selectedOfferId]
  );

  const pricing = useMemo(() => {
    if (!property || !checkIn || !checkOut) {
      return { valid: false };
    }

    try {
      const result = calculateBookingPrice({
        property,
        guestCount: Number(guestCount || 1),
        checkIn,
        checkOut,
        pricingRules,
        rateOverrides,
        gstRate: 18,
      });

      if (!result || result.valid === false) {
        return result || { valid: false };
      }

      let regularDiscount = {
        discountAmount: 0,
        eligibleAmount: 0,
      };

      if (selectedOffer) {
        regularDiscount = calculateRegularDiscount(
          result,
          selectedOffer,
          checkIn,
          checkOut
        );
      }

      const discountAmount = Number(
        regularDiscount.discountAmount || 0
      );

      const subtotalBeforeDiscount = Number(
        result.amountBeforeDiscount ??
          result.staySubtotal ??
          0
      );

      const subtotalAfterDiscount = Math.max(
        0,
        subtotalBeforeDiscount - discountAmount
      );

      const gstAmount =
        Math.round(subtotalAfterDiscount * 0.18 * 100) /
        100;

      const totalPayable =
        Math.round(
          (
            subtotalAfterDiscount +
            gstAmount +
            Number(result.securityDeposit || 0)
          ) *
            100
        ) / 100;

      return {
        ...result,
        regularDiscountAmount: discountAmount,
        selectedOffer,
        subtotalBeforeDiscount,
        subtotalAfterDiscount,
        gstAmount,
        total: totalPayable,
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
  }, [
    property,
    checkIn,
    checkOut,
    guestCount,
    pricingRules,
    rateOverrides,
    selectedOffer,
  ]);

  function datesUnavailable(start, end) {
    if (!start || !end) return false;

    const manuallyBlocked = blockedDates.some((block) =>
      rangesOverlap(
        start,
        end,
        block.start_date,
        addDays(block.end_date, 1)
      )
    );

    if (manuallyBlocked) return true;

    return existingBookings.some(
      (booking) =>
        booking.booking_status === 'confirmed' &&
        booking.payment_status === 'paid' &&
        rangesOverlap(
          start,
          end,
          booking.check_in,
          booking.check_out
        )
    );
  }

  const selectedDatesUnavailable = useMemo(
    () => datesUnavailable(checkIn, checkOut),
    [
      checkIn,
      checkOut,
      blockedDates,
      existingBookings,
    ]
  );

  function changeCheckIn(value) {
    setCheckIn(value);
    setBookingError('');
    setBookingSuccess(null);

    if (value && checkOut && checkOut <= value) {
      setCheckOut(addDays(value, 1));
    }
  }

  function changeCheckOut(value) {
    setCheckOut(value);
    setBookingError('');
    setBookingSuccess(null);
  }

  function changeGuests(value) {
    const minimum = Math.max(
      Number(property?.min_guests || 1),
      1
    );

    const maximum = Math.max(
      Number(property?.max_guests || minimum),
      minimum
    );

    const nextValue = Math.min(
      maximum,
      Math.max(minimum, Number(value || minimum))
    );

    setGuestCount(nextValue);
    setBookingError('');
    setBookingSuccess(null);
  }

  function redirectToLogin() {
    if (typeof window === 'undefined') return;

    const returnUrl =
      `${window.location.pathname}${window.location.search}`;

    window.location.href =
      `/login?redirect=${encodeURIComponent(returnUrl)}`;
  }

  async function ensureGuestProfile() {
    if (!session?.user) return null;
    if (guestProfile) return guestProfile;

    const {
      data: existingGuest,
      error: existingError,
    } = await supabase
      .from('guests')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingGuest) {
      setGuestProfile(existingGuest);
      return existingGuest;
    }

    const {
      data: newGuest,
      error: createError,
    } = await supabase
      .from('guests')
      .insert({
        user_id: session.user.id,

        full_name:
          guestName.trim() ||
          session.user.user_metadata?.full_name ||
          session.user.email?.split('@')[0] ||
          'Guest',

        email:
          guestEmail.trim() ||
          session.user.email ||
          null,

        phone: guestPhone.trim() || null,
      })
      .select('*')
      .single();

    if (createError) throw createError;

    setGuestProfile(newGuest);
    return newGuest;
  }

  async function updateGuestDetails(guest) {
    if (!guest?.id) return guest;

    const payload = {
      full_name: guestName.trim(),
      phone: guestPhone.trim(),
      email: guestEmail.trim(),
    };

    const { data, error } = await supabase
      .from('guests')
      .update(payload)
      .eq('id', guest.id)
      .select('*')
      .single();

    if (error) throw error;

    setGuestProfile(data);
    return data;
  }

  async function submitBookingRequest(event) {
    event.preventDefault();

    setBookingError('');
    setBookingSuccess(null);

    if (authChecking) return;

    if (!session?.user) {
      redirectToLogin();
      return;
    }

    if (!property) {
      setBookingError(
        'Property information is unavailable.'
      );
      return;
    }

    if (!checkIn || !checkOut) {
      setBookingError(
        'Please select check-in and check-out dates.'
      );
      return;
    }

    if (checkOut <= checkIn) {
      setBookingError(
        'Check-out must be after check-in.'
      );
      return;
    }

    if (checkIn < todayString()) {
      setBookingError(
        'Check-in date cannot be in the past.'
      );
      return;
    }

    const nights = getStayDates(checkIn, checkOut).length;

    if (
      nights <
      Number(property.min_stay_nights || 1)
    ) {
      setBookingError(
        `Minimum stay is ${
          property.min_stay_nights || 1
        } night(s).`
      );
      return;
    }

    if (
      property.max_stay_nights &&
      nights > Number(property.max_stay_nights)
    ) {
      setBookingError(
        `Maximum stay is ${property.max_stay_nights} nights.`
      );
      return;
    }

    if (
      Number(guestCount) <
      Number(property.min_guests || 1)
    ) {
      setBookingError(
        `Minimum guests: ${property.min_guests || 1}.`
      );
      return;
    }

    if (
      Number(guestCount) >
      Number(property.max_guests || guestCount)
    ) {
      setBookingError(
        `Maximum guests: ${property.max_guests}.`
      );
      return;
    }

    if (!guestName.trim()) {
      setBookingError('Please enter your full name.');
      return;
    }

    if (!guestPhone.trim()) {
      setBookingError('Please enter your phone number.');
      return;
    }

    if (!guestEmail.trim()) {
      setBookingError('Please enter your email address.');
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
      setSelectedOfferId('');

      setBookingError(
        'The selected discount is not eligible for these booking dates or stay duration.'
      );
      return;
    }

    if (selectedDatesUnavailable) {
      setBookingError(
        'These dates are already booked.'
      );
      return;
    }

    if (!pricing?.valid) {
      setBookingError(
        pricing?.error ||
          'Unable to calculate booking price.'
      );
      return;
    }

    setBookingLoading(true);

    try {
      const [
        latestBlockedResult,
        latestBookingsResult,
      ] = await Promise.all([
        supabase
          .from('blocked_dates')
          .select('start_date, end_date')
          .eq('property_id', property.id),

        supabase
          .from('bookings')
          .select(
            'id, check_in, check_out, booking_status, payment_status'
          )
          .eq('property_id', property.id)
          .eq('booking_status', 'confirmed')
          .eq('payment_status', 'paid'),
      ]);

      if (latestBlockedResult.error) {
        throw latestBlockedResult.error;
      }

      if (latestBookingsResult.error) {
        throw latestBookingsResult.error;
      }

      const latestManualConflict =
        (latestBlockedResult.data || []).some((block) =>
          rangesOverlap(
            checkIn,
            checkOut,
            block.start_date,
            addDays(block.end_date, 1)
          )
        );

      const latestBookingConflict =
        (latestBookingsResult.data || []).some(
          (booking) =>
            booking.booking_status === 'confirmed' &&
            booking.payment_status === 'paid' &&
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
          'These dates are already booked.'
        );

        setExistingBookings(
          latestBookingsResult.data || []
        );

        setBlockedDates(
          latestBlockedResult.data || []
        );

        return;
      }

      let guest = await ensureGuestProfile();
      guest = await updateGuestDetails(guest);

      const bookingPayload = {
        property_id: property.id,
        guest_id: guest.id,
        check_in: checkIn,
        check_out: checkOut,
        guest_count: Number(guestCount),
        guest_name: guestName.trim(),
        guest_phone: guestPhone.trim(),
        guest_email: guestEmail.trim(),
        guest_message: guestMessage.trim() || null,

        booking_status: 'pending',
        payment_status: 'unpaid',

        selected_offer_id:
          selectedOffer?.id || null,

        selected_offer_title:
          selectedOffer?.title || null,

        discount_amount: Number(
          pricing.regularDiscountAmount || 0
        ),

        subtotal: Number(
          pricing.subtotalBeforeDiscount || 0
        ),

        total_amount: Number(
          pricing.totalPayable ||
            pricing.total ||
            0
        ),

        nights: Number(
          pricing.nights || nights
        ),
      };

      const {
        data: createdBooking,
        error: bookingInsertError,
      } = await supabase
        .from('bookings')
        .insert(bookingPayload)
        .select('*')
        .single();

      if (bookingInsertError) {
        throw bookingInsertError;
      }

      setBookingSuccess(createdBooking);
      setGuestMessage('');
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
      setBookingLoading(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.centerMessage}>
          Loading property...
        </div>
      </main>
    );
  }

  if (pageError || !property) {
    return (
      <main style={styles.page}>
        <div style={styles.centerMessage}>
          <h2>Property unavailable</h2>

          <p>
            {pageError ||
              'This property could not be loaded.'}
          </p>

          <a href="/" style={styles.homeLink}>
            Back to NightOutStays
          </a>
        </div>
      </main>
    );
  }

  const coverPhoto =
    photos[activePhoto] ||
    photos[0] ||
    null;

  const minimumCheckout = checkIn
    ? addDays(
        checkIn,
        Math.max(
          Number(property.min_stay_nights || 1),
          1
        )
      )
    : todayString();

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <a href="/" style={styles.logo}>
          NightOutStays
        </a>

        <div style={styles.headerActions}>
          {session ? (
            <>
              <a
                href="/account/bookings"
                style={styles.headerLink}
              >
                My Bookings
              </a>

              <a
                href="/account/messages"
                style={styles.headerLink}
              >
                Messages
              </a>
            </>
          ) : (
            <a
              href={`/login?redirect=${encodeURIComponent(
                `/property/${property.slug}`
              )}`}
              style={styles.loginButton}
            >
              Guest Login
            </a>
          )}
        </div>
      </header>

      <div style={styles.container}>
        <section style={styles.titleSection}>
          <div>
            <h1 style={styles.propertyTitle}>
              {property.name}
            </h1>

            <div style={styles.location}>
              {property.location_name}
            </div>
          </div>

          <div style={styles.basePrice}>
            <strong>
              {money(property.base_price)}
            </strong>
            <span> / night</span>
          </div>
        </section>

        <section style={styles.gallery}>
          <div style={styles.mainPhotoBox}>
            {coverPhoto ? (
              <img
                src={coverPhoto.photo_url}
                alt={
                  coverPhoto.alt_text ||
                  property.name
                }
                style={styles.mainPhoto}
              />
            ) : (
              <div style={styles.noPhoto}>
                Property photo
              </div>
            )}
          </div>

          {photos.length > 1 && (
            <div style={styles.thumbnailRow}>
              {photos.map((photo, index) => (
                <button
                  type="button"
                  key={photo.id || index}
                  onClick={() =>
                    setActivePhoto(index)
                  }
                  style={{
                    ...styles.thumbnailButton,
                    ...(index === activePhoto
                      ? styles.activeThumbnail
                      : {}),
                  }}
                >
                  <img
                    src={photo.photo_url}
                    alt={
                      photo.alt_text ||
                      `${property.name} ${index + 1}`
                    }
                    style={styles.thumbnail}
                  />
                </button>
              ))}
            </div>
          )}
        </section>

        <div style={styles.contentGrid}>
          <div>
            <section style={styles.infoCard}>
              <h2>About this stay</h2>

              {property.short_description && (
                <p style={styles.description}>
                  {property.short_description}
                </p>
              )}

              {property.description && (
                <p style={styles.description}>
                  {property.description}
                </p>
              )}

              <div style={styles.quickFacts}>
                <Fact
                  label="Bedrooms"
                  value={property.bedrooms || 0}
                />

                <Fact
                  label="Bathrooms"
                  value={property.bathrooms || 0}
                />

                <Fact
                  label="Guests"
                  value={`Up to ${
                    property.max_guests || 1
                  }`}
                />

                <Fact
                  label="Minimum stay"
                  value={`${
                    property.min_stay_nights || 1
                  } night(s)`}
                />
              </div>
            </section>

            <section style={styles.infoCard}>
              <h2>Stay details</h2>

              <div style={styles.detailGrid}>
                <Detail
                  label="Check-in"
                  value={formatTime(
                    property.check_in_time
                  )}
                />

                <Detail
                  label="Check-out"
                  value={formatTime(
                    property.check_out_time
                  )}
                />

                <Detail
                  label="Base rate"
                  value={money(property.base_price)}
                />

                <Detail
                  label="Maximum guests"
                  value={property.max_guests || 1}
                />
              </div>
            </section>

            {property.amenities && (
              <section style={styles.infoCard}>
                <h2>Amenities</h2>

                <p style={styles.description}>
                  {Array.isArray(property.amenities)
                    ? property.amenities.join(' • ')
                    : property.amenities}
                </p>
              </section>
            )}

            {property.house_rules && (
              <section style={styles.infoCard}>
                <h2>House rules</h2>

                <p style={styles.description}>
                  {Array.isArray(property.house_rules)
                    ? property.house_rules.join(' • ')
                    : property.house_rules}
                </p>
              </section>
            )}

            <section style={styles.infoCard}>
              <h2>Availability</h2>

              <p style={styles.description}>
                Check live availability and nightly rates below.
                Rates can vary by date. Host special rates are
                automatically shown. Pending booking requests
                do not block dates.
              </p>

              <GuestAvailabilityCalendar
                property={property}
                pricingRules={pricingRules}
                rateOverrides={rateOverrides}
                blockedDates={blockedDates}
                existingBookings={existingBookings}
                guestCount={guestCount}
                checkIn={checkIn}
                checkOut={checkOut}
                onCheckInChange={changeCheckIn}
                onCheckOutChange={changeCheckOut}
              />
            </section>
          </div>
          <aside style={styles.bookingCard}>
            <div style={styles.bookingPrice}>
              {money(property.base_price)}

              <span style={styles.perNight}>
                {' '}
                / night
              </span>
            </div>

            <form onSubmit={submitBookingRequest}>
              <div style={styles.dateGrid}>
                <div>
                  <label style={styles.label}>
                    CHECK-IN
                  </label>

                  <input
                    type="date"
                    value={checkIn}
                    min={todayString()}
                    onChange={(event) =>
                      changeCheckIn(event.target.value)
                    }
                    style={styles.input}
                  />
                </div>

                <div>
                  <label style={styles.label}>
                    CHECK-OUT
                  </label>

                  <input
                    type="date"
                    value={checkOut}
                    min={minimumCheckout}
                    onChange={(event) =>
                      changeCheckOut(event.target.value)
                    }
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>
                  GUESTS
                </label>

                <input
                  type="number"
                  min={property.min_guests || 1}
                  max={property.max_guests || 1}
                  value={guestCount}
                  onChange={(event) =>
                    changeGuests(event.target.value)
                  }
                  style={styles.input}
                />
              </div>

              {checkIn && checkOut && (
                <div style={styles.discountSection}>
                  <label style={styles.label}>
                    AVAILABLE DISCOUNT
                  </label>

                  <select
                    value={selectedOfferId}
                    onChange={(event) =>
                      setSelectedOfferId(event.target.value)
                    }
                    style={styles.input}
                  >
                    <option value="">
                      No discount
                    </option>

                    {availableOffers.map((offer) => (
                      <option
                        key={offer.id}
                        value={offer.id}
                      >
                        {offer.title}
                        {' — '}

                        {offer.discount_type === 'percent'
                          ? `${Number(
                              offer.discount_value || 0
                            )}% OFF`
                          : `${money(
                              offer.discount_value
                            )} OFF`}
                      </option>
                    ))}
                  </select>

                  {availableOffers.length === 0 && (
                    <div style={styles.smallNote}>
                      No stay discount is eligible for the
                      selected dates and number of nights.
                    </div>
                  )}

                  {selectedOffer && (
                    <div style={styles.offerNotice}>
                      <strong>
                        {selectedOffer.title}
                      </strong>

                      <div>
                        {selectedOffer.discount_type ===
                        'percent'
                          ? `${Number(
                              selectedOffer.discount_value || 0
                            )}% discount`
                          : `${money(
                              selectedOffer.discount_value
                            )} discount`}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedDatesUnavailable && (
                <div style={styles.errorBox}>
                  These dates are already booked or blocked
                  by the host.
                </div>
              )}

              {pricing?.valid && (
                <div style={styles.priceBox}>
                  <div style={styles.priceRow}>
                    <span>Stay</span>

                    <span>
                      {money(
                        pricing.staySubtotal ||
                          pricing.subtotalBeforeDiscount ||
                          0
                      )}
                    </span>
                  </div>

                  <div style={styles.priceRow}>
                    <span>Nights</span>
                    <span>{pricing.nights}</span>
                  </div>

                  {Number(
                    pricing.regularDiscountAmount || 0
                  ) > 0 && (
                    <div style={styles.discountRow}>
                      <span>
                        {selectedOffer?.title || 'Discount'}
                      </span>

                      <span>
                        -
                        {money(
                          pricing.regularDiscountAmount
                        )}
                      </span>
                    </div>
                  )}

                  {Number(
                    pricing.extraGuestCharge || 0
                  ) > 0 && (
                    <div style={styles.priceRow}>
                      <span>Extra guest charge</span>

                      <span>
                        {money(pricing.extraGuestCharge)}
                      </span>
                    </div>
                  )}

                  {Number(pricing.cleaningFee || 0) > 0 && (
                    <div style={styles.priceRow}>
                      <span>Cleaning fee</span>

                      <span>
                        {money(pricing.cleaningFee)}
                      </span>
                    </div>
                  )}

                  {Number(pricing.gstAmount || 0) > 0 && (
                    <div style={styles.priceRow}>
                      <span>GST (18%)</span>

                      <span>
                        {money(pricing.gstAmount)}
                      </span>
                    </div>
                  )}

                  {Number(
                    pricing.securityDeposit || 0
                  ) > 0 && (
                    <div style={styles.priceRow}>
                      <span>Security deposit</span>

                      <span>
                        {money(pricing.securityDeposit)}
                      </span>
                    </div>
                  )}

                  <div style={styles.totalRow}>
                    <strong>Total</strong>

                    <strong>
                      {money(
                        pricing.totalPayable ||
                          pricing.total
                      )}
                    </strong>
                  </div>
                </div>
              )}

              {!session && (
                <div style={styles.loginNotice}>
                  You can check dates, rates and discounts
                  without logging in. Login is required when
                  you send the booking request.
                </div>
              )}

              {session && (
                <>
                  <div style={styles.field}>
                    <label style={styles.label}>
                      FULL NAME
                    </label>

                    <input
                      type="text"
                      value={guestName}
                      onChange={(event) =>
                        setGuestName(event.target.value)
                      }
                      placeholder="Your full name"
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>
                      PHONE
                    </label>

                    <input
                      type="tel"
                      value={guestPhone}
                      onChange={(event) =>
                        setGuestPhone(event.target.value)
                      }
                      placeholder="Mobile number"
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>
                      EMAIL
                    </label>

                    <input
                      type="email"
                      value={guestEmail}
                      onChange={(event) =>
                        setGuestEmail(event.target.value)
                      }
                      placeholder="Email address"
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>
                      MESSAGE TO HOST
                    </label>

                    <textarea
                      value={guestMessage}
                      onChange={(event) =>
                        setGuestMessage(event.target.value)
                      }
                      placeholder="Tell the host anything important about your stay."
                      rows={4}
                      style={{
                        ...styles.input,
                        resize: 'vertical',
                      }}
                    />
                  </div>
                </>
              )}

              {bookingError && (
                <div style={styles.errorBox}>
                  {bookingError}
                </div>
              )}

              {bookingSuccess && (
                <div style={styles.successBox}>
                  <strong>
                    Booking request sent successfully.
                  </strong>

                  <div style={styles.successText}>
                    Your dates are not blocked yet. They
                    become booked after the booking is
                    confirmed and payment is successfully
                    completed.
                  </div>

                  <div style={styles.successActions}>
                    <a
                      href="/account/bookings"
                      style={styles.successLink}
                    >
                      View My Bookings
                    </a>

                    <a
                      href="/account/messages"
                      style={styles.successLink}
                    >
                      Messages
                    </a>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={
                  bookingLoading ||
                  authChecking ||
                  selectedDatesUnavailable
                }
                style={{
                  ...styles.bookingButton,

                  ...(bookingLoading ||
                  authChecking ||
                  selectedDatesUnavailable
                    ? styles.disabledButton
                    : {}),
                }}
              >
                {authChecking
                  ? 'Checking account...'
                  : bookingLoading
                  ? 'Sending Request...'
                  : session
                  ? 'Request Booking'
                  : 'Login to Request Booking'}
              </button>

              <div style={styles.bookingNote}>
                Sending a request does not immediately
                reserve or block the dates.
              </div>
            </form>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Fact({ label, value }) {
  return (
    <div style={styles.fact}>
      <div style={styles.factValue}>
        {value}
      </div>

      <div style={styles.factLabel}>
        {label}
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div style={styles.detail}>
      <div style={styles.detailLabel}>
        {label}
      </div>

      <div style={styles.detailValue}>
        {value}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f6f7f9',
    color: '#11213c',
    fontFamily: 'Arial, sans-serif',
  },

  header: {
    minHeight: 68,
    padding: '12px 5vw',
    background: '#ffffff',
    borderBottom: '1px solid #e2e5e8',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
  },

  logo: {
    color: '#17457f',
    fontSize: 24,
    fontWeight: 900,
    textDecoration: 'none',
  },

  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },

  headerLink: {
    color: '#17457f',
    fontWeight: 800,
    textDecoration: 'none',
    fontSize: 13,
  },

  loginButton: {
    display: 'inline-block',
    border: 0,
    background: '#17457f',
    color: '#ffffff',
    padding: '10px 15px',
    borderRadius: 9,
    fontWeight: 800,
    textDecoration: 'none',
  },

  container: {
    maxWidth: 1350,
    margin: '0 auto',
    padding: '28px 5vw 80px',
  },

  centerMessage: {
    maxWidth: 650,
    margin: '80px auto',
    padding: 30,
    background: '#ffffff',
    border: '1px solid #e2e5e8',
    borderRadius: 16,
    textAlign: 'center',
  },

  homeLink: {
    display: 'inline-block',
    marginTop: 14,
    padding: '10px 15px',
    borderRadius: 9,
    background: '#17457f',
    color: '#ffffff',
    textDecoration: 'none',
    fontWeight: 800,
  },

  titleSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 20,
    flexWrap: 'wrap',
    marginBottom: 24,
  },

  propertyTitle: {
    margin: 0,
    fontSize: 34,
  },

  location: {
    marginTop: 8,
    color: '#687080',
  },

  basePrice: {
    color: '#17457f',
    fontSize: 24,
  },

  gallery: {
    marginBottom: 28,
  },

  mainPhotoBox: {
    width: '100%',
    minHeight: 420,
    borderRadius: 18,
    overflow: 'hidden',
    background: '#e9edf2',
  },

  mainPhoto: {
    width: '100%',
    height: 520,
    objectFit: 'cover',
    display: 'block',
  },

  noPhoto: {
    height: 420,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#687080',
    fontWeight: 800,
  },

  thumbnailRow: {
    display: 'flex',
    gap: 9,
    overflowX: 'auto',
    paddingTop: 10,
  },

  thumbnailButton: {
    border: '2px solid transparent',
    background: '#ffffff',
    borderRadius: 9,
    padding: 2,
    cursor: 'pointer',
  },

  activeThumbnail: {
    border: '2px solid #17457f',
  },

  thumbnail: {
    width: 95,
    height: 65,
    borderRadius: 7,
    objectFit: 'cover',
    display: 'block',
  },

  contentGrid: {
    display: 'grid',
    gridTemplateColumns:
      'minmax(0, 1.45fr) minmax(340px, 0.7fr)',
    gap: 28,
    alignItems: 'start',
  },

  infoCard: {
    marginBottom: 20,
    padding: 22,
    background: '#ffffff',
    border: '1px solid #e2e5e8',
    borderRadius: 15,
  },

  description: {
    color: '#56606e',
    lineHeight: 1.65,
  },

  quickFacts: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(130px, 1fr))',
    gap: 12,
    marginTop: 18,
  },

  fact: {
    padding: 14,
    background: '#f7f8fa',
    borderRadius: 10,
  },

  factValue: {
    fontSize: 18,
    fontWeight: 900,
    color: '#17457f',
  },

  factLabel: {
    marginTop: 4,
    color: '#687080',
    fontSize: 11,
  },

  detailGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
  },

  detail: {
    padding: 13,
    border: '1px solid #e2e5e8',
    borderRadius: 10,
  },

  detailLabel: {
    color: '#687080',
    fontSize: 11,
  },

  detailValue: {
    marginTop: 5,
    fontWeight: 800,
  },

  availabilityLegend: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 15,
  },

  availableLegend: {
    padding: '7px 10px',
    borderRadius: 20,
    background: '#eaf8ee',
    color: '#25663a',
    fontSize: 11,
    fontWeight: 800,
  },

  bookedLegend: {
    padding: '7px 10px',
    borderRadius: 20,
    background: '#ffeaea',
    color: '#8b2020',
    fontSize: 11,
    fontWeight: 800,
  },

  bookingCard: {
    position: 'sticky',
    top: 18,
    padding: 22,
    background: '#ffffff',
    border: '1px solid #dfe3e8',
    borderRadius: 16,
    boxShadow:
      '0 8px 28px rgba(16,24,40,0.07)',
  },

  bookingPrice: {
    marginBottom: 20,
    color: '#17457f',
    fontSize: 25,
    fontWeight: 900,
  },

  perNight: {
    fontSize: 13,
    fontWeight: 600,
    color: '#687080',
  },

  dateGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },

  field: {
    marginTop: 14,
  },

  label: {
    display: 'block',
    marginBottom: 6,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.8,
  },

  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: 11,
    border: '1px solid #ccd1d8',
    borderRadius: 9,
    background: '#ffffff',
    fontSize: 14,
  },

  discountSection: {
    marginTop: 16,
    padding: 13,
    background: '#fffaf0',
    border: '1px solid #f0dfb4',
    borderRadius: 10,
  },

  smallNote: {
    marginTop: 8,
    color: '#687080',
    fontSize: 11,
    lineHeight: 1.4,
  },

  offerNotice: {
    marginTop: 10,
    padding: 10,
    background: '#fff4d8',
    borderRadius: 8,
    color: '#735800',
    fontSize: 12,
  },

  priceBox: {
    marginTop: 18,
    padding: 14,
    background: '#f7f8fa',
    borderRadius: 10,
  },

  priceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    padding: '7px 0',
    fontSize: 13,
  },

  discountRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    padding: '7px 0',
    color: '#26733d',
    fontWeight: 800,
    fontSize: 13,
  },

  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 9,
    paddingTop: 12,
    borderTop: '1px solid #dfe3e8',
    fontSize: 17,
  },

  loginNotice: {
    marginTop: 15,
    padding: 12,
    borderRadius: 9,
    background: '#eef4fb',
    color: '#17457f',
    fontSize: 12,
    lineHeight: 1.5,
  },

  errorBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 9,
    background: '#ffeaea',
    color: '#8b2020',
    fontWeight: 700,
    fontSize: 12,
    lineHeight: 1.4,
  },

  successBox: {
    marginTop: 14,
    padding: 13,
    borderRadius: 9,
    background: '#eaf8ee',
    color: '#25663a',
    fontSize: 12,
    lineHeight: 1.5,
  },

  successText: {
    marginTop: 7,
  },

  successActions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 11,
  },

  successLink: {
    display: 'inline-block',
    padding: '8px 11px',
    borderRadius: 8,
    background: '#ffffff',
    border: '1px solid #b9d9c4',
    color: '#25663a',
    textDecoration: 'none',
    fontWeight: 800,
  },

  bookingButton: {
    width: '100%',
    marginTop: 18,
    border: 0,
    padding: 14,
    borderRadius: 10,
    background: '#17457f',
    color: '#ffffff',
    fontWeight: 900,
    fontSize: 14,
    cursor: 'pointer',
  },

  disabledButton: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },

  bookingNote: {
    marginTop: 9,
    textAlign: 'center',
    color: '#687080',
    fontSize: 10,
    lineHeight: 1.4,
  },
};