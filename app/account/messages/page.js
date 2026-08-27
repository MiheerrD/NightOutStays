'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  createClient,
} from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

function money(value) {
  return `₹${Number(
    value || 0
  ).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value) {
  if (!value) return '';

  try {
    return new Date(
      value
    ).toLocaleString(
      'en-IN',
      {
        dateStyle: 'medium',
        timeStyle: 'short',
      }
    );
  } catch {
    return value;
  }
}

function formatStayDate(value) {
  if (!value) {
    return '—';
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

function loadRazorpayScript() {
  return new Promise(
    (resolve) => {
      if (
        typeof window !==
        'undefined' &&
        window.Razorpay
      ) {
        resolve(true);
        return;
      }

      const existing =
        document.querySelector(
          'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
        );

      if (existing) {
        existing.addEventListener(
          'load',
          () => resolve(true)
        );

        existing.addEventListener(
          'error',
          () => resolve(false)
        );

        return;
      }

      const script =
        document.createElement(
          'script'
        );

      script.src =
        'https://checkout.razorpay.com/v1/checkout.js';

      script.async = true;

      script.onload = () =>
        resolve(true);

      script.onerror = () =>
        resolve(false);

      document.body.appendChild(
        script
      );
    }
  );
}

export default function GuestMessagesPage() {
  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState('');

  const [
    notice,
    setNotice,
  ] = useState('');

  const [
    session,
    setSession,
  ] = useState(null);

  const [
    guest,
    setGuest,
  ] = useState(null);

  const [
    bookings,
    setBookings,
  ] = useState([]);

  const [
    messages,
    setMessages,
  ] = useState([]);

  const [
    activeBookingId,
    setActiveBookingId,
  ] = useState('');

  const [
    messageText,
    setMessageText,
  ] = useState('');

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    showDiscountRequest,
    setShowDiscountRequest,
  ] = useState(false);

  const [
    discountText,
    setDiscountText,
  ] = useState('');

  const [
    discountSending,
    setDiscountSending,
  ] = useState(false);

  const [
    acceptingOffer,
    setAcceptingOffer,
  ] = useState(false);

  const [
    paymentLoading,
    setPaymentLoading,
  ] = useState(false);

  useEffect(
    () => {
      initialisePage();
    },
    []
  );

  useEffect(
    () => {
      if (
        activeBookingId
      ) {
        loadMessages(
          activeBookingId
        );
      }
    },
    [
      activeBookingId,
    ]
  );

  /*
    REALTIME MESSAGES
  */

  useEffect(
    () => {
      if (
        !activeBookingId
      ) {
        return;
      }

      const channel =
        supabase
          .channel(
            `guest-messages-${activeBookingId}`
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table:
                'booking_messages',
              filter:
                `booking_id=eq.${activeBookingId}`,
            },
            async () => {
              await loadMessages(
                activeBookingId
              );

              if (
                guest?.id
              ) {
                await loadBookings(
                  guest.id
                );
              }
            }
          )
          .subscribe();

      return () => {
        supabase.removeChannel(
          channel
        );
      };
    },
    [
      activeBookingId,
      guest?.id,
    ]
  );

  /*
    REALTIME BOOKING STATUS / OFFER / PAYMENT
  */

  useEffect(
    () => {
      if (
        !activeBookingId ||
        !guest?.id
      ) {
        return;
      }

      const channel =
        supabase
          .channel(
            `guest-booking-${activeBookingId}`
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'bookings',
              filter:
                `id=eq.${activeBookingId}`,
            },
            async () => {
              await loadBookings(
                guest.id
              );
            }
          )
          .subscribe();

      return () => {
        supabase.removeChannel(
          channel
        );
      };
    },
    [
      activeBookingId,
      guest?.id,
    ]
  );

  async function initialisePage() {
    setLoading(
      true
    );

    setError(
      ''
    );

    setNotice(
      ''
    );

    try {
      const {
        data: {
          session:
            currentSession,
        },
        error:
          sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError
      ) {
        throw sessionError;
      }

      if (
        !currentSession
          ?.user
      ) {
        window.location.href =
          `/login?redirect=${encodeURIComponent(
            '/account/messages'
          )}`;

        return;
      }

      setSession(
        currentSession
      );

      const email =
        String(
          currentSession.user
            .email || ''
        )
          .trim()
          .toLowerCase();

      if (!email) {
        throw new Error(
          'No email address is linked to this account.'
        );
      }

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
            'id, full_name, phone, email, created_at'
          )
          .eq(
            'email',
            email
          )
          .order(
            'created_at',
            {
              ascending:
                true,
            }
          )
          .limit(1);

      if (
        guestError
      ) {
        throw guestError;
      }

      const foundGuest =
        guestRows?.[0] ||
        null;

      if (
        !foundGuest
      ) {
        throw new Error(
          'No guest profile was found for this login.'
        );
      }

      setGuest(
        foundGuest
      );

      await loadBookings(
        foundGuest.id
      );
    } catch (
      pageError
    ) {
      console.error(
        pageError
      );

      setError(
        pageError.message ||
          'Unable to open messages.'
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  async function logoutGuest() {
    await supabase.auth.signOut();

    window.location.href =
      '/';
  }

  async function loadBookings(
    guestId
  ) {
    const {
      data,
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
          gst_rate,
          gst_amount,
          amount_including_gst,
          razorpay_order_id,
          paid_at,
          properties (
            id,
            name,
            slug,
            location_name
          )
        `)
        .eq(
          'guest_id',
          guestId
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
      data || [];

    setBookings(
      rows
    );

    if (
      rows.length
    ) {
      setActiveBookingId(
        (
          current
        ) => {
          const stillExists =
            rows.some(
              (
                booking
              ) =>
                booking.id ===
                current
            );

          return stillExists
            ? current
            : rows[0].id;
        }
      );
    } else {
      setActiveBookingId(
        ''
      );
    }
  }

  async function loadMessages(
    bookingId
  ) {
    if (
      !bookingId
    ) {
      setMessages(
        []
      );

      return;
    }

    const {
      data,
      error:
        messageError,
    } =
      await supabase
        .from(
          'booking_messages'
        )
        .select(
          'id, booking_id, sender_type, sender_name, message, message_type, is_read, created_at'
        )
        .eq(
          'booking_id',
          bookingId
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
      console.error(
        messageError
      );

      setError(
        messageError.message
      );

      return;
    }

    setMessages(
      data || []
    );

    const {
      error:
        readError,
    } =
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
        .neq(
          'sender_type',
          'guest'
        )
        .eq(
          'is_read',
          false
        );

    if (
      readError
    ) {
      console.warn(
        readError
      );
    }
  }

  const activeBooking =
    useMemo(
      () =>
        bookings.find(
          (
            booking
          ) =>
            booking.id ===
            activeBookingId
        ) || null,
      [
        bookings,
        activeBookingId,
      ]
    );

  const activeProperty =
    activeBooking
      ?.properties ||
    null;

  const finalPayable =
    Number(
      activeBooking
        ?.final_payable_amount ??
        activeBooking
          ?.amount_including_gst ??
        activeBooking
          ?.total_amount ??
        0
    );

  const specialOfferMessage =
    useMemo(
      () => {
        const offers =
          messages.filter(
            (
              item
            ) =>
              item.message_type ===
              'special_offer'
          );

        return offers.length
          ? offers[
              offers.length -
                1
            ]
          : null;
      },
      [
        messages,
      ]
    );

  const bookingPaid =
    activeBooking
      ?.payment_status ===
      'paid';

  const offerPending =
    activeBooking
      ?.offer_status ===
      'host_offered';

  const offerAccepted =
    activeBooking
      ?.offer_status ===
      'accepted';

  async function sendMessage(
    event
  ) {
    event.preventDefault();

    setError(
      ''
    );

    setNotice(
      ''
    );

    const text =
      String(
        messageText || ''
      ).trim();

    if (!text) {
      return;
    }

    if (
      !activeBooking ||
      !guest
    ) {
      setError(
        'Please select a booking first.'
      );

      return;
    }

    if (
      bookingPaid
    ) {
      setError(
        'This booking is already confirmed and paid.'
      );

      return;
    }

    setSending(
      true
    );

    try {
      const {
        error:
          insertError,
      } =
        await supabase
          .from(
            'booking_messages'
          )
          .insert({
            booking_id:
              activeBooking.id,

            sender_type:
              'guest',

            sender_name:
              guest.full_name ||
              'Guest',

            message:
              text,

            message_type:
              'message',

            is_read:
              false,
          });

      if (
        insertError
      ) {
        throw insertError;
      }

      setMessageText(
        ''
      );

      await loadMessages(
        activeBooking.id
      );
    } catch (
      sendError
    ) {
      console.error(
        sendError
      );

      setError(
        sendError.message ||
          'Message could not be sent.'
      );
    } finally {
      setSending(
        false
      );
    }
  }

  async function requestDiscount() {
    setError(
      ''
    );

    setNotice(
      ''
    );

    if (
      !activeBooking ||
      !guest
    ) {
      setError(
        'Please select a booking first.'
      );

      return;
    }

    if (
      bookingPaid
    ) {
      setError(
        'Discount cannot be requested after payment.'
      );

      return;
    }

    if (
      offerAccepted
    ) {
      setError(
        'You already accepted the host special offer.'
      );

      return;
    }

    const text =
      String(
        discountText || ''
      ).trim();

    if (!text) {
      setError(
        'Please write your request.'
      );

      return;
    }

    setDiscountSending(
      true
    );

    try {
      const {
        error:
          messageError,
      } =
        await supabase
          .from(
            'booking_messages'
          )
          .insert({
            booking_id:
              activeBooking.id,

            sender_type:
              'guest',

            sender_name:
              guest.full_name ||
              'Guest',

            message:
              `DISCOUNT REQUEST: ${text}`,

            message_type:
              'message',

            is_read:
              false,
          });

      if (
        messageError
      ) {
        throw messageError;
      }

      /*
        This booking flag is useful
        for the host dashboard.

        If RLS blocks it, the chat
        request is still successfully
        saved.
      */

      const {
        error:
          updateError,
      } =
        await supabase
          .from(
            'bookings'
          )
          .update({
            guest_discount_requested:
              true,

            guest_discount_message:
              text,
          })
          .eq(
            'id',
            activeBooking.id
          );

      if (
        updateError
      ) {
        console.warn(
          updateError
        );
      }

      setDiscountText(
        ''
      );

      setShowDiscountRequest(
        false
      );

      setNotice(
        'Better-rate request sent to the host.'
      );

      await loadMessages(
        activeBooking.id
      );
    } catch (
      requestError
    ) {
      console.error(
        requestError
      );

      setError(
        requestError.message ||
          'Request could not be sent.'
      );
    } finally {
      setDiscountSending(
        false
      );
    }
  }

  async function acceptSpecialOffer() {
    if (
      !activeBooking
    ) {
      return;
    }

    if (
      bookingPaid
    ) {
      return;
    }

    setAcceptingOffer(
      true
    );

    setError(
      ''
    );

    setNotice(
      ''
    );

    try {
      const response =
        await fetch(
          '/api/bookings/accept-offer',
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                bookingCode:
                  activeBooking.booking_code,
              }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          result.error ||
            'Unable to accept offer.'
        );
      }

      setNotice(
        `Special offer accepted. Final payable: ${money(
          result.finalPayableAmount
        )}`
      );

      await loadBookings(
        guest.id
      );

      await loadMessages(
        activeBooking.id
      );
    } catch (
      acceptError
    ) {
      console.error(
        acceptError
      );

      setError(
        acceptError.message ||
          'Unable to accept special offer.'
      );
    } finally {
      setAcceptingOffer(
        false
      );
    }
  }

  async function payNow() {
    if (
      !activeBooking ||
      !guest
    ) {
      return;
    }

    if (
      bookingPaid
    ) {
      setNotice(
        'This booking is already paid.'
      );

      return;
    }

    if (
      activeBooking.offer_status ===
      'host_offered'
    ) {
      setError(
        'Please accept the special offer before payment.'
      );

      return;
    }

    setPaymentLoading(
      true
    );

    setError(
      ''
    );

    setNotice(
      ''
    );

    try {
      const scriptReady =
        await loadRazorpayScript();

      if (
        !scriptReady
      ) {
        throw new Error(
          'Unable to load Razorpay checkout.'
        );
      }

      const orderResponse =
        await fetch(
          '/api/razorpay/create-order',
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                bookingCode:
                  activeBooking.booking_code,
              }),
          }
        );

      const order =
        await orderResponse.json();

      if (
        !orderResponse.ok
      ) {
        throw new Error(
          order.error ||
            'Unable to create payment order.'
        );
      }

      const options = {
        key:
          order.keyId,

        amount:
          order.amount,

        currency:
          order.currency ||
          'INR',

        name:
          'NightOutStays',

        description:
          activeProperty?.name ||
          `Booking ${activeBooking.booking_code}`,

        order_id:
          order.orderId,

        prefill: {
          name:
            guest.full_name ||
            '',

          email:
            guest.email ||
            '',

          contact:
            guest.phone ||
            '',
        },

        notes: {
          booking_code:
            activeBooking.booking_code,
        },

        theme: {},

        handler:
          async function (
            paymentResponse
          ) {
            try {
              const verifyResponse =
                await fetch(
                  '/api/razorpay/verify',
                  {
                    method:
                      'POST',

                    headers: {
                      'Content-Type':
                        'application/json',
                    },

                    body:
                      JSON.stringify({
                        bookingCode:
                          activeBooking.booking_code,

                        razorpay_order_id:
                          paymentResponse.razorpay_order_id,

                        razorpay_payment_id:
                          paymentResponse.razorpay_payment_id,

                        razorpay_signature:
                          paymentResponse.razorpay_signature,
                      }),
                  }
                );

              const verified =
                await verifyResponse.json();

              if (
                !verifyResponse.ok
              ) {
                throw new Error(
                  verified.error ||
                    'Payment verification failed.'
                );
              }

              setNotice(
                'Payment successful. Your booking is confirmed and the dates are now blocked.'
              );

              await loadBookings(
                guest.id
              );

              await loadMessages(
                activeBooking.id
              );
            } catch (
              verifyError
            ) {
              console.error(
                verifyError
              );

              setError(
                verifyError.message ||
                  'Payment was received but verification failed.'
              );
            } finally {
              setPaymentLoading(
                false
              );
            }
          },

        modal: {
          ondismiss: () => {
            setPaymentLoading(
              false
            );
          },
        },
      };

      const razorpay =
        new window.Razorpay(
          options
        );

      razorpay.on(
        'payment.failed',
        (
          response
        ) => {
          setPaymentLoading(
            false
          );

          setError(
            response.error
              ?.description ||
              'Payment failed.'
          );
        }
      );

      razorpay.open();
    } catch (
      paymentError
    ) {
      console.error(
        paymentError
      );

      setPaymentLoading(
        false
      );

      setError(
        paymentError.message ||
          'Unable to start payment.'
      );
    }
  }

  if (
    loading
  ) {
    return (
      <main
        style={
          styles.page
        }
      >
        <div
          style={
            styles.centerBox
          }
        >
          Loading your messages...
        </div>
      </main>
    );
  }

  if (
    error &&
    !guest
  ) {
    return (
      <main
        style={
          styles.page
        }
      >
        <div
          style={
            styles.centerBox
          }
        >
          <h2>
            Messages unavailable
          </h2>

          <p>
            {error}
          </p>

          <a
            href="/"
            style={
              styles.primaryLink
            }
          >
            Back to NightOutStays
          </a>
        </div>
      </main>
    );
  }

  return (
    <main
      style={
        styles.page
      }
    >
      <header
        style={
          styles.header
        }
      >
        <a
          href="/"
          style={
            styles.logo
          }
        >
          NightOutStays
        </a>

        <div
          style={
            styles.headerRight
          }
        >
          <nav
            style={
              styles.nav
            }
          >
            <a
              href="/"
              style={
                styles.navLink
              }
            >
              Properties
            </a>

            <a
              href="/account/messages"
              style={
                styles.activeNavLink
              }
            >
              Messages
            </a>
          </nav>

          <div
            style={
              styles.loginStatus
            }
          >
            <div>
              <div
                style={
                  styles.loggedInLabel
                }
              >
                Logged in as
              </div>

              <strong>
                {guest?.full_name ||
                  'Guest'}
              </strong>

              <div
                style={
                  styles.loggedInEmail
                }
              >
                {session?.user
                  ?.email ||
                  guest?.email}
              </div>
            </div>

            <button
              type="button"
              onClick={
                logoutGuest
              }
              style={
                styles.logoutButton
              }
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div
        style={
          styles.container
        }
      >
        <div
          style={
            styles.pageHeader
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
            onClick={
              initialisePage
            }
            style={
              styles.refreshButton
            }
          >
            Refresh
          </button>
        </div>

        {bookings.length ===
        0 ? (
          <div
            style={
              styles.emptyCard
            }
          >
            <h3>
              No booking conversations yet
            </h3>

            <p>
              Once you request a stay, its conversation will appear here.
            </p>

            <a
              href="/"
              style={
                styles.primaryLink
              }
            >
              Browse Properties
            </a>
          </div>
        ) : (
          <div
            style={
              styles.chatLayout
            }
          >
            <aside
              style={
                styles.conversationList
              }
            >
              <div
                style={
                  styles.listHeading
                }
              >
                Your Bookings
              </div>

              {bookings.map(
                (
                  booking
                ) => {
                  const property =
                    booking.properties;

                  const active =
                    booking.id ===
                    activeBookingId;

                  return (
                    <button
                      type="button"
                      key={
                        booking.id
                      }
                      onClick={() => {
                        setActiveBookingId(
                          booking.id
                        );

                        setNotice(
                          ''
                        );

                        setError(
                          ''
                        );

                        setShowDiscountRequest(
                          false
                        );

                        setDiscountText(
                          ''
                        );
                      }}
                      style={{
                        ...styles.conversationButton,

                        ...(active
                          ? styles.activeConversation
                          : {}),
                      }}
                    >
                      <strong
                        style={
                          styles.bookingCode
                        }
                      >
                        {
                          booking.booking_code
                        }
                      </strong>

                      <span
                        style={
                          styles.propertyName
                        }
                      >
                        {property?.name ||
                          'Property'}
                      </span>

                      <span
                        style={
                          styles.bookingDates
                        }
                      >
                        {formatStayDate(
                          booking.check_in
                        )}
                        {' → '}
                        {formatStayDate(
                          booking.check_out
                        )}
                      </span>

                      <span
                        style={
                          styles.bookingStatus
                        }
                      >
                        {booking.booking_status ||
                          'pending'}
                        {' • '}
                        {booking.payment_status ||
                          'unpaid'}
                      </span>
                    </button>
                  );
                }
              )}
            </aside>

            <section
              style={
                styles.chatPanel
              }
            >
              {activeBooking && (
                <>
                  <div
                    style={
                      styles.chatHeader
                    }
                  >
                    <div>
                      <h2
                        style={
                          styles.chatTitle
                        }
                      >
                        {activeProperty?.name ||
                          'Booking Conversation'}
                      </h2>

                      <div
                        style={
                          styles.chatMeta
                        }
                      >
                        {
                          activeBooking.booking_code
                        }
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

                    <div
                      style={
                        styles.statusGroup
                      }
                    >
                      <span
                        style={
                          styles.statusPill
                        }
                      >
                        {
                          activeBooking.booking_status
                        }
                      </span>

                      <span
                        style={
                          styles.statusPill
                        }
                      >
                        {
                          activeBooking.payment_status
                        }
                      </span>
                    </div>
                  </div>

                  <div
                    style={
                      styles.priceStrip
                    }
                  >
                    <div>
                      <span
                        style={
                          styles.priceLabel
                        }
                      >
                        Current Payable
                      </span>

                      <strong>
                        {money(
                          finalPayable
                        )}
                      </strong>
                    </div>

                    {Number(
                      activeBooking.host_discount_amount ||
                        0
                    ) > 0 && (
                      <div>
                        <span
                          style={
                            styles.priceLabel
                          }
                        >
                          Host Discount
                        </span>

                        <strong
                          style={
                            styles.discountAmount
                          }
                        >
                          -
                          {money(
                            activeBooking.host_discount_amount
                          )}
                        </strong>
                      </div>
                    )}

                    <div>
                      <span
                        style={
                          styles.priceLabel
                        }
                      >
                        GST
                      </span>

                      <strong>
                        {money(
                          activeBooking.gst_amount ||
                            0
                        )}
                      </strong>
                    </div>

                    <div>
                      <span
                        style={
                          styles.priceLabel
                        }
                      >
                        Offer Status
                      </span>

                      <strong>
                        {activeBooking.offer_status ||
                          'none'}
                      </strong>
                    </div>
                  </div>

                  <div
                    style={
                      styles.messagesArea
                    }
                  >
                    {messages.length === 0 ? (
                      <div
                        style={
                          styles.noMessages
                        }
                      >
                        No messages yet. Start the conversation with the host.
                      </div>
                    ) : (
                      messages.map(
                        (
                          item
                        ) => {
                          const isGuest =
                            item.sender_type ===
                            'guest';

                          const isDiscountRequest =
                            String(
                              item.message ||
                                ''
                            ).startsWith(
                              'DISCOUNT REQUEST:'
                            );

                          const isSpecialOffer =
                            item.message_type ===
                            'special_offer';

                          const isSystem =
                            item.sender_type ===
                              'system' ||
                            item.message_type ===
                              'system' ||
                            item.message_type ===
                              'confirmation';

                          if (
                            isSystem
                          ) {
                            return (
                              <div
                                key={
                                  item.id
                                }
                                style={
                                  styles.systemMessage
                                }
                              >
                                <div>
                                  {
                                    item.message
                                  }
                                </div>

                                <div
                                  style={
                                    styles.messageTime
                                  }
                                >
                                  {formatDateTime(
                                    item.created_at
                                  )}
                                </div>
                              </div>
                            );
                          }

                          if (
                            isSpecialOffer
                          ) {
                            return (
                              <div
                                key={
                                  item.id
                                }
                                style={
                                  styles.specialOfferMessageRow
                                }
                              >
                                <div
                                  style={
                                    styles.specialOfferCard
                                  }
                                >
                                  <div
                                    style={
                                      styles.specialOfferBadge
                                    }
                                  >
                                    HOST SPECIAL OFFER
                                  </div>

                                  <div
                                    style={
                                      styles.specialOfferTitle
                                    }
                                  >
                                    Special rate offered for this booking
                                  </div>

                                  <div
                                    style={
                                      styles.specialOfferText
                                    }
                                  >
                                    {
                                      item.message
                                    }
                                  </div>

                                  <div
                                    style={
                                      styles.offerPriceBox
                                    }
                                  >
                                    <div>
                                      <span
                                        style={
                                          styles.offerPriceLabel
                                        }
                                      >
                                        Accommodation
                                      </span>

                                      <strong>
                                        {money(
                                          activeBooking.taxable_amount ||
                                            0
                                        )}
                                      </strong>
                                    </div>

                                    <div>
                                      <span
                                        style={
                                          styles.offerPriceLabel
                                        }
                                      >
                                        GST
                                      </span>

                                      <strong>
                                        {money(
                                          activeBooking.gst_amount ||
                                            0
                                        )}
                                      </strong>
                                    </div>

                                    <div>
                                      <span
                                        style={
                                          styles.offerPriceLabel
                                        }
                                      >
                                        Final Payable
                                      </span>

                                      <strong
                                        style={
                                          styles.finalOfferAmount
                                        }
                                      >
                                        {money(
                                          activeBooking.final_payable_amount ||
                                            0
                                        )}
                                      </strong>
                                    </div>
                                  </div>

                                  {offerPending && (
                                    <div
                                      style={
                                        styles.offerActions
                                      }
                                    >
                                      <button
                                        type="button"
                                        onClick={
                                          acceptSpecialOffer
                                        }
                                        disabled={
                                          acceptingOffer
                                        }
                                        style={{
                                          ...styles.acceptOfferButton,

                                          ...(acceptingOffer
                                            ? styles.disabledButton
                                            : {}),
                                        }}
                                      >
                                        {acceptingOffer
                                          ? 'Accepting...'
                                          : 'Accept Offer'}
                                      </button>
                                    </div>
                                  )}

                                  {offerAccepted &&
                                    !bookingPaid && (
                                      <div
                                        style={
                                          styles.offerActions
                                        }
                                      >
                                        <div
                                          style={
                                            styles.acceptedText
                                          }
                                        >
                                          Offer accepted
                                        </div>

                                        <button
                                          type="button"
                                          onClick={
                                            payNow
                                          }
                                          disabled={
                                            paymentLoading
                                          }
                                          style={{
                                            ...styles.payButton,

                                            ...(paymentLoading
                                              ? styles.disabledButton
                                              : {}),
                                          }}
                                        >
                                          {paymentLoading
                                            ? 'Opening Payment...'
                                            : `Pay Now ${money(
                                                finalPayable
                                              )}`}
                                        </button>
                                      </div>
                                    )}

                                  {bookingPaid && (
                                    <div
                                      style={
                                        styles.paidOfferBox
                                      }
                                    >
                                      Payment received. Booking confirmed.
                                    </div>
                                  )}

                                  <div
                                    style={
                                      styles.specialOfferNote
                                    }
                                  >
                                    No additional discount will be applied to this host special offer.
                                  </div>

                                  <div
                                    style={
                                      styles.messageTime
                                    }
                                  >
                                    {formatDateTime(
                                      item.created_at
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={
                                item.id
                              }
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
                                }}
                              >
                                {isDiscountRequest && (
                                  <div
                                    style={
                                      styles.discountBadge
                                    }
                                  >
                                    Better Rate Request
                                  </div>
                                )}

                                <div
                                  style={
                                    styles.messageSender
                                  }
                                >
                                  {item.sender_name ||
                                    (isGuest
                                      ? guest?.full_name ||
                                        'You'
                                      : 'Host')}
                                </div>

                                <div
                                  style={
                                    styles.messageText
                                  }
                                >
                                  {isDiscountRequest
                                    ? String(
                                        item.message
                                      ).replace(
                                        /^DISCOUNT REQUEST:\s*/,
                                        ''
                                      )
                                    : item.message}
                                </div>

                                <div
                                  style={
                                    styles.messageTime
                                  }
                                >
                                  {formatDateTime(
                                    item.created_at
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }
                      )
                    )}
                  </div>

                  {notice && (
                    <div
                      style={
                        styles.noticeBox
                      }
                    >
                      {
                        notice
                      }
                    </div>
                  )}

                  {error && (
                    <div
                      style={
                        styles.errorBox
                      }
                    >
                      {
                        error
                      }
                    </div>
                  )}

                  {!bookingPaid && (
                    <div
                      style={
                        styles.composerSection
                      }
                    >
                      <form
                        onSubmit={
                          sendMessage
                        }
                        style={
                          styles.messageComposer
                        }
                      >
                        <textarea
                          value={
                            messageText
                          }
                          onChange={(
                            event
                          ) =>
                            setMessageText(
                              event.target.value
                            )
                          }
                          placeholder="Write a message to the host..."
                          style={
                            styles.messageInput
                          }
                        />

                        <button
                          type="submit"
                          disabled={
                            sending ||
                            !messageText.trim()
                          }
                          style={{
                            ...styles.sendButton,

                            ...(sending ||
                            !messageText.trim()
                              ? styles.disabledButton
                              : {}),
                          }}
                        >
                          {sending
                            ? 'Sending...'
                            : 'Send'}
                        </button>
                      </form>

                      {!offerAccepted && (
                        <div
                          style={
                            styles.smallDiscountArea
                          }
                        >
                          {!showDiscountRequest ? (
                            <button
                              type="button"
                              onClick={() => {
                                setShowDiscountRequest(
                                  true
                                );

                                setError(
                                  ''
                                );

                                setNotice(
                                  ''
                                );
                              }}
                              style={
                                styles.smallDiscountLink
                              }
                            >
                              Want a better rate? Ask host
                            </button>
                          ) : (
                            <div
                              style={
                                styles.discountInlineBox
                              }
                            >
                              <input
                                type="text"
                                value={
                                  discountText
                                }
                                onChange={(
                                  event
                                ) =>
                                  setDiscountText(
                                    event.target.value
                                  )
                                }
                                placeholder="Ask host for a better rate..."
                                style={
                                  styles.discountInlineInput
                                }
                              />

                              <button
                                type="button"
                                onClick={
                                  requestDiscount
                                }
                                disabled={
                                  discountSending ||
                                  !discountText.trim()
                                }
                                style={{
                                  ...styles.discountAskButton,

                                  ...(discountSending ||
                                  !discountText.trim()
                                    ? styles.disabledButton
                                    : {}),
                                }}
                              >
                                {discountSending
                                  ? 'Sending...'
                                  : 'Ask'}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setShowDiscountRequest(
                                    false
                                  );

                                  setDiscountText(
                                    ''
                                  );
                                }}
                                style={
                                  styles.discountCancelButton
                                }
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {bookingPaid && (
                    <div
                      style={
                        styles.confirmedFooter
                      }
                    >
                      Booking confirmed. These dates are now blocked for this property.
                    </div>
                  )}
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
    fontFamily:
      'Arial, sans-serif',
  },

  header: {
    minHeight: 74,
    padding: '10px 5%',
    background: '#ffffff',
    borderBottom:
      '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      'space-between',
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
    justifyContent:
      'flex-end',
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
    borderLeft:
      '1px solid #e5e7eb',
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
    border:
      '1px solid #d0d5dd',
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
    padding:
      '30px 0 60px',
  },

  pageHeader: {
    display: 'flex',
    justifyContent:
      'space-between',
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
    border:
      '1px solid #dfe3e8',
    borderRadius: 16,
    overflow: 'hidden',
  },

  conversationList: {
    borderRight:
      '1px solid #dfe3e8',
    maxHeight: 760,
    overflowY: 'auto',
    background: '#ffffff',
  },

  listHeading: {
    padding: 16,
    fontWeight: 800,
    borderBottom:
      '1px solid #e5e7eb',
  },

  conversationButton: {
    width: '100%',
    border: 0,
    borderBottom:
      '1px solid #edf0f4',
    background: '#ffffff',
    padding: 15,
    textAlign: 'left',
    display: 'grid',
    gap: 5,
    cursor: 'pointer',
  },

  activeConversation: {
    background: '#edf4ff',
    borderLeft:
      '4px solid #174f91',
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
    borderBottom:
      '1px solid #e5e7eb',
    display: 'flex',
    justifyContent:
      'space-between',
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

  statusGroup: {
    display: 'flex',
    gap: 7,
    flexWrap: 'wrap',
  },

  statusPill: {
    padding: '5px 8px',
    borderRadius: 20,
    background: '#eef2f6',
    color: '#475467',
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'capitalize',
  },

  priceStrip: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(130px, 1fr))',
    gap: 10,
    padding: 14,
    background: '#ffffff',
    borderBottom:
      '1px solid #e5e7eb',
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
    maxHeight: 510,
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
    border:
      '1px solid #c6dbff',
  },

  hostBubble: {
    background: '#ffffff',
    border:
      '1px solid #e1e5ea',
  },

  discountRequestBubble: {
    background: '#fffdf8',
    border:
      '1px solid #e7dfc7',
  },

  discountBadge: {
    display: 'inline-block',
    marginBottom: 5,
    padding: '3px 6px',
    borderRadius: 20,
    background: '#f5f1e5',
    color: '#776735',
    fontSize: 9,
    fontWeight: 800,
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

  systemMessage: {
    maxWidth: '82%',
    alignSelf: 'center',
    padding: 10,
    borderRadius: 10,
    background: '#fff7df',
    border: '1px solid #ead79a',
    color: '#6b561d',
    textAlign: 'center',
    fontSize: 12,
  },

  specialOfferMessageRow: {
    display: 'flex',
    justifyContent: 'flex-start',
    width: '100%',
  },

  specialOfferCard: {
    width: '100%',
    maxWidth: 520,
    background: '#f1fbf4',
    border:
      '1px solid #b8ddc4',
    borderRadius: 14,
    padding: 15,
  },

  specialOfferBadge: {
    display: 'inline-block',
    padding: '4px 7px',
    borderRadius: 20,
    background: '#dff3e5',
    color: '#27643a',
    fontSize: 9,
    fontWeight: 900,
    marginBottom: 7,
  },

  specialOfferTitle: {
    fontSize: 15,
    fontWeight: 900,
    marginBottom: 8,
  },

  specialOfferText: {
    fontSize: 12,
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap',
    color: '#385044',
  },

  offerPriceBox: {
    marginTop: 12,
    padding: 11,
    background: '#ffffff',
    border:
      '1px solid #d8eadf',
    borderRadius: 10,
    display: 'grid',
    gridTemplateColumns:
      'repeat(3, 1fr)',
    gap: 10,
  },

  offerPriceLabel: {
    display: 'block',
    fontSize: 9,
    textTransform: 'uppercase',
    color: '#667085',
    marginBottom: 4,
    fontWeight: 700,
  },

  finalOfferAmount: {
    color: '#174f91',
    fontSize: 17,
  },

  offerActions: {
    marginTop: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },

  acceptOfferButton: {
    border: 0,
    background: '#ffffff',
    color: '#27643a',
    border:
      '1px solid #97cba8',
    borderRadius: 8,
    padding: '10px 14px',
    fontWeight: 900,
    cursor: 'pointer',
  },

  payButton: {
    border: 0,
    background: '#174f91',
    color: '#ffffff',
    borderRadius: 8,
    padding: '11px 16px',
    fontWeight: 900,
    cursor: 'pointer',
  },

  acceptedText: {
    color: '#24723a',
    fontSize: 12,
    fontWeight: 900,
  },

  paidOfferBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    background: '#dff3e5',
    color: '#27643a',
    fontSize: 12,
    fontWeight: 900,
  },

  specialOfferNote: {
    marginTop: 10,
    color: '#687080',
    fontSize: 10,
  },

  noticeBox: {
    margin: '0 18px 10px',
    padding: 11,
    borderRadius: 9,
    background: '#eaf7ee',
    color: '#24723a',
    fontSize: 12,
    fontWeight: 700,
  },

  errorBox: {
    margin: '0 18px 10px',
    padding: 11,
    borderRadius: 9,
    background: '#fdeaea',
    color: '#a12828',
    fontSize: 12,
    fontWeight: 700,
  },

  composerSection: {
    background: '#ffffff',
    borderTop:
      '1px solid #e5e7eb',
    paddingBottom: 8,
  },

  messageComposer: {
    display: 'grid',
    gridTemplateColumns:
      '1fr auto',
    gap: 10,
    padding: '14px 18px 7px',
  },

  messageInput: {
    width: '100%',
    boxSizing: 'border-box',
    minHeight: 58,
    resize: 'vertical',
    border:
      '1px solid #cfd6df',
    borderRadius: 9,
    padding: 11,
    fontSize: 13,
  },

  sendButton: {
    minWidth: 95,
    border: 0,
    background: '#174f91',
    color: '#ffffff',
    borderRadius: 9,
    padding: '0 18px',
    fontWeight: 800,
    cursor: 'pointer',
  },

  smallDiscountArea: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '0 18px 5px',
  },

  smallDiscountLink: {
    border: 0,
    background: 'transparent',
    color: '#7b8490',
    padding: '2px 0',
    fontSize: 10,
    textDecoration: 'underline',
    cursor: 'pointer',
  },

  discountInlineBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    width: '100%',
  },

  discountInlineInput: {
    width: 270,
    maxWidth: '60%',
    border:
      '1px solid #d6dbe1',
    borderRadius: 7,
    padding: '7px 9px',
    fontSize: 11,
  },

  discountAskButton: {
    border: 0,
    background: '#687080',
    color: '#ffffff',
    borderRadius: 7,
    padding: '7px 10px',
    fontSize: 10,
    fontWeight: 800,
    cursor: 'pointer',
  },

  discountCancelButton: {
    border: 0,
    background: 'transparent',
    color: '#8b929b',
    padding: '6px 3px',
    fontSize: 10,
    cursor: 'pointer',
  },

  confirmedFooter: {
    padding: 15,
    background: '#eaf7ee',
    borderTop:
      '1px solid #cfe8d5',
    color: '#24723a',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 800,
  },

  disabledButton: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },

  emptyCard: {
    background: '#ffffff',
    border:
      '1px solid #e5e7eb',
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