'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { calculateBookingPrice } from '../../lib/pricing';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

function formatMoney(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`;
}

function formatTime(value) {
  if (!value) return '';

  const [hour, minute] = value.slice(0, 5).split(':');
  const date = new Date();

  date.setHours(Number(hour));
  date.setMinutes(Number(minute));

  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
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

export default function PropertyPage() {
  const params = useParams();
  const slug = params?.slug;

  const [property, setProperty] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [offers, setOffers] = useState([]);
  const [blockedDates, setBlockedDates] = useState([]);
  const [existingBookings, setExistingBookings] = useState([]);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestCount, setGuestCount] = useState(1);

  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [notes, setNotes] = useState('');

  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [bookingError, setBookingError] = useState('');

  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    if (slug) {
      loadProperty();
    }
  }, [slug]);

  async function loadProperty() {
    setLoading(true);
    setPageError('');

    const { data: propertyData, error: propertyError } =
      await supabase
        .from('properties')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

    if (propertyError || !propertyData) {
      console.error(propertyError);
      setPageError('Property not found or currently unavailable.');
      setLoading(false);
      return;
    }

    setProperty(propertyData);

    setGuestCount(
      Math.max(
        Number(propertyData.min_guests || 1),
        1
      )
    );

    const [
      photoResult,
      offerResult,
      pricingResult,
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
        .from('blocked_dates')
        .select('start_date, end_date')
        .eq('property_id', propertyData.id),

      supabase
        .from('bookings')
        .select('check_in, check_out, booking_status, payment_status')
        .eq('property_id', propertyData.id)
        .not(
          'booking_status',
          'in',
          '("declined","cancelled","rejected")'
        ),
    ]);

    if (photoResult.error) {
      console.error(photoResult.error);
    }

    setPhotos(photoResult.data || []);

    if (offerResult.error) {
      console.error(offerResult.error);
    }

    setOffers(offerResult.data || []);

    if (pricingResult.error) {
      console.error(pricingResult.error);
    }

    const mappedPricingRules = (pricingResult.data || []).map(
      (rule) => ({
        ...rule,

        type: rule.rule_type,

        percent:
          rule.adjustment_type === 'percent'
            ? Number(rule.adjustment_value || 0)
            : undefined,

        value: Number(rule.adjustment_value || 0),

        label: rule.name,

        adjustmentType:
          rule.adjustment_type,
      })
    );

    setPricingRules(mappedPricingRules);

    if (blockedResult.error) {
      console.error(blockedResult.error);
    }

    setBlockedDates(blockedResult.data || []);

    if (bookingResult.error) {
      console.error(bookingResult.error);
    }

    setExistingBookings(bookingResult.data || []);

    setLoading(false);
  }

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;

    const start = new Date(`${checkIn}T12:00:00`);
    const end = new Date(`${checkOut}T12:00:00`);

    return Math.round(
      (end - start) / (1000 * 60 * 60 * 24)
    );
  }, [checkIn, checkOut]);

  const applicableOffer = useMemo(() => {
    if (!checkIn || !checkOut || nights <= 0) {
      return null;
    }

    const availableOffers = offers.filter((offer) => {
      const dateEligible =
        checkIn >= offer.start_date &&
        checkIn <= offer.end_date;

      const stayEligible =
        nights >= Number(offer.min_nights || 1);

      return dateEligible && stayEligible;
    });

    if (!availableOffers.length) {
      return null;
    }

    const amountBeforeDiscount =
      Number(property?.base_price || 0) * nights;

    return [...availableOffers].sort((a, b) => {
      const discountA =
        a.discount_type === 'percent'
          ? amountBeforeDiscount *
            (Number(a.discount_value) / 100)
          : Number(a.discount_value);

      const discountB =
        b.discount_type === 'percent'
          ? amountBeforeDiscount *
            (Number(b.discount_value) / 100)
          : Number(b.discount_value);

      return discountB - discountA;
    })[0];
  }, [
    offers,
    checkIn,
    checkOut,
    nights,
    property,
  ]);

  const pricing = useMemo(() => {
    if (!property || !checkIn || !checkOut) {
      return null;
    }

    return calculateBookingPrice({
      property,
      guestCount,
      checkIn,
      checkOut,
      pricingRules,
      offer: applicableOffer,
    });
  }, [
    property,
    guestCount,
    checkIn,
    checkOut,
    pricingRules,
    applicableOffer,
  ]);

  const availability = useMemo(() => {
    if (!checkIn || !checkOut) {
      return {
        available: true,
        message: '',
      };
    }

    if (checkOut <= checkIn) {
      return {
        available: false,
        message: 'Check-out must be after check-in.',
      };
    }

    const manuallyBlocked = blockedDates.some((block) =>
      rangesOverlap(
        checkIn,
        checkOut,
        block.start_date,
        addDays(block.end_date, 1)
      )
    );

    if (manuallyBlocked) {
      return {
        available: false,
        message:
          'These dates are unavailable. Please choose different dates.',
      };
    }

    const bookingConflict = existingBookings.some(
      (booking) =>
        rangesOverlap(
          checkIn,
          checkOut,
          booking.check_in,
          booking.check_out
        )
    );

    if (bookingConflict) {
      return {
        available: false,
        message:
          'These dates already have a booking/request. Please select different dates.',
      };
    }

    return {
      available: true,
      message: 'Dates are currently available.',
    };
  }, [
    checkIn,
    checkOut,
    blockedDates,
    existingBookings,
  ]);

  async function submitBookingRequest(event) {
    event.preventDefault();

    setBookingError('');
    setBookingSuccess(null);

    if (!pricing?.valid) {
      setBookingError(
        pricing?.error || 'Please check your booking details.'
      );
      return;
    }

    if (!availability.available) {
      setBookingError(availability.message);
      return;
    }

    if (!guestName.trim()) {
      setBookingError('Please enter your full name.');
      return;
    }

    if (!guestPhone.trim()) {
      setBookingError('Please enter your contact number.');
      return;
    }

    if (
      guestEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)
    ) {
      setBookingError('Please enter a valid email address.');
      return;
    }

    setBookingLoading(true);

    try {
      const {
        data: guestData,
        error: guestError,
      } = await supabase
        .from('guests')
        .insert({
          full_name: guestName.trim(),
          phone: guestPhone.trim(),
          email: guestEmail.trim() || null,
        })
        .select('id')
        .single();

      if (guestError) {
        throw new Error(
          `Unable to save guest details: ${guestError.message}`
        );
      }

      const averageNightlyRate =
        pricing.nights > 0
          ? pricing.staySubtotal / pricing.nights
          : 0;

      const {
        data: bookingData,
        error: bookingInsertError,
      } = await supabase
        .from('bookings')
        .insert({
          property_id: property.id,
          guest_id: guestData.id,

          check_in: checkIn,
          check_out: checkOut,

          guests_count: Number(guestCount),
          nights: pricing.nights,

          nightly_rate: averageNightlyRate,

          cleaning_fee: pricing.cleaningFee,
          security_deposit: pricing.securityDeposit,

          base_amount: pricing.baseAmount,

          auto_discount_amount:
            pricing.autoDiscountAmount,

          host_discount_amount: 0,

          final_payable_amount:
            pricing.totalPayable,

          total_amount:
            pricing.totalPayable,

          booking_status: 'pending',
          host_decision: 'pending',
          payment_status: 'unpaid',

          offer_status: applicableOffer
            ? 'auto_applied'
            : 'none',

          offer_note: applicableOffer
            ? applicableOffer.title
            : null,

          notes: notes.trim() || null,
        })
        .select('id, booking_code')
        .single();

      if (bookingInsertError) {
        throw new Error(
          `Unable to create booking request: ${bookingInsertError.message}`
        );
      }

      setBookingSuccess({
        bookingCode: bookingData.booking_code,
        amount: pricing.totalPayable,
      });

      setNotes('');
    } catch (error) {
      console.error(error);

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
      <main style={styles.loadingPage}>
        Loading property...
      </main>
    );
  }

  if (pageError || !property) {
    return (
      <main style={styles.loadingPage}>
        <h2>Property unavailable</h2>
        <p>{pageError}</p>
      </main>
    );
  }

  const coverPhoto =
    photos.find((photo) => photo.is_cover) ||
    photos[0];

  const selectedPhoto =
    photos[activePhoto] || coverPhoto;

  return (
    <main style={styles.page}>
      <section style={styles.container}>
        <div style={styles.propertyHeader}>
          <div>
            <div style={styles.brand}>
              NightOutStays
            </div>

            <h1 style={styles.title}>
              {property.name}
            </h1>

            <div style={styles.location}>
              📍 {property.location_name}
            </div>
          </div>

          <div style={styles.headerPrice}>
            <div style={styles.price}>
              {formatMoney(property.base_price)}
            </div>

            <div style={styles.smallMuted}>
              per night
            </div>

            <div style={styles.smallMuted}>
              includes up to{' '}
              {property.included_guests} guests
            </div>
          </div>
        </div>

        {selectedPhoto && (
          <div style={styles.gallery}>
            <img
              src={selectedPhoto.image_url}
              alt={selectedPhoto.alt_text || property.name}
              style={styles.mainPhoto}
            />

            {photos.length > 1 && (
              <div style={styles.thumbnails}>
                {photos.map((photo, index) => (
                  <button
                    type="button"
                    key={photo.id}
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
                      src={photo.image_url}
                      alt=""
                      style={styles.thumbnail}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={styles.layout}>
          <div>
            <Section title="About this stay">
              <p style={styles.description}>
                {property.description ||
                  property.short_description}
              </p>

              <div style={styles.factGrid}>
                <Fact
                  label="Bedrooms"
                  value={property.bedrooms}
                />

                <Fact
                  label="Bathrooms"
                  value={property.bathrooms}
                />

                <Fact
                  label="Maximum Guests"
                  value={property.max_guests}
                />

                <Fact
                  label="Minimum Stay"
                  value={`${property.min_stay_nights} night${
                    Number(property.min_stay_nights) ===
                    1
                      ? ''
                      : 's'
                  }`}
                />
              </div>
            </Section>

            <Section title="Sleeping arrangement">
              <div style={styles.tickGrid}>
                {Number(property.queen_bed_count) > 0 && (
                  <Feature>
                    {property.queen_bed_count} Queen Size Bed
                    {Number(property.queen_bed_count) > 1
                      ? 's'
                      : ''}
                  </Feature>
                )}

                {Number(property.single_bed_count) > 0 && (
                  <Feature>
                    {property.single_bed_count} Single Bed
                    {Number(property.single_bed_count) > 1
                      ? 's'
                      : ''}
                  </Feature>
                )}

                {Number(property.sofa_cum_bed_count) > 0 && (
                  <Feature>
                    {property.sofa_cum_bed_count} Sofa-cum-Bed
                  </Feature>
                )}
              </div>
            </Section>

            <Section title="Facilities & Amenities">
              <div style={styles.tickGrid}>
                {property.wifi_available && (
                  <Feature>Wi-Fi</Feature>
                )}

                {property.tv_available && (
                  <Feature>TV</Feature>
                )}

                {property.fridge_available && (
                  <Feature>Fridge</Feature>
                )}

                {property.washing_machine_available && (
                  <Feature>Washing Machine</Feature>
                )}

                {property.ac_available && (
                  <Feature>
                    Air Conditioning
                    {Number(property.ac_count) > 0
                      ? ` (${property.ac_count})`
                      : ''}
                  </Feature>
                )}

                {Number(property.water_heater_count) >
                  0 && (
                  <Feature>
                    Water Heater / Geyser (
                    {property.water_heater_count})
                  </Feature>
                )}

                {(property.amenities || []).map(
                  (amenity) => (
                    <Feature key={amenity}>
                      {amenity}
                    </Feature>
                  )
                )}
              </div>
            </Section>

            {(property.kitchen_features || []).length >
              0 && (
              <Section title="Kitchen">
                <div style={styles.tickGrid}>
                  {property.kitchen_features.map(
                    (feature) => (
                      <Feature key={feature}>
                        {feature}
                      </Feature>
                    )
                  )}
                </div>
              </Section>
            )}

            <Section title="Stay Rules">
              <div style={styles.tickGrid}>
                <Rule
                  allowed={property.pets_allowed}
                  label="Pets"
                />

                <Rule
                  allowed={property.parties_allowed}
                  label="Parties"
                />

                <Rule
                  allowed={property.couples_allowed}
                  label="Couples"
                />

                <Rule
                  allowed={property.alcohol_allowed}
                  label="Alcohol"
                />

                <Rule
                  allowed={property.smoking_allowed}
                  label="Smoking"
                />
              </div>

              {property.quiet_hours_enabled && (
                <div style={styles.ruleNotice}>
                  Quiet hours:{' '}
                  {formatTime(property.quiet_hours_start)} –{' '}
                  {formatTime(property.quiet_hours_end)}
                </div>
              )}

              {(property.house_rules || []).length >
                0 && (
                <ul>
                  {property.house_rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Check-in & Check-out">
              <div style={styles.factGrid}>
                <Fact
                  label="Check-in"
                  value={formatTime(
                    property.check_in_time
                  )}
                />

                <Fact
                  label="Check-out"
                  value={formatTime(
                    property.check_out_time
                  )}
                />

                <Fact
                  label="Late checkout"
                  value={
                    Number(
                      property.late_checkout_hourly_fee
                    ) > 0
                      ? `${formatMoney(
                          property.late_checkout_hourly_fee
                        )} / hour`
                      : 'Contact host'
                  }
                />
              </div>
            </Section>
          </div>

          <aside style={styles.bookingCard}>
            <div style={styles.bookingHeading}>
              Request your stay
            </div>

            <div style={styles.basePriceText}>
              {formatMoney(property.base_price)} / night
            </div>

            <form onSubmit={submitBookingRequest}>
              <div style={styles.twoColumns}>
                <InputGroup label="CHECK-IN">
                  <input
                    type="date"
                    min={todayString()}
                    value={checkIn}
                    onChange={(event) => {
                      const value = event.target.value;

                      setCheckIn(value);

                      if (
                        checkOut &&
                        checkOut <= value
                      ) {
                        setCheckOut(addDays(value, 1));
                      }
                    }}
                    style={styles.input}
                  />
                </InputGroup>

                <InputGroup label="CHECK-OUT">
                  <input
                    type="date"
                    min={
                      checkIn
                        ? addDays(checkIn, 1)
                        : todayString()
                    }
                    value={checkOut}
                    onChange={(event) =>
                      setCheckOut(event.target.value)
                    }
                    style={styles.input}
                  />
                </InputGroup>
              </div>

              <InputGroup label="GUESTS">
                <select
                  value={guestCount}
                  onChange={(event) =>
                    setGuestCount(
                      Number(event.target.value)
                    )
                  }
                  style={styles.input}
                >
                  {Array.from(
                    {
                      length:
                        Number(property.max_guests) -
                        Number(property.min_guests) +
                        1,
                    },
                    (_, index) =>
                      Number(property.min_guests) +
                      index
                  ).map((count) => (
                    <option
                      key={count}
                      value={count}
                    >
                      {count} guest
                      {count === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              </InputGroup>

              {Number(property.extra_guest_fee) > 0 && (
                <div style={styles.info}>
                  Base price includes{' '}
                  <strong>
                    {property.included_guests} guests
                  </strong>
                  . Additional guests:{' '}
                  <strong>
                    {formatMoney(
                      property.extra_guest_fee
                    )} / person / night
                  </strong>
                  .
                </div>
              )}

              {checkIn && checkOut && (
                <>
                  <div
                    style={
                      availability.available
                        ? styles.available
                        : styles.unavailable
                    }
                  >
                    {availability.message}
                  </div>

                  {pricing && !pricing.valid && (
                    <div style={styles.unavailable}>
                      {pricing.error}
                    </div>
                  )}
                </>
              )}

              {pricing?.valid && (
                <div style={styles.priceBox}>
                  <div style={styles.priceRow}>
                    <span>
                      Stay subtotal ({pricing.nights}{' '}
                      night
                      {pricing.nights === 1 ? '' : 's'})
                    </span>

                    <strong>
                      {formatMoney(
                        pricing.staySubtotal
                      )}
                    </strong>
                  </div>

                  {pricing.cleaningFee > 0 && (
                    <div style={styles.priceRow}>
                      <span>Cleaning fee</span>

                      <strong>
                        {formatMoney(
                          pricing.cleaningFee
                        )}
                      </strong>
                    </div>
                  )}

                  {pricing.autoDiscountAmount > 0 && (
                    <div style={styles.discountRow}>
                      <span>
                        {applicableOffer?.title ||
                          'Special offer'}
                      </span>

                      <strong>
                        -
                        {formatMoney(
                          pricing.autoDiscountAmount
                        )}
                      </strong>
                    </div>
                  )}

                  {pricing.securityDeposit > 0 && (
                    <div style={styles.priceRow}>
                      <span>Security deposit</span>

                      <strong>
                        {formatMoney(
                          pricing.securityDeposit
                        )}
                      </strong>
                    </div>
                  )}

                  <div style={styles.totalRow}>
                    <span>Final payable</span>

                    <strong>
                      {formatMoney(
                        pricing.totalPayable
                      )}
                    </strong>
                  </div>

                  {pricing.nightlyBreakdown.some(
                    (night) =>
                      night.adjustments.length > 0
                  ) && (
                    <details style={styles.breakdown}>
                      <summary>
                        View nightly price details
                      </summary>

                      {pricing.nightlyBreakdown.map(
                        (night) => (
                          <div
                            key={night.date}
                            style={
                              styles.nightBreakdown
                            }
                          >
                            <span>{night.date}</span>

                            <span>
                              {formatMoney(night.rate)}
                            </span>
                          </div>
                        )
                      )}
                    </details>
                  )}
                </div>
              )}

              <hr style={styles.line} />

              <InputGroup label="FULL NAME">
                <input
                  value={guestName}
                  onChange={(event) =>
                    setGuestName(event.target.value)
                  }
                  style={styles.input}
                  placeholder="Your full name"
                />
              </InputGroup>

              <InputGroup label="CONTACT NUMBER">
                <input
                  value={guestPhone}
                  onChange={(event) =>
                    setGuestPhone(event.target.value)
                  }
                  style={styles.input}
                  placeholder="Mobile number"
                />
              </InputGroup>

              <InputGroup label="EMAIL">
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(event) =>
                    setGuestEmail(event.target.value)
                  }
                  style={styles.input}
                  placeholder="Email address"
                />
              </InputGroup>

              <InputGroup label="MESSAGE TO HOST">
                <textarea
                  value={notes}
                  onChange={(event) =>
                    setNotes(event.target.value)
                  }
                  style={styles.textarea}
                  placeholder="Questions, requests or any special requirements..."
                />
              </InputGroup>

              {bookingError && (
                <div style={styles.errorBox}>
                  {bookingError}
                </div>
              )}

              {bookingSuccess && (
                <div style={styles.successBox}>
                  <strong>
                    Booking request sent!
                  </strong>

                  <div style={{ marginTop: 6 }}>
                    Reference:{' '}
                    {bookingSuccess.bookingCode}
                  </div>

                  <div style={{ marginTop: 6 }}>
                    The host will review your request.
                    Payment will be requested only after
                    approval.
                  </div>
                </div>
              )}

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

              <div style={styles.paymentNote}>
                No payment now. The host will approve
                your request first.
              </div>
            </form>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Section({ title, children }) {
  return (
    <section style={styles.section}>
      <h2 style={styles.sectionHeading}>{title}</h2>
      {children}
    </section>
  );
}

function Fact({ label, value }) {
  return (
    <div style={styles.fact}>
      <div style={styles.factLabel}>{label}</div>
      <div style={styles.factValue}>{value}</div>
    </div>
  );
}

function Feature({ children }) {
  return (
    <div style={styles.feature}>
      <span>✓</span>
      <span>{children}</span>
    </div>
  );
}

function Rule({ allowed, label }) {
  return (
    <div style={styles.feature}>
      <span>{allowed ? '✓' : '✕'}</span>

      <span>
        {label} {allowed ? 'Allowed' : 'Not Allowed'}
      </span>
    </div>
  );
}

function InputGroup({ label, children }) {
  return (
    <div style={styles.inputGroup}>
      <label style={styles.label}>{label}</label>
      {children}
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

  loadingPage: {
    minHeight: '100vh',
    padding: '60px 7vw',
    background: '#f6f7f9',
    color: '#11213c',
    fontFamily: 'Arial, sans-serif',
  },

  container: {
    maxWidth: 1350,
    margin: '0 auto',
    padding: '28px 5vw 80px',
  },

  propertyHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 30,
    flexWrap: 'wrap',
    marginBottom: 25,
  },

  brand: {
    color: '#17457f',
    fontWeight: 900,
    fontSize: 18,
    marginBottom: 12,
  },

  title: {
    fontSize: 36,
    margin: 0,
  },

  location: {
    marginTop: 10,
    color: '#667085',
  },

  headerPrice: {
    textAlign: 'right',
  },

  price: {
    fontSize: 28,
    fontWeight: 900,
    color: '#17457f',
  },

  smallMuted: {
    fontSize: 13,
    color: '#667085',
    marginTop: 3,
  },

  gallery: {
    marginBottom: 30,
  },

  mainPhoto: {
    width: '100%',
    maxHeight: 600,
    aspectRatio: '16 / 8',
    objectFit: 'cover',
    borderRadius: 20,
    display: 'block',
  },

  thumbnails: {
    display: 'flex',
    gap: 10,
    overflowX: 'auto',
    paddingTop: 12,
  },

  thumbnailButton: {
    padding: 2,
    border: '2px solid transparent',
    borderRadius: 10,
    background: '#fff',
    cursor: 'pointer',
  },

  activeThumbnail: {
    border: '2px solid #17457f',
  },

  thumbnail: {
    width: 95,
    height: 65,
    objectFit: 'cover',
    borderRadius: 7,
    display: 'block',
  },

  layout: {
    display: 'grid',
    gridTemplateColumns:
      'minmax(0, 1.55fr) minmax(340px, 0.75fr)',
    gap: 28,
    alignItems: 'start',
  },

  section: {
    background: '#fff',
    border: '1px solid #e4e7ec',
    borderRadius: 16,
    padding: 24,
    marginBottom: 18,
  },

  sectionHeading: {
    marginTop: 0,
    fontSize: 22,
  },

  description: {
    lineHeight: 1.7,
    whiteSpace: 'pre-line',
  },

  factGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 14,
  },

  fact: {
    background: '#f8f9fb',
    padding: 14,
    borderRadius: 12,
  },

  factLabel: {
    fontSize: 11,
    color: '#667085',
    marginBottom: 5,
  },

  factValue: {
    fontWeight: 800,
  },

  tickGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(190px, 1fr))',
    gap: 10,
  },

  feature: {
    display: 'flex',
    gap: 9,
    alignItems: 'center',
    padding: 11,
    borderRadius: 10,
    background: '#f8f9fb',
  },

  ruleNotice: {
    marginTop: 16,
    padding: 13,
    background: '#fff6de',
    borderRadius: 10,
    fontWeight: 700,
  },

  bookingCard: {
    position: 'sticky',
    top: 20,
    background: '#fff',
    border: '1px solid #dfe3e8',
    borderRadius: 18,
    padding: 22,
    boxShadow: '0 8px 28px rgba(16,24,40,0.08)',
  },

  bookingHeading: {
    fontSize: 23,
    fontWeight: 900,
  },

  basePriceText: {
    marginTop: 7,
    color: '#667085',
    marginBottom: 20,
  },

  twoColumns: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },

  inputGroup: {
    marginBottom: 14,
  },

  label: {
    display: 'block',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1,
    marginBottom: 6,
  },

  input: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #ccd1d8',
    borderRadius: 10,
    padding: 12,
    background: '#fff',
  },

  textarea: {
    width: '100%',
    minHeight: 80,
    boxSizing: 'border-box',
    border: '1px solid #ccd1d8',
    borderRadius: 10,
    padding: 12,
    resize: 'vertical',
  },

  info: {
    background: '#eef5ff',
    padding: 12,
    borderRadius: 10,
    fontSize: 13,
    marginBottom: 14,
  },

  available: {
    background: '#eaf8ee',
    color: '#25663a',
    padding: 11,
    borderRadius: 9,
    marginBottom: 12,
    fontWeight: 700,
  },

  unavailable: {
    background: '#ffecec',
    color: '#8c2020',
    padding: 11,
    borderRadius: 9,
    marginBottom: 12,
    fontWeight: 700,
  },

  priceBox: {
    padding: 15,
    background: '#f7f8fa',
    borderRadius: 12,
    marginBottom: 15,
  },

  priceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 15,
    marginBottom: 10,
  },

  discountRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 15,
    marginBottom: 10,
    color: '#1c7a3d',
  },

  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 15,
    borderTop: '1px solid #d9dde3',
    paddingTop: 12,
    marginTop: 5,
    fontSize: 18,
  },

  breakdown: {
    marginTop: 13,
    fontSize: 13,
  },

  nightBreakdown: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 7,
  },

  line: {
    border: 0,
    borderTop: '1px solid #e5e7eb',
    margin: '20px 0',
  },

  errorBox: {
    padding: 12,
    background: '#ffecec',
    color: '#8c2020',
    borderRadius: 10,
    marginBottom: 12,
    fontWeight: 700,
  },

  successBox: {
    padding: 14,
    background: '#eaf8ee',
    color: '#25663a',
    borderRadius: 10,
    marginBottom: 12,
  },

  requestButton: {
    width: '100%',
    padding: 15,
    border: 0,
    borderRadius: 11,
    background: '#17457f',
    color: '#fff',
    fontSize: 15,
    fontWeight: 900,
    cursor: 'pointer',
  },

  paymentNote: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 12,
    color: '#667085',
  },
};