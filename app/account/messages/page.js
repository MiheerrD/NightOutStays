'use client';

import { useEffect, useMemo, useState } from 'react';
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

function formatDateTime(value) {
  if (!value) return '';

  try {
    return new Date(value).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
}

function formatStayDate(value) {
  if (!value) return '—';

  try {
    return new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

export default function GuestMessagesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [session, setSession] = useState(null);
  const [guest, setGuest] = useState(null);

  const [bookings, setBookings] = useState([]);
  const [messages, setMessages] = useState([]);

  const [activeBookingId, setActiveBookingId] = useState('');

  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  const [discountText, setDiscountText] = useState('');
  const [discountSending, setDiscountSending] = useState(false);

  useEffect(() => {
    initialisePage();
  }, []);

  useEffect(() => {
    if (activeBookingId) {
      loadMessages(activeBookingId);
    }
  }, [activeBookingId]);

  useEffect(() => {
    if (!activeBookingId) return;

    const channel = supabase
      .channel(`guest-booking-${activeBookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'booking_messages',
          filter: `booking_id=eq.${activeBookingId}`,
        },
        () => {
          loadMessages(activeBookingId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeBookingId]);

  async function initialisePage() {
    setLoading(true);
    setError('');
    setNotice('');

    try {
      const {
        data: { session: currentSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!currentSession?.user) {
        window.location.href =
          `/login?redirect=${encodeURIComponent('/account/messages')}`;
        return;
      }

      setSession(currentSession);

      const email = String(
        currentSession.user.email || ''
      )
        .trim()
        .toLowerCase();

      if (!email) {
        throw new Error('No email address is linked to this login.');
      }

      const {
        data: guestRows,
        error: guestError,
      } = await supabase
        .from('guests')
        .select('id, full_name, phone, email, created_at')
        .eq('email', email)
        .order('created_at', {
          ascending: true,
        })
        .limit(1);

      if (guestError) {
        throw guestError;
      }

      const foundGuest = guestRows?.[0] || null;

      if (!foundGuest) {
        throw new Error(
          'No guest profile was found for this login.'
        );
      }

      setGuest(foundGuest);

      await loadBookings(foundGuest.id);
    } catch (pageError) {
      console.error(pageError);

      setError(
        pageError?.message ||
          'Unable to open your messages.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function logoutGuest() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  async function loadBookings(guestId) {
    const {
      data,
      error: bookingsError,
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
        base_amount,
        auto_discount_amount,
        host_discount_amount,
        final_payable_amount,
        offer_note,
        offer_status,
        guest_discount_requested,
        guest_discount_message,
        taxable_amount,
        gst_amount,
        amount_including_gst,
        properties (
          id,
          name,
          slug,
          location_name
        )
      `)
      .eq('guest_id', guestId)
      .order('created_at', {
        ascending: false,
      });

    if (bookingsError) {
      throw bookingsError;
    }

    const rows = data || [];

    setBookings(rows);

    if (rows.length) {
      setActiveBookingId((current) => {
        if (
          current &&
          rows.some((booking) => booking.id === current)
        ) {
          return current;
        }

        return rows[0].id;
      });
    } else {
      setActiveBookingId('');
    }
  }

  async function loadMessages(bookingId) {
    if (!bookingId) {
      setMessages([]);
      return;
    }

    const {
      data,
      error: messagesError,
    } = await supabase
      .from('booking_messages')
      .select(
        'id, booking_id, sender_type, sender_name, message, message_type, is_read, created_at'
      )
      .eq('booking_id', bookingId)
      .order('created_at', {
        ascending: true,
      });

    if (messagesError) {
      console.error(messagesError);
      setError(messagesError.message);
      return;
    }

    setMessages(data || []);

    const { error: readError } = await supabase
      .from('booking_messages')
      .update({
        is_read: true,
      })
      .eq('booking_id', bookingId)
      .neq('sender_type', 'guest')
      .eq('is_read', false);

    if (readError) {
      console.warn('Unable to update read status:', readError);
    }
  }

  const activeBooking = useMemo(() => {
    return (
      bookings.find(
        (booking) => booking.id === activeBookingId
      ) || null
    );
  }, [bookings, activeBookingId]);

  const activeProperty =
    activeBooking?.properties || null;

  const finalPayable = Number(
    activeBooking?.final_payable_amount ??
      activeBooking?.amount_including_gst ??
      activeBooking?.total_amount ??
      0
  );

  const hostDiscount = Number(
    activeBooking?.host_discount_amount || 0
  );

  async function sendMessage(event) {
    event.preventDefault();

    setError('');
    setNotice('');

    const cleanMessage = String(
      messageText || ''
    ).trim();

    if (!cleanMessage) return;

    if (!activeBooking?.id || !guest?.id) {
      setError('Please select a booking first.');
      return;
    }

    setSending(true);

    try {
      const {
        error: insertError,
      } = await supabase
        .from('booking_messages')
        .insert({
          booking_id: activeBooking.id,
          sender_type: 'guest',
          sender_name:
            guest.full_name || 'Guest',
          message: cleanMessage,

          // IMPORTANT:
          // "message" is an allowed database message type.
          message_type: 'message',

          is_read: false,
        });

      if (insertError) {
        throw insertError;
      }

      setMessageText('');

      await loadMessages(activeBooking.id);
    } catch (sendError) {
      console.error(sendError);

      setError(
        sendError?.message ||
          'Message could not be sent.'
      );
    } finally {
      setSending(false);
    }
  }

  async function requestDiscount() {
    setError('');
    setNotice('');

    if (!activeBooking?.id || !guest?.id) {
      setError('Please select a booking first.');
      return;
    }

    const cleanRequest = String(
      discountText || ''
    ).trim();

    if (!cleanRequest) {
      setError(
        'Please write your discount request first.'
      );
      return;
    }

    setDiscountSending(true);

    try {
      /*
        IMPORTANT FIX:

        booking_messages.message_type currently allows:
        message
        booking_request
        approval
        decline
        special_offer
        payment
        confirmation
        system

        Therefore we DO NOT insert "discount_request".
        Guest discount requests are stored as a normal message
        with a clear DISCOUNT REQUEST prefix.
      */

      const discountMessage =
        `DISCOUNT REQUEST: ${cleanRequest}`;

      const {
        error: messageError,
      } = await supabase
        .from('booking_messages')
        .insert({
          booking_id: activeBooking.id,
          sender_type: 'guest',
          sender_name:
            guest.full_name || 'Guest',
          message: discountMessage,
          message_type: 'message',
          is_read: false,
        });

      if (messageError) {
        throw messageError;
      }

      /*
        Keep the booking-level discount request flag also,
        so the host/admin can identify that this booking
        has an active guest discount request.
      */

      const {
        error: bookingUpdateError,
      } = await supabase
        .from('bookings')
        .update({
          guest_discount_requested: true,
          guest_discount_message:
            cleanRequest,
        })
        .eq('id', activeBooking.id);

      if (bookingUpdateError) {
        console.warn(
          'Discount request message was sent, but booking flag could not be updated:',
          bookingUpdateError
        );
      }

      setDiscountText('');

      setNotice(
        'Discount request sent successfully. The host can reply or send you a special offer.'
      );

      await loadMessages(activeBooking.id);

      await loadBookings(guest.id);
    } catch (discountError) {
      console.error(discountError);

      setError(
        discountError?.message ||
          'Discount request could not be sent.'
      );
    } finally {
      setDiscountSending(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.centerBox}>
          Loading your messages...
        </div>
      </main>
    );
  }

  if (error && !guest) {
    return (
      <main style={styles.page}>
        <div style={styles.centerBox}>
          <h2>Messages unavailable</h2>

          <p>{error}</p>

          <a
            href="/"
            style={styles.primaryLink}
          >
            Back to NightOutStays
          </a>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <a
          href="/"
          style={styles.logo}
        >
          NightOutStays
        </a>

        <div style={styles.headerRight}>
          <nav style={styles.nav}>
            <a
              href="/account/bookings"
              style={styles.navLink}
            >
              My Bookings
            </a>

            <a
              href="/account/messages"
              style={styles.activeNavLink}
            >
              Messages
            </a>
          </nav>

          <div style={styles.loginStatus}>
            <div>
              <div style={styles.loggedInLabel}>
                Logged in as
              </div>

              <strong>
                {guest?.full_name || 'Guest'}
              </strong>

              <div style={styles.loggedInEmail}>
                {session?.user?.email ||
                  guest?.email}
              </div>
            </div>

            <button
              type="button"
              onClick={logoutGuest}
              style={styles.logoutButton}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div style={styles.container}>
        <div style={styles.pageHeader}>
          <div>
            <h1 style={styles.title}>
              Messages
            </h1>

            <p style={styles.subtitle}>
              Chat with the host about your booking or request a better rate.
            </p>
          </div>

          <button
            type="button"
            onClick={initialisePage}
            style={styles.refreshButton}
          >
            Refresh
          </button>
        </div>

        {bookings.length === 0 ? (
          <div style={styles.emptyCard}>
            <h3>
              No booking conversations yet
            </h3>

            <p>
              Once you request a stay, its conversation will appear here.
            </p>

            <a
              href="/"
              style={styles.primaryLink}
            >
              Browse Properties
            </a>
          </div>
        ) : (
          <div style={styles.chatLayout}>
            <aside style={styles.conversationList}>
              <div style={styles.listHeading}>
                Your Bookings
              </div>

              {bookings.map((booking) => {
                const property =
                  booking.properties;

                const active =
                  booking.id ===
                  activeBookingId;

                return (
                  <button
                    type="button"
                    key={booking.id}
                    onClick={() => {
                      setActiveBookingId(
                        booking.id
                      );

                      setNotice('');
                      setError('');
                    }}
                    style={{
                      ...styles.conversationButton,
                      ...(active
                        ? styles.activeConversation
                        : {}),
                    }}
                  >
                    <strong style={styles.bookingCode}>
                      {booking.booking_code}
                    </strong>

                    <span style={styles.propertyName}>
                      {property?.name ||
                        'Property'}
                    </span>

                    <span style={styles.bookingDates}>
                      {formatStayDate(
                        booking.check_in
                      )}
                      {' → '}
                      {formatStayDate(
                        booking.check_out
                      )}
                    </span>

                    <span style={styles.bookingStatus}>
                      {booking.booking_status ||
                        'pending'}
                      {' • '}
                      {booking.payment_status ||
                        'unpaid'}
                    </span>
                  </button>
                );
              })}
            </aside>

            <section style={styles.chatPanel}>
              {activeBooking && (
                <>
                  <div style={styles.chatHeader}>
                    <div>
                      <h2 style={styles.chatTitle}>
                        {activeProperty?.name ||
                          'Booking Conversation'}
                      </h2>

                      <div style={styles.chatMeta}>
                        {activeBooking.booking_code}
                        {' • '}
                        {formatStayDate(
                          activeBooking.check_in
                        )}
                        {' → '}
                        {formatStayDate(
                          activeBooking.check_out
                        )}
                      </div>
                    </div>

                    <a
                      href="/account/bookings"
                      style={styles.bookingLink}
                    >
                      View Booking
                    </a>
                  </div>

                  <div style={styles.priceStrip}>
                    <div>
                      <span style={styles.priceLabel}>
                        Current Payable
                      </span>

                      <strong>
                        {money(finalPayable)}
                      </strong>
                    </div>

                    {hostDiscount > 0 && (
                      <div>
                        <span style={styles.priceLabel}>
                          Host Discount
                        </span>

                        <strong style={styles.discountAmount}>
                          -{money(hostDiscount)}
                        </strong>
                      </div>
                    )}

                    <div>
                      <span style={styles.priceLabel}>
                        Offer Status
                      </span>

                      <strong>
                        {activeBooking.offer_status ||
                          'None'}
                      </strong>
                    </div>
                  </div>

                  <div style={styles.messagesArea}>
                    {messages.length === 0 ? (
                      <div style={styles.noMessages}>
                        No messages yet. Start the conversation with the host.
                      </div>
                    ) : (
                      messages.map((item) => {
                        const isGuest =
                          item.sender_type === 'guest';

                        const isDiscountRequest =
                          String(
                            item.message || ''
                          ).startsWith(
                            'DISCOUNT REQUEST:'
                          );

                        const isSpecialOffer =
                          item.message_type ===
                          'special_offer';

                        return (
                          <div
                            key={item.id}
                            style={{
                              ...styles.messageRow,
                              justifyContent:
                                isGuest
                                  ? 'flex-end'
                                  : 'flex-start',
                            }}
                          >
                            <div
                              style={{
                                ...styles.messageBubble,

                                ...(isGuest
                                  ? styles.guestBubble
                                  : styles.hostBubble),

                                ...(isDiscountRequest
                                  ? styles.discountRequestBubble
                                  : {}),

                                ...(isSpecialOffer
                                  ? styles.specialOfferBubble
                                  : {}),
                              }}
                            >
                              <div style={styles.messageSender}>
                                {isSpecialOffer
                                  ? 'Host Special Offer'
                                  : isDiscountRequest
                                  ? 'Discount Request'
                                  : item.sender_name ||
                                    (isGuest
                                      ? guest?.full_name ||
                                        'You'
                                      : 'Host')}
                              </div>

                              <div style={styles.messageText}>
                                {item.message}
                              </div>

                              <div style={styles.messageTime}>
                                {formatDateTime(
                                  item.created_at
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div style={styles.discountRequestCard}>
                    <h3 style={styles.sectionTitle}>
                      Ask Host for a Better Rate
                    </h3>

                    <p style={styles.sectionHelp}>
                      You can request a discount before payment. This request does not change your booking price. If the host agrees, the host can send you a formal special offer.
                    </p>

                    <textarea
                      value={discountText}
                      onChange={(event) =>
                        setDiscountText(
                          event.target.value
                        )
                      }
                      placeholder="Example: Can you offer a better rate for this booking?"
                      style={styles.discountTextarea}
                    />

                    <button
                      type="button"
                      onClick={requestDiscount}
                      disabled={discountSending}
                      style={{
                        ...styles.discountButton,

                        ...(discountSending
                          ? styles.disabledButton
                          : {}),
                      }}
                    >
                      {discountSending
                        ? 'Sending...'
                        : 'Request Discount'}
                    </button>
                  </div>

                  {notice && (
                    <div style={styles.noticeBox}>
                      {notice}
                    </div>
                  )}

                  {error && (
                    <div style={styles.errorBox}>
                      {error}
                    </div>
                  )}

                  <form
                    onSubmit={sendMessage}
                    style={styles.messageComposer}
                  >
                    <textarea
                      value={messageText}
                      onChange={(event) =>
                        setMessageText(
                          event.target.value
                        )
                      }
                      placeholder="Write a message to the host..."
                      style={styles.messageInput}
                    />

                    <button
                      type="submit"
                      disabled={sending}
                      style={{
                        ...styles.sendButton,

                        ...(sending
                          ? styles.disabledButton
                          : {}),
                      }}
                    >
                      {sending
                        ? 'Sending...'
                        : 'Send'}
                    </button>
                  </form>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f5f7fb',
    color: '#0b2447',
    fontFamily: 'Arial, sans-serif',
  },

  header: {
    minHeight: 74,
    padding: '10px 5%',
    background: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },

  logo: {
    fontSize: 24,
    fontWeight: 800,
    color: '#174f91',
    textDecoration: 'none',
  },

  headerRight: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 22,
    flexWrap: 'wrap',
  },

  nav: {
    display: 'flex',
    gap: 16,
    alignItems: 'center',
  },

  navLink: {
    color: '#174f91',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: 14,
  },

  activeNavLink: {
    color: '#ffffff',
    background: '#174f91',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: 14,
    padding: '9px 14px',
    borderRadius: 20,
  },

  loginStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 18,
    borderLeft: '1px solid #e5e7eb',
  },

  loggedInLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    color: '#667085',
    fontWeight: 700,
    marginBottom: 2,
  },

  loggedInEmail: {
    fontSize: 10,
    color: '#667085',
    marginTop: 2,
  },

  logoutButton: {
    border: '1px solid #d0d5dd',
    background: '#ffffff',
    color: '#0b2447',
    padding: '8px 13px',
    borderRadius: 20,
    fontWeight: 700,
    cursor: 'pointer',
  },

  container: {
    width: '92%',
    maxWidth: 1220,
    margin: '0 auto',
    padding: '30px 0 60px',
  },

  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
    marginBottom: 22,
  },

  title: {
    margin: 0,
    fontSize: 34,
  },

  subtitle: {
    marginTop: 8,
    marginBottom: 0,
    color: '#667085',
  },

  refreshButton: {
    border: 0,
    background: '#174f91',
    color: '#ffffff',
    borderRadius: 9,
    padding: '10px 16px',
    fontWeight: 700,
    cursor: 'pointer',
  },

  chatLayout: {
    display: 'grid',
    gridTemplateColumns:
      '310px minmax(0, 1fr)',
    minHeight: 650,
    background: '#ffffff',
    border: '1px solid #dfe3e8',
    borderRadius: 16,
    overflow: 'hidden',
  },

  conversationList: {
    borderRight: '1px solid #dfe3e8',
    maxHeight: 760,
    overflowY: 'auto',
    background: '#ffffff',
  },

  listHeading: {
    padding: 16,
    fontWeight: 800,
    borderBottom: '1px solid #e5e7eb',
  },

  conversationButton: {
    width: '100%',
    border: 0,
    borderBottom: '1px solid #edf0f4',
    background: '#ffffff',
    padding: 15,
    textAlign: 'left',
    display: 'grid',
    gap: 5,
    cursor: 'pointer',
  },

  activeConversation: {
    background: '#edf4ff',
    borderLeft: '4px solid #174f91',
  },

  bookingCode: {
    color: '#174f91',
    fontSize: 13,
  },

  propertyName: {
    fontWeight: 700,
    fontSize: 13,
  },

  bookingDates: {
    fontSize: 12,
    color: '#667085',
  },

  bookingStatus: {
    fontSize: 11,
    color: '#667085',
    textTransform: 'capitalize',
  },

  chatPanel: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    background: '#f9fafc',
  },

  chatHeader: {
    padding: 18,
    background: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },

  chatTitle: {
    margin: 0,
    fontSize: 22,
  },

  chatMeta: {
    marginTop: 5,
    color: '#667085',
    fontSize: 12,
  },

  bookingLink: {
    color: '#174f91',
    fontWeight: 700,
    textDecoration: 'none',
    fontSize: 13,
  },

  priceStrip: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 10,
    padding: 14,
    background: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
  },

  priceLabel: {
    display: 'block',
    marginBottom: 5,
    color: '#667085',
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: 700,
  },

  discountAmount: {
    color: '#23833c',
  },

  messagesArea: {
    flex: 1,
    minHeight: 350,
    maxHeight: 470,
    overflowY: 'auto',
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  noMessages: {
    margin: 'auto',
    color: '#98a2b3',
    textAlign: 'center',
    fontSize: 13,
  },

  messageRow: {
    display: 'flex',
    width: '100%',
  },

  messageBubble: {
    maxWidth: '72%',
    padding: '11px 13px',
    borderRadius: 13,
    boxShadow:
      '0 1px 2px rgba(0,0,0,0.04)',
  },

  guestBubble: {
    background: '#e8f1ff',
    border: '1px solid #c6dbff',
  },

  hostBubble: {
    background: '#ffffff',
    border: '1px solid #e1e5ea',
  },

  discountRequestBubble: {
    background: '#fff6df',
    border: '1px solid #efd493',
  },

  specialOfferBubble: {
    background: '#ecfdf3',
    border: '1px solid #9adbb0',
  },

  messageSender: {
    fontWeight: 800,
    fontSize: 11,
    marginBottom: 5,
  },

  messageText: {
    fontSize: 13,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },

  messageTime: {
    marginTop: 6,
    color: '#98a2b3',
    fontSize: 10,
  },

  discountRequestCard: {
    margin: '0 18px 14px',
    padding: 14,
    background: '#fffaf0',
    border: '1px solid #efd493',
    borderRadius: 12,
    display: 'grid',
    gap: 10,
  },

  sectionTitle: {
    margin: 0,
    fontSize: 16,
  },

  sectionHelp: {
    margin: 0,
    color: '#765d1e',
    fontSize: 12,
    lineHeight: 1.5,
  },

  discountTextarea: {
    width: '100%',
    boxSizing: 'border-box',
    minHeight: 70,
    resize: 'vertical',
    border: '1px solid #dcc57e',
    borderRadius: 9,
    padding: 10,
    fontSize: 13,
    background: '#ffffff',
  },

  discountButton: {
    justifySelf: 'start',
    border: 0,
    background: '#b77700',
    color: '#ffffff',
    padding: '10px 14px',
    borderRadius: 8,
    fontWeight: 700,
    cursor: 'pointer',
  },

  noticeBox: {
    margin: '0 18px 12px',
    padding: 11,
    borderRadius: 9,
    background: '#eaf7ee',
    color: '#24723a',
    fontSize: 12,
    fontWeight: 700,
  },

  errorBox: {
    margin: '0 18px 12px',
    padding: 11,
    borderRadius: 9,
    background: '#fdeaea',
    color: '#a12828',
    fontSize: 12,
    fontWeight: 700,
  },

  messageComposer: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 10,
    padding: 18,
    borderTop: '1px solid #e5e7eb',
    background: '#ffffff',
  },

  messageInput: {
    width: '100%',
    boxSizing: 'border-box',
    minHeight: 60,
    resize: 'vertical',
    border: '1px solid #cfd6df',
    borderRadius: 9,
    padding: 11,
    fontSize: 13,
  },

  sendButton: {
    alignSelf: 'stretch',
    minWidth: 100,
    border: 0,
    background: '#174f91',
    color: '#ffffff',
    borderRadius: 9,
    padding: '0 18px',
    fontWeight: 800,
    cursor: 'pointer',
  },

  disabledButton: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },

  emptyCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 14,
    padding: 28,
    textAlign: 'center',
  },

  primaryLink: {
    display: 'inline-block',
    marginTop: 10,
    color: '#ffffff',
    background: '#174f91',
    padding: '10px 14px',
    borderRadius: 8,
    textDecoration: 'none',
    fontWeight: 700,
  },

  centerBox: {
    width: '90%',
    maxWidth: 600,
    margin: '100px auto',
    background: '#ffffff',
    borderRadius: 14,
    padding: 30,
    textAlign: 'center',
  },
};