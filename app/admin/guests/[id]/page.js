'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

export default function AdminGuestDetailPage() {
  const params = useParams();
  const router = useRouter();

  const guestId = params?.id;

  const [guest, setGuest] = useState(null);

  const [bookings, setBookings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [views, setViews] = useState([]);
  const [visits, setVisits] = useState([]);

  const [hostReviews, setHostReviews] = useState([]);
  const [guestReviews, setGuestReviews] = useState([]);
  const [misconductReports, setMisconductReports] = useState([]);

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [bookingGuests, setBookingGuests] = useState([]);

  const [adminPermissions, setAdminPermissions] = useState({
    canEdit: false,
    canBlock: false,
  });

  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [bookingFilter, setBookingFilter] = useState('all');
  const [analyticsPeriod, setAnalyticsPeriod] = useState('all');

  useEffect(() => {
    if (guestId) {
      loadGuest();
    }
  }, [guestId]);

  async function loadGuest() {
    setLoading(true);
    setError('');
    setSuccess('');

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
        error: rolesError,
      } = await supabase.rpc('get_my_platform_roles');

      if (rolesError) {
        throw rolesError;
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

      await loadAdminPermissions(session.user.id);

      const {
        data: guestRow,
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
        .eq('id', guestId)
        .single();

      if (guestError) {
        throw guestError;
      }

      setGuest(guestRow);

      const {
        data: bookingRows,
        error: bookingError,
      } = await supabase
        .from('bookings')
        .select(`
          id,
          booking_code,
          property_id,
          guest_id,
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
          updated_at,
          paid_at,
          base_amount,
          auto_discount_amount,
          host_discount_amount,
          final_payable_amount,
          offer_note,
          offer_status,
          offer_created_at,
          host_decision,
          host_decision_at,
          guest_discount_requested,
          guest_discount_message,
          payment_due_at,
          verification_status,
          verification_completed_at,
          taxable_amount,
          gst_rate,
          gst_amount,
          amount_including_gst,
          property_offer_id
        `)
        .eq('guest_id', guestId)
        .order('created_at', {
          ascending: false,
        });

      if (bookingError) {
        throw bookingError;
      }

      const safeBookings = bookingRows || [];
      setBookings(safeBookings);

      const propertyIds = [
        ...new Set(
          safeBookings
            .map((item) => item.property_id)
            .filter(Boolean)
        ),
      ];

      const {
        data: viewRows,
        error: viewError,
      } = await supabase
        .from('property_views')
        .select(`
          id,
          property_id,
          guest_id,
          source,
          viewed_at
        `)
        .eq('guest_id', guestId)
        .order('viewed_at', {
          ascending: false,
        });

      if (viewError) {
        throw viewError;
      }

      const safeViews = viewRows || [];
      setViews(safeViews);

      safeViews.forEach((row) => {
        if (
          row.property_id &&
          !propertyIds.includes(row.property_id)
        ) {
          propertyIds.push(row.property_id);
        }
      });

      const {
        data: visitRows,
        error: visitError,
      } = await supabase
        .from('property_visits')
        .select(`
          id,
          property_id,
          guest_id,
          booking_id,
          visit_date,
          visit_status,
          notes,
          created_at,
          updated_at
        `)
        .eq('guest_id', guestId)
        .order('visit_date', {
          ascending: false,
        });

      if (visitError) {
        throw visitError;
      }

      const safeVisits = visitRows || [];
      setVisits(safeVisits);

      safeVisits.forEach((row) => {
        if (
          row.property_id &&
          !propertyIds.includes(row.property_id)
        ) {
          propertyIds.push(row.property_id);
        }
      });

      let propertyRows = [];

      if (propertyIds.length > 0) {
        const {
          data,
          error: propertyError,
        } = await supabase
          .from('properties')
          .select(`
            id,
            name,
            slug,
            location_name,
            city,
            area,
            property_type,
            host_id,
            base_price,
            is_active,
            moderation_status
          `)
          .in('id', propertyIds);

        if (propertyError) {
          throw propertyError;
        }

        propertyRows = data || [];
      }

      setProperties(propertyRows);

      const bookingIds = safeBookings.map(
        (item) => item.id
      );

      let bookingGuestRows = [];

      if (bookingIds.length > 0) {
        const {
          data,
          error: bookingGuestsError,
        } = await supabase
          .from('booking_guests')
          .select(`
            id,
            booking_id,
            full_name,
            contact_number,
            is_primary_guest,
            address_proof_type,
            created_at
          `)
          .in('booking_id', bookingIds);

        if (bookingGuestsError) {
          throw bookingGuestsError;
        }

        bookingGuestRows = data || [];
      }

      setBookingGuests(bookingGuestRows);

      const { data: hostReviewRows, error: hostReviewError } = await supabase
        .from('guest_reviews')
        .select(`
          id, booking_id, property_id, guest_id, host_id,
          rating, kept_property_clean, nuisance_created,
          left_property_on_time, recommend_to_hosts,
          public_review, created_at, updated_at
        `)
        .eq('guest_id', guestId)
        .order('created_at', { ascending: false });

      if (hostReviewError) throw hostReviewError;

      const safeHostReviews = hostReviewRows || [];
      const hostReviewIds = safeHostReviews.map((item) => item.id);
      let hostPrivateNoteRows = [];

      if (hostReviewIds.length > 0) {
        const { data, error: hostPrivateNotesError } = await supabase
          .from('guest_review_private_notes')
          .select(`id, guest_review_id, private_note, created_at, updated_at`)
          .in('guest_review_id', hostReviewIds);
        if (hostPrivateNotesError) throw hostPrivateNotesError;
        hostPrivateNoteRows = data || [];
      }

      const hostPrivateNotesByReview = new Map(
        hostPrivateNoteRows.map((item) => [item.guest_review_id, item.private_note])
      );

      setHostReviews(
        safeHostReviews.map((review) => ({
          ...review,
          private_admin_note: hostPrivateNotesByReview.get(review.id) || null,
        }))
      );

      const { data: guestReviewRows, error: guestReviewError } = await supabase
        .from('property_guest_reviews')
        .select(`
          id, booking_id, property_id, guest_id, host_id,
          overall_rating, information_accurate, location_correct,
          host_communication_good, cleanliness_good,
          checkin_process_smooth, recommend_property,
          public_review, created_at, updated_at
        `)
        .eq('guest_id', guestId)
        .order('created_at', { ascending: false });

      if (guestReviewError) throw guestReviewError;

      const safeGuestReviews = guestReviewRows || [];
      const guestReviewIds = safeGuestReviews.map((item) => item.id);
      let guestPrivateNoteRows = [];

      if (guestReviewIds.length > 0) {
        const { data, error: guestPrivateNotesError } = await supabase
          .from('property_review_private_notes')
          .select(`id, property_guest_review_id, private_note, created_at, updated_at`)
          .in('property_guest_review_id', guestReviewIds);
        if (guestPrivateNotesError) throw guestPrivateNotesError;
        guestPrivateNoteRows = data || [];
      }

      const guestPrivateNotesByReview = new Map(
        guestPrivateNoteRows.map((item) => [item.property_guest_review_id, item.private_note])
      );

      setGuestReviews(
        safeGuestReviews.map((review) => ({
          ...review,
          private_admin_note: guestPrivateNotesByReview.get(review.id) || null,
        }))
      );

      const { data: misconductRows, error: misconductError } = await supabase
        .from('misconduct_reports')
        .select(`
          id, booking_id, property_id, reporter_type,
          reporter_guest_id, reporter_host_id, reported_type,
          reported_guest_id, reported_host_id, category,
          description, status, reviewed_at, created_at
        `)
        .or(`reported_guest_id.eq.${guestId},reporter_guest_id.eq.${guestId}`)
        .order('created_at', { ascending: false });

      if (misconductError) throw misconductError;

      const safeMisconductRows = misconductRows || [];
      const misconductIds = safeMisconductRows.map((item) => item.id);
      let misconductAdminNoteRows = [];

      if (misconductIds.length > 0) {
        const { data, error: misconductNotesError } = await supabase
          .from('misconduct_admin_notes')
          .select(`id, misconduct_report_id, admin_user_id, note, created_at, updated_at`)
          .in('misconduct_report_id', misconductIds)
          .order('created_at', { ascending: true });
        if (misconductNotesError) throw misconductNotesError;
        misconductAdminNoteRows = data || [];
      }

      const misconductNotesByReport = new Map();
      misconductAdminNoteRows.forEach((item) => {
        const current = misconductNotesByReport.get(item.misconduct_report_id) || [];
        current.push(item);
        misconductNotesByReport.set(item.misconduct_report_id, current);
      });

      setMisconductReports(
        safeMisconductRows.map((report) => ({
          ...report,
          admin_private_notes: misconductNotesByReport.get(report.id) || [],
        }))
      );

      const {
        data: conversationRows,
        error: conversationError,
      } = await supabase
        .from('conversations')
        .select(`
          id,
          booking_id,
          property_id,
          guest_id,
          is_open,
          created_at,
          updated_at
        `)
        .eq('guest_id', guestId)
        .order('updated_at', {
          ascending: false,
        });

      if (conversationError) {
        throw conversationError;
      }

      const safeConversations = conversationRows || [];
      setConversations(safeConversations);

      const conversationIds = safeConversations.map(
        (item) => item.id
      );

      let messageRows = [];

      if (conversationIds.length > 0) {
        const {
          data,
          error: messageError,
        } = await supabase
          .from('messages')
          .select(`
            id,
            conversation_id,
            sender_type,
            sender_user_id,
            sender_guest_id,
            message_text,
            is_read,
            created_at
          `)
          .in('conversation_id', conversationIds)
          .order('created_at', {
            ascending: false,
          });

        if (messageError) {
          throw messageError;
        }

        messageRows = data || [];
      }

      setMessages(messageRows);

      const {
        data: notificationRows,
        error: notificationError,
      } = await supabase
        .from('notifications')
        .select(`
          id,
          recipient_type,
          recipient_guest_id,
          booking_id,
          type,
          title,
          body,
          is_read,
          email_status,
          scheduled_for,
          created_at
        `)
        .eq('recipient_guest_id', guestId)
        .order('created_at', {
          ascending: false,
        });

      if (notificationError) {
        throw notificationError;
      }

      setNotifications(notificationRows || []);
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          'Unable to load Guest Details.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadAdminPermissions(userId) {
    const {
      data: admin,
      error,
    } = await supabase
      .from('admin_profiles')
      .select(`
        role,
        full_access,
        is_active
      `)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!admin?.is_active) {
      return;
    }

    if (
      admin.role === 'super_admin' ||
      admin.full_access === true
    ) {
      setAdminPermissions({
        canEdit: true,
        canBlock: true,
      });

      return;
    }

    const {
      data: permissions,
      error: permissionsError,
    } = await supabase
      .from('admin_permissions')
      .select(`
        can_edit,
        can_block
      `)
      .eq('admin_user_id', userId)
      .eq('module', 'guests')
      .maybeSingle();

    if (permissionsError) {
      throw permissionsError;
    }

    setAdminPermissions({
      canEdit: permissions?.can_edit === true,
      canBlock: permissions?.can_block === true,
    });
  }

  async function changeGuestStatus(status) {
    if (!guest) {
      return;
    }

    let reason = null;

    if (status === 'suspended') {
      reason = window.prompt(
        'Enter suspension reason:'
      );

      if (reason === null) {
        return;
      }
    }

    if (status === 'blocked') {
      reason = window.prompt(
        'Enter reason for blocking this guest:'
      );

      if (reason === null) {
        return;
      }

      const confirmed = window.confirm(
        'Block this guest account? Existing booking history will remain available to Admin.'
      );

      if (!confirmed) {
        return;
      }
    }

    if (status === 'active') {
      const confirmed = window.confirm(
        'Reactivate this guest?'
      );

      if (!confirmed) {
        return;
      }
    }

    setSavingStatus(true);
    setError('');
    setSuccess('');

    try {
      const {
        error: rpcError,
      } = await supabase.rpc(
        'admin_update_guest_status',
        {
          p_guest_id: guest.id,
          p_status: status,
          p_reason: reason,
        }
      );

      if (rpcError) {
        throw rpcError;
      }

      setSuccess(
        `Guest status changed to ${prettyStatus(status)}.`
      );

      await loadGuest();
    } catch (err) {
      setError(
        err?.message ||
          'Unable to update Guest status.'
      );
    } finally {
      setSavingStatus(false);
    }
  }

  function propertyById(id) {
    return properties.find(
      (item) => item.id === id
    );
  }

  const stats = useMemo(() => {
    const confirmed = bookings.filter(
      isConfirmed
    );

    const cancelled = bookings.filter(
      isCancelled
    );

    const pending = bookings.filter(
      (booking) =>
        !isConfirmed(booking) &&
        !isCancelled(booking)
    );

    const discountRequests = bookings.filter(
      (booking) =>
        booking.guest_discount_requested === true
    );

    const totalValue = confirmed.reduce(
      (sum, item) =>
        sum +
        Number(
          item.amount_including_gst ??
            item.final_payable_amount ??
            item.total_amount ??
            0
        ),
      0
    );

    const uniqueViewedProperties = new Set(
      views
        .map((item) => item.property_id)
        .filter(Boolean)
    ).size;

    return {
      totalBookings: bookings.length,
      confirmed: confirmed.length,
      cancelled: cancelled.length,
      pending: pending.length,
      discountRequests:
        discountRequests.length,
      totalValue,
      totalViews: views.length,
      uniqueViewedProperties,
      physicalVisits: visits.length,
      completedVisits: visits.filter(
        (item) =>
          item.visit_status === 'completed'
      ).length,
      conversations: conversations.length,
      messages: messages.length,
      hostReviews: hostReviews.length,
      guestReviews: guestReviews.length,
      misconduct: misconductReports.length,
    };
  }, [
    bookings,
    views,
    visits,
    conversations,
    messages,
    hostReviews,
    guestReviews,
    misconductReports,
  ]);

  const propertyActivity = useMemo(() => {
    const ids = new Set();

    bookings.forEach((item) =>
      ids.add(item.property_id)
    );

    views.forEach((item) =>
      ids.add(item.property_id)
    );

    visits.forEach((item) =>
      ids.add(item.property_id)
    );

    return [...ids]
      .filter(Boolean)
      .map((propertyId) => {
        const property =
          propertyById(propertyId);

        const propertyViews = views.filter(
          (item) =>
            item.property_id === propertyId
        );

        const propertyVisits = visits.filter(
          (item) =>
            item.property_id === propertyId
        );

        const propertyBookings =
          bookings.filter(
            (item) =>
              item.property_id === propertyId
          );

        const confirmed =
          propertyBookings.filter(
            isConfirmed
          );

        const cancelled =
          propertyBookings.filter(
            isCancelled
          );

        const discounts =
          propertyBookings.filter(
            (item) =>
              item.guest_discount_requested ===
              true
          );

        return {
          propertyId,
          property,
          views: propertyViews.length,
          lastViewed:
            propertyViews[0]?.viewed_at ||
            null,
          visits: propertyVisits.length,
          completedVisits:
            propertyVisits.filter(
              (item) =>
                item.visit_status ===
                'completed'
            ).length,
          requests: propertyBookings.length,
          confirmed: confirmed.length,
          cancelled: cancelled.length,
          discounts: discounts.length,
        };
      });
  }, [
    bookings,
    views,
    visits,
    properties,
  ]);

  const periodBookings = useMemo(() => {
    if (analyticsPeriod === 'all') {
      return bookings;
    }

    const now = new Date();

    return bookings.filter((booking) => {
      const created = new Date(
        booking.created_at
      );

      if (analyticsPeriod === 'today') {
        return (
          created.toDateString() ===
          now.toDateString()
        );
      }

      if (analyticsPeriod === 'week') {
        const start = new Date(now);

        start.setDate(
          now.getDate() -
            now.getDay()
        );

        start.setHours(0, 0, 0, 0);

        return created >= start;
      }

      if (analyticsPeriod === 'month') {
        return (
          created.getMonth() ===
            now.getMonth() &&
          created.getFullYear() ===
            now.getFullYear()
        );
      }

      if (analyticsPeriod === 'year') {
        return (
          created.getFullYear() ===
          now.getFullYear()
        );
      }

      return true;
    });
  }, [bookings, analyticsPeriod]);

  const periodStats = useMemo(() => {
    const confirmed =
      periodBookings.filter(
        isConfirmed
      );

    const cancelled =
      periodBookings.filter(
        isCancelled
      );

    const totalValue =
      confirmed.reduce(
        (sum, item) =>
          sum +
          Number(
            item.amount_including_gst ??
              item.final_payable_amount ??
              item.total_amount ??
              0
          ),
        0
      );

    return {
      bookings: periodBookings.length,
      confirmed: confirmed.length,
      cancelled: cancelled.length,
      discountRequests:
        periodBookings.filter(
          (item) =>
            item.guest_discount_requested ===
            true
        ).length,
      value: totalValue,
    };
  }, [periodBookings]);

  const filteredBookings = useMemo(() => {
    if (bookingFilter === 'all') {
      return bookings;
    }

    if (bookingFilter === 'confirmed') {
      return bookings.filter(
        isConfirmed
      );
    }

    if (bookingFilter === 'cancelled') {
      return bookings.filter(
        isCancelled
      );
    }

    if (bookingFilter === 'pending') {
      return bookings.filter(
        (item) =>
          !isConfirmed(item) &&
          !isCancelled(item)
      );
    }

    if (bookingFilter === 'discount') {
      return bookings.filter(
        (item) =>
          item.guest_discount_requested ===
          true
      );
    }

    return bookings;
  }, [bookings, bookingFilter]);

  if (loading) {
    return (
      <>
        <main className="guestDetailPage">
          <div className="loadingBox">
            Loading Guest Details...
          </div>
        </main>

        <Styles />
      </>
    );
  }

  if (!guest) {
    return (
      <>
        <main className="guestDetailPage">
          <div className="loadingBox">
            Guest not found.
          </div>
        </main>

        <Styles />
      </>
    );
  }

  return (
    <>
      <main className="guestDetailPage">
        <div className="guestDetailContainer">

          <div className="topActions">
            <Link
              href="/admin/guests"
              className="backButton"
            >
              ← Guest Management
            </Link>
          </div>

          <section className="guestProfileCard">

            <div className="guestProfileMain">

              <div className="avatar">
                {(guest.full_name ||
                  guest.email ||
                  'G')
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div>
                <span className="eyebrow">
                  GUEST PROFILE
                </span>

                <h1>
                  {guest.full_name ||
                    'Guest'}
                </h1>

                <p>
                  {guest.email ||
                    'Email not added'}
                </p>

                <p>
                  {guest.phone ||
                    'Phone not added'}
                </p>
              </div>

            </div>

            <div className="profileStatus">
              <StatusBadge
                status={
                  guest.status ||
                  'active'
                }
              />

              <span>
                Member since{' '}
                {formatDate(
                  guest.created_at
                )}
              </span>
            </div>

          </section>

          {error && (
            <div className="messageBox error">
              {error}
            </div>
          )}

          {success && (
            <div className="messageBox success">
              {success}
            </div>
          )}

          <section className="statusControlCard">

            <div>
              <span className="eyebrow">
                ACCOUNT CONTROL
              </span>

              <h2>
                Guest Account Status
              </h2>

              <p>
                Suspend or block a guest without deleting
                booking history, reviews or messages.
              </p>
            </div>

            <div className="statusButtons">

              {adminPermissions.canEdit &&
                guest.status !== 'active' && (
                  <button
                    onClick={() =>
                      changeGuestStatus(
                        'active'
                      )
                    }
                    disabled={savingStatus}
                    className="actionButton activate"
                  >
                    Activate Guest
                  </button>
                )}

              {adminPermissions.canEdit &&
                guest.status !==
                  'suspended' && (
                  <button
                    onClick={() =>
                      changeGuestStatus(
                        'suspended'
                      )
                    }
                    disabled={savingStatus}
                    className="actionButton suspend"
                  >
                    Suspend Guest
                  </button>
                )}

              {adminPermissions.canBlock &&
                guest.status !== 'blocked' && (
                  <button
                    onClick={() =>
                      changeGuestStatus(
                        'blocked'
                      )
                    }
                    disabled={savingStatus}
                    className="actionButton block"
                  >
                    Block Guest
                  </button>
                )}

            </div>

            {guest.status ===
              'suspended' &&
              guest.suspension_reason && (
                <div className="reasonBox">
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
                <div className="reasonBox blocked">
                  <strong>
                    Block Reason
                  </strong>

                  <p>
                    {guest.blocked_reason}
                  </p>
                </div>
              )}

          </section>

          <section className="statsGrid">

            <StatCard
              label="Property Views"
              value={stats.totalViews}
            />

            <StatCard
              label="Unique Properties Viewed"
              value={
                stats.uniqueViewedProperties
              }
            />

            <StatCard
              label="Booking Requests"
              value={stats.totalBookings}
            />

            <StatCard
              label="Confirmed"
              value={stats.confirmed}
            />

            <StatCard
              label="Cancelled"
              value={stats.cancelled}
            />

            <StatCard
              label="Discount Requests"
              value={
                stats.discountRequests
              }
            />

            <StatCard
              label="Physical Visits"
              value={stats.physicalVisits}
            />

            <StatCard
              label="Booking Value"
              value={`₹${Number(
                stats.totalValue
              ).toLocaleString('en-IN')}`}
            />

          </section>

          <section className="sectionCard">

            <SectionTitle
              eyebrow="GUEST JOURNEY"
              title="Property Activity"
              text="Shows which properties this guest viewed, visited, requested, negotiated and booked."
            />

            {propertyActivity.length === 0 ? (
              <EmptyState text="No property activity recorded yet." />
            ) : (
              <div className="activityGrid">

                {propertyActivity.map(
                  (activity) => (
                    <div
                      key={
                        activity.propertyId
                      }
                      className="activityCard"
                    >

                      <div className="activityHeader">
                        <div>
                          <h3>
                            {activity.property
                              ?.name ||
                              'Property'}
                          </h3>

                          <p>
                            {[
                              activity.property
                                ?.area,
                              activity.property
                                ?.city,
                            ]
                              .filter(Boolean)
                              .join(', ') ||
                              'Location not available'}
                          </p>
                        </div>

                        <span className="propertyType">
                          {activity.property
                            ?.property_type ||
                            'Property'}
                        </span>
                      </div>

                      <div className="activityNumbers">

                        <MiniStat
                          label="Views"
                          value={
                            activity.views
                          }
                        />

                        <MiniStat
                          label="Physical Visits"
                          value={
                            activity.visits
                          }
                        />

                        <MiniStat
                          label="Requests"
                          value={
                            activity.requests
                          }
                        />

                        <MiniStat
                          label="Discount Asked"
                          value={
                            activity.discounts
                          }
                        />

                        <MiniStat
                          label="Confirmed"
                          value={
                            activity.confirmed
                          }
                        />

                        <MiniStat
                          label="Cancelled"
                          value={
                            activity.cancelled
                          }
                        />

                      </div>

                      <div className="lastActivity">
                        Last Viewed:{' '}
                        <strong>
                          {formatDateTime(
                            activity.lastViewed
                          )}
                        </strong>
                      </div>

                    </div>
                  )
                )}

              </div>
            )}

          </section>

          <section className="sectionCard">

            <div className="analyticsHeader">

              <SectionTitle
                eyebrow="BOOKING ANALYTICS"
                title="Guest Booking Performance"
                text="Daily, weekly, monthly and yearly booking activity for this guest."
              />

              <select
                value={analyticsPeriod}
                onChange={(event) =>
                  setAnalyticsPeriod(
                    event.target.value
                  )
                }
                className="periodSelect"
              >
                <option value="all">
                  All Time
                </option>

                <option value="today">
                  Today
                </option>

                <option value="week">
                  This Week
                </option>

                <option value="month">
                  This Month
                </option>

                <option value="year">
                  This Year
                </option>
              </select>

            </div>

            <div className="analyticsGrid">

              <StatCard
                label="Requests"
                value={
                  periodStats.bookings
                }
              />

              <StatCard
                label="Confirmed"
                value={
                  periodStats.confirmed
                }
              />

              <StatCard
                label="Cancelled"
                value={
                  periodStats.cancelled
                }
              />

              <StatCard
                label="Discount Requests"
                value={
                  periodStats.discountRequests
                }
              />

              <StatCard
                label="Confirmed Value"
                value={`₹${Number(
                  periodStats.value
                ).toLocaleString(
                  'en-IN'
                )}`}
              />

            </div>

          </section>

          <section className="sectionCard">

            <div className="bookingHeader">

              <SectionTitle
                eyebrow="BOOKINGS"
                title="Booking History"
                text="Complete booking request and payment history."
              />

              <div className="bookingFilters">

                {[
                  ['all', 'All'],
                  [
                    'pending',
                    'Pending',
                  ],
                  [
                    'confirmed',
                    'Confirmed',
                  ],
                  [
                    'cancelled',
                    'Cancelled',
                  ],
                  [
                    'discount',
                    'Discount Requests',
                  ],
                ].map(
                  ([value, label]) => (
                    <button
                      key={value}
                      onClick={() =>
                        setBookingFilter(
                          value
                        )
                      }
                      className={
                        bookingFilter ===
                        value
                          ? 'filterButton active'
                          : 'filterButton'
                      }
                    >
                      {label}
                    </button>
                  )
                )}

              </div>
            </div>

            {filteredBookings.length === 0 ? (
              <EmptyState text="No bookings in this category." />
            ) : (
              <div className="bookingList">

                {filteredBookings.map(
                  (booking) => {
                    const property =
                      propertyById(
                        booking.property_id
                      );

                    const extraGuests =
                      bookingGuests.filter(
                        (item) =>
                          item.booking_id ===
                          booking.id
                      );

                    return (
                      <div
                        key={booking.id}
                        className="bookingCard"
                      >

                        <div className="bookingTop">

                          <div>
                            <span className="eyebrow">
                              {booking.booking_code ||
                                'BOOKING'}
                            </span>

                            <h3>
                              {property?.name ||
                                'Property'}
                            </h3>

                            <p>
                              {formatDate(
                                booking.check_in
                              )}{' '}
                              →{' '}
                              {formatDate(
                                booking.check_out
                              )}
                            </p>
                          </div>

                          <BookingStatus
                            booking={
                              booking
                            }
                          />

                        </div>

                        <div className="bookingInfoGrid">

                          <Info
                            label="Guests"
                            value={
                              booking.guests_count ??
                              '—'
                            }
                          />

                          <Info
                            label="Nights"
                            value={
                              booking.nights ??
                              '—'
                            }
                          />

                          <Info
                            label="Payment"
                            value={prettyStatus(
                              booking.payment_status
                            )}
                          />

                          <Info
                            label="Host Decision"
                            value={prettyStatus(
                              booking.host_decision
                            )}
                          />

                          <Info
                            label="Booking Value"
                            value={`₹${Number(
                              booking.amount_including_gst ??
                                booking.final_payable_amount ??
                                booking.total_amount ??
                                0
                            ).toLocaleString(
                              'en-IN'
                            )}`}
                          />

                          <Info
                            label="GST"
                            value={`₹${Number(
                              booking.gst_amount ??
                                0
                            ).toLocaleString(
                              'en-IN'
                            )}`}
                          />

                        </div>

                        {booking.guest_discount_requested && (
                          <div className="discountBox">
                            <strong>
                              Guest Requested Discount
                            </strong>

                            <p>
                              {booking.guest_discount_message ||
                                'No message provided.'}
                            </p>
                          </div>
                        )}

                        {booking.offer_note && (
                          <div className="offerBox">
                            <strong>
                              Host Special Offer
                            </strong>

                            <p>
                              {booking.offer_note}
                            </p>
                          </div>
                        )}

                        {extraGuests.length >
                          0 && (
                          <div className="travellingGuests">

                            <strong>
                              Travelling Guests
                            </strong>

                            <div className="travellerGrid">

                              {extraGuests.map(
                                (person) => (
                                  <div
                                    key={
                                      person.id
                                    }
                                  >
                                    <span>
                                      {person.full_name ||
                                        'Guest'}
                                    </span>

                                    <small>
                                      {person.is_primary_guest
                                        ? 'Primary Guest'
                                        : 'Additional Guest'}
                                    </small>
                                  </div>
                                )
                              )}

                            </div>

                          </div>
                        )}

                      </div>
                    );
                  }
                )}

              </div>
            )}

          </section>

          <section className="sectionCard">

            <SectionTitle
              eyebrow="HOST FEEDBACK"
              title="Host Reviews About Guest"
              text="Includes host rating, behaviour indicators and private Admin remarks."
            />

            {hostReviews.length === 0 ? (
              <EmptyState text="No host reviews available yet." />
            ) : (
              <div className="reviewGrid">

                {hostReviews.map(
                  (review) => (
                    <ReviewCard
                      key={review.id}
                      title={
                        propertyById(
                          review.property_id
                        )?.name ||
                        'Property'
                      }
                      rating={
                        review.rating
                      }
                      date={
                        review.created_at
                      }
                    >
                      <ReviewRow
                        label="Kept Property Clean"
                        value={
                          review.kept_property_clean
                        }
                      />

                      <ReviewRow
                        label="Nuisance Created"
                        value={
                          review.nuisance_created
                        }
                        negativeBoolean
                      />

                      <ReviewRow
                        label="Left Property On Time"
                        value={
                          review.left_property_on_time
                        }
                      />

                      <ReviewRow
                        label="Recommended To Other Hosts"
                        value={
                          review.recommend_to_hosts
                        }
                      />

                      {review.public_review && (
                        <Remark
                          label="Public Review"
                          text={
                            review.public_review
                          }
                        />
                      )}

                      {review.private_admin_note && (
                        <Remark
                          label="Private Host Remark — Admin Only"
                          text={
                            review.private_admin_note
                          }
                          privateRemark
                        />
                      )}

                    </ReviewCard>
                  )
                )}

              </div>
            )}

          </section>

          <section className="sectionCard">

            <SectionTitle
              eyebrow="GUEST FEEDBACK"
              title="Guest Reviews About Properties"
              text="Guest feedback about listing accuracy, cleanliness, host communication and stay experience."
            />

            {guestReviews.length === 0 ? (
              <EmptyState text="No guest property reviews yet." />
            ) : (
              <div className="reviewGrid">

                {guestReviews.map(
                  (review) => (
                    <ReviewCard
                      key={review.id}
                      title={
                        propertyById(
                          review.property_id
                        )?.name ||
                        'Property'
                      }
                      rating={
                        review.overall_rating
                      }
                      date={
                        review.created_at
                      }
                    >

                      <ReviewRow
                        label="Information Accurate"
                        value={
                          review.information_accurate
                        }
                      />

                      <ReviewRow
                        label="Location Correct"
                        value={
                          review.location_correct
                        }
                      />

                      <ReviewRow
                        label="Host Communication"
                        value={
                          review.host_communication_good
                        }
                      />

                      <ReviewRow
                        label="Cleanliness"
                        value={
                          review.cleanliness_good
                        }
                      />

                      <ReviewRow
                        label="Check-in Smooth"
                        value={
                          review.checkin_process_smooth
                        }
                      />

                      <ReviewRow
                        label="Recommends Property"
                        value={
                          review.recommend_property
                        }
                      />

                      {review.public_review && (
                        <Remark
                          label="Public Review"
                          text={
                            review.public_review
                          }
                        />
                      )}

                      {review.private_admin_note && (
                        <Remark
                          label="Private Guest Remark — Admin Only"
                          text={
                            review.private_admin_note
                          }
                          privateRemark
                        />
                      )}

                    </ReviewCard>
                  )
                )}

              </div>
            )}

          </section>

          <section className="sectionCard">

            <SectionTitle
              eyebrow="SAFETY & TRUST"
              title="Misconduct Reports"
              text="Reports made by or against this guest."
            />

            {misconductReports.length ===
            0 ? (
              <EmptyState text="No misconduct reports recorded." />
            ) : (
              <div className="reportList">

                {misconductReports.map(
                  (report) => (
                    <div
                      key={report.id}
                      className="reportCard"
                    >

                      <div className="reportTop">

                        <div>
                          <h3>
                            {prettyStatus(
                              report.category
                            )}
                          </h3>

                          <p>
                            {propertyById(
                              report.property_id
                            )?.name ||
                              'Property not specified'}
                          </p>
                        </div>

                        <span
                          className={`reportStatus ${report.status}`}
                        >
                          {prettyStatus(
                            report.status
                          )}
                        </span>

                      </div>

                      <div className="reportDirection">
                        {report.reporter_guest_id ===
                        guest.id
                          ? 'Guest reported an issue'
                          : 'Guest was reported'}
                      </div>

                      <p className="reportDescription">
                        {report.description}
                      </p>

                      {report.admin_private_notes?.length > 0 && (
                        <div className="adminNotes">
                          <strong>
                            🔒 Admin Notes — Admin Only
                          </strong>

                          {report.admin_private_notes.map((note) => (
                            <div key={note.id} className="adminNoteItem">
                              <p>{note.note}</p>
                              <small>{formatDateTime(note.created_at)}</small>
                            </div>
                          ))}
                        </div>
                      )}

                      <small>
                        Reported{' '}
                        {formatDateTime(
                          report.created_at
                        )}
                      </small>

                    </div>
                  )
                )}

              </div>
            )}

          </section>

          <section className="twoColumnSection">

            <div className="sectionCard">

              <SectionTitle
                eyebrow="MESSAGES"
                title="Communication"
                text="Guest conversation activity."
              />

              <div className="communicationStats">

                <MiniStat
                  label="Conversations"
                  value={
                    stats.conversations
                  }
                />

                <MiniStat
                  label="Messages"
                  value={stats.messages}
                />

              </div>

              {messages.length > 0 && (
                <div className="latestMessages">

                  {messages
                    .slice(0, 8)
                    .map((message) => (
                      <div
                        key={message.id}
                        className="messagePreview"
                      >
                        <strong>
                          {prettyStatus(
                            message.sender_type
                          )}
                        </strong>

                        <p>
                          {message.message_text}
                        </p>

                        <small>
                          {formatDateTime(
                            message.created_at
                          )}
                        </small>
                      </div>
                    ))}

                </div>
              )}

            </div>

            <div className="sectionCard">

              <SectionTitle
                eyebrow="NOTIFICATIONS"
                title="Guest Notifications"
                text="Latest booking and system notifications."
              />

              {notifications.length === 0 ? (
                <EmptyState text="No notifications yet." />
              ) : (
                <div className="notificationList">

                  {notifications
                    .slice(0, 10)
                    .map(
                      (notification) => (
                        <div
                          key={
                            notification.id
                          }
                          className="notificationItem"
                        >
                          <strong>
                            {notification.title ||
                              prettyStatus(
                                notification.type
                              )}
                          </strong>

                          <p>
                            {notification.body ||
                              '—'}
                          </p>

                          <small>
                            {formatDateTime(
                              notification.created_at
                            )}
                          </small>
                        </div>
                      )
                    )}

                </div>
              )}

            </div>

          </section>

        </div>
      </main>

      <Styles />
    </>
  );
}

function SectionTitle({
  eyebrow,
  title,
  text,
}) {
  return (
    <div className="sectionTitle">
      <span className="eyebrow">
        {eyebrow}
      </span>

      <h2>{title}</h2>

      <p>{text}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
}) {
  return (
    <div className="statCard">
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
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Info({
  label,
  value,
}) {
  return (
    <div className="infoBox">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBadge({
  status,
}) {
  return (
    <span
      className={`statusBadge ${status}`}
    >
      {prettyStatus(status)}
    </span>
  );
}

function BookingStatus({
  booking,
}) {
  let status = 'pending';

  if (isConfirmed(booking)) {
    status = 'confirmed';
  }

  if (isCancelled(booking)) {
    status = 'cancelled';
  }

  return (
    <span
      className={`bookingStatus ${status}`}
    >
      {prettyStatus(status)}
    </span>
  );
}

function ReviewCard({
  title,
  rating,
  date,
  children,
}) {
  return (
    <div className="reviewCard">

      <div className="reviewHeader">
        <div>
          <h3>{title}</h3>

          <small>
            {formatDate(date)}
          </small>
        </div>

        <div className="rating">
          ★ {rating ?? '—'} / 5
        </div>
      </div>

      <div className="reviewRows">
        {children}
      </div>

    </div>
  );
}

function ReviewRow({
  label,
  value,
  negativeBoolean = false,
}) {
  let display = 'Not rated';

  if (value === true) {
    display = negativeBoolean
      ? 'Yes'
      : 'Yes';
  }

  if (value === false) {
    display = negativeBoolean
      ? 'No'
      : 'No';
  }

  return (
    <div className="reviewRow">
      <span>{label}</span>

      <strong>
        {display}
      </strong>
    </div>
  );
}

function Remark({
  label,
  text,
  privateRemark = false,
}) {
  return (
    <div
      className={
        privateRemark
          ? 'remark private'
          : 'remark'
      }
    >
      <strong>
        {privateRemark
          ? `🔒 ${label}`
          : label}
      </strong>

      <p>{text}</p>
    </div>
  );
}

function EmptyState({
  text,
}) {
  return (
    <div className="emptyState">
      {text}
    </div>
  );
}

function isConfirmed(booking) {
  const status = String(
    booking.booking_status || ''
  ).toLowerCase();

  const payment = String(
    booking.payment_status || ''
  ).toLowerCase();

  return (
    payment === 'paid' ||
    status.includes('confirmed') ||
    status.includes('booked') ||
    status.includes('completed')
  );
}

function isCancelled(booking) {
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

function prettyStatus(value) {
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

function formatDateTime(value) {
  if (!value) {
    return '—';
  }

  try {
    return new Date(
      value
    ).toLocaleString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
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

      .guestDetailPage {
        min-height: 100vh;
        background: #f5f7fa;
        color: #101828;
      }

      .guestDetailContainer {
        width: calc(100% - 64px);
        max-width: 1500px;
        margin: 0 auto;
        padding: 26px 0 70px;
      }

      .topActions {
        margin-bottom: 14px;
      }

      .backButton {
        color: #f00078;
        font-size: 11px;
        font-weight: 900;
        text-decoration: none;
      }

      .eyebrow {
        display: block;
        margin-bottom: 5px;
        color: #748297;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: 1px;
      }

      .guestProfileCard,
      .statusControlCard,
      .sectionCard {
        border: 1px solid #d8e1eb;
        border-radius: 15px;
        background: #ffffff;
      }

      .guestProfileCard {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 25px;
        padding: 22px;
        margin-bottom: 15px;
      }

      .guestProfileMain {
        display: flex;
        align-items: center;
        gap: 15px;
      }

      .avatar {
        width: 66px;
        height: 66px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 16px;
        background: #e8f0f9;
        color: #f00078;
        font-size: 27px;
        font-weight: 900;
      }

      .guestProfileMain h1 {
        margin: 0;
        color: #303a44;
        font-size: 28px;
      }

      .guestProfileMain p {
        margin: 4px 0 0;
        color: #667085;
        font-size: 10px;
      }

      .profileStatus {
        display: flex;
        align-items: flex-end;
        flex-direction: column;
        gap: 7px;
      }

      .profileStatus > span:last-child {
        color: #728095;
        font-size: 9px;
      }

      .statusBadge {
        padding: 7px 12px;
        border-radius: 999px;
        font-size: 9px;
        font-weight: 900;
      }

      .statusBadge.active {
        background: #e5f7eb;
        color: #14743b;
      }

      .statusBadge.suspended {
        background: #fff3da;
        color: #946100;
      }

      .statusBadge.blocked {
        background: #feeceb;
        color: #b42318;
      }

      .messageBox {
        padding: 12px 14px;
        margin-bottom: 15px;
        border-radius: 9px;
        font-size: 10px;
        font-weight: 800;
      }

      .messageBox.error {
        border: 1px solid #efb8b1;
        background: #fff1f0;
        color: #b42318;
      }

      .messageBox.success {
        border: 1px solid #9bd1aa;
        background: #edf9f0;
        color: #14743b;
      }

      .statusControlCard {
        padding: 20px;
        margin-bottom: 15px;
      }

      .statusControlCard h2,
      .sectionTitle h2 {
        margin: 0;
        color: #303a44;
        font-size: 21px;
      }

      .statusControlCard p,
      .sectionTitle p {
        margin: 5px 0 0;
        color: #667085;
        font-size: 10px;
      }

      .statusButtons {
        display: flex;
        flex-wrap: wrap;
        gap: 9px;
        margin-top: 15px;
      }

      .actionButton {
        min-height: 39px;
        padding: 0 15px;
        border: 0;
        border-radius: 8px;
        font-size: 10px;
        font-weight: 900;
        cursor: pointer;
      }

      .actionButton.activate {
        background: #18753d;
        color: #ffffff;
      }

      .actionButton.suspend {
        background: #a46b00;
        color: #ffffff;
      }

      .actionButton.block {
        background: #b42318;
        color: #ffffff;
      }

      .actionButton:disabled {
        opacity: .5;
        cursor: not-allowed;
      }

      .reasonBox {
        margin-top: 14px;
        padding: 11px;
        border-radius: 8px;
        background: #fff7e6;
        color: #855c0b;
        font-size: 10px;
      }

      .reasonBox.blocked {
        background: #fff0ef;
        color: #a42018;
      }

      .reasonBox p {
        margin: 4px 0 0;
      }

      .statsGrid {
        display: grid;
        grid-template-columns: repeat(8, minmax(0, 1fr));
        gap: 9px;
        margin-bottom: 15px;
      }

      .statCard {
        min-height: 92px;
        padding: 14px;
        border: 1px solid #d8e1eb;
        border-radius: 11px;
        background: #ffffff;
      }

      .statCard span {
        display: block;
        min-height: 24px;
        color: #6b788c;
        font-size: 8px;
        font-weight: 900;
      }

      .statCard strong {
        display: block;
        margin-top: 7px;
        color: #303a44;
        font-size: 20px;
      }

      .sectionCard {
        padding: 20px;
        margin-bottom: 15px;
      }

      .sectionTitle {
        margin-bottom: 16px;
      }

      .activityGrid,
      .reviewGrid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .activityCard,
      .bookingCard,
      .reviewCard,
      .reportCard {
        border: 1px solid #dee5ed;
        border-radius: 11px;
        background: #ffffff;
      }

      .activityCard {
        padding: 15px;
      }

      .activityHeader,
      .bookingTop,
      .reviewHeader,
      .reportTop,
      .analyticsHeader,
      .bookingHeader {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 15px;
      }

      .activityHeader h3,
      .bookingTop h3,
      .reviewHeader h3,
      .reportTop h3 {
        margin: 0;
        color: #303a44;
        font-size: 14px;
      }

      .activityHeader p,
      .bookingTop p,
      .reportTop p {
        margin: 4px 0 0;
        color: #69778a;
        font-size: 9px;
      }

      .propertyType {
        padding: 6px 9px;
        border-radius: 999px;
        background: #edf3f8;
        color: #f00078;
        font-size: 8px;
        font-weight: 900;
      }

      .activityNumbers {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 6px;
        margin-top: 13px;
      }

      .miniStat {
        padding: 9px;
        border: 1px solid #e1e7ee;
        border-radius: 8px;
        background: #fafbfd;
        text-align: center;
      }

      .miniStat strong {
        display: block;
        color: #303a44;
        font-size: 16px;
      }

      .miniStat span {
        display: block;
        margin-top: 3px;
        color: #738095;
        font-size: 7px;
        font-weight: 800;
      }

      .lastActivity {
        margin-top: 10px;
        color: #788699;
        font-size: 8px;
      }

      .analyticsGrid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 9px;
      }

      .periodSelect {
        min-height: 40px;
        padding: 0 12px;
        border: 1px solid #cbd6e1;
        border-radius: 8px;
        background: #ffffff;
        font-size: 10px;
      }

      .bookingFilters {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .filterButton {
        min-height: 34px;
        padding: 0 11px;
        border: 1px solid #cfd8e2;
        border-radius: 7px;
        background: #ffffff;
        color: #455468;
        font-size: 8px;
        font-weight: 900;
        cursor: pointer;
      }

      .filterButton.active {
        border-color: #303a44;
        background: #303a44;
        color: #ffffff;
      }

      .bookingList,
      .reportList {
        display: grid;
        gap: 11px;
      }

      .bookingCard {
        padding: 16px;
      }

      .bookingStatus {
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 8px;
        font-weight: 900;
      }

      .bookingStatus.confirmed {
        background: #e5f7eb;
        color: #14743b;
      }

      .bookingStatus.pending {
        background: #fff3da;
        color: #946100;
      }

      .bookingStatus.cancelled {
        background: #feeceb;
        color: #b42318;
      }

      .bookingInfoGrid {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 7px;
        margin-top: 12px;
      }

      .infoBox {
        padding: 9px;
        border-radius: 8px;
        background: #f7f9fb;
      }

      .infoBox span {
        display: block;
        color: #758398;
        font-size: 7px;
        font-weight: 900;
      }

      .infoBox strong {
        display: block;
        margin-top: 4px;
        color: #172033;
        font-size: 9px;
      }

      .discountBox,
      .offerBox {
        margin-top: 10px;
        padding: 10px;
        border-radius: 8px;
        font-size: 9px;
      }

      .discountBox {
        background: #fff8e9;
        color: #7d5c14;
      }

      .offerBox {
        background: #eef6ff;
        color: #14548d;
      }

      .discountBox p,
      .offerBox p {
        margin: 4px 0 0;
      }

      .travellingGuests {
        margin-top: 12px;
        padding-top: 11px;
        border-top: 1px solid #e5eaf0;
        font-size: 9px;
      }

      .travellerGrid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 7px;
      }

      .travellerGrid > div {
        padding: 8px 10px;
        border-radius: 7px;
        background: #f5f7fa;
      }

      .travellerGrid span,
      .travellerGrid small {
        display: block;
      }

      .travellerGrid small {
        margin-top: 2px;
        color: #758398;
        font-size: 7px;
      }

      .reviewCard {
        padding: 15px;
      }

      .rating {
        color: #925f00;
        font-size: 10px;
        font-weight: 900;
      }

      .reviewRows {
        margin-top: 12px;
      }

      .reviewRow {
        display: flex;
        justify-content: space-between;
        gap: 15px;
        padding: 8px 0;
        border-bottom: 1px solid #edf0f3;
        font-size: 9px;
      }

      .reviewRow span {
        color: #6b788a;
      }

      .remark {
        margin-top: 10px;
        padding: 10px;
        border-radius: 8px;
        background: #f6f8fa;
        font-size: 9px;
      }

      .remark.private {
        background: #fff6e6;
      }

      .remark p {
        margin: 4px 0 0;
      }

      .reportCard {
        padding: 15px;
      }

      .reportStatus {
        padding: 6px 9px;
        border-radius: 999px;
        background: #edf3f8;
        font-size: 8px;
        font-weight: 900;
      }

      .reportStatus.open {
        background: #feeceb;
        color: #b42318;
      }

      .reportStatus.under_review {
        background: #fff3da;
        color: #946100;
      }

      .reportStatus.resolved {
        background: #e5f7eb;
        color: #14743b;
      }

      .reportDirection {
        margin-top: 9px;
        font-size: 9px;
        font-weight: 900;
      }

      .reportDescription {
        color: #566376;
        font-size: 9px;
        line-height: 1.55;
      }

      .adminNotes {
        padding: 9px;
        border-radius: 7px;
        background: #f4f6f8;
        font-size: 9px;
      }

      .adminNotes p {
        margin: 4px 0 0;
      }

      .reportCard small,
      .reviewHeader small {
        color: #7a8798;
        font-size: 7px;
      }

      .twoColumnSection {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 15px;
      }

      .communicationStats {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }

      .latestMessages,
      .notificationList {
        margin-top: 12px;
      }

      .messagePreview,
      .notificationItem {
        padding: 10px 0;
        border-bottom: 1px solid #e8edf2;
        font-size: 9px;
      }

      .messagePreview p,
      .notificationItem p {
        margin: 4px 0;
        color: #5c6878;
        line-height: 1.45;
      }

      .messagePreview small,
      .notificationItem small {
        color: #8793a3;
        font-size: 7px;
      }

      .emptyState {
        padding: 28px 15px;
        border: 1px dashed #cbd4de;
        border-radius: 10px;
        color: #718096;
        text-align: center;
        font-size: 10px;
      }

      .loadingBox {
        width: calc(100% - 40px);
        max-width: 900px;
        margin: 40px auto;
        padding: 50px;
        border: 1px solid #d8e1eb;
        border-radius: 14px;
        background: #ffffff;
        text-align: center;
      }

      .adminNoteItem {
        padding-top: 9px;
        margin-top: 9px;
        border-top: 1px solid rgba(180, 35, 24, .12);
      }

      .adminNoteItem p {
        margin: 0 0 4px;
      }

      .adminNoteItem small {
        color: #8b5e57;
        font-size: 8px;
      }

      @media (max-width: 1250px) {
        .statsGrid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .activityNumbers {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .bookingInfoGrid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      @media (max-width: 900px) {
        .activityGrid,
        .reviewGrid,
        .twoColumnSection {
          grid-template-columns: 1fr;
        }

        .analyticsGrid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 700px) {
        .guestDetailContainer {
          width: calc(100% - 24px);
        }

        .guestProfileCard,
        .analyticsHeader,
        .bookingHeader {
          flex-direction: column;
          align-items: stretch;
        }

        .profileStatus {
          align-items: flex-start;
        }

        .statsGrid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .bookingInfoGrid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 480px) {
        .statsGrid,
        .analyticsGrid {
          grid-template-columns: 1fr;
        }

        .activityNumbers {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

    `}</style>
  );
}