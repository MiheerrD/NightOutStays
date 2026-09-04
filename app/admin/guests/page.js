'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

export default function AdminGuestsPage() {
  const router = useRouter();

  const [guests, setGuests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [conversations, setConversations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage(refresh = false) {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        router.replace('/admin/login');
        return;
      }

      const {
        data: roles,
        error: roleError,
      } = await supabase.rpc('get_my_platform_roles');

      if (roleError) {
        throw roleError;
      }

      const allowed = (roles || []).some(
        (item) =>
          (item.role === 'super_admin' ||
            item.role === 'admin') &&
          item.is_active === true
      );

      if (!allowed) {
        throw new Error('Admin access required.');
      }

      const {
        data: guestRows,
        error: guestError,
      } = await supabase
        .from('guests')
        .select(`
          id,
          user_id,
          full_name,
          phone,
          email,
          status,
          suspension_reason,
          blocked_reason,
          blocked_at,
          blocked_by,
          created_at,
          updated_at
        `)
        .order('created_at', {
          ascending: false,
        });

      if (guestError) {
        throw guestError;
      }

      const safeGuests = guestRows || [];

      const guestIds = safeGuests.map(
        (guest) => guest.id
      );

      let bookingRows = [];

      if (guestIds.length > 0) {
        const {
          data,
          error: bookingError,
        } = await supabase
          .from('bookings')
          .select(`
            id,
            booking_code,
            guest_id,
            property_id,
            check_in,
            check_out,
            guests_count,
            nights,
            booking_status,
            payment_status,
            total_amount,
            final_payable_amount,
            amount_including_gst,
            guest_discount_requested,
            host_discount_amount,
            offer_status,
            host_decision,
            created_at
          `)
          .in('guest_id', guestIds)
          .order('created_at', {
            ascending: false,
          });

        if (bookingError) {
          throw bookingError;
        }

        bookingRows = data || [];
      }

      let conversationRows = [];

      if (guestIds.length > 0) {
        const {
          data,
          error: conversationError,
        } = await supabase
          .from('conversations')
          .select(`
            id,
            guest_id,
            booking_id,
            property_id,
            is_open,
            created_at,
            updated_at
          `)
          .in('guest_id', guestIds);

        if (conversationError) {
          throw conversationError;
        }

        conversationRows = data || [];
      }

      setGuests(safeGuests);
      setBookings(bookingRows);
      setConversations(conversationRows);

    } catch (err) {
      console.error('Guest Management error:', err);

      setError(
        err?.message ||
          'Unable to load Guest Management.'
      );

    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function bookingsForGuest(guestId) {
    return bookings.filter(
      (booking) => booking.guest_id === guestId
    );
  }

  function conversationsForGuest(guestId) {
    return conversations.filter(
      (conversation) =>
        conversation.guest_id === guestId
    );
  }

  function guestStats(guestId) {
    const rows = bookingsForGuest(guestId);

    const confirmed = rows.filter(
      isConfirmedBooking
    );

    const pending = rows.filter(
      isPendingBooking
    );

    const cancelled = rows.filter(
      isCancelledBooking
    );

    const discountRequests = rows.filter(
      (booking) =>
        booking.guest_discount_requested === true
    );

    const totalValue = confirmed.reduce(
      (total, booking) =>
        total +
        Number(
          booking.amount_including_gst ??
            booking.final_payable_amount ??
            booking.total_amount ??
            0
        ),
      0
    );

    return {
      total: rows.length,
      confirmed: confirmed.length,
      pending: pending.length,
      cancelled: cancelled.length,
      discountRequests: discountRequests.length,
      totalValue,
      conversations:
        conversationsForGuest(guestId).length,
    };
  }

  const dashboardStats = useMemo(() => {
    let guestsWithBookings = 0;
    let guestsWithConfirmed = 0;
    let guestsWithPending = 0;
    let guestsWithDiscount = 0;
    let guestsWithMessages = 0;

    guests.forEach((guest) => {
      const stats = guestStats(guest.id);

      if (stats.total > 0) {
        guestsWithBookings += 1;
      }

      if (stats.confirmed > 0) {
        guestsWithConfirmed += 1;
      }

      if (stats.pending > 0) {
        guestsWithPending += 1;
      }

      if (stats.discountRequests > 0) {
        guestsWithDiscount += 1;
      }

      if (stats.conversations > 0) {
        guestsWithMessages += 1;
      }
    });

    return {
      total: guests.length,

      active: guests.filter(
        (guest) =>
          (guest.status || 'active') === 'active'
      ).length,

      suspended: guests.filter(
        (guest) =>
          guest.status === 'suspended'
      ).length,

      blocked: guests.filter(
        (guest) =>
          guest.status === 'blocked'
      ).length,

      guestsWithBookings,
      guestsWithConfirmed,
      guestsWithPending,
      guestsWithDiscount,
      guestsWithMessages,
    };
  }, [guests, bookings, conversations]);

  const filteredGuests = useMemo(() => {
    const cleanSearch = search
      .trim()
      .toLowerCase();

    return guests.filter((guest) => {
      const stats = guestStats(guest.id);

      let matchesFilter = true;

      if (filter === 'active') {
        matchesFilter =
          (guest.status || 'active') === 'active';
      }

      if (filter === 'suspended') {
        matchesFilter =
          guest.status === 'suspended';
      }

      if (filter === 'blocked') {
        matchesFilter =
          guest.status === 'blocked';
      }

      if (filter === 'bookings') {
        matchesFilter =
          stats.total > 0;
      }

      if (filter === 'confirmed') {
        matchesFilter =
          stats.confirmed > 0;
      }

      if (filter === 'pending') {
        matchesFilter =
          stats.pending > 0;
      }

      if (filter === 'discount') {
        matchesFilter =
          stats.discountRequests > 0;
      }

      if (filter === 'messages') {
        matchesFilter =
          stats.conversations > 0;
      }

      if (!matchesFilter) {
        return false;
      }

      if (!cleanSearch) {
        return true;
      }

      const searchable = [
        guest.full_name,
        guest.phone,
        guest.email,
        guest.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(cleanSearch);
    });
  }, [
    guests,
    bookings,
    conversations,
    filter,
    search,
  ]);

  if (loading) {
    return (
      <>
        <main className="guestAdminPage">
          <div className="loadingBox">
            Loading Guest Management...
          </div>
        </main>

        <Styles />
      </>
    );
  }

  return (
    <>
      <main className="guestAdminPage">
        <div className="guestContainer">

          <div className="pageHeader">

            <div>
              <span className="eyebrow">
                NIGHTOUTSTAYS ADMIN
              </span>

              <h1>
                Guest Management
              </h1>

              <p>
                View guest accounts, booking activity,
                discounts, messages and account status.
              </p>
            </div>

            <button
              type="button"
              className="refreshButton"
              onClick={() =>
                loadPage(true)
              }
              disabled={refreshing}
            >
              {refreshing
                ? 'Refreshing...'
                : '↻ Refresh'}
            </button>

          </div>


          {error && (
            <div className="errorBox">
              {error}
            </div>
          )}


          <section className="primaryStats">

            <StatCard
              title="Total Guests"
              value={dashboardStats.total}
            />

            <StatCard
              title="Active"
              value={dashboardStats.active}
            />

            <StatCard
              title="Suspended"
              value={dashboardStats.suspended}
            />

            <StatCard
              title="Blocked"
              value={dashboardStats.blocked}
            />

            <StatCard
              title="With Bookings"
              value={
                dashboardStats.guestsWithBookings
              }
            />

          </section>


          <section className="activityStats">

            <FilterCard
              title="All Guests"
              value={dashboardStats.total}
              active={filter === 'all'}
              onClick={() =>
                setFilter('all')
              }
            />

            <FilterCard
              title="Active"
              value={dashboardStats.active}
              active={filter === 'active'}
              onClick={() =>
                setFilter('active')
              }
            />

            <FilterCard
              title="Suspended"
              value={dashboardStats.suspended}
              active={filter === 'suspended'}
              onClick={() =>
                setFilter('suspended')
              }
            />

            <FilterCard
              title="Blocked"
              value={dashboardStats.blocked}
              active={filter === 'blocked'}
              onClick={() =>
                setFilter('blocked')
              }
            />

            <FilterCard
              title="Confirmed Guests"
              value={
                dashboardStats.guestsWithConfirmed
              }
              active={filter === 'confirmed'}
              onClick={() =>
                setFilter('confirmed')
              }
            />

            <FilterCard
              title="Pending Requests"
              value={
                dashboardStats.guestsWithPending
              }
              active={filter === 'pending'}
              onClick={() =>
                setFilter('pending')
              }
            />

            <FilterCard
              title="Discount Requests"
              value={
                dashboardStats.guestsWithDiscount
              }
              active={filter === 'discount'}
              onClick={() =>
                setFilter('discount')
              }
            />

            <FilterCard
              title="Messages"
              value={
                dashboardStats.guestsWithMessages
              }
              active={filter === 'messages'}
              onClick={() =>
                setFilter('messages')
              }
            />

          </section>


          <section className="guestListSection">

            <div className="guestToolRow">

              <div>
                <span className="eyebrow">
                  GUEST DIRECTORY
                </span>

                <h2>
                  {filterHeading(filter)}
                </h2>

                <p>
                  {filteredGuests.length}{' '}
                  {filteredGuests.length === 1
                    ? 'guest'
                    : 'guests'}
                </p>
              </div>


              <input
                type="search"
                className="guestSearch"
                placeholder="Search name, phone or email..."
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
              />

            </div>


            {filteredGuests.length === 0 ? (
              <div className="emptyBox">
                <h3>
                  No guests found
                </h3>

                <p>
                  There are currently no guests matching
                  this selection.
                </p>
              </div>
            ) : (
              <div className="guestGrid">

                {filteredGuests.map(
                  (guest) => (
                    <GuestCard
                      key={guest.id}
                      guest={guest}
                      stats={guestStats(
                        guest.id
                      )}
                    />
                  )
                )}

              </div>
            )}

          </section>

        </div>
      </main>

      <Styles />
    </>
  );
}


function GuestCard({
  guest,
  stats,
}) {
  const name =
    guest.full_name ||
    guest.email ||
    'Guest';

  return (
    <article className="guestCard">

      <div className="guestCardTop">

        <div className="guestIdentity">

          <div className="guestAvatar">
            {name
              .charAt(0)
              .toUpperCase()}
          </div>

          <div>
            <span className="eyebrow">
              GUEST
            </span>

            <h3>
              {name}
            </h3>

            <p>
              {guest.email ||
                'Email not added'}
            </p>
          </div>

        </div>


        <GuestStatus
          status={
            guest.status ||
            'active'
          }
        />

      </div>


      <div className="guestContactGrid">

        <GuestInfo
          label="Phone"
          value={
            guest.phone ||
            'Not added'
          }
        />

        <GuestInfo
          label="Member Since"
          value={
            formatDate(
              guest.created_at
            )
          }
        />

      </div>


      <div className="guestBookingStats">

        <MiniStat
          label="Bookings"
          value={stats.total}
        />

        <MiniStat
          label="Confirmed"
          value={stats.confirmed}
        />

        <MiniStat
          label="Pending"
          value={stats.pending}
        />

        <MiniStat
          label="Cancelled"
          value={stats.cancelled}
        />

      </div>


      <div className="guestActivityGrid">

        <div>
          <span>
            Discount Requests
          </span>

          <strong>
            {stats.discountRequests}
          </strong>
        </div>

        <div>
          <span>
            Conversations
          </span>

          <strong>
            {stats.conversations}
          </strong>
        </div>

        <div>
          <span>
            Confirmed Booking Value
          </span>

          <strong>
            ₹
            {Number(
              stats.totalValue
            ).toLocaleString(
              'en-IN'
            )}
          </strong>
        </div>

      </div>


      {guest.status ===
        'suspended' &&
        guest.suspension_reason && (
          <div className="guestWarning suspended">
            <strong>
              Suspension Reason
            </strong>

            <p>
              {guest.suspension_reason}
            </p>
          </div>
        )}


      {guest.status ===
        'blocked' &&
        guest.blocked_reason && (
          <div className="guestWarning blocked">
            <strong>
              Block Reason
            </strong>

            <p>
              {guest.blocked_reason}
            </p>
          </div>
        )}


      <div className="guestCardFooter">

        <span>
          Guest ID{' '}
          {shortId(guest.id)}
        </span>

        <Link
          href={`/admin/guests/${guest.id}`}
          className="viewGuestButton"
        >
          View Guest
        </Link>

      </div>

    </article>
  );
}


function StatCard({
  title,
  value,
}) {
  return (
    <div className="statCard">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}


function FilterCard({
  title,
  value,
  active,
  onClick,
}) {
  return (
    <button
      type="button"
      className={
        active
          ? 'filterCard active'
          : 'filterCard'
      }
      onClick={onClick}
    >
      <span>
        {title}
      </span>

      <strong>
        {value}
      </strong>
    </button>
  );
}


function GuestInfo({
  label,
  value,
}) {
  return (
    <div className="guestInfo">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}


function MiniStat({
  label,
  value,
}) {
  return (
    <div className="miniStat">
      <strong>
        {value}
      </strong>

      <span>
        {label}
      </span>
    </div>
  );
}


function GuestStatus({
  status,
}) {
  return (
    <span
      className={`guestStatus ${status}`}
    >
      {prettyStatus(status)}
    </span>
  );
}


function isConfirmedBooking(
  booking
) {
  const status = String(
    booking.booking_status ||
      ''
  ).toLowerCase();

  const payment = String(
    booking.payment_status ||
      ''
  ).toLowerCase();

  return (
    payment === 'paid' ||
    status.includes(
      'confirm'
    ) ||
    status.includes(
      'booked'
    )
  );
}


function isPendingBooking(
  booking
) {
  if (
    isConfirmedBooking(booking) ||
    isCancelledBooking(booking)
  ) {
    return false;
  }

  const status = String(
    booking.booking_status ||
      ''
  ).toLowerCase();

  const decision = String(
    booking.host_decision ||
      ''
  ).toLowerCase();

  return (
    status.includes(
      'request'
    ) ||
    status.includes(
      'pending'
    ) ||
    !decision ||
    decision === 'pending' ||
    decision === 'approved' ||
    decision === 'accepted'
  );
}


function isCancelledBooking(
  booking
) {
  const value = [
    booking.booking_status,
    booking.host_decision,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    value.includes('cancel') ||
    value.includes('declin') ||
    value.includes('reject') ||
    value.includes('expired')
  );
}


function filterHeading(
  filter
) {
  const headings = {
    all: 'All Guests',
    active: 'Active Guests',
    suspended: 'Suspended Guests',
    blocked: 'Blocked Guests',
    bookings: 'Guests With Bookings',
    confirmed: 'Guests With Confirmed Bookings',
    pending: 'Guests With Pending Requests',
    discount: 'Guests Requesting Discounts',
    messages: 'Guests With Conversations',
  };

  return (
    headings[filter] ||
    'Guests'
  );
}


function prettyStatus(
  value
) {
  if (!value) {
    return '—';
  }

  return String(value)
    .replaceAll('_', ' ')
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}


function shortId(value) {
  if (!value) {
    return '—';
  }

  return value
    .slice(0, 8)
    .toUpperCase();
}


function formatDate(value) {
  if (!value) {
    return '—';
  }

  try {
    return new Date(
      value
    ).toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    );
  } catch {
    return '—';
  }
}


function Styles() {
  return (
    <style jsx global>{`

      * {
        box-sizing: border-box;
      }

      .guestAdminPage {
        min-height: 100vh;
        background: #f5f7fa;
        color: #101828;
      }

      .guestContainer {
        width: calc(100% - 64px);
        max-width: 1500px;
        margin: 0 auto;
        padding: 30px 0 70px;
      }

      .pageHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 25px;
      }

      .eyebrow {
        display: block;
        margin-bottom: 5px;
        color: #738096;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: 1px;
      }

      .pageHeader h1 {
        margin: 0;
        color: #303a44;
        font-size: 32px;
      }

      .pageHeader p {
        margin: 7px 0 0;
        color: #667085;
        font-size: 12px;
      }

      .refreshButton {
        min-height: 43px;
        padding: 0 17px;
        border: 0;
        border-radius: 8px;
        background: #f00078;
        color: #ffffff;
        font-size: 11px;
        font-weight: 900;
        cursor: pointer;
      }

      .refreshButton:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .primaryStats {
        display: grid;
        grid-template-columns:
          repeat(
            5,
            minmax(0, 1fr)
          );
        gap: 12px;
        margin-bottom: 20px;
      }

      .statCard {
        min-height: 105px;
        padding: 17px;
        border: 1px solid #d8e1eb;
        border-radius: 13px;
        background: #ffffff;
      }

      .statCard span {
        display: block;
        color: #617085;
        font-size: 10px;
        font-weight: 900;
      }

      .statCard strong {
        display: block;
        margin-top: 10px;
        color: #303a44;
        font-size: 27px;
      }

      .activityStats {
        display: grid;
        grid-template-columns:
          repeat(
            8,
            minmax(0, 1fr)
          );
        gap: 9px;
        margin-bottom: 30px;
      }

      .filterCard {
        min-height: 86px;
        padding: 13px;
        border: 1px solid #d8e1eb;
        border-radius: 11px;
        background: #ffffff;
        color: #101828;
        text-align: left;
        cursor: pointer;
      }

      .filterCard.active {
        border-color: #303a44;
        background: #303a44;
        color: #ffffff;
      }

      .filterCard span {
        display: block;
        min-height: 25px;
        color: #59697d;
        font-size: 9px;
        line-height: 1.35;
        font-weight: 900;
      }

      .filterCard.active span {
        color: #ffffff;
      }

      .filterCard strong {
        display: block;
        margin-top: 6px;
        font-size: 20px;
      }

      .guestListSection {
        padding-top: 4px;
      }

      .guestToolRow {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 20px;
        margin-bottom: 15px;
      }

      .guestToolRow h2 {
        margin: 0;
        color: #303a44;
        font-size: 24px;
      }

      .guestToolRow p {
        margin: 4px 0 0;
        color: #667085;
        font-size: 10px;
      }

      .guestSearch {
        width: min(
          430px,
          100%
        );
        min-height: 43px;
        padding: 0 14px;
        border: 1px solid #cbd6e1;
        border-radius: 8px;
        background: #ffffff;
        outline: none;
      }

      .guestSearch:focus {
        border-color: #f00078;
      }

      .guestGrid {
        display: grid;
        grid-template-columns:
          repeat(
            2,
            minmax(0, 1fr)
          );
        gap: 16px;
      }

      .guestCard {
        padding: 20px;
        border: 1px solid #d8e1eb;
        border-radius: 15px;
        background: #ffffff;
      }

      .guestCardTop {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 15px;
      }

      .guestIdentity {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .guestAvatar {
        width: 51px;
        height: 51px;
        flex: 0 0 51px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 13px;
        background: #e8f0f9;
        color: #f00078;
        font-size: 21px;
        font-weight: 900;
      }

      .guestIdentity h3 {
        margin: 0;
        color: #303a44;
        font-size: 17px;
      }

      .guestIdentity p {
        margin: 4px 0 0;
        color: #667085;
        font-size: 10px;
      }

      .guestStatus {
        min-height: 25px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 10px;
        border-radius: 999px;
        font-size: 9px;
        font-weight: 900;
      }

      .guestStatus.active {
        background: #e5f7eb;
        color: #14743b;
      }

      .guestStatus.suspended {
        background: #fff3da;
        color: #946100;
      }

      .guestStatus.blocked {
        background: #feeceb;
        color: #b42318;
      }

      .guestContactGrid {
        display: grid;
        grid-template-columns:
          repeat(
            2,
            minmax(0, 1fr)
          );
        gap: 8px;
        margin-top: 17px;
      }

      .guestInfo {
        min-height: 59px;
        padding: 10px;
        border: 1px solid #e0e6ed;
        border-radius: 8px;
        background: #fafbfd;
      }

      .guestInfo span {
        display: block;
        color: #728095;
        font-size: 8px;
        font-weight: 900;
      }

      .guestInfo strong {
        display: block;
        margin-top: 5px;
        font-size: 10px;
        word-break: break-word;
      }

      .guestBookingStats {
        display: grid;
        grid-template-columns:
          repeat(
            4,
            minmax(0, 1fr)
          );
        gap: 8px;
        margin-top: 12px;
      }

      .miniStat {
        padding: 11px;
        border: 1px solid #dfe6ee;
        border-radius: 8px;
        text-align: center;
      }

      .miniStat strong {
        display: block;
        color: #303a44;
        font-size: 18px;
      }

      .miniStat span {
        display: block;
        margin-top: 3px;
        color: #69778b;
        font-size: 8px;
        font-weight: 800;
      }

      .guestActivityGrid {
        display: grid;
        grid-template-columns:
          1fr 1fr 1.4fr;
        gap: 8px;
        margin-top: 12px;
      }

      .guestActivityGrid > div {
        padding: 10px;
        border-radius: 8px;
        background: #f5f8fb;
      }

      .guestActivityGrid span {
        display: block;
        color: #728095;
        font-size: 8px;
        font-weight: 900;
      }

      .guestActivityGrid strong {
        display: block;
        margin-top: 5px;
        color: #303a44;
        font-size: 12px;
      }

      .guestWarning {
        margin-top: 12px;
        padding: 10px 11px;
        border-radius: 8px;
      }

      .guestWarning.suspended {
        background: #fff7e6;
        color: #8a5c00;
      }

      .guestWarning.blocked {
        background: #fff0ef;
        color: #a42018;
      }

      .guestWarning strong {
        font-size: 9px;
      }

      .guestWarning p {
        margin: 3px 0 0;
        font-size: 9px;
      }

      .guestCardFooter {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-top: 16px;
        padding-top: 14px;
        border-top: 1px solid #e5eaf0;
      }

      .guestCardFooter span {
        color: #7b899b;
        font-size: 8px;
      }

      .viewGuestButton {
        min-height: 38px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 15px;
        border-radius: 8px;
        background: #303a44;
        color: #ffffff;
        font-size: 10px;
        font-weight: 900;
        text-decoration: none;
      }

      .emptyBox,
      .loadingBox {
        padding: 48px 20px;
        border: 1px solid #d8e1eb;
        border-radius: 14px;
        background: #ffffff;
        text-align: center;
      }

      .loadingBox {
        width: calc(
          100% - 40px
        );
        max-width: 900px;
        margin: 40px auto;
      }

      .emptyBox h3 {
        margin: 0;
        color: #303a44;
      }

      .emptyBox p {
        margin: 6px 0 0;
        color: #667085;
        font-size: 11px;
      }

      .errorBox {
        margin-bottom: 18px;
        padding: 12px 14px;
        border: 1px solid #efb8b1;
        border-radius: 8px;
        background: #fff2f1;
        color: #b42318;
        font-size: 11px;
        font-weight: 700;
      }

      @media (
        max-width: 1200px
      ) {

        .primaryStats {
          grid-template-columns:
            repeat(
              3,
              minmax(0, 1fr)
            );
        }

        .activityStats {
          grid-template-columns:
            repeat(
              4,
              minmax(0, 1fr)
            );
        }

      }

      @media (
        max-width: 900px
      ) {

        .guestGrid {
          grid-template-columns:
            1fr;
        }

        .primaryStats {
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
        }

      }

      @media (
        max-width: 700px
      ) {

        .guestContainer {
          width: calc(
            100% - 24px
          );
        }

        .pageHeader,
        .guestToolRow {
          flex-direction: column;
          align-items: stretch;
        }

        .guestSearch {
          width: 100%;
        }

        .activityStats {
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
        }

        .guestActivityGrid {
          grid-template-columns:
            1fr;
        }

      }

      @media (
        max-width: 480px
      ) {

        .primaryStats {
          grid-template-columns:
            1fr;
        }

        .guestBookingStats {
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
        }

        .guestCardTop,
        .guestCardFooter {
          align-items: stretch;
          flex-direction: column;
        }

        .viewGuestButton {
          width: 100%;
        }

      }

    `}</style>
  );
}