'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

export default function AdminBookingsPage() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [adminProfile, setAdminProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [pageError, setPageError] = useState('');

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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);

      if (session) {
        await verifyAdmin(session.user.id);
      } else {
        setAdminProfile(null);
        setBookings([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function verifyAdmin(userId) {
    setPageError('');

    const { data, error } = await supabase
      .from('admin_profiles')
      .select('user_id, full_name, role, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      setAdminProfile(null);
      setPageError(
        'This login does not have permission to access the admin dashboard.'
      );
      return;
    }

    setAdminProfile(data);
    await loadBookings();
  }

  async function login(event) {
    event.preventDefault();

    setLoginError('');
    setLoginLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoginLoading(false);

    if (error) {
      setLoginError('Invalid email or password.');
      return;
    }

    if (data.session) {
      setSession(data.session);
      await verifyAdmin(data.session.user.id);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setAdminProfile(null);
    setBookings([]);
  }

  async function loadBookings() {
    setLoadingBookings(true);
    setPageError('');

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_code,
        check_in,
        check_out,
        guests_count,
        nights,
        nightly_rate,
        cleaning_fee,
        security_deposit,
        total_amount,
        booking_status,
        payment_status,
        notes,
        created_at,
        properties (
          name,
          location_name
        ),
        guests (
          full_name,
          phone,
          email
        )
      `)
      .order('created_at', { ascending: false });

    setLoadingBookings(false);

    if (error) {
      console.error(error);
      setPageError('Unable to load bookings.');
      return;
    }

    setBookings(data || []);
  }

  async function updateBookingStatus(bookingId, newStatus) {
    setPageError('');

    const { error } = await supabase
      .from('bookings')
      .update({
        booking_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (error) {
      console.error(error);
      setPageError('Unable to update booking status.');
      return;
    }

    await loadBookings();
  }

  async function updatePaymentStatus(bookingId, newStatus) {
    setPageError('');

    const { error } = await supabase
      .from('bookings')
      .update({
        payment_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (error) {
      console.error(error);
      setPageError('Unable to update payment status.');
      return;
    }

    await loadBookings();
  }

  if (checkingSession) {
    return (
      <main style={styles.page}>
        <p>Loading admin dashboard...</p>
      </main>
    );
  }

  if (!session || !adminProfile) {
    return (
      <main style={styles.loginPage}>
        <div style={styles.loginBox}>
          <div style={styles.brand}>NightOutStays</div>

          <h1 style={styles.loginTitle}>
            Admin Login
          </h1>

          <p style={styles.muted}>
            Sign in to manage bookings.
          </p>

          <form onSubmit={login}>
            <label style={styles.label}>
              EMAIL
            </label>

            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="Admin email"
              required
            />

            <label style={styles.label}>
              PASSWORD
            </label>

            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Password"
              required
            />

            {loginError && (
              <div style={styles.errorBox}>
                {loginError}
              </div>
            )}

            {pageError && (
              <div style={styles.errorBox}>
                {pageError}
              </div>
            )}

            <button
              style={styles.primaryButton}
              disabled={loginLoading}
              type="submit"
            >
              {loginLoading
                ? 'Signing in...'
                : 'Login'}
            </button>
          </form>

          <a href="/" style={styles.backLink}>
            ← Back to website
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
            Booking Administration
          </div>
        </div>

        <div style={styles.headerRight}>
          <div>
            <strong>
              {adminProfile.full_name || 'Admin'}
            </strong>

            <div style={styles.smallText}>
              {adminProfile.role}
            </div>
          </div>

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
              Bookings
            </h1>

            <p style={styles.muted}>
              Manage guest bookings and payment status.
            </p>
          </div>

          <button
            onClick={loadBookings}
            style={styles.refreshButton}
          >
            Refresh
          </button>
        </div>

        {pageError && (
          <div style={styles.errorBox}>
            {pageError}
          </div>
        )}

        {loadingBookings ? (
          <p>Loading bookings...</p>
        ) : bookings.length === 0 ? (
          <div style={styles.emptyBox}>
            No bookings found.
          </div>
        ) : (
          <div style={styles.bookingGrid}>
            {bookings.map((booking) => (
              <div
                key={booking.id}
                style={styles.bookingCard}
              >
                <div style={styles.cardTop}>
                  <div>
                    <div style={styles.bookingCode}>
                      {booking.booking_code}
                    </div>

                    <div style={styles.smallText}>
                      {new Date(
                        booking.created_at
                      ).toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div
                    style={{
                      ...styles.statusBadge,
                      background:
                        booking.booking_status ===
                        'confirmed'
                          ? '#e7f7ec'
                          : booking.booking_status ===
                            'cancelled'
                          ? '#ffeaea'
                          : booking.booking_status ===
                            'completed'
                          ? '#e8eef9'
                          : '#fff4dc',
                    }}
                  >
                    {booking.booking_status}
                  </div>
                </div>

                <h2 style={styles.propertyName}>
                  {booking.properties?.name ||
                    'Property'}
                </h2>

                <div style={styles.location}>
                  {booking.properties?.location_name}
                </div>

                <div style={styles.divider} />

                <div style={styles.infoGrid}>
                  <div>
                    <span style={styles.infoLabel}>
                      Guest
                    </span>

                    <strong>
                      {booking.guests?.full_name}
                    </strong>
                  </div>

                  <div>
                    <span style={styles.infoLabel}>
                      Mobile
                    </span>

                    <strong>
                      {booking.guests?.phone}
                    </strong>
                  </div>

                  <div>
                    <span style={styles.infoLabel}>
                      Check-in
                    </span>

                    <strong>
                      {booking.check_in}
                    </strong>
                  </div>

                  <div>
                    <span style={styles.infoLabel}>
                      Check-out
                    </span>

                    <strong>
                      {booking.check_out}
                    </strong>
                  </div>

                  <div>
                    <span style={styles.infoLabel}>
                      Guests
                    </span>

                    <strong>
                      {booking.guests_count}
                    </strong>
                  </div>

                  <div>
                    <span style={styles.infoLabel}>
                      Nights
                    </span>

                    <strong>
                      {booking.nights}
                    </strong>
                  </div>
                </div>

                <div style={styles.amountBox}>
                  <span>Total Amount</span>

                  <strong>
                    ₹
                    {Number(
                      booking.total_amount
                    ).toLocaleString('en-IN')}
                  </strong>
                </div>

                <label style={styles.label}>
                  BOOKING STATUS
                </label>

                <select
                  style={styles.input}
                  value={booking.booking_status}
                  onChange={(event) =>
                    updateBookingStatus(
                      booking.id,
                      event.target.value
                    )
                  }
                >
                  <option value="pending">
                    Pending
                  </option>

                  <option value="confirmed">
                    Confirmed
                  </option>

                  <option value="cancelled">
                    Cancelled
                  </option>

                  <option value="completed">
                    Completed
                  </option>
                </select>

                <label style={styles.label}>
                  PAYMENT STATUS
                </label>

                <select
                  style={styles.input}
                  value={
                    booking.payment_status ||
                    'unpaid'
                  }
                  onChange={(event) =>
                    updatePaymentStatus(
                      booking.id,
                      event.target.value
                    )
                  }
                >
                  <option value="unpaid">
                    Unpaid
                  </option>

                  <option value="partial">
                    Partial
                  </option>

                  <option value="paid">
                    Paid
                  </option>

                  <option value="refunded">
                    Refunded
                  </option>
                </select>

                {booking.notes && (
                  <div style={styles.notes}>
                    <strong>Guest note:</strong>
                    <br />
                    {booking.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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

  loginPage: {
    minHeight: '100vh',
    background: '#f6f7f9',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
  },

  loginBox: {
    width: '100%',
    maxWidth: '420px',
    background: '#ffffff',
    padding: '32px',
    borderRadius: '18px',
    boxShadow: '0 15px 40px rgba(0,0,0,0.08)',
  },

  brand: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#163c74',
  },

  loginTitle: {
    marginBottom: '5px',
  },

  muted: {
    color: '#687080',
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

  primaryButton: {
    width: '100%',
    marginTop: '20px',
    padding: '14px',
    background: '#163c74',
    color: '#ffffff',
    border: 0,
    borderRadius: '10px',
    fontWeight: '800',
    cursor: 'pointer',
  },

  backLink: {
    display: 'block',
    textAlign: 'center',
    marginTop: '20px',
    color: '#163c74',
    textDecoration: 'none',
  },

  errorBox: {
    padding: '12px',
    background: '#ffecec',
    borderRadius: '10px',
    marginTop: '15px',
    color: '#8b2020',
    fontWeight: '700',
  },

  header: {
    background: '#ffffff',
    padding: '18px 5vw',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e5e5e5',
  },

  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '18px',
  },

  smallText: {
    color: '#777',
    fontSize: '12px',
  },

  logoutButton: {
    border: '1px solid #ddd',
    background: '#ffffff',
    padding: '9px 14px',
    borderRadius: '20px',
    cursor: 'pointer',
  },

  content: {
    padding: '35px 5vw 70px',
    maxWidth: '1500px',
    margin: 'auto',
  },

  titleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '25px',
  },

  title: {
    marginBottom: '5px',
  },

  refreshButton: {
    background: '#163c74',
    color: '#fff',
    border: 0,
    borderRadius: '10px',
    padding: '10px 18px',
    cursor: 'pointer',
    fontWeight: '700',
  },

  bookingGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '20px',
  },

  bookingCard: {
    background: '#ffffff',
    padding: '22px',
    borderRadius: '16px',
    border: '1px solid #e2e4e8',
  },

  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '15px',
  },

  bookingCode: {
    color: '#163c74',
    fontSize: '18px',
    fontWeight: '800',
  },

  statusBadge: {
    height: 'fit-content',
    borderRadius: '20px',
    padding: '7px 12px',
    textTransform: 'capitalize',
    fontSize: '12px',
    fontWeight: '800',
  },

  propertyName: {
    fontSize: '19px',
    marginBottom: '5px',
  },

  location: {
    color: '#777',
    fontSize: '13px',
  },

  divider: {
    height: '1px',
    background: '#eeeeee',
    margin: '18px 0',
  },

  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },

  infoLabel: {
    display: 'block',
    color: '#777',
    fontSize: '11px',
    marginBottom: '4px',
  },

  amountBox: {
    background: '#f5f7fa',
    borderRadius: '10px',
    padding: '14px',
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '20px',
    fontSize: '17px',
  },

  notes: {
    background: '#fff8e9',
    borderRadius: '10px',
    padding: '12px',
    marginTop: '16px',
    fontSize: '13px',
  },

  emptyBox: {
    background: '#ffffff',
    padding: '30px',
    borderRadius: '15px',
  },
};