'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

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

function dateTime(value) {
  if (!value) return '';

  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function calculateOfferAmounts(booking, type, value) {
  /*
    IMPORTANT:
    booking.taxable_amount is already after the
    guest-selected regular/property discount.

    Therefore Host Special Offer is applied ON TOP
    of the one regular discount, exactly as required.
  */

  const originalTaxable = Number(
    booking.taxable_amount ??
      booking.base_amount ??
      0
  );

  let discount = 0;

  if (type === 'percent') {
    discount =
      originalTaxable *
      (Number(value || 0) / 100);
  } else {
    discount = Number(value || 0);
  }

  if (discount < 0) {
    discount = 0;
  }

  if (discount > originalTaxable) {
    discount = originalTaxable;
  }

  const taxable =
    originalTaxable - discount;

  const gstRate =
    Number(booking.gst_rate || 18);

  const gst =
    taxable * (gstRate / 100);

  const amountIncludingGst =
    taxable + gst;

  const securityDeposit =
    Number(
      booking.security_deposit || 0
    );

  const final =
    amountIncludingGst +
    securityDeposit;

  return {
    discount:
      Math.round(discount * 100) / 100,

    taxable:
      Math.round(taxable * 100) / 100,

    gst:
      Math.round(gst * 100) / 100,

    amountIncludingGst:
      Math.round(
        amountIncludingGst * 100
      ) / 100,

    final:
      Math.round(final * 100) / 100,
  };
}

export default function AdminBookingsPage() {
  const [checkingSession, setCheckingSession] =
    useState(true);

  const [session, setSession] =
    useState(null);

  const [adminProfile, setAdminProfile] =
    useState(null);

  const [bookings, setBookings] =
    useState([]);

  const [
    messagesByBooking,
    setMessagesByBooking,
  ] = useState({});

  const [
    replyByBooking,
    setReplyByBooking,
  ] = useState({});

  const [
    loadingBookings,
    setLoadingBookings,
  ] = useState(false);

  const [
    pageError,
    setPageError,
  ] = useState('');

  const [
    message,
    setMessage,
  ] = useState('');

  const [
    busyId,
    setBusyId,
  ] = useState('');

  const [
    sendingMessageId,
    setSendingMessageId,
  ] = useState('');

  const [
    offerBookingId,
    setOfferBookingId,
  ] = useState('');

  const [
    offerType,
    setOfferType,
  ] = useState('percent');

  const [
    offerValue,
    setOfferValue,
  ] = useState('');

  const [
    offerNote,
    setOfferNote,
  ] = useState('');

  useEffect(() => {
    initialize();
  }, []);

  async function initialize() {
    setCheckingSession(true);
    setPageError('');

    try {
      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      setSession(session);

      if (!session) {
        return;
      }

      const {
        data: profile,
        error: profileError,
      } =
        await supabase
          .from('admin_profiles')
          .select(
            'user_id, full_name, role, is_active'
          )
          .eq(
            'user_id',
            session.user.id
          )
          .eq(
            'is_active',
            true
          )
          .single();

      if (
        profileError ||
        !profile
      ) {
        throw new Error(
          'Admin access not available for this login.'
        );
      }

      setAdminProfile(profile);

      await loadBookings();
    } catch (error) {
      console.error(error);

      setPageError(
        error.message ||
          'Unable to load admin dashboard.'
      );
    } finally {
      setCheckingSession(false);
    }
  }

  async function loadBookings() {
    setLoadingBookings(true);
    setPageError('');

    try {
      const {
        data: bookingRows,
        error: bookingError,
      } =
        await supabase
          .from('bookings')
          .select('*')
          .order(
            'created_at',
            {
              ascending: false,
            }
          );

      if (bookingError) {
        throw bookingError;
      }

      const rows =
        bookingRows || [];

      if (!rows.length) {
        setBookings([]);
        setMessagesByBooking({});
        return;
      }

      const propertyIds = [
        ...new Set(
          rows
            .map(
              (item) =>
                item.property_id
            )
            .filter(Boolean)
        ),
      ];

      const guestIds = [
        ...new Set(
          rows
            .map(
              (item) =>
                item.guest_id
            )
            .filter(Boolean)
        ),
      ];

      const bookingIds =
        rows.map(
          (item) =>
            item.id
        );

      const [
        propertyResult,
        guestResult,
        messageResult,
      ] =
        await Promise.all([
          propertyIds.length
            ? supabase
                .from(
                  'properties'
                )
                .select(
                  'id, name, location_name'
                )
                .in(
                  'id',
                  propertyIds
                )
            : Promise.resolve({
                data: [],
                error: null,
              }),

          guestIds.length
            ? supabase
                .from(
                  'guests'
                )
                .select(
                  'id, full_name, phone, email'
                )
                .in(
                  'id',
                  guestIds
                )
            : Promise.resolve({
                data: [],
                error: null,
              }),

          bookingIds.length
            ? supabase
                .from(
                  'booking_messages'
                )
                .select('*')
                .in(
                  'booking_id',
                  bookingIds
                )
                .order(
                  'created_at',
                  {
                    ascending: true,
                  }
                )
            : Promise.resolve({
                data: [],
                error: null,
              }),
        ]);

      if (
        propertyResult.error
      ) {
        console.error(
          propertyResult.error
        );
      }

      if (
        guestResult.error
      ) {
        console.error(
          guestResult.error
        );
      }

      if (
        messageResult.error
      ) {
        console.error(
          messageResult.error
        );
      }

      const propertyMap = {};

      (
        propertyResult.data ||
        []
      ).forEach(
        (property) => {
          propertyMap[
            property.id
          ] = property;
        }
      );

      const guestMap = {};

      (
        guestResult.data ||
        []
      ).forEach(
        (guest) => {
          guestMap[
            guest.id
          ] = guest;
        }
      );

      const messageMap = {};

      (
        messageResult.data ||
        []
      ).forEach(
        (item) => {
          if (
            !messageMap[
              item.booking_id
            ]
          ) {
            messageMap[
              item.booking_id
            ] = [];
          }

          messageMap[
            item.booking_id
          ].push(item);
        }
      );

      const enriched =
        rows.map(
          (booking) => ({
            ...booking,

            property:
              propertyMap[
                booking.property_id
              ] || null,

            guest:
              guestMap[
                booking.guest_id
              ] || null,
          })
        );

      setBookings(
        enriched
      );

      setMessagesByBooking(
        messageMap
      );
    } catch (error) {
      console.error(error);

      setPageError(
        `Unable to load bookings: ${
          error.message ||
          'Unknown error'
        }`
      );
    } finally {
      setLoadingBookings(false);
    }
  }

  async function reloadBookingMessages(
    bookingId
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          'booking_messages'
        )
        .select('*')
        .eq(
          'booking_id',
          bookingId
        )
        .order(
          'created_at',
          {
            ascending: true,
          }
        );

    if (error) {
      console.error(error);
      return;
    }

    setMessagesByBooking(
      (previous) => ({
        ...previous,
        [bookingId]:
          data || [],
      })
    );
  }

  async function addSystemMessage(
    bookingId,
    text,
    messageType = 'system'
  ) {
    const {
      error,
    } =
      await supabase
        .from(
          'booking_messages'
        )
        .insert({
          booking_id:
            bookingId,

          sender_type:
            'system',

          sender_name:
            'NightOutStays',

          message:
            text,

          message_type:
            messageType,

          is_read:
            false,
        });

    if (error) {
      console.error(
        'System message error:',
        error
      );
    }
  }

  async function sendHostReply(
    booking
  ) {
    const text =
      String(
        replyByBooking[
          booking.id
        ] || ''
      ).trim();

    if (!text) {
      setPageError(
        'Type a reply before sending.'
      );
      return;
    }

    setSendingMessageId(
      booking.id
    );

    setPageError('');
    setMessage('');

    try {
      const {
        error,
      } =
        await supabase
          .from(
            'booking_messages'
          )
          .insert({
            booking_id:
              booking.id,

            sender_type:
              'host',

            sender_name:
              adminProfile.full_name ||
              'Host',

            message:
              text,

            message_type:
              'message',

            is_read:
              false,
          });

      if (error) {
        throw error;
      }

      setReplyByBooking(
        (previous) => ({
          ...previous,
          [booking.id]:
            '',
        })
      );

      setMessage(
        `Reply sent for ${booking.booking_code}.`
      );

      await reloadBookingMessages(
        booking.id
      );
    } catch (error) {
      setPageError(
        `Unable to send reply: ${error.message}`
      );
    } finally {
      setSendingMessageId('');
    }
  }

  async function approveBooking(
    booking
  ) {
    const confirmed =
      window.confirm(
        `Approve booking ${booking.booking_code}?`
      );

    if (!confirmed) {
      return;
    }

    setBusyId(
      booking.id
    );

    setMessage('');
    setPageError('');

    try {
      const {
        error,
      } =
        await supabase
          .from('bookings')
          .update({
            host_decision:
              'approved',

            host_decision_at:
              new Date().toISOString(),

            host_decision_by:
              session.user.id,

            booking_status:
              'confirmed',

            payment_status:
              booking.payment_status ||
              'unpaid',

            verification_status:
              booking.verification_status ||
              'not_required',

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            booking.id
          );

      if (error) {
        throw error;
      }

      await addSystemMessage(
        booking.id,
        `Booking ${booking.booking_code} was approved by the host. Awaiting payment.`,
        'approval'
      );

      setMessage(
        `${booking.booking_code} approved successfully.`
      );

      await loadBookings();
    } catch (error) {
      setPageError(
        `Unable to approve booking: ${error.message}`
      );
    } finally {
      setBusyId('');
    }
  }

  async function declineBooking(
    booking
  ) {
    const confirmed =
      window.confirm(
        `Decline booking ${booking.booking_code}?`
      );

    if (!confirmed) {
      return;
    }

    setBusyId(
      booking.id
    );

    setMessage('');
    setPageError('');

    try {
      const {
        error,
      } =
        await supabase
          .from('bookings')
          .update({
            host_decision:
              'declined',

            host_decision_at:
              new Date().toISOString(),

            host_decision_by:
              session.user.id,

            booking_status:
              'cancelled',

            offer_status:
              booking.offer_status ===
              'host_offered'
                ? 'declined'
                : booking.offer_status,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            booking.id
          );

      if (error) {
        throw error;
      }

      await addSystemMessage(
        booking.id,
        `Booking ${booking.booking_code} was declined by the host.`,
        'decline'
      );

      setMessage(
        `${booking.booking_code} declined.`
      );

      await loadBookings();
    } catch (error) {
      setPageError(
        `Unable to decline booking: ${error.message}`
      );
    } finally {
      setBusyId('');
    }
  }

  function openOffer(
    booking
  ) {
    setOfferBookingId(
      booking.id
    );

    setOfferType(
      'percent'
    );

    setOfferValue('');

    setOfferNote('');

    setPageError('');
  }

  function closeOffer() {
    setOfferBookingId('');
    setOfferValue('');
    setOfferNote('');
  }

  async function sendSpecialOffer(
    booking
  ) {
    const value =
      Number(
        offerValue
      );

    if (
      !value ||
      value <= 0
    ) {
      setPageError(
        'Enter a valid discount amount.'
      );

      return;
    }

    const amounts =
      calculateOfferAmounts(
        booking,
        offerType,
        value
      );

    const confirmed =
      window.confirm(
        `Send special offer? Final payable will be ${money(
          amounts.final
        )}.`
      );

    if (!confirmed) {
      return;
    }

    setBusyId(
      booking.id
    );

    setMessage('');
    setPageError('');

    try {
      const specialOfferText =
        offerNote.trim() ||
        `Host special ${
          offerType ===
          'percent'
            ? `${value}%`
            : money(value)
        } discount`;

      const {
        error,
      } =
        await supabase
          .from('bookings')
          .update({
            host_discount_amount:
              amounts.discount,

            taxable_amount:
              amounts.taxable,

            gst_amount:
              amounts.gst,

            amount_including_gst:
              amounts.amountIncludingGst,

            final_payable_amount:
              amounts.final,

            total_amount:
              amounts.final,

            offer_note:
              specialOfferText,

            offer_status:
              'host_offered',

            offer_created_by:
              session.user.id,

            offer_created_at:
              new Date().toISOString(),

            host_decision:
              'approved',

            host_decision_at:
              new Date().toISOString(),

            host_decision_by:
              session.user.id,

            booking_status:
              'confirmed',

            payment_status:
              'unpaid',

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            booking.id
          );

      if (error) {
        throw error;
      }

      await addSystemMessage(
        booking.id,
        `${specialOfferText}. New final payable amount: ${money(
          amounts.final
        )}.`,
        'special_offer'
      );

      setMessage(
        `Special offer sent for ${booking.booking_code}.`
      );

      closeOffer();

      await loadBookings();
    } catch (error) {
      setPageError(
        `Unable to send special offer: ${error.message}`
      );
    } finally {
      setBusyId('');
    }
  }

  async function logout() {
    await supabase.auth.signOut();

    window.location.href =
      '/admin/bookings';
  }

  if (
    checkingSession
  ) {
    return (
      <main style={styles.loading}>
        Loading admin dashboard...
      </main>
    );
  }

  if (
    !session ||
    !adminProfile
  ) {
    return (
      <main style={styles.page}>
        <div style={styles.loginBox}>
          <h2>
            Admin login required
          </h2>

          <p>
            Please login to manage bookings.
          </p>
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

          <div style={styles.subBrand}>
            Booking Administration
          </div>
        </div>

        <div style={styles.userArea}>
          <div>
            <strong>
              {adminProfile.full_name ||
                'Administrator'}
            </strong>

            <div style={styles.role}>
              {adminProfile.role}
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            style={styles.logout}
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
              Review requests, chat with guests,
              manage discounts, GST, payment and
              verification.
            </p>
          </div>

          <button
            type="button"
            onClick={
              loadBookings
            }
            disabled={
              loadingBookings
            }
            style={styles.refresh}
          >
            {loadingBookings
              ? 'Loading...'
              : 'Refresh'}
          </button>
        </div>

        {pageError && (
          <div style={styles.error}>
            {pageError}
          </div>
        )}

        {message && (
          <div style={styles.success}>
            {message}
          </div>
        )}

        {loadingBookings &&
        bookings.length === 0 ? (
          <div style={styles.empty}>
            Loading bookings...
          </div>
        ) : bookings.length ===
          0 ? (
          <div style={styles.empty}>
            No bookings found.
          </div>
        ) : (
          <div style={styles.grid}>
            {bookings.map(
              (booking) => {
                const thread =
                  messagesByBooking[
                    booking.id
                  ] || [];

                const specialOfferOpen =
                  offerBookingId ===
                  booking.id;

                const preview =
                  specialOfferOpen &&
                  offerValue
                    ? calculateOfferAmounts(
                        booking,
                        offerType,
                        offerValue
                      )
                    : null;

                return (
                  <article
                    key={
                      booking.id
                    }
                    style={
                      styles.card
                    }
                  >
                    <div style={styles.cardTop}>
                      <div>
                        <div style={styles.bookingCode}>
                          {booking.booking_code}
                        </div>

                        <div style={styles.created}>
                          {dateTime(
                            booking.created_at
                          )}
                        </div>
                      </div>

                      <StatusBadge
                        value={
                          booking.booking_status
                        }
                      />
                    </div>

                    <h2 style={styles.propertyName}>
                      {booking.property?.name ||
                        'Property'}
                    </h2>

                    <div style={styles.location}>
                      {booking.property
                        ?.location_name ||
                        ''}
                    </div>

                    <hr style={styles.line} />

                    <div style={styles.detailsGrid}>
                      <Detail
                        label="Guest"
                        value={
                          booking.guest
                            ?.full_name ||
                          '—'
                        }
                      />

                      <Detail
                        label="Mobile"
                        value={
                          booking.guest
                            ?.phone ||
                          '—'
                        }
                      />

                      <Detail
                        label="Email"
                        value={
                          booking.guest
                            ?.email ||
                          '—'
                        }
                      />

                      <Detail
                        label="Guests"
                        value={
                          booking.guests_count
                        }
                      />

                      <Detail
                        label="Check-in"
                        value={
                          booking.check_in
                        }
                      />

                      <Detail
                        label="Check-out"
                        value={
                          booking.check_out
                        }
                      />

                      <Detail
                        label="Nights"
                        value={
                          booking.nights
                        }
                      />
                    </div>

                    <div style={styles.amountBox}>
                      <Amount
                        label="Base amount"
                        value={
                          booking.base_amount
                        }
                      />

                      {Number(
                        booking.auto_discount_amount
                      ) > 0 && (
                        <Amount
                          label="Regular property discount"
                          value={
                            -Number(
                              booking.auto_discount_amount
                            )
                          }
                          discount
                        />
                      )}

                      {Number(
                        booking.host_discount_amount
                      ) > 0 && (
                        <Amount
                          label="Host special discount"
                          value={
                            -Number(
                              booking.host_discount_amount
                            )
                          }
                          discount
                        />
                      )}

                      <Amount
                        label="Taxable amount"
                        value={
                          booking.taxable_amount
                        }
                      />

                      <Amount
                        label={`GST @ ${
                          booking.gst_rate ||
                          18
                        }%`}
                        value={
                          booking.gst_amount
                        }
                      />

                      {Number(
                        booking.security_deposit
                      ) > 0 && (
                        <Amount
                          label="Security deposit"
                          value={
                            booking.security_deposit
                          }
                        />
                      )}

                      <div style={styles.total}>
                        <span>
                          Final Payable
                        </span>

                        <strong>
                          {money(
                            booking.final_payable_amount ??
                              booking.total_amount
                          )}
                        </strong>
                      </div>
                    </div>

                    <div style={styles.statusGrid}>
                      <MiniStatus
                        label="HOST DECISION"
                        value={
                          booking.host_decision
                        }
                      />

                      <MiniStatus
                        label="PAYMENT"
                        value={
                          booking.payment_status
                        }
                      />

                      <MiniStatus
                        label="VERIFICATION"
                        value={
                          booking.verification_status
                        }
                      />
                    </div>

                    {booking.offer_note && (
                      <div style={styles.offerNotice}>
                        <strong>
                          Offer:
                        </strong>{' '}
                        {booking.offer_note}
                      </div>
                    )}

                    {booking.guest_discount_requested && (
                      <div style={styles.discountRequest}>
                        <strong>
                          Guest requested a discount
                        </strong>

                        {booking.guest_discount_message && (
                          <div style={{ marginTop: 5 }}>
                            {
                              booking.guest_discount_message
                            }
                          </div>
                        )}
                      </div>
                    )}

                    <div style={styles.chatBox}>
                      <div style={styles.chatHeader}>
                        <div>
                          <strong>
                            Guest Conversation
                          </strong>

                          <div style={styles.chatHelp}>
                            Booking-linked chat
                          </div>
                        </div>

                        <a
                          href={`/admin/messages?booking=${booking.id}`}
                          style={
                            styles.fullChatLink
                          }
                        >
                          Open Full Conversation
                        </a>
                      </div>

                      {booking.notes && (
                        <div style={styles.guestBubble}>
                          <div style={styles.messageSender}>
                            {booking.guest
                              ?.full_name ||
                              'Guest'}
                          </div>

                          <div>
                            {booking.notes}
                          </div>

                          <div style={styles.messageTime}>
                            Original booking message
                          </div>
                        </div>
                      )}

                      {thread.length > 0 ? (
                        <div style={styles.thread}>
                          {thread.map(
                            (chatMessage) => (
                              <ChatMessage
                                key={
                                  chatMessage.id
                                }
                                item={
                                  chatMessage
                                }
                              />
                            )
                          )}
                        </div>
                      ) : (
                        !booking.notes && (
                          <div style={styles.noMessages}>
                            No messages yet.
                          </div>
                        )
                      )}

                      <div style={styles.replyArea}>
                        <textarea
                          value={
                            replyByBooking[
                              booking.id
                            ] || ''
                          }
                          onChange={(event) =>
                            setReplyByBooking(
                              (previous) => ({
                                ...previous,
                                [booking.id]:
                                  event.target.value,
                              })
                            )
                          }
                          placeholder="Type your reply to the guest..."
                          style={styles.replyInput}
                        />

                        <button
                          type="button"
                          disabled={
                            sendingMessageId ===
                            booking.id
                          }
                          onClick={() =>
                            sendHostReply(
                              booking
                            )
                          }
                          style={styles.sendReply}
                        >
                          {sendingMessageId ===
                          booking.id
                            ? 'Sending...'
                            : 'Send Reply'}
                        </button>
                      </div>
                    </div>

                    {booking.host_decision ===
                      'pending' && (
                      <div style={styles.actionGrid}>
                        <button
                          type="button"
                          disabled={
                            busyId ===
                            booking.id
                          }
                          onClick={() =>
                            approveBooking(
                              booking
                            )
                          }
                          style={
                            styles.approve
                          }
                        >
                          Approve
                        </button>

                        <button
                          type="button"
                          disabled={
                            busyId ===
                            booking.id
                          }
                          onClick={() =>
                            openOffer(
                              booking
                            )
                          }
                          style={
                            styles.offerButton
                          }
                        >
                          Special Offer
                        </button>

                        <button
                          type="button"
                          disabled={
                            busyId ===
                            booking.id
                          }
                          onClick={() =>
                            declineBooking(
                              booking
                            )
                          }
                          style={
                            styles.decline
                          }
                        >
                          Decline
                        </button>
                      </div>
                    )}

                    {specialOfferOpen && (
                      <div style={styles.offerEditor}>
                        <h3 style={{ marginTop: 0 }}>
                          Host Special Offer
                        </h3>

                        <div style={styles.offerFields}>
                          <select
                            value={
                              offerType
                            }
                            onChange={(
                              event
                            ) =>
                              setOfferType(
                                event.target
                                  .value
                              )
                            }
                            style={
                              styles.input
                            }
                          >
                            <option value="percent">
                              Percentage %
                            </option>

                            <option value="flat">
                              Flat ₹
                            </option>
                          </select>

                          <input
                            type="number"
                            min="0"
                            value={
                              offerValue
                            }
                            onChange={(
                              event
                            ) =>
                              setOfferValue(
                                event.target
                                  .value
                              )
                            }
                            placeholder={
                              offerType ===
                              'percent'
                                ? 'Example: 10'
                                : 'Example: 500'
                            }
                            style={
                              styles.input
                            }
                          />
                        </div>

                        <textarea
                          value={
                            offerNote
                          }
                          onChange={(
                            event
                          ) =>
                            setOfferNote(
                              event.target
                                .value
                            )
                          }
                          placeholder="Optional offer message to guest"
                          style={
                            styles.textarea
                          }
                        />

                        {preview && (
                          <div style={styles.preview}>
                            <Amount
                              label="Host discount"
                              value={
                                -preview.discount
                              }
                              discount
                            />

                            <Amount
                              label="New taxable amount"
                              value={
                                preview.taxable
                              }
                            />

                            <Amount
                              label={`GST @ ${
                                booking.gst_rate ||
                                18
                              }%`}
                              value={
                                preview.gst
                              }
                            />

                            <div style={styles.total}>
                              <span>
                                New Final Payable
                              </span>

                              <strong>
                                {money(
                                  preview.final
                                )}
                              </strong>
                            </div>
                          </div>
                        )}

                        <div style={styles.offerActions}>
                          <button
                            type="button"
                            onClick={() =>
                              sendSpecialOffer(
                                booking
                              )
                            }
                            disabled={
                              busyId ===
                              booking.id
                            }
                            style={
                              styles.sendOffer
                            }
                          >
                            Approve & Send Offer
                          </button>

                          <button
                            type="button"
                            onClick={
                              closeOffer
                            }
                            style={
                              styles.cancel
                            }
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              }
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function ChatMessage({
  item,
}) {
  const isHost =
    item.sender_type ===
    'host';

  const isSystem =
    item.sender_type ===
    'system';

  if (isSystem) {
    return (
      <div style={styles.systemMessage}>
        <div>
          {item.message}
        </div>

        <div style={styles.messageTime}>
          {dateTime(
            item.created_at
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={
        isHost
          ? styles.hostBubble
          : styles.guestBubble
      }
    >
      <div style={styles.messageSender}>
        {item.sender_name ||
          (isHost
            ? 'Host'
            : 'Guest')}
      </div>

      <div>
        {item.message}
      </div>

      <div style={styles.messageTime}>
        {dateTime(
          item.created_at
        )}
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}) {
  return (
    <div>
      <div style={styles.detailLabel}>
        {label}
      </div>

      <div style={styles.detailValue}>
        {value ?? '—'}
      </div>
    </div>
  );
}

function Amount({
  label,
  value,
  discount = false,
}) {
  return (
    <div
      style={{
        ...styles.amountRow,
        ...(discount
          ? styles.discount
          : {}),
      }}
    >
      <span>
        {label}
      </span>

      <strong>
        {Number(value || 0) < 0
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

function MiniStatus({
  label,
  value,
}) {
  return (
    <div style={styles.miniStatus}>
      <div style={styles.detailLabel}>
        {label}
      </div>

      <strong
        style={{
          textTransform:
            'capitalize',
        }}
      >
        {String(
          value || '—'
        ).replaceAll(
          '_',
          ' '
        )}
      </strong>
    </div>
  );
}

function StatusBadge({
  value,
}) {
  const status =
    String(
      value || ''
    ).toLowerCase();

  let background =
    '#fff3d6';

  if (
    status === 'confirmed' ||
    status === 'completed'
  ) {
    background =
      '#e4f7e9';
  }

  if (
    status === 'cancelled'
  ) {
    background =
      '#ffe8e8';
  }

  return (
    <span
      style={{
        ...styles.badge,
        background,
      }}
    >
      {String(
        value || 'pending'
      ).replaceAll(
        '_',
        ' '
      )}
    </span>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f6f7f9',
    color: '#11213c',
    fontFamily:
      'Arial, sans-serif',
  },

  loading: {
    padding: 30,
    fontFamily:
      'Arial, sans-serif',
  },

  header: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 20,
    background: '#fff',
    borderBottom:
      '1px solid #e3e6ea',
    padding:
      '18px 3vw',
  },

  brand: {
    fontSize: 25,
    fontWeight: 900,
    color: '#17457f',
  },

  subBrand: {
    color: '#687080',
  },

  userArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
  },

  role: {
    fontSize: 12,
    color: '#687080',
    textTransform:
      'capitalize',
  },

  logout: {
    background: '#fff',
    border:
      '1px solid #d8dce2',
    borderRadius: 22,
    padding: '9px 15px',
    cursor: 'pointer',
  },

  content: {
    padding:
      '35px 3vw 80px',
  },

  titleRow: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'center',
    gap: 20,
    flexWrap: 'wrap',
    marginBottom: 25,
  },

  title: {
    fontSize: 34,
    marginBottom: 5,
  },

  muted: {
    color: '#687080',
  },

  refresh: {
    background: '#17457f',
    color: '#fff',
    border: 0,
    borderRadius: 10,
    padding: '11px 18px',
    fontWeight: 800,
    cursor: 'pointer',
  },

  error: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 20,
    background: '#ffeaea',
    color: '#8b2020',
    fontWeight: 700,
  },

  success: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 20,
    background: '#e9f8ee',
    color: '#23653a',
    fontWeight: 700,
  },

  empty: {
    background: '#fff',
    padding: 30,
    borderRadius: 15,
  },

  grid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(420px, 1fr))',
    gap: 20,
  },

  card: {
    background: '#fff',
    border:
      '1px solid #dfe3e8',
    borderRadius: 17,
    padding: 22,
  },

  cardTop: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems:
      'flex-start',
    gap: 15,
  },

  bookingCode: {
    color: '#17457f',
    fontSize: 20,
    fontWeight: 900,
  },

  created: {
    fontSize: 12,
    color: '#687080',
    marginTop: 4,
  },

  badge: {
    padding: '8px 13px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 900,
    textTransform:
      'capitalize',
  },

  propertyName: {
    fontSize: 20,
    marginBottom: 4,
  },

  location: {
    color: '#687080',
  },

  line: {
    border: 0,
    borderTop:
      '1px solid #e7e9ed',
    margin: '18px 0',
  },

  detailsGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(2, 1fr)',
    gap: 15,
  },

  detailLabel: {
    fontSize: 10,
    color: '#687080',
    marginBottom: 4,
    textTransform:
      'uppercase',
    letterSpacing:
      '0.5px',
  },

  detailValue: {
    fontWeight: 800,
  },

  amountBox: {
    background: '#f7f8fa',
    borderRadius: 12,
    padding: 15,
    marginTop: 18,
  },

  amountRow: {
    display: 'flex',
    justifyContent:
      'space-between',
    gap: 15,
    marginBottom: 9,
  },

  discount: {
    color: '#208142',
  },

  total: {
    display: 'flex',
    justifyContent:
      'space-between',
    gap: 15,
    paddingTop: 12,
    marginTop: 6,
    borderTop:
      '1px solid #d9dde3',
    fontSize: 18,
  },

  statusGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(3, 1fr)',
    gap: 8,
    marginTop: 15,
  },

  miniStatus: {
    background: '#f8f9fb',
    borderRadius: 9,
    padding: 10,
  },

  offerNotice: {
    background: '#fff7dd',
    padding: 12,
    marginTop: 14,
    borderRadius: 10,
  },

  discountRequest: {
    background: '#fff0dc',
    padding: 12,
    marginTop: 14,
    borderRadius: 10,
  },

  chatBox: {
    marginTop: 18,
    padding: 15,
    border:
      '1px solid #dbe2ea',
    borderRadius: 14,
    background: '#f8fafc',
  },

  chatHeader: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 12,
  },

  chatHelp: {
    marginTop: 3,
    fontSize: 11,
    color: '#687080',
  },

  fullChatLink: {
    fontSize: 12,
    fontWeight: 800,
    color: '#17457f',
    textDecoration: 'none',
  },

  thread: {
    display: 'grid',
    gap: 8,
    maxHeight: 300,
    overflowY: 'auto',
    padding: '4px 0',
  },

  guestBubble: {
    maxWidth: '85%',
    padding: 11,
    borderRadius:
      '12px 12px 12px 3px',
    background: '#ffffff',
    border:
      '1px solid #dfe3e8',
    marginBottom: 8,
  },

  hostBubble: {
    maxWidth: '85%',
    marginLeft: 'auto',
    padding: 11,
    borderRadius:
      '12px 12px 3px 12px',
    background: '#eaf2ff',
    border:
      '1px solid #c8daf5',
    marginBottom: 8,
  },

  systemMessage: {
    textAlign: 'center',
    padding: '8px 10px',
    borderRadius: 9,
    background: '#fff7dd',
    color: '#68521d',
    fontSize: 12,
    marginBottom: 8,
  },

  messageSender: {
    fontSize: 11,
    fontWeight: 900,
    marginBottom: 5,
    color: '#17457f',
  },

  messageTime: {
    marginTop: 5,
    color: '#87909d',
    fontSize: 10,
  },

  noMessages: {
    padding: 12,
    textAlign: 'center',
    color: '#87909d',
    fontSize: 12,
  },

  replyArea: {
    display: 'grid',
    gridTemplateColumns:
      '1fr auto',
    gap: 9,
    alignItems: 'end',
    marginTop: 10,
  },

  replyInput: {
    width: '100%',
    boxSizing: 'border-box',
    minHeight: 65,
    resize: 'vertical',
    padding: 10,
    border:
      '1px solid #ccd1d8',
    borderRadius: 9,
    background: '#fff',
  },

  sendReply: {
    border: 0,
    background: '#17457f',
    color: '#fff',
    borderRadius: 9,
    padding: '12px 16px',
    fontWeight: 800,
    cursor: 'pointer',
  },

  actionGrid: {
    display: 'grid',
    gridTemplateColumns:
      '1fr 1fr 1fr',
    gap: 8,
    marginTop: 18,
  },

  approve: {
    border: 0,
    background: '#18753c',
    color: '#fff',
    padding: 11,
    borderRadius: 9,
    fontWeight: 800,
    cursor: 'pointer',
  },

  offerButton: {
    border:
      '1px solid #17457f',
    background: '#fff',
    color: '#17457f',
    padding: 11,
    borderRadius: 9,
    fontWeight: 800,
    cursor: 'pointer',
  },

  decline: {
    border: 0,
    background: '#a83232',
    color: '#fff',
    padding: 11,
    borderRadius: 9,
    fontWeight: 800,
    cursor: 'pointer',
  },

  offerEditor: {
    background: '#f3f6fb',
    padding: 16,
    marginTop: 15,
    borderRadius: 12,
  },

  offerFields: {
    display: 'grid',
    gridTemplateColumns:
      '1fr 1fr',
    gap: 10,
  },

  input: {
    width: '100%',
    boxSizing:
      'border-box',
    border:
      '1px solid #ccd1d8',
    borderRadius: 9,
    padding: 11,
  },

  textarea: {
    width: '100%',
    boxSizing:
      'border-box',
    minHeight: 70,
    marginTop: 10,
    border:
      '1px solid #ccd1d8',
    borderRadius: 9,
    padding: 11,
  },

  preview: {
    marginTop: 12,
    background: '#fff',
    padding: 13,
    borderRadius: 10,
  },

  offerActions: {
    display: 'flex',
    gap: 10,
    marginTop: 12,
  },

  sendOffer: {
    flex: 1,
    border: 0,
    background: '#17457f',
    color: '#fff',
    padding: 11,
    borderRadius: 9,
    fontWeight: 800,
    cursor: 'pointer',
  },

  cancel: {
    border:
      '1px solid #ccd1d8',
    background: '#fff',
    padding: '11px 17px',
    borderRadius: 9,
    cursor: 'pointer',
  },

  loginBox: {
    maxWidth: 450,
    margin: '80px auto',
    background: '#fff',
    padding: 30,
    borderRadius: 15,
  },
};