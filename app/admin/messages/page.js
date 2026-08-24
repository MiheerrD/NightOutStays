'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

function formatDateTime(value) {
  if (!value) return '';

  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function AdminMessagesPage() {
  const [session, setSession] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);

  const [loading, setLoading] = useState(true);

  const [bookings, setBookings] = useState([]);
  const [messages, setMessages] = useState([]);

  const [
    selectedBookingId,
    setSelectedBookingId,
  ] = useState('');

  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  useEffect(() => {
    initialize();
  }, []);

  async function initialize() {
    setLoading(true);
    setErrorMessage('');

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

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
      } = await supabase
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
          'Admin access not available.'
        );
      }

      setAdminProfile(profile);

      let requestedBookingId = '';

      if (
        typeof window !==
        'undefined'
      ) {
        const params =
          new URLSearchParams(
            window.location.search
          );

        requestedBookingId =
          params.get('booking') || '';
      }

      await loadInbox(
        requestedBookingId
      );
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error.message ||
          'Unable to load messages.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadInbox(
    requestedBookingId = ''
  ) {
    const {
      data: bookingRows,
      error: bookingError,
    } = await supabase
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
      setMessages([]);
      setSelectedBookingId('');
      return;
    }

    const propertyIds = [
      ...new Set(
        rows
          .map(
            (booking) =>
              booking.property_id
          )
          .filter(Boolean)
      ),
    ];

    const guestIds = [
      ...new Set(
        rows
          .map(
            (booking) =>
              booking.guest_id
          )
          .filter(Boolean)
      ),
    ];

    const bookingIds =
      rows.map(
        (booking) =>
          booking.id
      );

    const [
      propertiesResult,
      guestsResult,
      messagesResult,
    ] = await Promise.all([
      propertyIds.length
        ? supabase
            .from('properties')
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
            .from('guests')
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
      propertiesResult.error
    ) {
      throw propertiesResult.error;
    }

    if (
      guestsResult.error
    ) {
      throw guestsResult.error;
    }

    if (
      messagesResult.error
    ) {
      throw messagesResult.error;
    }

    const propertyMap = {};

    (
      propertiesResult.data ||
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
      guestsResult.data ||
      []
    ).forEach(
      (guest) => {
        guestMap[
          guest.id
        ] = guest;
      }
    );

    const enrichedBookings =
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
      enrichedBookings
    );

    setMessages(
      messagesResult.data ||
        []
    );

    const requestedExists =
      requestedBookingId &&
      enrichedBookings.some(
        (booking) =>
          booking.id ===
          requestedBookingId
      );

    if (requestedExists) {
      setSelectedBookingId(
        requestedBookingId
      );

      await markThreadReadOnly(
        requestedBookingId
      );

      return;
    }

    setSelectedBookingId(
      (previous) => {
        const previousExists =
          previous &&
          enrichedBookings.some(
            (booking) =>
              booking.id ===
              previous
          );

        if (
          previousExists
        ) {
          return previous;
        }

        return (
          enrichedBookings[0]
            ?.id || ''
        );
      }
    );
  }

  const threads =
    useMemo(() => {
      return bookings
        .map(
          (booking) => {
            const bookingMessages =
              messages.filter(
                (item) =>
                  item.booking_id ===
                  booking.id
              );

            const lastMessage =
              bookingMessages.length
                ? bookingMessages[
                    bookingMessages.length -
                      1
                  ]
                : null;

            const unread =
              bookingMessages.filter(
                (item) =>
                  item.sender_type ===
                    'guest' &&
                  !item.is_read
              ).length;

            return {
              booking,
              messages:
                bookingMessages,

              lastMessage,
              unread,

              displayTime:
                lastMessage
                  ?.created_at ||
                booking.created_at,
            };
          }
        )
        .sort(
          (a, b) =>
            new Date(
              b.displayTime || 0
            ) -
            new Date(
              a.displayTime || 0
            )
        );
    }, [
      bookings,
      messages,
    ]);

  const selectedThread =
    useMemo(() => {
      return threads.find(
        (thread) =>
          thread.booking.id ===
          selectedBookingId
      );
    }, [
      threads,
      selectedBookingId,
    ]);

  async function markThreadReadOnly(
    bookingId
  ) {
    const {
      error,
    } = await supabase
      .from(
        'booking_messages'
      )
      .update({
        is_read: true,
      })
      .eq(
        'booking_id',
        bookingId
      )
      .eq(
        'sender_type',
        'guest'
      )
      .eq(
        'is_read',
        false
      );

    if (error) {
      console.error(
        error
      );
    }
  }

  async function openThread(
    bookingId
  ) {
    setSelectedBookingId(
      bookingId
    );

    setReply('');

    await markThreadReadOnly(
      bookingId
    );

    setMessages(
      (previous) =>
        previous.map(
          (item) =>
            item.booking_id ===
              bookingId &&
            item.sender_type ===
              'guest'
              ? {
                  ...item,
                  is_read: true,
                }
              : item
        )
    );

    if (
      typeof window !==
      'undefined'
    ) {
      const url =
        new URL(
          window.location.href
        );

      url.searchParams.set(
        'booking',
        bookingId
      );

      window.history.replaceState(
        {},
        '',
        url
      );
    }
  }

  async function sendReply() {
    const text =
      reply.trim();

    if (
      !text ||
      !selectedThread
    ) {
      return;
    }

    setSending(true);
    setErrorMessage('');

    try {
      const {
        data,
        error,
      } = await supabase
        .from(
          'booking_messages'
        )
        .insert({
          booking_id:
            selectedThread.booking
              .id,

          sender_type:
            'host',

          sender_name:
            adminProfile?.full_name ||
            'Host',

          message: text,

          message_type:
            'message',

          is_read:
            false,
        })
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      setReply('');

      setMessages(
        (previous) => [
          ...previous,
          data,
        ]
      );
    } catch (error) {
      console.error(error);

      setErrorMessage(
        `Unable to send message: ${
          error.message ||
          'Unknown error'
        }`
      );
    } finally {
      setSending(false);
    }
  }

  async function refreshInbox() {
    try {
      setErrorMessage('');

      await loadInbox(
        selectedBookingId
      );
    } catch (error) {
      console.error(error);

      setErrorMessage(
        `Unable to refresh messages: ${
          error.message ||
          'Unknown error'
        }`
      );
    }
  }

  async function logout() {
    await supabase.auth.signOut();

    window.location.href =
      '/admin/bookings';
  }

  if (loading) {
    return (
      <main style={styles.loading}>
        Loading messages...
      </main>
    );
  }

  if (
    !session ||
    !adminProfile
  ) {
    return (
      <main style={styles.loading}>
        <h2>
          Admin login required
        </h2>

        <p>
          Please login through the admin area.
        </p>

        <a
          href="/admin/bookings"
          style={
            styles.adminLink
          }
        >
          Go to Admin
        </a>
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
            Guest Messages
          </div>
        </div>

        <div style={styles.headerRight}>
          <div>
            <strong>
              {adminProfile.full_name ||
                'Administrator'}
            </strong>

            <div style={styles.role}>
              {adminProfile.role ||
                'admin'}
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

      <section style={styles.container}>
        <div style={styles.headingRow}>
          <div>
            <h1 style={styles.heading}>
              Messages
            </h1>

            <p style={styles.muted}>
              All booking-linked guest conversations in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={
              refreshInbox
            }
            style={
              styles.refreshButton
            }
          >
            Refresh
          </button>
        </div>

        {errorMessage && (
          <div style={styles.error}>
            {errorMessage}
          </div>
        )}

        <div style={styles.messagingLayout}>
          <aside style={styles.threadList}>
            <div style={styles.inboxTitle}>
              Conversations
              <span style={styles.inboxCount}>
                {threads.length}
              </span>
            </div>

            {threads.length ===
            0 ? (
              <div style={styles.empty}>
                No conversations yet.
              </div>
            ) : (
              threads.map(
                (thread) => {
                  const {
                    booking,
                    lastMessage,
                    displayTime,
                    unread,
                  } = thread;

                  const selected =
                    booking.id ===
                    selectedBookingId;

                  return (
                    <button
                      key={
                        booking.id
                      }
                      type="button"
                      onClick={() =>
                        openThread(
                          booking.id
                        )
                      }
                      style={{
                        ...styles.threadButton,

                        ...(selected
                          ? styles.selectedThread
                          : {}),
                      }}
                    >
                      <div style={styles.threadTop}>
                        <strong>
                          {booking.guest
                            ?.full_name ||
                            'Guest'}
                        </strong>

                        {unread > 0 && (
                          <span style={styles.unreadBadge}>
                            {unread}
                          </span>
                        )}
                      </div>

                      <div style={styles.bookingCode}>
                        {
                          booking.booking_code
                        }
                      </div>

                      <div style={styles.propertyName}>
                        {booking.property
                          ?.name ||
                          'Property'}
                      </div>

                      <div style={styles.messagePreview}>
                        {lastMessage
                          ? lastMessage.message
                          : booking.notes ||
                            'Booking request received'}
                      </div>

                      <div style={styles.threadTime}>
                        {formatDateTime(
                          displayTime
                        )}
                      </div>
                    </button>
                  );
                }
              )
            )}
          </aside>

          <section style={styles.conversation}>
            {!selectedThread ? (
              <div style={styles.noSelection}>
                Select a conversation to view messages.
              </div>
            ) : (
              <>
                <div style={styles.conversationHeader}>
                  <div>
                    <h2 style={styles.guestName}>
                      {selectedThread.booking
                        .guest
                        ?.full_name ||
                        'Guest'}
                    </h2>

                    <div style={styles.bookingInfo}>
                      {
                        selectedThread.booking
                          .booking_code
                      }
                      {' · '}
                      {selectedThread.booking
                        .property
                        ?.name ||
                        'Property'}
                    </div>

                    <div style={styles.contactInfo}>
                      {selectedThread.booking
                        .guest?.phone ||
                        ''}

                      {selectedThread.booking
                        .guest?.email
                        ? ` · ${selectedThread.booking.guest.email}`
                        : ''}
                    </div>
                  </div>

                  <a
                    href="/admin/bookings"
                    style={styles.bookingLink}
                  >
                    View Bookings
                  </a>
                </div>

                <div style={styles.messagesArea}>
                  {selectedThread.booking
                    .notes &&
                    selectedThread.messages
                      .length ===
                      0 && (
                      <MessageBubble
                        senderType="guest"
                        senderName={
                          selectedThread
                            .booking
                            .guest
                            ?.full_name ||
                          'Guest'
                        }
                        message={
                          selectedThread
                            .booking
                            .notes
                        }
                        time="Original booking message"
                      />
                    )}

                  {selectedThread.messages
                    .length ===
                    0 &&
                    !selectedThread.booking
                      .notes && (
                      <div style={styles.emptyConversation}>
                        No messages yet.
                      </div>
                    )}

                  {selectedThread.messages.map(
                    (item) => (
                      <MessageBubble
                        key={
                          item.id
                        }
                        senderType={
                          item.sender_type
                        }
                        senderName={
                          item.sender_name
                        }
                        message={
                          item.message
                        }
                        time={
                          formatDateTime(
                            item.created_at
                          )
                        }
                      />
                    )
                  )}
                </div>

                <div style={styles.replyBox}>
                  <textarea
                    value={reply}
                    onChange={(event) =>
                      setReply(
                        event.target.value
                      )
                    }
                    placeholder="Type your reply to the guest..."
                    style={styles.textarea}
                  />

                  <button
                    type="button"
                    onClick={
                      sendReply
                    }
                    disabled={
                      sending ||
                      !reply.trim()
                    }
                    style={{
                      ...styles.sendButton,

                      opacity:
                        sending ||
                        !reply.trim()
                          ? 0.55
                          : 1,
                    }}
                  >
                    {sending
                      ? 'Sending...'
                      : 'Send Reply'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function MessageBubble({
  senderType,
  senderName,
  message,
  time,
}) {
  if (
    senderType ===
    'system'
  ) {
    return (
      <div style={styles.systemBubble}>
        <div>
          {message}
        </div>

        <div style={styles.messageTime}>
          {time}
        </div>
      </div>
    );
  }

  const host =
    senderType ===
    'host';

  return (
    <div
      style={
        host
          ? styles.hostBubble
          : styles.guestBubble
      }
    >
      <div style={styles.senderName}>
        {senderName ||
          (host
            ? 'Host'
            : 'Guest')}
      </div>

      <div style={styles.messageText}>
        {message}
      </div>

      <div style={styles.messageTime}>
        {time}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f5f7fa',
    color: '#11213c',
    fontFamily:
      'Arial, sans-serif',
  },

  loading: {
    padding: 40,
    fontFamily:
      'Arial, sans-serif',
  },

  header: {
    background: '#ffffff',
    borderBottom:
      '1px solid #e1e5ea',
    padding: '17px 3vw',
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'center',
    gap: 20,
  },

  brand: {
    fontSize: 25,
    fontWeight: 900,
    color: '#17457f',
  },

  subBrand: {
    marginTop: 2,
    color: '#687080',
  },

  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 18,
  },

  role: {
    color: '#687080',
    fontSize: 11,
    textTransform:
      'capitalize',
  },

  logout: {
    border:
      '1px solid #d6dae0',
    background: '#ffffff',
    padding: '9px 14px',
    borderRadius: 20,
    cursor: 'pointer',
  },

  container: {
    maxWidth: 1500,
    margin: '0 auto',
    padding: '32px 3vw 70px',
  },

  headingRow: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'center',
    gap: 20,
    flexWrap: 'wrap',
    marginBottom: 20,
  },

  heading: {
    margin: 0,
    fontSize: 34,
  },

  muted: {
    color: '#687080',
    marginTop: 5,
  },

  refreshButton: {
    border: 0,
    background: '#17457f',
    color: '#ffffff',
    borderRadius: 9,
    padding: '11px 18px',
    fontWeight: 800,
    cursor: 'pointer',
  },

  error: {
    padding: 12,
    marginBottom: 15,
    background: '#ffeaea',
    color: '#8c2020',
    borderRadius: 9,
    fontWeight: 700,
  },

  messagingLayout: {
    display: 'grid',
    gridTemplateColumns:
      '360px minmax(0, 1fr)',
    minHeight: '72vh',
    background: '#ffffff',
    border:
      '1px solid #dde2e7',
    borderRadius: 16,
    overflow: 'hidden',
  },

  threadList: {
    borderRight:
      '1px solid #e2e5e8',
    overflowY: 'auto',
    maxHeight: '78vh',
  },

  inboxTitle: {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    background: '#ffffff',
    borderBottom:
      '1px solid #e5e7eb',
    padding: 16,
    fontWeight: 900,
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'center',
  },

  inboxCount: {
    display: 'inline-flex',
    minWidth: 25,
    height: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    background: '#edf3fb',
    color: '#17457f',
    fontSize: 11,
  },

  threadButton: {
    width: '100%',
    textAlign: 'left',
    border: 0,
    borderBottom:
      '1px solid #e8eaed',
    background: '#ffffff',
    padding: 16,
    cursor: 'pointer',
  },

  selectedThread: {
    background: '#edf4ff',
    borderLeft:
      '4px solid #17457f',
  },

  threadTop: {
    display: 'flex',
    justifyContent:
      'space-between',
    gap: 10,
  },

  unreadBadge: {
    background: '#17457f',
    color: '#ffffff',
    minWidth: 20,
    height: 20,
    borderRadius: 20,
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 11,
    fontWeight: 900,
  },

  bookingCode: {
    marginTop: 5,
    color: '#17457f',
    fontSize: 12,
    fontWeight: 800,
  },

  propertyName: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: 700,
  },

  messagePreview: {
    marginTop: 8,
    color: '#687080',
    fontSize: 12,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  threadTime: {
    marginTop: 7,
    color: '#9aa1aa',
    fontSize: 10,
  },

  conversation: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },

  conversationHeader: {
    background: '#ffffff',
    borderBottom:
      '1px solid #e2e5e8',
    padding: 18,
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'center',
    gap: 15,
  },

  guestName: {
    margin: 0,
  },

  bookingInfo: {
    marginTop: 5,
    color: '#17457f',
    fontWeight: 700,
    fontSize: 13,
  },

  contactInfo: {
    marginTop: 4,
    color: '#687080',
    fontSize: 12,
  },

  bookingLink: {
    color: '#17457f',
    fontWeight: 800,
    textDecoration: 'none',
  },

  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: 20,
    background: '#f8fafc',
    maxHeight: '60vh',
  },

  guestBubble: {
    width: 'fit-content',
    maxWidth: '75%',
    background: '#ffffff',
    border:
      '1px solid #dfe4e9',
    borderRadius:
      '14px 14px 14px 4px',
    padding: 12,
    marginBottom: 12,
  },

  hostBubble: {
    width: 'fit-content',
    maxWidth: '75%',
    marginLeft: 'auto',
    background: '#e8f1ff',
    border:
      '1px solid #c7daf5',
    borderRadius:
      '14px 14px 4px 14px',
    padding: 12,
    marginBottom: 12,
  },

  systemBubble: {
    maxWidth: '80%',
    margin: '10px auto',
    textAlign: 'center',
    background: '#fff6dd',
    color: '#66501b',
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
  },

  senderName: {
    fontSize: 11,
    color: '#17457f',
    fontWeight: 900,
    marginBottom: 5,
  },

  messageText: {
    whiteSpace: 'pre-wrap',
    lineHeight: 1.45,
  },

  messageTime: {
    marginTop: 6,
    color: '#929aa4',
    fontSize: 10,
  },

  replyBox: {
    display: 'grid',
    gridTemplateColumns:
      '1fr auto',
    gap: 10,
    padding: 15,
    borderTop:
      '1px solid #e2e5e8',
    background: '#ffffff',
  },

  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    minHeight: 70,
    resize: 'vertical',
    padding: 11,
    border:
      '1px solid #ccd1d8',
    borderRadius: 9,
  },

  sendButton: {
    alignSelf: 'end',
    border: 0,
    background: '#17457f',
    color: '#ffffff',
    borderRadius: 9,
    padding: '13px 20px',
    fontWeight: 900,
    cursor: 'pointer',
  },

  noSelection: {
    padding: 40,
    color: '#687080',
  },

  emptyConversation: {
    textAlign: 'center',
    color: '#687080',
    padding: 30,
  },

  empty: {
    padding: 25,
    color: '#687080',
  },

  adminLink: {
    display: 'inline-block',
    marginTop: 12,
    background: '#17457f',
    color: '#ffffff',
    textDecoration: 'none',
    padding: '10px 15px',
    borderRadius: 8,
  },
};