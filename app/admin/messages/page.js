'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useSearchParams } from 'next/navigation';

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
  const searchParams = useSearchParams();

  const requestedBookingId =
    searchParams.get('booking');

  const [session, setSession] =
    useState(null);

  const [adminProfile, setAdminProfile] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [bookings, setBookings] =
    useState([]);

  const [messages, setMessages] =
    useState([]);

  const [
    selectedBookingId,
    setSelectedBookingId,
  ] = useState('');

  const [reply, setReply] =
    useState('');

  const [sending, setSending] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState('');

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
          'Admin access not available.'
        );
      }

      setAdminProfile(profile);

      await loadInbox();
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

  async function loadInbox() {
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
      setMessages([]);
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
    ] =
      await Promise.all([
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

    if (propertiesResult.error) {
      throw propertiesResult.error;
    }

    if (guestsResult.error) {
      throw guestsResult.error;
    }

    if (messagesResult.error) {
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

    const validRequestedBooking =
      requestedBookingId &&
      enrichedBookings.some(
        (booking) =>
          booking.id ===
          requestedBookingId
      );

    if (validRequestedBooking) {
      setSelectedBookingId(
        requestedBookingId
      );
    } else if (
      !selectedBookingId &&
      enrichedBookings.length
    ) {
      setSelectedBookingId(
        enrichedBookings[0].id
      );
    }
  }

  const threads =
    useMemo(() => {
      return bookings.map(
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

          return {
            booking,
            messages:
              bookingMessages,

            lastMessage,

            displayTime:
              lastMessage?.created_at ||
              booking.created_at,
          };
        }
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
        error,
      } =
        await supabase
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

      setReply('');

      await loadInbox();
    } catch (error) {
      setErrorMessage(
        `Unable to send message: ${error.message}`
      );
    } finally {
      setSending(false);
    }
  }

  async function markThreadRead(
    bookingId
  ) {
    setSelectedBookingId(
      bookingId
    );

    await supabase
      .from(
        'booking_messages'
      )
      .update({
        is_read:
          true,
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
                  is_read:
                    true,
                }
              : item
        )
    );
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
        Admin login required.
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.container}>
        <div style={styles.headingRow}>
          <div>
            <h1 style={styles.heading}>
              Messages
            </h1>

            <p style={styles.muted}>
              All guest conversations linked to booking requests.
            </p>
          </div>

          <button
            type="button"
            onClick={
              loadInbox
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
            {threads.length === 0 ? (
              <div style={styles.empty}>
                No conversations yet.
              </div>
            ) : (
              threads.map(
                ({
                  booking,
                  lastMessage,
                  displayTime,
                  messages:
                    threadMessages,
                }) => {
                  const unread =
                    threadMessages.filter(
                      (item) =>
                        item.sender_type ===
                          'guest' &&
                        !item.is_read
                    ).length;

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
                        markThreadRead(
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
                Select a conversation.
              </div>
            ) : (
              <>
                <div style={styles.conversationHeader}>
                  <div>
                    <h2 style={styles.guestName}>
                      {selectedThread.booking
                        .guest?.full_name ||
                        'Guest'}
                    </h2>

                    <div style={styles.muted}>
                      {
                        selectedThread.booking
                          .booking_code
                      }
                      {' · '}
                      {selectedThread.booking
                        .property?.name ||
                        ''}
                    </div>

                    <div style={styles.muted}>
                      {
                        selectedThread.booking
                          .guest?.phone
                      }
                      {selectedThread.booking
                        .guest?.email
                        ? ` · ${selectedThread.booking.guest.email}`
                        : ''}
                    </div>
                  </div>

                  <a
                    href={`/admin/bookings`}
                    style={styles.bookingLink}
                  >
                    View Booking
                  </a>
                </div>

                <div style={styles.messagesArea}>
                  {selectedThread.booking
                    .notes && (
                    <MessageBubble
                      senderType="guest"
                      senderName={
                        selectedThread.booking
                          .guest?.full_name ||
                        'Guest'
                      }
                      message={
                        selectedThread.booking
                          .notes
                      }
                      time="Original booking message"
                    />
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
                    placeholder="Type your reply..."
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
                    style={styles.sendButton}
                  >
                    {sending
                      ? 'Sending...'
                      : 'Send'}
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

      <div>
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
    fontFamily: 'Arial, sans-serif',
  },

  loading: {
    padding: 40,
    fontFamily: 'Arial, sans-serif',
  },

  container: {
    padding: '35px 3vw 70px',
  },

  headingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
    flexWrap: 'wrap',
    marginBottom: 22,
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
    gridTemplateColumns: '360px minmax(0, 1fr)',
    minHeight: '70vh',
    background: '#ffffff',
    border: '1px solid #dde2e7',
    borderRadius: 16,
    overflow: 'hidden',
  },

  threadList: {
    borderRight: '1px solid #e2e5e8',
    overflowY: 'auto',
    maxHeight: '75vh',
  },

  threadButton: {
    width: '100%',
    textAlign: 'left',
    border: 0,
    borderBottom: '1px solid #e8eaed',
    background: '#ffffff',
    padding: 16,
    cursor: 'pointer',
  },

  selectedThread: {
    background: '#edf4ff',
  },

  threadTop: {
    display: 'flex',
    justifyContent: 'space-between',
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
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },

  conversationHeader: {
    padding: 18,
    borderBottom: '1px solid #e2e5e8',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 15,
  },

  guestName: {
    margin: 0,
  },

  bookingLink: {
    textDecoration: 'none',
    color: '#17457f',
    fontWeight: 800,
  },

  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: 20,
    background: '#f8fafc',
  },

  guestBubble: {
    width: 'fit-content',
    maxWidth: '75%',
    background: '#ffffff',
    border: '1px solid #dfe4e9',
    borderRadius: '14px 14px 14px 4px',
    padding: 12,
    marginBottom: 12,
  },

  hostBubble: {
    width: 'fit-content',
    maxWidth: '75%',
    marginLeft: 'auto',
    background: '#e8f1ff',
    border: '1px solid #c7daf5',
    borderRadius: '14px 14px 4px 14px',
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

  messageTime: {
    marginTop: 6,
    color: '#929aa4',
    fontSize: 10,
  },

  replyBox: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 10,
    padding: 15,
    borderTop: '1px solid #e2e5e8',
    background: '#ffffff',
  },

  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    minHeight: 65,
    resize: 'vertical',
    padding: 11,
    border: '1px solid #ccd1d8',
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

  empty: {
    padding: 25,
    color: '#687080',
  },
};