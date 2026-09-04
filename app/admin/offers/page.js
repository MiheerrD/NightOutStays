'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

export default function AdminOffersPage() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const [adminProfile, setAdminProfile] = useState(null);
  const [properties, setProperties] = useState([]);
  const [offers, setOffers] = useState([]);

  const [propertyId, setPropertyId] = useState('');
  const [title, setTitle] = useState('');
  const [discountType, setDiscountType] = useState('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minNights, setMinNights] = useState(1);

  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);
      setCheckingSession(false);

      if (session) {
        await verifyAdmin(session.user.id);
      }
    }

    loadSession();
  }, []);

  async function verifyAdmin(userId) {
    const { data, error } = await supabase
      .from('admin_profiles')
      .select('user_id, full_name, role, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      setPageError(
        'This login does not have permission to manage offers.'
      );
      return;
    }

    setAdminProfile(data);

    await Promise.all([
      loadProperties(),
      loadOffers(),
    ]);
  }

  async function loadProperties() {
    const { data, error } = await supabase
      .from('properties')
      .select('id, name, location_name, is_active')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error(error);
      setPageError('Unable to load properties.');
      return;
    }

    setProperties(data || []);

    if (data?.length && !propertyId) {
      setPropertyId(data[0].id);
    }
  }

  async function loadOffers() {
    const { data, error } = await supabase
      .from('property_offers')
      .select(`
        id,
        title,
        discount_type,
        discount_value,
        start_date,
        end_date,
        min_nights,
        is_active,
        created_at,
        properties (
          name,
          location_name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      setPageError('Unable to load offers.');
      return;
    }

    setOffers(data || []);
  }

  async function createOffer(event) {
    event.preventDefault();

    setPageError('');
    setSuccessMessage('');

    if (!propertyId) {
      setPageError('Please select a property.');
      return;
    }

    if (!title.trim()) {
      setPageError('Please enter an offer title.');
      return;
    }

    if (!discountValue || Number(discountValue) <= 0) {
      setPageError('Please enter a valid discount value.');
      return;
    }

    if (!startDate || !endDate) {
      setPageError('Please select offer dates.');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setPageError('End date cannot be before start date.');
      return;
    }

    if (
      discountType === 'percent' &&
      Number(discountValue) > 100
    ) {
      setPageError('Percentage discount cannot exceed 100%.');
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('property_offers')
      .insert({
        property_id: propertyId,
        title: title.trim(),
        discount_type: discountType,
        discount_value: Number(discountValue),
        start_date: startDate,
        end_date: endDate,
        min_nights: Number(minNights) || 1,
        is_active: true,
        created_by: adminProfile.user_id,
      });

    setSaving(false);

    if (error) {
      console.error(error);
      setPageError('Unable to create offer.');
      return;
    }

    setSuccessMessage('Offer created successfully.');

    setTitle('');
    setDiscountValue('');
    setStartDate('');
    setEndDate('');
    setMinNights(1);

    await loadOffers();
  }

  async function toggleOffer(offer) {
    setPageError('');
    setSuccessMessage('');

    const { error } = await supabase
      .from('property_offers')
      .update({
        is_active: !offer.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', offer.id);

    if (error) {
      console.error(error);
      setPageError('Unable to update offer status.');
      return;
    }

    await loadOffers();
  }

  async function deleteOffer(offerId) {
    const confirmed = window.confirm(
      'Are you sure you want to delete this offer?'
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from('property_offers')
      .delete()
      .eq('id', offerId);

    if (error) {
      console.error(error);
      setPageError('Unable to delete offer.');
      return;
    }

    await loadOffers();
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = '/admin/bookings';
  }

  if (checkingSession) {
    return (
      <main style={styles.page}>
        <p>Loading offers...</p>
      </main>
    );
  }

  if (!session || !adminProfile) {
    return (
      <main style={styles.page}>
        <div style={styles.noticeBox}>
          <h2>Admin login required</h2>
          <p>
            Please log in through the bookings dashboard first.
          </p>

          <a
            href="/admin/bookings"
            style={styles.primaryLink}
          >
            Go to Admin Login
          </a>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.brand}>
            NightOutStays
          </div>

          <div style={styles.muted}>
            Host Administration
          </div>
        </div>

        <div style={styles.headerActions}>
          <a
            href="/admin/bookings"
            style={styles.navLink}
          >
            Bookings
          </a>

          <a
            href="/admin/offers"
            style={styles.activeNav}
          >
            Offers
          </a>

          <button
            onClick={logout}
            style={styles.logoutButton}
          >
            Logout
          </button>
        </div>
      </header>

      <section style={styles.content}>
        <div style={styles.titleRow}>
          <div>
            <h1 style={styles.title}>
              Pre-approved Offers
            </h1>

            <p style={styles.muted}>
              Create discounts for low-demand dates and selected properties.
            </p>
          </div>
        </div>

        <div style={styles.layout}>
          <div style={styles.formCard}>
            <h2>Create New Offer</h2>

            <form onSubmit={createOffer}>
              <label style={styles.label}>
                PROPERTY
              </label>

              <select
                style={styles.input}
                value={propertyId}
                onChange={(event) =>
                  setPropertyId(event.target.value)
                }
              >
                {properties.map((property) => (
                  <option
                    key={property.id}
                    value={property.id}
                  >
                    {property.name}
                  </option>
                ))}
              </select>

              <label style={styles.label}>
                OFFER NAME
              </label>

              <input
                style={styles.input}
                type="text"
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                placeholder="Example: Weekday Special"
              />

              <label style={styles.label}>
                DISCOUNT TYPE
              </label>

              <select
                style={styles.input}
                value={discountType}
                onChange={(event) =>
                  setDiscountType(event.target.value)
                }
              >
                <option value="percent">
                  Percentage %
                </option>

                <option value="flat">
                  Flat ₹
                </option>
              </select>

              <label style={styles.label}>
                DISCOUNT VALUE
              </label>

              <input
                style={styles.input}
                type="number"
                min="0"
                step="0.01"
                value={discountValue}
                onChange={(event) =>
                  setDiscountValue(event.target.value)
                }
                placeholder={
                  discountType === 'percent'
                    ? 'Example: 10'
                    : 'Example: 300'
                }
              />

              <div style={styles.twoColumn}>
                <div>
                  <label style={styles.label}>
                    START DATE
                  </label>

                  <input
                    style={styles.input}
                    type="date"
                    value={startDate}
                    onChange={(event) =>
                      setStartDate(event.target.value)
                    }
                  />
                </div>

                <div>
                  <label style={styles.label}>
                    END DATE
                  </label>

                  <input
                    style={styles.input}
                    type="date"
                    value={endDate}
                    onChange={(event) =>
                      setEndDate(event.target.value)
                    }
                  />
                </div>
              </div>

              <label style={styles.label}>
                MINIMUM NIGHTS
              </label>

              <input
                style={styles.input}
                type="number"
                min="1"
                value={minNights}
                onChange={(event) =>
                  setMinNights(event.target.value)
                }
              />

              {pageError && (
                <div style={styles.errorBox}>
                  {pageError}
                </div>
              )}

              {successMessage && (
                <div style={styles.successBox}>
                  {successMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                style={styles.primaryButton}
              >
                {saving
                  ? 'Creating Offer...'
                  : 'Create Offer'}
              </button>
            </form>
          </div>

          <div>
            <h2>Existing Offers</h2>

            {offers.length === 0 ? (
              <div style={styles.emptyBox}>
                No offers created yet.
              </div>
            ) : (
              <div style={styles.offerGrid}>
                {offers.map((offer) => (
                  <div
                    key={offer.id}
                    style={styles.offerCard}
                  >
                    <div style={styles.offerTop}>
                      <div>
                        <div style={styles.offerTitle}>
                          {offer.title}
                        </div>

                        <div style={styles.muted}>
                          {offer.properties?.name}
                        </div>
                      </div>

                      <span
                        style={{
                          ...styles.statusBadge,
                          background: offer.is_active
                            ? '#e7f7ec'
                            : '#eeeeee',
                        }}
                      >
                        {offer.is_active
                          ? 'Active'
                          : 'Inactive'}
                      </span>
                    </div>

                    <div style={styles.discountValue}>
                      {offer.discount_type === 'percent'
                        ? `${Number(
                            offer.discount_value
                          )}% OFF`
                        : `₹${Number(
                            offer.discount_value
                          ).toLocaleString('en-IN')} OFF`}
                    </div>

                    <div style={styles.offerMeta}>
                      Valid: {offer.start_date} →{' '}
                      {offer.end_date}
                    </div>

                    <div style={styles.offerMeta}>
                      Minimum stay: {offer.min_nights}{' '}
                      night
                      {offer.min_nights > 1
                        ? 's'
                        : ''}
                    </div>

                    <div style={styles.offerActions}>
                      <button
                        onClick={() =>
                          toggleOffer(offer)
                        }
                        style={styles.secondaryButton}
                      >
                        {offer.is_active
                          ? 'Deactivate'
                          : 'Activate'}
                      </button>

                      <button
                        onClick={() =>
                          deleteOffer(offer.id)
                        }
                        style={styles.deleteButton}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f6f7f9',
    color: '#172033',
    fontFamily: 'Arial, sans-serif',
  },

  header: {
    background: '#ffffff',
    padding: '18px 5vw',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e5e5e5',
  },

  brand: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#303a44',
  },

  muted: {
    color: '#687080',
  },

  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },

  navLink: {
    textDecoration: 'none',
    color: '#303a44',
    padding: '9px 14px',
    borderRadius: '20px',
  },

  activeNav: {
    textDecoration: 'none',
    color: '#ffffff',
    background: '#303a44',
    padding: '9px 14px',
    borderRadius: '20px',
  },

  logoutButton: {
    border: '1px solid #ddd',
    background: '#ffffff',
    padding: '9px 14px',
    borderRadius: '20px',
    cursor: 'pointer',
  },

  content: {
    maxWidth: '1500px',
    margin: 'auto',
    padding: '35px 5vw 70px',
  },

  titleRow: {
    marginBottom: '28px',
  },

  title: {
    marginBottom: '5px',
  },

  layout: {
    display: 'grid',
    gridTemplateColumns:
      'minmax(320px, 420px) 1fr',
    gap: '28px',
    alignItems: 'start',
  },

  formCard: {
    background: '#ffffff',
    padding: '24px',
    borderRadius: '16px',
    border: '1px solid #e2e4e8',
  },

  label: {
    display: 'block',
    fontSize: '10px',
    fontWeight: '800',
    letterSpacing: '1px',
    marginTop: '16px',
    marginBottom: '6px',
  },

  input: {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid #d4d7dc',
    background: '#ffffff',
  },

  twoColumn: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },

  primaryButton: {
    width: '100%',
    marginTop: '20px',
    padding: '14px',
    border: 0,
    borderRadius: '10px',
    background: '#303a44',
    color: '#ffffff',
    fontWeight: '800',
    cursor: 'pointer',
  },

  errorBox: {
    marginTop: '15px',
    padding: '12px',
    borderRadius: '10px',
    background: '#ffecec',
    color: '#8b2020',
    fontWeight: '700',
  },

  successBox: {
    marginTop: '15px',
    padding: '12px',
    borderRadius: '10px',
    background: '#edf9f0',
    color: '#25663a',
    fontWeight: '700',
  },

  emptyBox: {
    background: '#ffffff',
    padding: '30px',
    borderRadius: '15px',
  },

  offerGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '18px',
  },

  offerCard: {
    background: '#ffffff',
    padding: '20px',
    borderRadius: '16px',
    border: '1px solid #e2e4e8',
  },

  offerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
  },

  offerTitle: {
    fontSize: '18px',
    fontWeight: '800',
  },

  statusBadge: {
    height: 'fit-content',
    padding: '6px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '800',
  },

  discountValue: {
    fontSize: '26px',
    fontWeight: '900',
    color: '#b07b12',
    marginTop: '20px',
  },

  offerMeta: {
    marginTop: '10px',
    fontSize: '13px',
    color: '#555',
  },

  offerActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '20px',
  },

  secondaryButton: {
    flex: 1,
    padding: '10px',
    borderRadius: '10px',
    border: '1px solid #303a44',
    background: '#ffffff',
    color: '#303a44',
    cursor: 'pointer',
    fontWeight: '700',
  },

  deleteButton: {
    padding: '10px 14px',
    borderRadius: '10px',
    border: 0,
    background: '#ffecec',
    color: '#8b2020',
    cursor: 'pointer',
    fontWeight: '700',
  },

  noticeBox: {
    maxWidth: '460px',
    margin: '80px auto',
    background: '#ffffff',
    padding: '30px',
    borderRadius: '16px',
  },

  primaryLink: {
    display: 'inline-block',
    marginTop: '15px',
    padding: '11px 16px',
    borderRadius: '10px',
    background: '#303a44',
    color: '#ffffff',
    textDecoration: 'none',
  },
};