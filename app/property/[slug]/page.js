'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';

    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);

    document.body.appendChild(script);
  });
}

export default function PropertyPage() {
  const params = useParams();
  const slug = params.slug;

  const [property, setProperty] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(2);

  const [checking, setChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState(null);
  const [availabilityMessage, setAvailabilityMessage] = useState('');

  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestNotes, setGuestNotes] = useState('');

  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(null);

  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentId, setPaymentId] = useState('');

  useEffect(() => {
    async function loadProperty() {
      setLoading(true);

      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (propertyError || !propertyData) {
        setLoading(false);
        return;
      }

      setProperty(propertyData);

      const { data: photoData } = await supabase
        .from('property_photos')
        .select('*')
        .eq('property_id', propertyData.id)
        .order('sort_order', { ascending: true });

      setPhotos(photoData || []);
      setLoading(false);
    }

    if (slug) {
      loadProperty();
    }
  }, [slug]);

  function resetSelection() {
    setIsAvailable(null);
    setAvailabilityMessage('');
    setBookingError('');
    setBookingSuccess(null);
    setPaymentError('');
    setPaymentSuccess(false);
    setPaymentId('');
  }

  function calculateNights() {
    if (!checkIn || !checkOut) return 0;

    const start = new Date(checkIn);
    const end = new Date(checkOut);

    return Math.max(
      0,
      Math.round((end - start) / (1000 * 60 * 60 * 24))
    );
  }

  const nights = calculateNights();

  const stayAmount =
    property && nights > 0
      ? Number(property.base_price) * nights
      : 0;

  const cleaningFee = property
    ? Number(property.cleaning_fee || 0)
    : 0;

  const securityDeposit = property
    ? Number(property.security_deposit || 0)
    : 0;

  const totalAmount =
    stayAmount + cleaningFee + securityDeposit;

  async function checkAvailability() {
    setIsAvailable(null);
    setAvailabilityMessage('');
    setBookingError('');
    setBookingSuccess(null);
    setPaymentError('');
    setPaymentSuccess(false);

    if (!checkIn || !checkOut) {
      setAvailabilityMessage(
        'Please select check-in and check-out dates.'
      );
      return;
    }

    if (new Date(checkOut) <= new Date(checkIn)) {
      setAvailabilityMessage(
        'Check-out must be after check-in.'
      );
      return;
    }

    if (guests < 1 || guests > property.max_guests) {
      setAvailabilityMessage(
        `Maximum ${property.max_guests} guests are allowed.`
      );
      return;
    }

    setChecking(true);

    const { data, error } = await supabase.rpc(
      'check_property_availability',
      {
        p_property_id: property.id,
        p_check_in: checkIn,
        p_check_out: checkOut,
      }
    );

    setChecking(false);

    if (error) {
      console.error(error);

      setAvailabilityMessage(
        'Unable to check availability. Please try again.'
      );

      return;
    }

    if (data === true) {
      setIsAvailable(true);

      setAvailabilityMessage(
        'Available for your selected dates.'
      );
    } else {
      setIsAvailable(false);

      setAvailabilityMessage(
        'Sorry, this property is not available for those dates.'
      );
    }
  }

  async function submitBooking(event) {
    event.preventDefault();

    setBookingError('');
    setBookingSuccess(null);
    setPaymentError('');

    if (!guestName.trim()) {
      setBookingError('Please enter your full name.');
      return;
    }

    if (!guestPhone.trim() || guestPhone.trim().length < 10) {
      setBookingError('Please enter a valid mobile number.');
      return;
    }

    setBookingLoading(true);

    const { data, error } = await supabase.rpc(
      'create_booking_request',
      {
        p_property_id: property.id,
        p_full_name: guestName.trim(),
        p_phone: guestPhone.trim(),
        p_email: guestEmail.trim(),
        p_check_in: checkIn,
        p_check_out: checkOut,
        p_guests_count: guests,
        p_notes: guestNotes.trim(),
      }
    );

    setBookingLoading(false);

    if (error) {
      console.error(error);

      setBookingError(
        error.message || 'Unable to create booking.'
      );

      return;
    }

    const booking = data?.[0];

    if (!booking) {
      setBookingError(
        'Booking could not be created. Please try again.'
      );

      return;
    }

    setBookingSuccess(booking);
  }

  async function startPayment() {
    if (!bookingSuccess?.booking_code) {
      setPaymentError('Booking reference is missing.');
      return;
    }

    setPaymentLoading(true);
    setPaymentError('');

    const razorpayLoaded = await loadRazorpayScript();

    if (!razorpayLoaded) {
      setPaymentLoading(false);

      setPaymentError(
        'Unable to load payment gateway. Please check your internet connection.'
      );

      return;
    }

    try {
      const orderResponse = await fetch(
        '/api/razorpay/create-order',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bookingCode: bookingSuccess.booking_code,
          }),
        }
      );

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(
          orderData.error || 'Unable to create payment order.'
        );
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'NightOutStay',
        description: property.name,
        order_id: orderData.orderId,

        prefill: {
          name: guestName,
          email: guestEmail,
          contact: guestPhone,
        },

        notes: {
          booking_code: bookingSuccess.booking_code,
        },

        theme: {
          color: '#163c74',
        },

        handler: async function (response) {
          setPaymentLoading(true);
          setPaymentError('');

          try {
            const verifyResponse = await fetch(
              '/api/razorpay/verify',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  bookingCode:
                    bookingSuccess.booking_code,

                  razorpay_order_id:
                    response.razorpay_order_id,

                  razorpay_payment_id:
                    response.razorpay_payment_id,

                  razorpay_signature:
                    response.razorpay_signature,
                }),
              }
            );

            const verifyData =
              await verifyResponse.json();

            if (!verifyResponse.ok) {
              throw new Error(
                verifyData.error ||
                  'Payment verification failed.'
              );
            }

            setPaymentSuccess(true);

            setPaymentId(
              verifyData.paymentId ||
                response.razorpay_payment_id
            );
          } catch (error) {
            console.error(error);

            setPaymentError(
              error.message ||
                'Payment was received but verification failed. Please contact us with your booking reference.'
            );
          } finally {
            setPaymentLoading(false);
          }
        },

        modal: {
          ondismiss: function () {
            setPaymentLoading(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);

      razorpay.on(
        'payment.failed',
        function (response) {
          setPaymentLoading(false);

          setPaymentError(
            response.error?.description ||
              'Payment failed. Please try again.'
          );
        }
      );

      razorpay.open();

      setPaymentLoading(false);
    } catch (error) {
      console.error(error);

      setPaymentLoading(false);

      setPaymentError(
        error.message ||
          'Unable to start payment. Please try again.'
      );
    }
  }

  if (loading) {
    return (
      <main className="detail">
        <p>Loading property...</p>
      </main>
    );
  }

  if (!property) {
    return (
      <main className="detail">
        <h1>Property not found</h1>

        <a href="/">
          ← Back to all stays
        </a>
      </main>
    );
  }

  return (
    <main className="detail">
      <a className="back" href="/">
        ← All stays
      </a>

      <p className="eyebrow">
        {property.location_name}
      </p>

      <h1>{property.name}</h1>

      {photos.length > 0 && (
        <div className="gallery">
          {photos.slice(0, 5).map((photo, index) => (
            <img
              key={photo.id}
              src={photo.image_url}
              alt={photo.alt_text || property.name}
              className={index === 0 ? 'mainphoto' : ''}
            />
          ))}
        </div>
      )}

      <div className="detailgrid">
        <section>
          <h2>About this stay</h2>

          <p>
            {property.description ||
              property.short_description ||
              'A comfortable short stay managed by Aanandee Realty.'}
          </p>

          <div className="facts">
            {property.bedrooms} bedrooms •{' '}
            {property.bathrooms} bathrooms • up to{' '}
            {property.max_guests} guests
          </div>

          <h2>Amenities</h2>

          <div className="amenities">
            {(property.amenities || []).map(
              (amenity) => (
                <div key={amenity}>
                  ✓ {amenity}
                </div>
              )
            )}
          </div>

          {property.google_maps_url && (
            <a
              className="map"
              href={property.google_maps_url}
              target="_blank"
              rel="noreferrer"
            >
              View location on Google Maps ↗
            </a>
          )}
        </section>

        <aside>
          {paymentSuccess ? (
            <div
              style={{
                padding: '20px',
                background: '#edf9f0',
                borderRadius: '14px',
              }}
            >
              <h2 style={{ marginTop: 0 }}>
                Payment successful ✓
              </h2>

              <p>
                Your booking is confirmed.
              </p>

              <p>
                Booking reference:
              </p>

              <div
                style={{
                  fontSize: '24px',
                  fontWeight: '800',
                  color: '#163c74',
                  margin: '12px 0',
                }}
              >
                {bookingSuccess.booking_code}
              </div>

              <p>
                Payment ID:
              </p>

              <div
                style={{
                  wordBreak: 'break-all',
                  fontWeight: '700',
                }}
              >
                {paymentId}
              </div>

              <p>
                Total paid:{' '}
                <strong>
                  ₹
                  {totalAmount.toLocaleString(
                    'en-IN'
                  )}
                </strong>
              </p>

              <p>
                Check-in:{' '}
                <strong>{checkIn}</strong>
              </p>

              <p>
                Check-out:{' '}
                <strong>{checkOut}</strong>
              </p>
            </div>
          ) : bookingSuccess ? (
            <div
              style={{
                padding: '20px',
                background: '#edf9f0',
                borderRadius: '14px',
              }}
            >
              <h2 style={{ marginTop: 0 }}>
                Booking request created ✓
              </h2>

              <p>Your booking reference:</p>

              <div
                style={{
                  fontSize: '24px',
                  fontWeight: '800',
                  color: '#163c74',
                  margin: '12px 0',
                }}
              >
                {bookingSuccess.booking_code}
              </div>

              <p>
                Check-in:{' '}
                <strong>{checkIn}</strong>
              </p>

              <p>
                Check-out:{' '}
                <strong>{checkOut}</strong>
              </p>

              <p>
                Guests:{' '}
                <strong>{guests}</strong>
              </p>

              <p>
                Amount payable:{' '}
                <strong>
                  ₹
                  {totalAmount.toLocaleString(
                    'en-IN'
                  )}
                </strong>
              </p>

              <button
                onClick={startPayment}
                disabled={paymentLoading}
                style={{
                  background: '#b07b12',
                  marginTop: '12px',
                }}
              >
                {paymentLoading
                  ? 'Opening payment...'
                  : `Pay ₹${totalAmount.toLocaleString(
                      'en-IN'
                    )}`}
              </button>

              {paymentError && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '12px',
                    background: '#fff0f0',
                    borderRadius: '10px',
                    fontWeight: '700',
                  }}
                >
                  {paymentError}
                </div>
              )}

              <p
                style={{
                  marginTop: '14px',
                  fontSize: '12px',
                  color: '#666',
                }}
              >
                Your booking will be confirmed after
                successful payment.
              </p>
            </div>
          ) : (
            <>
              <div className="price">
                ₹
                {Number(
                  property.base_price
                ).toLocaleString('en-IN')}

                <small> / night</small>
              </div>

              <label>CHECK-IN</label>

              <input
                type="date"
                value={checkIn}
                onChange={(event) => {
                  setCheckIn(event.target.value);
                  resetSelection();
                }}
              />

              <label>CHECK-OUT</label>

              <input
                type="date"
                value={checkOut}
                onChange={(event) => {
                  setCheckOut(event.target.value);
                  resetSelection();
                }}
              />

              <label>GUESTS</label>

              <input
                type="number"
                min="1"
                max={property.max_guests}
                value={guests}
                onChange={(event) => {
                  setGuests(
                    Number(event.target.value)
                  );

                  resetSelection();
                }}
              />

              {nights > 0 && (
                <div
                  style={{
                    marginTop: '18px',
                    paddingTop: '16px',
                    borderTop: '1px solid #eee',
                  }}
                >
                  <div>
                    ₹
                    {Number(
                      property.base_price
                    ).toLocaleString(
                      'en-IN'
                    )}{' '}
                    × {nights} night
                    {nights > 1 ? 's' : ''}
                  </div>

                  {cleaningFee > 0 && (
                    <div style={{ marginTop: '6px' }}>
                      Cleaning fee ₹
                      {cleaningFee.toLocaleString(
                        'en-IN'
                      )}
                    </div>
                  )}

                  {securityDeposit > 0 && (
                    <div style={{ marginTop: '6px' }}>
                      Security deposit ₹
                      {securityDeposit.toLocaleString(
                        'en-IN'
                      )}
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: '10px',
                      fontSize: '20px',
                      fontWeight: '800',
                    }}
                  >
                    Total ₹
                    {totalAmount.toLocaleString(
                      'en-IN'
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={checkAvailability}
                disabled={checking}
              >
                {checking
                  ? 'Checking...'
                  : 'Check availability'}
              </button>

              {availabilityMessage && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '12px',
                    borderRadius: '10px',
                    background:
                      isAvailable === true
                        ? '#edf9f0'
                        : isAvailable === false
                        ? '#fff0f0'
                        : '#f5f6f8',
                    fontWeight: '700',
                  }}
                >
                  {availabilityMessage}
                </div>
              )}

              {isAvailable === true && (
                <form
                  onSubmit={submitBooking}
                  style={{
                    marginTop: '22px',
                    paddingTop: '20px',
                    borderTop: '1px solid #ddd',
                  }}
                >
                  <h3>Guest details</h3>

                  <label>FULL NAME</label>

                  <input
                    type="text"
                    value={guestName}
                    onChange={(event) =>
                      setGuestName(
                        event.target.value
                      )
                    }
                    placeholder="Your full name"
                  />

                  <label>MOBILE NUMBER</label>

                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={(event) =>
                      setGuestPhone(
                        event.target.value
                      )
                    }
                    placeholder="10 digit mobile number"
                  />

                  <label>EMAIL</label>

                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(event) =>
                      setGuestEmail(
                        event.target.value
                      )
                    }
                    placeholder="Optional"
                  />

                  <label>SPECIAL REQUEST</label>

                  <textarea
                    value={guestNotes}
                    onChange={(event) =>
                      setGuestNotes(
                        event.target.value
                      )
                    }
                    placeholder="Optional"
                    style={{
                      width: '100%',
                      minHeight: '90px',
                      padding: '13px',
                      border: '1px solid #ccc',
                      borderRadius: '10px',
                      resize: 'vertical',
                    }}
                  />

                  {bookingError && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '12px',
                        background: '#fff0f0',
                        borderRadius: '10px',
                        fontWeight: '700',
                      }}
                    >
                      {bookingError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={bookingLoading}
                    style={{
                      background: '#b07b12',
                    }}
                  >
                    {bookingLoading
                      ? 'Creating booking...'
                      : 'Continue to Payment'}
                  </button>
                </form>
              )}
            </>
          )}
        </aside>
      </div>
    </main>
  );
}