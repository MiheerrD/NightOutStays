'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import GuestNav from '../GuestNav';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

export default function GuestBookingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('upcoming');

  useEffect(() => {
    initialisePage();
  }, []);

  useEffect(() => {
    if (!guest?.id) return;

    const channel = supabase
      .channel(`guest-bookings-${guest.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `guest_id=eq.${guest.id}`,
        },
        () => {
          loadBookings(guest.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [guest?.id]);

  async function initialisePage() {
    try {
      setLoading(true);
      setError('');

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session?.user) {
        router.replace('/login?redirect=/account/bookings');
        return;
      }

      const user = session.user;

      const { data: guestRow, error: guestError } = await supabase
        .from('guests')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (guestError) {
        throw guestError;
      }

      if (!guestRow) {
        setError(
          'Your guest profile could not be found. Please log out and log in again.'
        );
        return;
      }

      setGuest(guestRow);
      await loadBookings(guestRow.id);
    } catch (err) {
      console.error('Guest bookings initialization error:', err);

      setError(
        err?.message ||
          'Unable to load your bookings. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadBookings(guestId) {
    try {
      setError('');

      const { data, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          properties (
            id,
            name,
            slug,
            location_name,
            address
          )
        `)
        .eq('guest_id', guestId)
        .order('created_at', { ascending: false });

      if (bookingsError) {
        throw bookingsError;
      }

      setBookings(data || []);
    } catch (err) {
      console.error('Load bookings error:', err);

      setError(
        err?.message ||
          'Unable to load your bookings.'
      );
    }
  }

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const groupedBookings = useMemo(() => {
    const upcoming = [];
    const past = [];
    const cancelled = [];

    bookings.forEach((booking) => {
      const status = String(
        booking.booking_status || ''
      ).toLowerCase();

      const checkOut = booking.check_out
        ? parseDateOnly(booking.check_out)
        : null;

      if (
        status === 'cancelled' ||
        status === 'declined'
      ) {
        cancelled.push(booking);
        return;
      }

      if (
        status === 'completed' ||
        (checkOut && checkOut < today)
      ) {
        past.push(booking);
        return;
      }

      upcoming.push(booking);
    });

    upcoming.sort((a, b) => {
      const aDate = parseDateOnly(a.check_in);
      const bDate = parseDateOnly(b.check_in);

      return (
        (aDate?.getTime() || 0) -
        (bDate?.getTime() || 0)
      );
    });

    past.sort((a, b) => {
      const aDate = parseDateOnly(a.check_out);
      const bDate = parseDateOnly(b.check_out);

      return (
        (bDate?.getTime() || 0) -
        (aDate?.getTime() || 0)
      );
    });

    cancelled.sort((a, b) => {
      return (
        new Date(
          b.updated_at || b.created_at
        ).getTime() -
        new Date(
          a.updated_at || a.created_at
        ).getTime()
      );
    });

    return {
      upcoming,
      past,
      cancelled,
    };
  }, [bookings, today]);

  const currentBookings =
    activeTab === 'upcoming'
      ? groupedBookings.upcoming
      : activeTab === 'past'
      ? groupedBookings.past
      : groupedBookings.cancelled;

  if (loading) {
    return (
      <>
        <PageStyles />

        <main className="guest-page">
          <div className="loading-card">
            <div className="loader" />

            <h2>Loading your bookings</h2>

            <p>
              Please wait while we prepare your NightOutStays account.
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <PageStyles />

      <GuestNav guest={guest} />

      <main className="guest-page">
        <div className="guest-shell">

          <section className="guest-page-heading">
            <p className="guest-eyebrow">
              GUEST PORTAL
            </p>

            <h1>
              My Bookings
            </h1>

            <p className="welcome-text">
              {guest?.full_name
                ? `Welcome, ${guest.full_name}. Manage your stays, payments and booking requests.`
                : 'Manage your stays, payments and booking requests.'}
            </p>
          </section>

          {error ? (
            <div className="error-box">
              <strong>Unable to load account</strong>

              <span>{error}</span>

              <button
                type="button"
                onClick={initialisePage}
              >
                Try Again
              </button>
            </div>
          ) : (
            <>
              <section className="summary-grid">
                <SummaryCard
                  label="Upcoming"
                  value={groupedBookings.upcoming.length}
                  description="Active requests and upcoming stays"
                />

                <SummaryCard
                  label="Past Stays"
                  value={groupedBookings.past.length}
                  description="Completed and previous stays"
                />

                <SummaryCard
                  label="Cancelled"
                  value={groupedBookings.cancelled.length}
                  description="Cancelled, declined or expired"
                />
              </section>

              <nav className="booking-tabs">
                <TabButton
                  active={activeTab === 'upcoming'}
                  onClick={() =>
                    setActiveTab('upcoming')
                  }
                >
                  Upcoming
                  <span>
                    {groupedBookings.upcoming.length}
                  </span>
                </TabButton>

                <TabButton
                  active={activeTab === 'past'}
                  onClick={() =>
                    setActiveTab('past')
                  }
                >
                  Past Stays
                  <span>
                    {groupedBookings.past.length}
                  </span>
                </TabButton>

                <TabButton
                  active={activeTab === 'cancelled'}
                  onClick={() =>
                    setActiveTab('cancelled')
                  }
                >
                  Cancelled / Expired
                  <span>
                    {groupedBookings.cancelled.length}
                  </span>
                </TabButton>
              </nav>

              <section className="booking-content">
                {currentBookings.length === 0 ? (
                  <EmptyBookings
                    activeTab={activeTab}
                    onBrowse={() => router.push('/')}
                  />
                ) : (
                  <div className="booking-list">
                    {currentBookings.map((booking) => (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        activeTab={activeTab}
                        router={router}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}

function SummaryCard({
  label,
  value,
  description,
}) {
  return (
    <div className="summary-card">
      <div className="summary-number">
        {value}
      </div>

      <div>
        <div className="summary-label">
          {label}
        </div>

        <div className="summary-description">
          {description}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}) {
  return (
    <button
      type="button"
      className={
        active
          ? 'tab-button active'
          : 'tab-button'
      }
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function EmptyBookings({
  activeTab,
  onBrowse,
}) {
  let title = 'No upcoming bookings';
  let text =
    'Your booking requests and upcoming stays will appear here.';

  if (activeTab === 'past') {
    title = 'No past stays';
    text =
      'Your completed stays will appear here after checkout.';
  }

  if (activeTab === 'cancelled') {
    title = 'No cancelled bookings';
    text =
      'Cancelled, declined and expired requests will appear here.';
  }

  return (
    <div className="empty-card">
      <div className="empty-icon">
        🏡
      </div>

      <h2>{title}</h2>

      <p>{text}</p>

      {activeTab === 'upcoming' && (
        <button
          type="button"
          className="primary-button"
          onClick={onBrowse}
        >
          Browse Properties
        </button>
      )}
    </div>
  );
}

function BookingCard({
  booking,
  activeTab,
  router,
}) {
  const property = booking.properties || {};

  const displayStatus =
    getBookingDisplayStatus(booking);

  const paymentStatus = String(
    booking.payment_status || 'unpaid'
  ).toLowerCase();

  const amount = Number(
    booking.final_payable_amount ||
      booking.amount_including_gst ||
      booking.total_amount ||
      0
  );

  const canPay =
    paymentStatus !== 'paid' &&
    (
      booking.host_decision === 'approved' ||
      booking.offer_status === 'accepted' ||
      booking.booking_status === 'approved' ||
      booking.booking_status === 'confirmed'
    ) &&
    !isApprovalExpired(booking);

  const propertyImage =
    booking.property_image || '';

  return (
    <article className="booking-card">

      <div className="booking-image-wrap">
        {propertyImage ? (
          <img
            src={propertyImage}
            alt={property.name || 'Property'}
            className="booking-image"
          />
        ) : (
          <div className="image-placeholder">
            <span>NightOutStays</span>
          </div>
        )}
      </div>

      <div className="booking-main">

        <div className="booking-top">
          <div>
            <div className="booking-code">
              {booking.booking_code ||
                'Booking Request'}
            </div>

            <h2>
              {property.name ||
                'NightOutStays Property'}
            </h2>

            {(property.location_name ||
              property.address) && (
              <p className="property-location">
                {[
                  property.location_name,
                  property.address,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
          </div>

          <StatusBadge
            status={displayStatus}
          />
        </div>

        <div className="stay-details">
          <DetailItem
            label="Check-in"
            value={formatDate(
              booking.check_in
            )}
          />

          <DetailItem
            label="Check-out"
            value={formatDate(
              booking.check_out
            )}
          />

          <DetailItem
            label="Guests"
            value={
              booking.guests_count
                ? `${booking.guests_count} ${
                    Number(
                      booking.guests_count
                    ) === 1
                      ? 'Guest'
                      : 'Guests'
                  }`
                : '—'
            }
          />

          <DetailItem
            label="Nights"
            value={
              booking.nights
                ? String(booking.nights)
                : calculateNights(
                    booking.check_in,
                    booking.check_out
                  )
            }
          />
        </div>

        <div className="booking-finance">
          <div>
            <span className="finance-label">
              Total Amount
            </span>

            <strong className="amount">
              {formatCurrency(amount)}
            </strong>
          </div>

          <div className="payment-info">
            <span className="finance-label">
              Payment
            </span>

            <PaymentBadge
              paymentStatus={paymentStatus}
            />
          </div>
        </div>

        {displayStatus ===
          'Host Approved – Payment Pending' && (
            <ApprovalNotice
              booking={booking}
            />
          )}

        {booking.offer_status ===
          'host_offered' && (
            <div className="offer-notice">
              <strong>
                Special Offer Received
              </strong>

              <span>
                Your host has sent you a special price.
                Open Messages to review the offer.
              </span>
            </div>
          )}

        {paymentStatus === 'paid' &&
          booking.verification_status ===
            'pending' && (
            <div className="verification-notice">
              <strong>
                Identity Verification Required
              </strong>

              <span>
                Payment received. Complete your ID verification
                to finish the booking confirmation process.
              </span>
            </div>
          )}

        <div className="booking-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              router.push(
                `/account/messages?booking=${encodeURIComponent(
                  booking.booking_code ||
                    booking.id
                )}`
              )
            }
          >
            Messages
          </button>

          {property.slug && (
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                router.push(
                  `/property/${property.slug}`
                )
              }
            >
              View Property
            </button>
          )}

          {canPay && (
            <button
              type="button"
              className="primary-button"
              onClick={() =>
                router.push(
                  `/booking/${
                    booking.booking_code ||
                    booking.id
                  }/pay`
                )
              }
            >
              Pay Now
            </button>
          )}

          {paymentStatus === 'paid' &&
            booking.verification_status ===
              'pending' && (
              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  router.push(
                    `/account/verification?booking=${encodeURIComponent(
                      booking.booking_code ||
                        booking.id
                    )}`
                  )
                }
              >
                Verify ID
              </button>
            )}

          {activeTab === 'past' &&
            paymentStatus === 'paid' && (
              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  router.push(
                    `/account/reviews?booking=${encodeURIComponent(
                      booking.booking_code ||
                        booking.id
                    )}`
                  )
                }
              >
                Write Review
              </button>
            )}
        </div>
      </div>
    </article>
  );
}

function DetailItem({
  label,
  value,
}) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = String(
    status || ''
  ).toLowerCase();

  let className = 'status-badge';

  if (
    normalized.includes('booked') ||
    normalized.includes('confirmed')
  ) {
    className += ' status-success';
  } else if (
    normalized.includes('declined') ||
    normalized.includes('cancelled') ||
    normalized.includes('expired')
  ) {
    className += ' status-danger';
  } else if (
    normalized.includes('payment') ||
    normalized.includes('offer')
  ) {
    className += ' status-warning';
  } else {
    className += ' status-info';
  }

  return (
    <span className={className}>
      {status}
    </span>
  );
}

function PaymentBadge({
  paymentStatus,
}) {
  const paid =
    paymentStatus === 'paid';

  const refunded =
    paymentStatus === 'refunded';

  return (
    <span
      className={
        paid
          ? 'payment-badge payment-paid'
          : refunded
          ? 'payment-badge payment-refunded'
          : 'payment-badge payment-unpaid'
      }
    >
      {paid
        ? 'Paid'
        : refunded
        ? 'Refunded'
        : 'Payment Pending'}
    </span>
  );
}

function ApprovalNotice({
  booking,
}) {
  const deadline =
    getApprovalDeadline(booking);

  if (!deadline) {
    return null;
  }

  const expired =
    deadline.getTime() <= Date.now();

  return (
    <div
      className={
        expired
          ? 'approval-notice expired'
          : 'approval-notice'
      }
    >
      <strong>
        {expired
          ? 'Host Approval Expired'
          : 'Host Approved Your Request'}
      </strong>

      <span>
        {expired
          ? 'The 24-hour payment window has expired. Please submit a new booking request.'
          : `Complete payment before ${formatDateTime(
              deadline
            )}. Host approval is valid for 24 hours.`}
      </span>
    </div>
  );
}

function getBookingDisplayStatus(
  booking
) {
  const bookingStatus = String(
    booking.booking_status || ''
  ).toLowerCase();

  const paymentStatus = String(
    booking.payment_status || ''
  ).toLowerCase();

  const hostDecision = String(
    booking.host_decision || ''
  ).toLowerCase();

  const offerStatus = String(
    booking.offer_status || ''
  ).toLowerCase();

  if (paymentStatus === 'paid') {
    if (
      booking.verification_status ===
      'pending'
    ) {
      return 'Paid – Verification Pending';
    }

    return 'Property Booked';
  }

  if (
    bookingStatus.includes('cancel')
  ) {
    return 'Cancelled';
  }

  if (
    bookingStatus.includes('declin') ||
    hostDecision.includes('declin') ||
    hostDecision.includes('reject')
  ) {
    return 'Declined';
  }

  if (isApprovalExpired(booking)) {
    return 'Approval Expired';
  }

  if (
    offerStatus === 'host_offered'
  ) {
    return 'Special Offer Received';
  }

  if (
    hostDecision === 'approved'
  ) {
    return 'Host Approved – Payment Pending';
  }

  if (
    booking.guest_discount_requested
  ) {
    return 'Discount Requested';
  }

  if (
    bookingStatus === 'confirmed' ||
    bookingStatus === 'booked'
  ) {
    return 'Confirmed';
  }

  if (
    bookingStatus === 'completed'
  ) {
    return 'Completed';
  }

  return 'Booking Requested';
}

function getApprovalDeadline(
  booking
) {
  if (
    booking.payment_due_at
  ) {
    const deadline =
      new Date(
        booking.payment_due_at
      );

    if (
      !Number.isNaN(
        deadline.getTime()
      )
    ) {
      return deadline;
    }
  }

  const approvedAt =
    booking.host_decision_at ||
    booking.updated_at;

  if (!approvedAt) {
    return null;
  }

  const approvedDate =
    new Date(approvedAt);

  if (
    Number.isNaN(
      approvedDate.getTime()
    )
  ) {
    return null;
  }

  return new Date(
    approvedDate.getTime() +
      24 * 60 * 60 * 1000
  );
}

function isApprovalExpired(
  booking
) {
  if (
    String(
      booking.payment_status || ''
    ).toLowerCase() === 'paid'
  ) {
    return false;
  }

  if (
    String(
      booking.host_decision || ''
    ).toLowerCase() !== 'approved'
  ) {
    return false;
  }

  const deadline =
    getApprovalDeadline(booking);

  if (!deadline) {
    return false;
  }

  return (
    deadline.getTime() <=
    Date.now()
  );
}

function parseDateOnly(value) {
  if (!value) {
    return null;
  }

  const parts =
    String(value).split('-');

  if (parts.length === 3) {
    const year =
      Number(parts[0]);

    const month =
      Number(parts[1]);

    const day =
      Number(parts[2]);

    return new Date(
      year,
      month - 1,
      day
    );
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}

function formatDate(value) {
  const date =
    parseDateOnly(value);

  if (!date) {
    return '—';
  }

  return new Intl.DateTimeFormat(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }
  ).format(date);
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

function formatCurrency(value) {
  const number =
    Number(value || 0);

  return new Intl.NumberFormat(
    'en-IN',
    {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }
  ).format(number);
}

function calculateNights(
  checkIn,
  checkOut
) {
  const start =
    parseDateOnly(checkIn);

  const end =
    parseDateOnly(checkOut);

  if (!start || !end) {
    return '—';
  }

  const difference =
    end.getTime() -
    start.getTime();

  const nights =
    Math.round(
      difference /
        (1000 * 60 * 60 * 24)
    );

  return nights > 0
    ? String(nights)
    : '—';
}

function PageStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: #f5f7fb;
        color: #172033;
        font-family:
          Arial,
          Helvetica,
          sans-serif;
      }

      button {
        font: inherit;
      }

      .guest-page {
        min-height: 100vh;
        padding: 28px 20px 60px;
      }

      .guest-shell {
        width: 100%;
        max-width: 1180px;
        margin: 0 auto;
      }

      /*
      ==========================================
      PAGE HEADING
      ==========================================
      */

      .guest-page-heading {
        margin-bottom: 26px;
      }

      .guest-eyebrow {
        margin: 0 0 7px;
        color: #667085;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 1px;
      }

      .guest-page-heading h1 {
        margin: 0;
        color: #101828;
        font-size: 34px;
        line-height: 1.15;
      }

      .welcome-text {
        margin: 8px 0 0;
        color: #667085;
        font-size: 15px;
      }

      /*
      ==========================================
      BUTTONS
      ==========================================
      */

      .primary-button,
      .secondary-button {
        min-height: 44px;
        border-radius: 10px;
        padding: 10px 16px;
        font-weight: 700;
        cursor: pointer;
      }

      .primary-button {
        border: 1px solid #154f91;
        background: #154f91;
        color: white;
      }

      .secondary-button {
        border: 1px solid #d0d5dd;
        background: white;
        color: #344054;
      }

      /*
      ==========================================
      SUMMARY
      ==========================================
      */

      .summary-grid {
        display: grid;
        grid-template-columns:
          repeat(
            3,
            minmax(0, 1fr)
          );
        gap: 14px;
        margin-bottom: 20px;
      }

      .summary-card {
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 18px;
        border:
          1px solid #e5e7eb;
        border-radius: 16px;
        background: white;
      }

      .summary-number {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 52px;
        min-width: 52px;
        height: 52px;
        border-radius: 14px;
        background: #edf4ff;
        color: #154f91;
        font-size: 22px;
        font-weight: 800;
      }

      .summary-label {
        margin-bottom: 4px;
        font-weight: 800;
      }

      .summary-description {
        color: #667085;
        font-size: 12px;
        line-height: 1.4;
      }

      /*
      ==========================================
      BOOKING TABS
      ==========================================
      */

      .booking-tabs {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        margin-bottom: 18px;
        padding-bottom: 2px;
      }

      .tab-button {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 0 0 auto;
        min-height: 44px;
        padding: 9px 14px;
        border:
          1px solid #dfe3ea;
        border-radius: 999px;
        background: white;
        color: #475467;
        font-weight: 700;
        cursor: pointer;
      }

      .tab-button span {
        min-width: 24px;
        padding: 3px 7px;
        border-radius: 999px;
        background: #f2f4f7;
        font-size: 11px;
        text-align: center;
      }

      .tab-button.active {
        border-color: #154f91;
        background: #154f91;
        color: white;
      }

      .tab-button.active span {
        background:
          rgba(
            255,
            255,
            255,
            0.18
          );
        color: white;
      }

      /*
      ==========================================
      BOOKING LIST
      ==========================================
      */

      .booking-list {
        display: grid;
        gap: 16px;
      }

      .booking-card {
        display: grid;
        grid-template-columns:
          250px 1fr;
        overflow: hidden;
        border:
          1px solid #e4e7ec;
        border-radius: 18px;
        background: white;
        box-shadow:
          0 5px 18px
          rgba(
            16,
            24,
            40,
            0.04
          );
      }

      /*
      ==========================================
      PROPERTY IMAGE
      ==========================================
      */

      .booking-image-wrap {
        min-height: 100%;
        background: #e9eef5;
      }

      .booking-image {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 260px;
        object-fit: cover;
      }

      .image-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        min-height: 260px;
        background:
          linear-gradient(
            145deg,
            #0d376d,
            #1c64ae
          );
        color: white;
        font-size: 19px;
        font-weight: 800;
      }

      /*
      ==========================================
      BOOKING CONTENT
      ==========================================
      */

      .booking-main {
        min-width: 0;
        padding: 20px;
      }

      .booking-top {
        display: flex;
        justify-content:
          space-between;
        align-items:
          flex-start;
        gap: 15px;
      }

      .booking-code {
        margin-bottom: 5px;
        color: #667085;
        font-size: 12px;
        font-weight: 700;
      }

      .booking-top h2 {
        margin: 0;
        font-size: 21px;
        line-height: 1.3;
      }

      .property-location {
        margin: 6px 0 0;
        color: #667085;
        font-size: 13px;
      }

      /*
      ==========================================
      STATUS
      ==========================================
      */

      .status-badge {
        display: inline-flex;
        align-items: center;
        flex: 0 0 auto;
        max-width: 250px;
        min-height: 30px;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 800;
        line-height: 1.25;
        text-align: center;
      }

      .status-success {
        background: #ecfdf3;
        color: #027a48;
      }

      .status-danger {
        background: #fef3f2;
        color: #b42318;
      }

      .status-warning {
        background: #fffaeb;
        color: #b54708;
      }

      .status-info {
        background: #eff8ff;
        color: #175cd3;
      }

      /*
      ==========================================
      STAY DETAILS
      ==========================================
      */

      .stay-details {
        display: grid;
        grid-template-columns:
          repeat(
            4,
            minmax(0, 1fr)
          );
        gap: 10px;
        margin-top: 18px;
      }

      .detail-item {
        padding: 12px;
        border-radius: 12px;
        background: #f8fafc;
      }

      .detail-item span {
        display: block;
        margin-bottom: 5px;
        color: #667085;
        font-size: 11px;
      }

      .detail-item strong {
        font-size: 13px;
      }

      /*
      ==========================================
      FINANCE
      ==========================================
      */

      .booking-finance {
        display: flex;
        justify-content:
          space-between;
        align-items: flex-end;
        gap: 20px;
        margin-top: 16px;
        padding-top: 16px;
        border-top:
          1px solid #eef0f3;
      }

      .finance-label {
        display: block;
        margin-bottom: 5px;
        color: #667085;
        font-size: 11px;
      }

      .amount {
        font-size: 21px;
      }

      .payment-info {
        text-align: right;
      }

      .payment-badge {
        display: inline-block;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 800;
      }

      .payment-paid {
        background: #ecfdf3;
        color: #027a48;
      }

      .payment-unpaid {
        background: #fff7ed;
        color: #c2410c;
      }

      .payment-refunded {
        background: #f2f4f7;
        color: #475467;
      }

      /*
      ==========================================
      NOTICES
      ==========================================
      */

      .approval-notice,
      .offer-notice,
      .verification-notice {
        display: grid;
        gap: 5px;
        margin-top: 14px;
        padding: 12px 14px;
        border-radius: 12px;
        font-size: 12px;
        line-height: 1.45;
      }

      .approval-notice {
        border:
          1px solid #fedf89;
        background: #fffaeb;
        color: #7a2e0e;
      }

      .approval-notice.expired {
        border-color: #fecdca;
        background: #fef3f2;
        color: #912018;
      }

      .offer-notice {
        border:
          1px solid #b2ddff;
        background: #eff8ff;
        color: #1849a9;
      }

      .verification-notice {
        border:
          1px solid #d6bbfb;
        background: #f9f5ff;
        color: #6941c6;
      }

      /*
      ==========================================
      ACTIONS
      ==========================================
      */

      .booking-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 9px;
        margin-top: 17px;
      }

      /*
      ==========================================
      EMPTY / LOADING
      ==========================================
      */

      .empty-card,
      .loading-card {
        max-width: 650px;
        margin: 60px auto;
        padding: 42px 24px;
        border:
          1px solid #e5e7eb;
        border-radius: 18px;
        background: white;
        text-align: center;
      }

      .empty-icon {
        margin-bottom: 10px;
        font-size: 40px;
      }

      .empty-card h2,
      .loading-card h2 {
        margin: 0 0 8px;
      }

      .empty-card p,
      .loading-card p {
        margin: 0 0 20px;
        color: #667085;
        line-height: 1.5;
      }

      .loader {
        width: 36px;
        height: 36px;
        margin:
          0 auto 18px;
        border:
          4px solid #e5e7eb;
        border-top-color:
          #154f91;
        border-radius: 50%;
        animation:
          spin
          0.8s
          linear
          infinite;
      }

      @keyframes spin {
        to {
          transform:
            rotate(360deg);
        }
      }

      /*
      ==========================================
      ERROR
      ==========================================
      */

      .error-box {
        display: grid;
        gap: 8px;
        margin-top: 20px;
        padding: 18px;
        border:
          1px solid #fecdca;
        border-radius: 14px;
        background: #fef3f2;
        color: #912018;
      }

      .error-box button {
        width: fit-content;
        min-height: 40px;
        margin-top: 4px;
        padding: 8px 14px;
        border: 0;
        border-radius: 8px;
        background: #b42318;
        color: white;
        font-weight: 700;
        cursor: pointer;
      }

      /*
      ==========================================
      TABLET
      ==========================================
      */

      @media (
        max-width: 900px
      ) {
        .summary-grid {
          grid-template-columns:
            1fr;
        }

        .booking-card {
          grid-template-columns:
            210px 1fr;
        }

        .stay-details {
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
        }
      }

      /*
      ==========================================
      MOBILE
      ==========================================
      */

      @media (
        max-width: 700px
      ) {
        .guest-page {
          padding:
            18px 12px 40px;
        }

        .guest-page-heading h1 {
          font-size: 28px;
        }

        .booking-card {
          display: block;
        }

        .booking-image-wrap,
        .booking-image,
        .image-placeholder {
          min-height: 200px;
          height: 200px;
        }

        .booking-main {
          padding: 16px;
        }

        .booking-top {
          display: grid;
        }

        .status-badge {
          width: fit-content;
          max-width: 100%;
        }

        .booking-finance {
          align-items:
            flex-start;
          flex-direction:
            column;
        }

        .payment-info {
          text-align: left;
        }

        .booking-actions {
          display: grid;
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
        }

        .booking-actions button {
          width: 100%;
        }
      }

      @media (
        max-width: 430px
      ) {
        .stay-details {
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
        }

        .booking-actions {
          grid-template-columns:
            1fr;
        }

        .summary-card {
          padding: 15px;
        }

        .tab-button {
          font-size: 12px;
        }
      }
    `}</style>
  );
}