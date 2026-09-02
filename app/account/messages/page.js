'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useSearchParams,
} from 'next/navigation';

import {
  createClient,
} from '@supabase/supabase-js';

const supabase =
  createClient(
    'https://gxwemplbykjxhezefykh.supabase.co',
    'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
  );

function formatDateTime(value) {
  if (!value) {
    return '';
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
    return value;
  }
}

function formatDate(value) {
  if (!value) {
    return '';
  }

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

export default function GuestMessagesPage() {
  const searchParams =
    useSearchParams();

  const requestedBooking =
    searchParams.get(
      'booking'
    );

  const [
    session,
    setSession,
  ] = useState(null);

  const [
    guestProfile,
    setGuestProfile,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    bookings,
    setBookings,
  ] = useState([]);

  const [
    messages,
    setMessages,
  ] = useState([]);

  const [
    selectedBookingId,
    setSelectedBookingId,
  ] = useState('');

  const [
    reply,
    setReply,
  ] = useState('');

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  useEffect(() => {
    initialise();
  }, []);

  useEffect(() => {
    if (
      !session?.user ||
      !guestProfile?.id
    ) {
      return;
    }

    const channel =
      supabase
        .channel(
          `guest-messages-${guestProfile.id}`
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table:
              'booking_messages',
          },
          () => {
            loadInbox(
              selectedBookingId
            );
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    session,
    guestProfile,
    selectedBookingId,
  ]);

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

      if (
        sessionError
      ) {
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

      const {
        data:
          guestRows,
        error:
          guestError,
      } =
        await supabase
          .from(
            'guests'
          )
          .select(
            'id, user_id, full_name, phone, email'
          )
          .eq(
            'user_id',
            user.id
          )
          .limit(1);

      if (
        guestError
      ) {
        throw guestError;
      }

      let guest =
        guestRows?.[0] ||
        null;

      /*
        Older guest profiles may not
        yet contain user_id.

        Use email as a safe fallback.
      */
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
            .from(
              'guests'
            )
            .select(
              'id, user_id, full_name, phone, email'
            )
            .eq(
              'email',
              user.email
            )
            .limit(1);

        if (
          emailError
        ) {
          throw emailError;
        }

        guest =
          emailGuests?.[0] ||
          null;
      }

      if (!guest) {
        setErrorMessage(
          'Guest profile not found for this login.'
        );

        return;
      }

      setGuestProfile(
        guest
      );

      await loadInbox(
        '',
        guest
      );
    } catch (error) {
      console.error(
        error
      );

      setErrorMessage(
        error.message ||
          'Unable to load messages.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadInbox(
    preferredBookingId = '',
    profileOverride = null
  ) {
    const profile =
      profileOverride ||
      guestProfile;

    if (!profile?.id) {
      return;
    }

    try {
      setErrorMessage('');

      const {
        data:
          bookingRows,
        error:
          bookingError,
      } =
        await supabase
          .from(
            'bookings'
          )
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
            total_amount,
            final_payable_amount,
            created_at,
            properties (
              id,
              name,
              location_name
            )
          `)
          .eq(
            'guest_id',
            profile.id
          )
          .order(
            'created_at',
            {
              ascending:
                false,
            }
          );

      if (
        bookingError
      ) {
        throw bookingError;
      }

      const rows =
        bookingRows ||
        [];

      setBookings(
        rows
      );

      if (
        rows.length ===
        0
      ) {
        setMessages([]);
        setSelectedBookingId('');
        return;
      }

      const bookingIds =
        rows.map(
          (booking) =>
            booking.id
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
              ascending:
                true,
            }
          );

      if (
        messageError
      ) {
        throw messageError;
      }

      setMessages(
        messageRows ||
          []
      );

      let targetId =
        preferredBookingId ||
        selectedBookingId;

      if (
        requestedBooking
      ) {
        const requested =
          rows.find(
            (booking) =>
              booking.id ===
                requestedBooking ||
              booking.booking_code ===
                requestedBooking
          );

        if (requested) {
          targetId =
            requested.id;
        }
      }

      if (
        !targetId ||
        !rows.some(
          (booking) =>
            booking.id ===
            targetId
        )
      ) {
        targetId =
          rows[0].id;
      }

      setSelectedBookingId(
        targetId
      );

      await markHostMessagesRead(
        targetId
      );
    } catch (error) {
      console.error(
        error
      );

      setErrorMessage(
        error.message ||
          'Unable to load conversations.'
      );
    }
  }

  async function markHostMessagesRead(
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
      (previous) =>
        previous.map(
          (item) =>
            item.booking_id ===
              bookingId &&
            item.sender_type ===
              'host'
              ? {
                  ...item,
                  is_read: true,
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

    await markHostMessagesRead(
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
      return bookings.map(
        (booking) => {
          const threadMessages =
            messages.filter(
              (message) =>
                message.booking_id ===
                booking.id
            );

          const lastMessage =
            threadMessages.length
              ? threadMessages[
                  threadMessages.length -
                    1
                ]
              : null;

          const unread =
            threadMessages.filter(
              (message) =>
                message.sender_type ===
                  'host' &&
                !message.is_read
            ).length;

          return {
            booking,
            messages:
              threadMessages,
            lastMessage,
            unread,
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
                .booking
                .id,

            sender_type:
              'guest',

            sender_name:
              guestProfile
                ?.full_name ||
              session?.user
                ?.email ||
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

      setReply('');

      setMessages(
        (previous) => [
          ...previous,
          data,
        ]
      );
    } catch (error) {
      console.error(
        error
      );

      setErrorMessage(
        error.message ||
          'Unable to send message.'
      );
    } finally {
      setSending(false);
    }
  }

  function getBookingStatus(
    booking
  ) {
    const paid =
      String(
        booking.payment_status ||
          ''
      ).toLowerCase() ===
      'paid';

    if (paid) {
      return 'Booking Confirmed';
    }

    const decision =
      String(
        booking.host_decision ||
          ''
      ).toLowerCase();

    if (
      decision ===
      'approved'
    ) {
      return 'Host Approved';
    }

    if (
      decision ===
      'declined'
    ) {
      return 'Declined';
    }

    if (
      booking.offer_status ===
      'host_offered'
    ) {
      return 'Special Offer Sent';
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
            styles.headingRow
          }
        >
          <div>
            <h1
              style={
                styles.heading
              }
            >
              Messages
            </h1>

            <p
              style={
                styles.muted
              }
            >
              Chat with the host about your booking requests and stays.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              loadInbox(
                selectedBookingId
              )
            }
            style={
              styles.refreshButton
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

        {threads.length ===
        0 ? (
          <div
            style={
              styles.emptyState
            }
          >
            <div
              style={
                styles.emptyIcon
              }
            >
              💬
            </div>

            <h2>
              No conversations yet
            </h2>

            <p>
              Your booking conversations will appear here after you send a booking request.
            </p>

            <a
              href="/"
              style={
                styles.browseButton
              }
            >
              Browse Properties
            </a>
          </div>
        ) : (
          <div
            style={
              styles.messagingLayout
            }
          >

            <aside
              style={
                styles.threadList
              }
            >
              <div
                style={
                  styles.inboxTitle
                }
              >
                Conversations

                <span
                  style={
                    styles.inboxCount
                  }
                >
                  {threads.length}
                </span>
              </div>

              {threads.map(
                (thread) => {
                  const selected =
                    thread.booking.id ===
                    selectedBookingId;

                  return (
                    <button
                      key={
                        thread.booking.id
                      }
                      type="button"
                      onClick={() =>
                        openThread(
                          thread.booking.id
                        )
                      }
                      style={{
                        ...styles.threadButton,

                        ...(selected
                          ? styles.selectedThread
                          : {}),
                      }}
                    >

                      <div
                        style={
                          styles.threadTop
                        }
                      >
                        <strong>
                          {thread.booking
                            .properties
                            ?.name ||
                            'Property'}
                        </strong>

                        {thread.unread >
                          0 && (
                          <span
                            style={
                              styles.unreadBadge
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
                          styles.bookingCode
                        }
                      >
                        {thread.booking
                          .booking_code ||
                          'Booking'}
                      </div>

                      <div
                        style={
                          styles.threadPreview
                        }
                      >
                        {thread
                          .lastMessage
                          ?.message ||
                          'Booking conversation'}
                      </div>

                      <div
                        style={
                          styles.threadBottom
                        }
                      >
                        <span>
                          {getBookingStatus(
                            thread.booking
                          )}
                        </span>

                        <span>
                          {formatDateTime(
                            thread.displayTime
                          )}
                        </span>
                      </div>

                    </button>
                  );
                }
              )}
            </aside>

            <section
              style={
                styles.conversation
              }
            >

              {!selectedThread ? (
                <div
                  style={
                    styles.noSelection
                  }
                >
                  Select a conversation.
                </div>
              ) : (
                <>

                  <div
                    style={
                      styles.conversationHeader
                    }
                  >
                    <div>
                      <h2
                        style={
                          styles.propertyName
                        }
                      >
                        {selectedThread
                          .booking
                          .properties
                          ?.name ||
                          'Property'}
                      </h2>

                      <div
                        style={
                          styles.bookingInfo
                        }
                      >
                        {selectedThread
                          .booking
                          .booking_code}

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

                      <div
                        style={
                          styles.statusPill
                        }
                      >
                        {getBookingStatus(
                          selectedThread
                            .booking
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
                      styles.messagesArea
                    }
                  >
                    {selectedThread
                      .messages
                      .length ===
                      0 && (
                      <div
                        style={
                          styles.emptyConversation
                        }
                      >
                        No messages yet.
                      </div>
                    )}

                    {selectedThread
                      .messages
                      .map(
                        (
                          message
                        ) => (
                          <MessageBubble
                            key={
                              message.id
                            }
                            senderType={
                              message.sender_type
                            }
                            senderName={
                              message.sender_name
                            }
                            message={
                              message.message
                            }
                            time={
                              formatDateTime(
                                message.created_at
                              )
                            }
                          />
                        )
                      )}
                  </div>

                  <div
                    style={
                      styles.replyBox
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
                      placeholder="Type your message to the host..."
                      style={
                        styles.textarea
                      }
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
                        : 'Send'}
                    </button>
                  </div>

                </>
              )}

            </section>

          </div>
        )}

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
      <div
        style={
          styles.systemBubble
        }
      >
        <div>
          {message}
        </div>

        <div
          style={
            styles.messageTime
          }
        >
          {time}
        </div>
      </div>
    );
  }

  const guest =
    senderType ===
    'guest';

  return (
    <div
      style={{
        ...styles.messageRow,

        justifyContent:
          guest
            ? 'flex-end'
            : 'flex-start',
      }}
    >
      <div
        style={{
          ...styles.messageBubble,

          ...(guest
            ? styles.guestBubble
            : styles.hostBubble),
        }}
      >
        <div
          style={
            styles.senderName
          }
        >
          {senderName ||
            (guest
              ? 'You'
              : 'Host')}
        </div>

        <div
          style={
            styles.messageText
          }
        >
          {message}
        </div>

        <div
          style={
            styles.messageTime
          }
        >
          {time}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight:
      '100vh',

    background:
      '#f5f7fa',

    color:
      '#102a43',

    fontFamily:
      'Arial, sans-serif',
  },

  loading: {
    minHeight:
      '70vh',

    display:
      'flex',

    alignItems:
      'center',

    justifyContent:
      'center',

    fontFamily:
      'Arial, sans-serif',

    color:
      '#174f91',

    fontWeight:
      700,
  },

  container: {
    width:
      '94%',

    maxWidth:
      1250,

    margin:
      '0 auto',

    padding:
      '30px 0 70px',
  },

  headingRow: {
    display:
      'flex',

    alignItems:
      'flex-end',

    justifyContent:
      'space-between',

    gap:
      20,

    flexWrap:
      'wrap',

    marginBottom:
      22,
  },

  heading: {
    margin: 0,

    fontSize: 30,
  },

  muted: {
    margin:
      '7px 0 0',

    color:
      '#667085',
  },

  refreshButton: {
    border:
      '1px solid #174f91',

    background:
      '#ffffff',

    color:
      '#174f91',

    borderRadius:
      9,

    padding:
      '10px 16px',

    fontWeight:
      800,

    cursor:
      'pointer',
  },

  error: {
    marginBottom:
      18,

    padding:
      13,

    background:
      '#fdeaea',

    color:
      '#9c2d2d',

    borderRadius:
      9,

    fontWeight:
      700,
  },

  messagingLayout: {
    display:
      'grid',

    gridTemplateColumns:
      '330px minmax(0, 1fr)',

    minHeight:
      620,

    background:
      '#ffffff',

    border:
      '1px solid #dfe4ea',

    borderRadius:
      16,

    overflow:
      'hidden',
  },

  threadList: {
    borderRight:
      '1px solid #e4e7ec',

    background:
      '#fbfcfe',

    overflowY:
      'auto',
  },

  inboxTitle: {
    padding:
      '18px',

    borderBottom:
      '1px solid #e4e7ec',

    fontWeight:
      800,

    display:
      'flex',

    alignItems:
      'center',

    justifyContent:
      'space-between',
  },

  inboxCount: {
    background:
      '#174f91',

    color:
      '#ffffff',

    borderRadius:
      999,

    padding:
      '4px 8px',

    fontSize:
      11,
  },

  threadButton: {
    width:
      '100%',

    border: 0,

    borderBottom:
      '1px solid #edf0f3',

    background:
      '#ffffff',

    padding:
      16,

    textAlign:
      'left',

    cursor:
      'pointer',

    color:
      '#102a43',
  },

  selectedThread: {
    background:
      '#eef5fc',

    borderLeft:
      '4px solid #174f91',
  },

  threadTop: {
    display:
      'flex',

    alignItems:
      'center',

    justifyContent:
      'space-between',

    gap:
      10,
  },

  unreadBadge: {
    background:
      '#d92d20',

    color:
      '#ffffff',

    minWidth:
      20,

    height:
      20,

    borderRadius:
      999,

    display:
      'inline-flex',

    alignItems:
      'center',

    justifyContent:
      'center',

    fontSize:
      10,

    fontWeight:
      800,
  },

  bookingCode: {
    marginTop:
      5,

    fontSize:
      11,

    color:
      '#174f91',

    fontWeight:
      700,
  },

  threadPreview: {
    marginTop:
      9,

    color:
      '#667085',

    fontSize:
      12,

    whiteSpace:
      'nowrap',

    overflow:
      'hidden',

    textOverflow:
      'ellipsis',
  },

  threadBottom: {
    marginTop:
      10,

    display:
      'flex',

    justifyContent:
      'space-between',

    gap:
      10,

    color:
      '#667085',

    fontSize:
      9,
  },

  conversation: {
    minWidth: 0,

    display:
      'flex',

    flexDirection:
      'column',

    background:
      '#ffffff',
  },

  conversationHeader: {
    padding:
      20,

    borderBottom:
      '1px solid #e4e7ec',

    display:
      'flex',

    justifyContent:
      'space-between',

    alignItems:
      'flex-start',

    gap:
      15,
  },

  propertyName: {
    margin: 0,

    fontSize:
      20,
  },

  bookingInfo: {
    marginTop:
      6,

    color:
      '#667085',

    fontSize:
      12,
  },

  statusPill: {
    display:
      'inline-block',

    marginTop:
      9,

    padding:
      '6px 10px',

    borderRadius:
      999,

    background:
      '#eef5fc',

    color:
      '#174f91',

    fontSize:
      11,

    fontWeight:
      800,
  },

  bookingLink: {
    textDecoration:
      'none',

    color:
      '#174f91',

    fontWeight:
      800,

    fontSize:
      12,
  },

  messagesArea: {
    flex: 1,

    padding:
      20,

    overflowY:
      'auto',

    background:
      '#f8fafc',
  },

  messageRow: {
    display:
      'flex',

    marginBottom:
      12,
  },

  messageBubble: {
    maxWidth:
      '75%',

    padding:
      '11px 13px',

    borderRadius:
      14,

    boxShadow:
      '0 1px 2px rgba(0,0,0,0.05)',
  },

  guestBubble: {
    background:
      '#174f91',

    color:
      '#ffffff',

    borderBottomRightRadius:
      4,
  },

  hostBubble: {
    background:
      '#ffffff',

    border:
      '1px solid #dfe4ea',

    color:
      '#102a43',

    borderBottomLeftRadius:
      4,
  },

  senderName: {
    fontSize:
      9,

    fontWeight:
      800,

    opacity:
      0.8,

    marginBottom:
      4,
  },

  messageText: {
    fontSize:
      13,

    lineHeight:
      1.45,

    whiteSpace:
      'pre-wrap',
  },

  messageTime: {
    marginTop:
      6,

    fontSize:
      8,

    opacity:
      0.7,

    textAlign:
      'right',
  },

  systemBubble: {
    margin:
      '10px auto',

    maxWidth:
      '80%',

    background:
      '#fff8e7',

    color:
      '#715b1b',

    padding:
      '10px 13px',

    borderRadius:
      10,

    textAlign:
      'center',

    fontSize:
      11,
  },

  replyBox: {
    padding:
      16,

    borderTop:
      '1px solid #e4e7ec',

    display:
      'grid',

    gridTemplateColumns:
      '1fr auto',

    gap:
      10,

    background:
      '#ffffff',
  },

  textarea: {
    width:
      '100%',

    minHeight:
      70,

    resize:
      'vertical',

    padding:
      12,

    border:
      '1px solid #cfd6df',

    borderRadius:
      10,

    fontFamily:
      'Arial, sans-serif',

    boxSizing:
      'border-box',
  },

  sendButton: {
    border: 0,

    background:
      '#174f91',

    color:
      '#ffffff',

    padding:
      '0 22px',

    borderRadius:
      10,

    fontWeight:
      800,

    cursor:
      'pointer',
  },

  noSelection: {
    minHeight:
      500,

    display:
      'flex',

    alignItems:
      'center',

    justifyContent:
      'center',

    color:
      '#667085',
  },

  emptyConversation: {
    color:
      '#667085',

    textAlign:
      'center',

    marginTop:
      50,
  },

  emptyState: {
    background:
      '#ffffff',

    border:
      '1px solid #dfe4ea',

    borderRadius:
      16,

    padding:
      '60px 25px',

    textAlign:
      'center',

    maxWidth:
      650,

    margin:
      '40px auto',

    color:
      '#475467',
  },

  emptyIcon: {
    fontSize:
      42,
  },

  browseButton: {
    display:
      'inline-block',

    marginTop:
      15,

    padding:
      '12px 18px',

    background:
      '#174f91',

    color:
      '#ffffff',

    textDecoration:
      'none',

    borderRadius:
      9,

    fontWeight:
      800,
  },
};