'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  createClient,
} from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

function formatDate(value) {
  if (!value) return '';

  try {
    return new Date(
      `${value}T12:00:00`
    ).toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    );
  } catch {
    return value;
  }
}

function formatDateTime(value) {
  if (!value) return '';

  try {
    return new Date(
      value
    ).toLocaleString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }
    );
  } catch {
    return value;
  }
}

export default function GuestMessagesPage() {
  const [session, setSession] =
    useState(null);

  const [
    guestProfile,
    setGuestProfile,
  ] = useState(null);

  const [
    bookings,
    setBookings,
  ] = useState([]);

  const [
    properties,
    setProperties,
  ] = useState({});

  const [
    messages,
    setMessages,
  ] = useState([]);

  const [
    selectedBookingId,
    setSelectedBookingId,
  ] = useState('');

  const [loading, setLoading] =
    useState(true);

  const [reply, setReply] =
    useState('');

  const [sending, setSending] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const selectedBookingRef = useRef('');
  const syncInFlightRef = useRef(false);

  useEffect(() => {
    selectedBookingRef.current = selectedBookingId;
  }, [selectedBookingId]);

  useEffect(() => {
    initialise();
  }, []);

  useEffect(() => {
    if (
      !guestProfile?.id
    ) {
      return;
    }

    const channel =
      supabase
        .channel(
          `guest-chat-${guestProfile.id}-${Date.now()}`
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table:
              'booking_messages',
          },
          () => {
            loadInbox(
              guestProfile,
              selectedBookingRef.current
            );
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [guestProfile]);

  useEffect(() => {
    if (!guestProfile?.id) return;

    const sync = () => loadInbox(guestProfile, selectedBookingRef.current);
    const timer = window.setInterval(sync, 4000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') sync();
    };

    window.addEventListener('focus', sync);
    window.addEventListener('online', sync);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', sync);
      window.removeEventListener('online', sync);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [guestProfile]);

  async function initialise() {
    setLoading(true);
    setErrorMessage('');

    try {
      const {
        data: {
          session:
            currentSession,
        },
        error:
          sessionError,
      } =
        await supabase.auth
          .getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (
        !currentSession?.user
      ) {
        window.location.href =
          '/';

        return;
      }

      setSession(
        currentSession
      );

      const user =
        currentSession.user;

      let guest = null;

      const {
        data:
          userGuests,
        error:
          userGuestError,
      } =
        await supabase
          .from('guests')
          .select(
            'id, full_name, phone, email, user_id'
          )
          .eq(
            'user_id',
            user.id
          )
          .limit(1);

      if (
        !userGuestError &&
        userGuests?.length
      ) {
        guest =
          userGuests[0];
      }

      if (
        !guest &&
        user.email
      ) {
        const {
          data:
            emailGuests,
          error:
            emailError,
        } =
          await supabase
            .from('guests')
            .select(
              'id, full_name, phone, email, user_id'
            )
            .eq(
              'email',
              user.email
            )
            .limit(1);

        if (emailError) {
          throw emailError;
        }

        guest =
          emailGuests?.[0] ||
          null;
      }

      if (!guest) {
        throw new Error(
          'Guest profile not found.'
        );
      }

      setGuestProfile(
        guest
      );

      await loadInbox(
        guest
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
    guest,
    preferredBookingId = ''
  ) {
    if (!guest?.id) {
      return;
    }

    const {
      data:
        bookingRows,
      error:
        bookingError,
    } =
      await supabase
        .from('bookings')
        .select(`
          id,
          booking_code,
          property_id,
          guest_id,
          check_in,
          check_out,
          guests_count,
          booking_status,
          payment_status,
          host_decision,
          offer_status,
          created_at
        `)
        .eq(
          'guest_id',
          guest.id
        )
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

    setBookings(rows);

    if (!rows.length) {
      setMessages([]);
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

    if (
      propertyIds.length
    ) {
      const {
        data:
          propertyRows,
      } =
        await supabase
          .from('properties')
          .select(
            'id, name, location_name'
          )
          .in(
            'id',
            propertyIds
          );

      const propertyMap = {};

      (
        propertyRows || []
      ).forEach(
        (property) => {
          propertyMap[
            property.id
          ] = property;
        }
      );

      setProperties(
        propertyMap
      );
    }

    const bookingIds =
      rows.map(
        (item) =>
          item.id
      );

    const {
      data:
        messageRows,
      error:
        messageError,
    } =
      await supabase
        .from(
          'booking_messages'
        )
        .select(`
          id,
          booking_id,
          sender_type,
          sender_name,
          message,
          message_type,
          is_read,
          created_at
        `)
        .in(
          'booking_id',
          bookingIds
        )
        .order(
          'created_at',
          {
            ascending: true,
          }
        );

    if (messageError) {
      throw messageError;
    }

    setMessages(
      messageRows || []
    );

    let target =
      preferredBookingId;

    if (
      typeof window !==
      'undefined'
    ) {
      const params =
        new URLSearchParams(
          window.location.search
        );

      const requested =
        params.get(
          'booking'
        );

      if (requested) {
        const match =
          rows.find(
            (booking) =>
              booking.id ===
                requested ||
              booking.booking_code ===
                requested
          );

        if (match) {
          target =
            match.id;
        }
      }
    }

    if (
      !target ||
      !rows.some(
        (booking) =>
          booking.id ===
          target
      )
    ) {
      target =
        rows[0].id;
    }

    setSelectedBookingId(
      target
    );

    await markRead(
      target
    );
  }

  async function markRead(
    bookingId
  ) {
    if (!bookingId) {
      return;
    }

    await supabase
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
        'host'
      )
      .eq(
        'is_read',
        false
      );

    setMessages(
      (old) =>
        old.map(
          (item) =>
            item.booking_id ===
              bookingId &&
            item.sender_type ===
              'host'
              ? {
                  ...item,
                  is_read:
                    true,
                }
              : item
        )
    );
  }

  async function openThread(
    bookingId
  ) {
    setSelectedBookingId(
      bookingId
    );

    setReply('');

    await markRead(
      bookingId
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

  const threads =
    useMemo(() => {
      const rows = bookings.map(
        (booking) => {
          const list =
            messages.filter(
              (message) =>
                message.booking_id ===
                booking.id
            );

          const last =
            list.length
              ? list[
                  list.length -
                    1
                ]
              : null;

          const unread =
            list.filter(
              (message) =>
                message.sender_type ===
                  'host' &&
                !message.is_read
            ).length;

          return {
            booking,
            messages:
              list,
            last,
            unread,
          };
        }
      );

      rows.sort((a, b) => {
        const aTime = new Date(a.last?.created_at || a.booking.created_at || 0).getTime();
        const bTime = new Date(b.last?.created_at || b.booking.created_at || 0).getTime();
        return bTime - aTime;
      });

      return rows;
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

  async function sendMessage() {
    const text =
      reply.trim();

    if (
      !text ||
      !selectedThread ||
      sending
    ) {
      return;
    }

    setSending(true);
    setErrorMessage('');

    try {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            'booking_messages'
          )
          .insert({
            booking_id:
              selectedThread
                .booking.id,

            sender_type:
              'guest',

            sender_name:
              guestProfile
                ?.full_name ||
              'Guest',

            message:
              text,

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

      setMessages((old) => old.some((item) => item.id === data.id) ? old : [...old, data]);

      setReply('');
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error.message ||
          'Unable to send message.'
      );
    } finally {
      setSending(false);
    }
  }

  function bookingStatus(
    booking
  ) {
    if (
      booking.payment_status ===
      'paid'
    ) {
      return 'Booking Confirmed';
    }

    if (
      booking.host_decision ===
      'approved'
    ) {
      return 'Host Approved';
    }

    if (
      booking.host_decision ===
      'declined'
    ) {
      return 'Declined';
    }

    if (
      booking.offer_status ===
      'host_offered'
    ) {
      return 'Special Offer';
    }

    return 'Booking Requested';
  }

  if (loading) {
    return (
      <main
        style={
          styles.loading
        }
      >
        Loading messages...
      </main>
    );
  }

  return (
    <main
      style={
        styles.page
      }
    >
      <section
        style={
          styles.container
        }
      >
        <div
          style={
            styles.titleRow
          }
        >
          <div>
            <h1
              style={
                styles.title
              }
            >
              Messages
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              Chat with the host about your booking.
            </p>
          </div>

          <button
            type="button"
            style={
              styles.refresh
            }
            onClick={() =>
              loadInbox(
                guestProfile,
                selectedBookingId
              )
            }
          >
            Refresh
          </button>
        </div>

        {errorMessage && (
          <div
            style={
              styles.error
            }
          >
            {errorMessage}
          </div>
        )}

        {!threads.length ? (
          <div
            style={
              styles.empty
            }
          >
            <div
              style={{
                fontSize: 42,
              }}
            >
              💬
            </div>

            <h2>
              No conversations
            </h2>

            <p>
              Booking conversations will appear here.
            </p>

            <a
              href="/"
              style={
                styles.browse
              }
            >
              Browse Properties
            </a>
          </div>
        ) : (
          <div
            style={
              styles.layout
            }
          >
            <aside
              style={
                styles.threads
              }
            >
              <div
                style={
                  styles.threadHeading
                }
              >
                Conversations
              </div>

              {threads.map(
                (thread) => {
                  const property =
                    properties[
                      thread
                        .booking
                        .property_id
                    ];

                  const selected =
                    thread.booking
                      .id ===
                    selectedBookingId;

                  return (
                    <button
                      key={
                        thread
                          .booking.id
                      }
                      type="button"
                      onClick={() =>
                        openThread(
                          thread
                            .booking.id
                        )
                      }
                      style={{
                        ...styles.thread,

                        ...(selected
                          ? styles.selected
                          : {}),
                      }}
                    >
                      <div
                        style={
                          styles.threadTop
                        }
                      >
                        <strong>
                          {property
                            ?.name ||
                            'Property'}
                        </strong>

                        {thread.unread >
                          0 && (
                          <span
                            style={
                              styles.badge
                            }
                          >
                            {
                              thread.unread
                            }
                          </span>
                        )}
                      </div>

                      <div
                        style={
                          styles.code
                        }
                      >
                        {
                          thread
                            .booking
                            .booking_code
                        }
                      </div>

                      <div
                        style={
                          styles.preview
                        }
                      >
                        {thread.last
                          ?.message ||
                          'Booking conversation'}
                      </div>

                      <div
                        style={
                          styles.status
                        }
                      >
                        {bookingStatus(
                          thread.booking
                        )}
                      </div>
                    </button>
                  );
                }
              )}
            </aside>

            <section
              style={
                styles.chat
              }
            >
              {selectedThread ? (
                <>
                  <div
                    style={
                      styles.chatHeader
                    }
                  >
                    <div>
                      <h2
                        style={{
                          margin: 0,
                        }}
                      >
                        {properties[
                          selectedThread
                            .booking
                            .property_id
                        ]?.name ||
                          'Property'}
                      </h2>

                      <div
                        style={
                          styles.bookingInfo
                        }
                      >
                        {
                          selectedThread
                            .booking
                            .booking_code
                        }

                        {' · '}

                        {formatDate(
                          selectedThread
                            .booking
                            .check_in
                        )}

                        {' → '}

                        {formatDate(
                          selectedThread
                            .booking
                            .check_out
                        )}
                      </div>
                    </div>

                    <a
                      href="/account/bookings"
                      style={
                        styles.bookingLink
                      }
                    >
                      My Bookings
                    </a>
                  </div>

                  <div
                    style={
                      styles.messages
                    }
                  >
                    {!selectedThread
                      .messages
                      .length && (
                      <div
                        style={
                          styles.noMessages
                        }
                      >
                        No messages yet.
                      </div>
                    )}

                    {selectedThread
                      .messages
                      .map(
                        (message) => (
                          <Bubble
                            key={
                              message.id
                            }
                            message={
                              message
                            }
                          />
                        )
                      )}
                  </div>

                  <div
                    style={
                      styles.reply
                    }
                  >
                    <textarea
                      value={
                        reply
                      }
                      onChange={(
                        event
                      ) =>
                        setReply(
                          event
                            .target
                            .value
                        )
                      }
                      placeholder="Write a message to the host..."
                      style={
                        styles.textarea
                      }
                    />

                    <button
                      type="button"
                      disabled={
                        sending ||
                        !reply.trim()
                      }
                      onClick={
                        sendMessage
                      }
                      style={{
                        ...styles.send,

                        opacity:
                          sending ||
                          !reply.trim()
                            ? 0.5
                            : 1,
                      }}
                    >
                      {sending
                        ? 'Sending...'
                        : 'Send'}
                    </button>
                  </div>
                </>
              ) : (
                <div
                  style={
                    styles.noMessages
                  }
                >
                  Select a conversation.
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

function Bubble({
  message,
}) {
  const guest =
    message.sender_type ===
    'guest';

  const system =
    message.sender_type ===
    'system';

  if (system) {
    return (
      <div
        style={
          styles.systemMessage
        }
      >
        {message.message}

        <div
          style={
            styles.time
          }
        >
          {formatDateTime(
            message.created_at
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        ...styles.bubbleRow,

        justifyContent:
          guest
            ? 'flex-end'
            : 'flex-start',
      }}
    >
      <div
        style={{
          ...styles.bubble,

          ...(guest
            ? styles.guestBubble
            : styles.hostBubble),
        }}
      >
        <strong
          style={{
            fontSize: 10,
          }}
        >
          {guest
            ? 'You'
            : message.sender_name ||
              'Host'}
        </strong>

        <div
          style={{
            marginTop: 5,
          }}
        >
          {message.message}
        </div>

        <div
          style={
            styles.time
          }
        >
          {formatDateTime(
            message.created_at
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f5f7fa',
    fontFamily:
      'Arial, sans-serif',
    color: '#102a43',
  },

  loading: {
    minHeight: '70vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      'center',
    color: '#174f91',
    fontWeight: 700,
  },

  container: {
    width: '94%',
    maxWidth: 1250,
    margin: '0 auto',
    padding:
      '30px 0 70px',
  },

  titleRow: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'flex-end',
    gap: 15,
    flexWrap: 'wrap',
    marginBottom: 20,
  },

  title: {
    margin: 0,
    fontSize: 30,
  },

  subtitle: {
    color: '#667085',
    margin:
      '7px 0 0',
  },

  refresh: {
    background: '#fff',
    border:
      '1px solid #174f91',
    color: '#174f91',
    borderRadius: 9,
    padding:
      '10px 16px',
    fontWeight: 800,
    cursor: 'pointer',
  },

  error: {
    background: '#fdeaea',
    color: '#9c2d2d',
    borderRadius: 9,
    padding: 12,
    marginBottom: 16,
  },

  layout: {
    display: 'grid',
    gridTemplateColumns:
      '320px minmax(0, 1fr)',
    minHeight: 600,
    background: '#fff',
    border:
      '1px solid #dfe4ea',
    borderRadius: 16,
    overflow: 'hidden',
  },

  threads: {
    borderRight:
      '1px solid #e4e7ec',
  },

  threadHeading: {
    padding: 18,
    fontWeight: 800,
    borderBottom:
      '1px solid #e4e7ec',
  },

  thread: {
    width: '100%',
    border: 0,
    borderBottom:
      '1px solid #edf0f3',
    background: '#fff',
    textAlign: 'left',
    padding: 15,
    cursor: 'pointer',
  },

  selected: {
    background: '#eef5fc',
    borderLeft:
      '4px solid #174f91',
  },

  threadTop: {
    display: 'flex',
    justifyContent:
      'space-between',
    gap: 8,
  },

  badge: {
    background: '#d92d20',
    color: '#fff',
    borderRadius: 999,
    minWidth: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      'center',
    fontSize: 10,
  },

  code: {
    marginTop: 5,
    color: '#174f91',
    fontSize: 11,
    fontWeight: 700,
  },

  preview: {
    marginTop: 8,
    color: '#667085',
    fontSize: 12,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow:
      'ellipsis',
  },

  status: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: 700,
    color: '#475467',
  },

  chat: {
    minWidth: 0,
    display: 'flex',
    flexDirection:
      'column',
  },

  chatHeader: {
    padding: 18,
    borderBottom:
      '1px solid #e4e7ec',
    display: 'flex',
    justifyContent:
      'space-between',
    gap: 10,
  },

  bookingInfo: {
    marginTop: 6,
    color: '#667085',
    fontSize: 12,
  },

  bookingLink: {
    color: '#174f91',
    textDecoration:
      'none',
    fontWeight: 800,
  },

  messages: {
    flex: 1,
    padding: 20,
    background: '#f8fafc',
    overflowY: 'auto',
  },

  bubbleRow: {
    display: 'flex',
    marginBottom: 12,
  },

  bubble: {
    maxWidth: '75%',
    padding:
      '11px 13px',
    borderRadius: 14,
    fontSize: 13,
    lineHeight: 1.45,
  },

  guestBubble: {
    background: '#174f91',
    color: '#fff',
  },

  hostBubble: {
    background: '#fff',
    border:
      '1px solid #dfe4ea',
  },

  systemMessage: {
    maxWidth: '75%',
    margin:
      '10px auto',
    padding: 10,
    background: '#fff8e7',
    borderRadius: 9,
    textAlign: 'center',
    color: '#715b1b',
  },

  time: {
    marginTop: 6,
    fontSize: 8,
    opacity: 0.7,
  },

  reply: {
    padding: 15,
    borderTop:
      '1px solid #e4e7ec',
    display: 'grid',
    gridTemplateColumns:
      '1fr auto',
    gap: 10,
  },

  textarea: {
    width: '100%',
    minHeight: 65,
    border:
      '1px solid #ccd4dd',
    borderRadius: 9,
    padding: 11,
    boxSizing:
      'border-box',
    resize: 'vertical',
  },

  send: {
    border: 0,
    background: '#174f91',
    color: '#fff',
    borderRadius: 9,
    padding:
      '0 20px',
    fontWeight: 800,
    cursor: 'pointer',
  },

  noMessages: {
    flex: 1,
    minHeight: 300,
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      'center',
    color: '#667085',
  },

  empty: {
    maxWidth: 650,
    margin:
      '40px auto',
    background: '#fff',
    padding: 50,
    border:
      '1px solid #dfe4ea',
    borderRadius: 16,
    textAlign: 'center',
  },

  browse: {
    display:
      'inline-block',
    marginTop: 12,
    padding:
      '11px 17px',
    background: '#174f91',
    color: '#fff',
    borderRadius: 9,
    textDecoration:
      'none',
    fontWeight: 800,
  },
};