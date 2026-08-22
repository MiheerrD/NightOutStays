'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

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
  const [availabilityMessage, setAvailabilityMessage] = useState('');
  const [isAvailable, setIsAvailable] = useState(null);

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

  async function checkAvailability() {
    setAvailabilityMessage('');
    setIsAvailable(null);

    if (!checkIn || !checkOut) {
      setAvailabilityMessage('Please select check-in and check-out dates.');
      return;
    }

    if (new Date(checkOut) <= new Date(checkIn)) {
      setAvailabilityMessage('Check-out must be after check-in.');
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
        'Unable to check availability right now. Please try again.'
      );
      return;
    }

    if (data === true) {
      setIsAvailable(true);
      setAvailabilityMessage('Available for your selected dates.');
    } else {
      setIsAvailable(false);
      setAvailabilityMessage(
        'Sorry, this property is not available for those dates.'
      );
    }
  }

  function calculateNights() {
    if (!checkIn || !checkOut) return 0;

    const start = new Date(checkIn);
    const end = new Date(checkOut);

    const difference = end.getTime() - start.getTime();

    return Math.max(
      0,
      Math.round(difference / (1000 * 60 * 60 * 24))
    );
  }

  const nights = calculateNights();

  const stayAmount =
    property && nights > 0
      ? Number(property.base_price) * nights
      : 0;

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
        <a href="/">← Back to all stays</a>
      </main>
    );
  }

  return (
    <main className="detail">
      <a className="back" href="/">
        ← All stays
      </a>

      <p className="eyebrow">{property.location_name}</p>

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
            {property.bedrooms} bedrooms • {property.bathrooms} bathrooms • up
            to {property.max_guests} guests
          </div>

          <h2>Amenities</h2>

          <div className="amenities">
            {(property.amenities || []).map((amenity) => (
              <div key={amenity}>✓ {amenity}</div>
            ))}
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
          <div className="price">
            ₹{Number(property.base_price).toLocaleString('en-IN')}
            <small> / night</small>
          </div>

          <label>CHECK-IN</label>

          <input
            type="date"
            value={checkIn}
            onChange={(event) => {
              setCheckIn(event.target.value);
              setAvailabilityMessage('');
              setIsAvailable(null);
            }}
          />

          <label>CHECK-OUT</label>

          <input
            type="date"
            value={checkOut}
            onChange={(event) => {
              setCheckOut(event.target.value);
              setAvailabilityMessage('');
              setIsAvailable(null);
            }}
          />

          <label>GUESTS</label>

          <input
            type="number"
            min="1"
            max={property.max_guests}
            value={guests}
            onChange={(event) =>
              setGuests(Number(event.target.value))
            }
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
                ₹{Number(property.base_price).toLocaleString('en-IN')} ×{' '}
                {nights} night{nights > 1 ? 's' : ''}
              </div>

              <div
                style={{
                  marginTop: '8px',
                  fontSize: '20px',
                  fontWeight: '800',
                }}
              >
                Total ₹{stayAmount.toLocaleString('en-IN')}
              </div>
            </div>
          )}

          <button onClick={checkAvailability} disabled={checking}>
            {checking ? 'Checking...' : 'Check availability'}
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
            <button
              style={{
                background: '#b07b12',
                marginTop: '12px',
              }}
            >
              Book Now
            </button>
          )}
        </aside>
      </div>
    </main>
  );
}