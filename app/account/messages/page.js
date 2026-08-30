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
    return new Date(value).toLocaleString(
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
  if (!value) return '—';

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
  return new Promise((resolve) => {
    if (
      typeof window !== 'undefined' &&
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
      document.createElement('script');

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
  });
}

async function readJsonResponse(
  response
) {
  const responseText =
    await response.text();

  if (!responseText) {
    if (!response.ok) {
      throw new Error(
        `Server returned an empty response. Status: ${response.status}`
      );
    }

    return {};
  }

  try {
    return JSON.parse(
      responseText
    );
  } catch {
    throw new Error(
      `Server returned an invalid response. Status: ${response.status}`
    );
  }
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

  useEffect(() => {
    initialisePage();
  }, []);

  useEffect(() => {
    if (activeBookingId) {
      loadMessages(
        activeBookingId
      );
    }
  }, [activeBookingId]);

  useEffect(() => {
    if (!activeBookingId) {
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

            if (guest?.id) {
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
  }, [
    activeBookingId,
    guest?.id,
  ]);

  useEffect(() => {
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
  }, [
    activeBookingId,
    guest?.id,
  ]);

  async function initialisePage() {
    setLoading(true);
    setError('');
    setNotice('');

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

      if (sessionError) {
        throw sessionError;
      }

      if (
        !currentSession?.user
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
          .from('guests')
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

      if (guestError) {
        throw guestError;
      }

      const foundGuest =
        guestRows?.[0] ||
        null;

      if (!foundGuest) {
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
      setLoading(false);
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

    if (bookingError) {
      throw bookingError;
    }

    const rows =
      data || [];

    setBookings(rows);

    if (rows.length) {
      setActiveBookingId(
        (current) => {
          const stillExists =
            rows.some(
              (booking) =>
                booking.id ===
                current
            );

          return stillExists
            ? current
            : rows[0].id;
        }
      );
    } else {
      setActiveBookingId('');
    }
  }

  async function loadMessages(
    bookingId
  ) {
    if (!bookingId) {
      setMessages([]);
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

    if (messageError) {
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
          is_read: true,
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

    if (readError) {
      console.warn(
        readError
      );
    }
  }

  const activeBooking =
    useMemo(
      () =>
        bookings.find(
          (booking) =>
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

    setError('');
    setNotice('');

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

    setSending(true);

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

            message: text,

            message_type:
              'message',

            is_read:
              false,
          });

      if (insertError) {
        throw insertError;
      }

      setMessageText('');

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
      setSending(false);
    }
  }

  async function requestDiscount() {
    setError('');
    setNotice('');

    if (
      !activeBooking ||
      !guest
    ) {
      setError(
        'Please select a booking first.'
      );

      return;
    }

    if (bookingPaid) {
      setError(
        'Discount cannot be requested after payment.'
      );

      return;
    }

    if (offerAccepted) {
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

    setDiscountSending(true);

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

      if (messageError) {
        throw messageError;
      }

      const {
        error:
          updateError,
      } =
        await supabase
          .from('bookings')
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

      if (updateError) {
        console.warn(
          updateError
        );
      }

      setDiscountText('');

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
      setDiscountSending(false);
    }
  }

  async function acceptSpecialOffer() {
    if (!activeBooking) {
      return;
    }

    if (bookingPaid) {
      return;
    }

    setAcceptingOffer(true);
    setError('');
    setNotice('');

    try {
      const response =
        await fetch(
          '/api/bookings/accept-offer',
          {
            method: 'POST',

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
        await readJsonResponse(
          response
        );

      if (!response.ok) {
        throw new Error(
          result.error ||
            `Unable to accept offer. Status: ${response.status}`
        );
      }

      if (!result.success) {
        throw new Error(
          result.error ||
            'Unable to accept special offer.'
        );
      }

      setNotice(
        `Special offer accepted. Final payable: ${money(
          result.finalPayableAmount ||
            activeBooking.final_payable_amount
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
      setAcceptingOffer(false);
    }
  }

  async function payNow() {
    if (
      !activeBooking ||
      !guest
    ) {
      return;
    }

    if (bookingPaid) {
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

    setPaymentLoading(true);
    setError('');
    setNotice('');

    try {
      const scriptReady =
        await loadRazorpayScript();

      if (!scriptReady) {
        throw new Error(
          'Unable to load Razorpay checkout.'
        );
      }

      const orderResponse =
        await fetch(
          '/api/razorpay/create-order',
          {
            method: 'POST',

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
        await readJsonResponse(
          orderResponse
        );

      if (!orderResponse.ok) {
        throw new Error(
          order.error ||
            `Unable to create payment order. Status: ${orderResponse.status}`
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
                await readJsonResponse(
                  verifyResponse
                );

              if (
                !verifyResponse.ok
              ) {
                throw new Error(
                  verified.error ||
                    `Payment verification failed. Status: ${verifyResponse.status}`
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
              setPaymentLoading(false);
            }
          },

        modal: {
          ondismiss: () => {
            setPaymentLoading(false);
          },
        },
      };

      const razorpay =
        new window.Razorpay(
          options
        );

      razorpay.on(
        'payment.failed',
        (response) => {
          setPaymentLoading(false);

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

      setPaymentLoading(false);

      setError(
        paymentError.message ||
          'Unable to start payment.'
      );
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

  if (
    error &&
    !guest
  ) {
    return (
      <main style={styles.page}>
        <div style={styles.centerBox}>
          <h2>
            Messages unavailable
          </h2>

          <p>{error}</p>

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
    <main style={styles.page}>
      <header style={styles.header}>
        <a
          href="/"
          style={styles.logo}
        >
          NightOutStays
        </a>

        <div
          style={
            styles.headerRight
          }
        >
          <nav style={styles.nav}>
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

      <div style={styles.container}>
        <div
          style={
            styles.pageHeader
          }
        >
          <div>
            <h1 style={styles.title}>
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
                (booking) => (
                  <button
                    type="button"
                    key={booking.id}
                    onClick={() => {
                      setActiveBookingId(
                        booking.id
                      );

                      setNotice('');
                      setError('');

                      setShowDiscountRequest(
                        false
                      );

                      setDiscountText(
                        ''
                      );
                    }}
                    style={{
                      ...styles.conversationButton,

                      ...(booking.id ===
                      activeBookingId
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
                      {booking.properties
                        ?.name ||
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
                      {
                        booking.booking_status
                      }
                      {' • '}
                      {
                        booking.payment_status
                      }
                    </span>
                  </button>
                )
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
                    {messages.map(
                      (item) => {
                        const isGuest =
                          item.sender_type ===
                          'guest';

                        const discountRequest =
                          String(
                            item.message ||
                              ''
                          ).startsWith(
                            'DISCOUNT REQUEST:'
                          );

                        if (
                          item.message_type ===
                          'special_offer'
                        ) {
                          return (
                            <div
                              key={
                                item.id
                              }
                              style={
                                styles.specialOfferCard
                              }
                            >
                              <strong>
                                HOST SPECIAL OFFER
                              </strong>

                              <div
                                style={
                                  styles.messageText
                                }
                              >
                                {
                                  item.message
                                }
                              </div>

                              <div
                                style={
                                  styles.offerAmounts
                                }
                              >
                                <div>
                                  Accommodation
                                  <br />
                                  <strong>
                                    {money(
                                      activeBooking.taxable_amount
                                    )}
                                  </strong>
                                </div>

                                <div>
                                  GST
                                  <br />
                                  <strong>
                                    {money(
                                      activeBooking.gst_amount
                                    )}
                                  </strong>
                                </div>

                                <div>
                                  Final Payable
                                  <br />
                                  <strong>
                                    {money(
                                      activeBooking.final_payable_amount
                                    )}
                                  </strong>
                                </div>
                              </div>

                              {offerPending && (
                                <button
                                  type="button"
                                  onClick={
                                    acceptSpecialOffer
                                  }
                                  disabled={
                                    acceptingOffer
                                  }
                                  style={
                                    styles.acceptOfferButton
                                  }
                                >
                                  {acceptingOffer
                                    ? 'Accepting...'
                                    : 'Accept Offer'}
                                </button>
                              )}

                              {offerAccepted &&
                                !bookingPaid && (
                                  <button
                                    type="button"
                                    onClick={
                                      payNow
                                    }
                                    disabled={
                                      paymentLoading
                                    }
                                    style={
                                      styles.payButton
                                    }
                                  >
                                    {paymentLoading
                                      ? 'Opening Payment...'
                                      : `Pay Now ${money(
                                          finalPayable
                                        )}`}
                                  </button>
                                )}

                              {bookingPaid && (
                                <div
                                  style={
                                    styles.paidBox
                                  }
                                >
                                  Paid and confirmed
                                </div>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div
                            key={
                              item.id
                            }
                            style={{
                              display:
                                'flex',

                              justifyContent:
                                isGuest
                                  ? 'flex-end'
                                  : 'flex-start',
                            }}
                          >
                            <div
                              style={
                                isGuest
                                  ? styles.guestBubble
                                  : styles.hostBubble
                              }
                            >
                              <strong>
                                {discountRequest
                                  ? 'Better Rate Request'
                                  : item.sender_name}
                              </strong>

                              <div>
                                {discountRequest
                                  ? String(
                                      item.message
                                    ).replace(
                                      /^DISCOUNT REQUEST:\s*/,
                                      ''
                                    )
                                  : item.message}
                              </div>

                              <small>
                                {formatDateTime(
                                  item.created_at
                                )}
                              </small>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>

                  {notice && (
                    <div
                      style={
                        styles.noticeBox
                      }
                    >
                      {notice}
                    </div>
                  )}

                  {error && (
                    <div
                      style={
                        styles.errorBox
                      }
                    >
                      {error}
                    </div>
                  )}

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
                      onChange={(e) =>
                        setMessageText(
                          e.target.value
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
                      style={
                        styles.sendButton
                      }
                    >
                      {sending
                        ? 'Sending...'
                        : 'Send'}
                    </button>
                  </form>

                  {!bookingPaid &&
                    !offerAccepted && (
                      <div
                        style={
                          styles.discountArea
                        }
                      >
                        {!showDiscountRequest ? (
                          <button
                            type="button"
                            onClick={() =>
                              setShowDiscountRequest(
                                true
                              )
                            }
                            style={
                              styles.discountLink
                            }
                          >
                            Want a better rate? Ask host
                          </button>
                        ) : (
                          <div
                            style={
                              styles.discountInline
                            }
                          >
                            <input
                              value={
                                discountText
                              }
                              onChange={(e) =>
                                setDiscountText(
                                  e.target.value
                                )
                              }
                              placeholder="Ask host for a better rate..."
                              style={
                                styles.discountInput
                              }
                            />

                            <button
                              type="button"
                              onClick={
                                requestDiscount
                              }
                            >
                              Ask
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
                            >
                              Cancel
                            </button>
                          </div>
                        )}
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
    minHeight: 72,
    padding: '10px 5%',
    background: '#ffffff',
    borderBottom:
      '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      'space-between',
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
    gap: 20,
  },

  nav: {
    display: 'flex',
    gap: 15,
  },

  navLink: {
    color: '#174f91',
    textDecoration: 'none',
    fontWeight: 700,
  },

  activeNavLink: {
    color: '#ffffff',
    background: '#174f91',
    padding: '8px 13px',
    borderRadius: 20,
    textDecoration: 'none',
    fontWeight: 700,
  },

  loginStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },

  loggedInLabel: {
    fontSize: 9,
    color: '#667085',
  },

  loggedInEmail: {
    fontSize: 10,
    color: '#667085',
  },

  logoutButton: {
    border:
      '1px solid #d0d5dd',
    background: '#ffffff',
    borderRadius: 20,
    padding: '8px 12px',
    cursor: 'pointer',
  },

  container: {
    width: '92%',
    maxWidth: 1220,
    margin: '0 auto',
    padding: '30px 0',
  },

  pageHeader: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  title: {
    margin: 0,
  },

  subtitle: {
    color: '#667085',
  },

  refreshButton: {
    border: 0,
    background: '#174f91',
    color: '#ffffff',
    padding: '9px 14px',
    borderRadius: 8,
  },

  chatLayout: {
    display: 'grid',
    gridTemplateColumns:
      '310px 1fr',
    background: '#ffffff',
    border:
      '1px solid #dfe3e8',
    borderRadius: 15,
    overflow: 'hidden',
  },

  conversationList: {
    borderRight:
      '1px solid #e5e7eb',
  },

  listHeading: {
    padding: 15,
    fontWeight: 800,
  },

  conversationButton: {
    width: '100%',
    padding: 14,
    border: 0,
    borderTop:
      '1px solid #edf0f4',
    background: '#ffffff',
    textAlign: 'left',
    display: 'grid',
    gap: 4,
  },

  activeConversation: {
    background: '#edf4ff',
  },

  bookingCode: {
    color: '#174f91',
    fontWeight: 800,
  },

  propertyName: {
    fontWeight: 700,
  },

  bookingDates: {
    fontSize: 11,
    color: '#667085',
  },

  bookingStatus: {
    fontSize: 10,
    color: '#667085',
  },

  chatPanel: {
    minWidth: 0,
  },

  chatHeader: {
    padding: 16,
    borderBottom:
      '1px solid #e5e7eb',
  },

  chatTitle: {
    margin: 0,
  },

  chatMeta: {
    marginTop: 5,
    fontSize: 11,
    color: '#667085',
  },

  priceStrip: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(3, 1fr)',
    gap: 10,
    padding: 14,
    borderBottom:
      '1px solid #e5e7eb',
  },

  priceLabel: {
    display: 'block',
    fontSize: 9,
    color: '#667085',
    marginBottom: 4,
  },

  messagesArea: {
    minHeight: 350,
    maxHeight: 500,
    overflowY: 'auto',
    padding: 15,
    display: 'grid',
    gap: 10,
  },

  guestBubble: {
    maxWidth: 450,
    background: '#e8f1ff',
    padding: 10,
    borderRadius: 12,
  },

  hostBubble: {
    maxWidth: 450,
    background: '#ffffff',
    border:
      '1px solid #e1e5ea',
    padding: 10,
    borderRadius: 12,
  },

  specialOfferCard: {
    maxWidth: 520,
    background: '#effaf2',
    border:
      '1px solid #aad4b8',
    padding: 14,
    borderRadius: 13,
  },

  messageText: {
    whiteSpace: 'pre-wrap',
    marginTop: 7,
    lineHeight: 1.45,
  },

  offerAmounts: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(3, 1fr)',
    gap: 10,
    marginTop: 12,
    background: '#ffffff',
    padding: 10,
    borderRadius: 8,
  },

  acceptOfferButton: {
    marginTop: 12,
    border:
      '1px solid #79b78d',
    background: '#ffffff',
    color: '#23743c',
    padding: '9px 13px',
    borderRadius: 7,
    fontWeight: 800,
  },

  payButton: {
    marginTop: 12,
    border: 0,
    background: '#174f91',
    color: '#ffffff',
    padding: '10px 15px',
    borderRadius: 7,
    fontWeight: 800,
  },

  paidBox: {
    marginTop: 10,
    color: '#23743c',
    fontWeight: 800,
  },

  noticeBox: {
    margin: 12,
    padding: 10,
    background: '#eaf7ee',
    color: '#24723a',
    borderRadius: 8,
  },

  errorBox: {
    margin: 12,
    padding: 10,
    background: '#fdeaea',
    color: '#a12828',
    borderRadius: 8,
  },

  messageComposer: {
    display: 'grid',
    gridTemplateColumns:
      '1fr auto',
    gap: 10,
    padding: 14,
    borderTop:
      '1px solid #e5e7eb',
  },

  messageInput: {
    minHeight: 55,
    padding: 10,
    border:
      '1px solid #cfd6df',
    borderRadius: 8,
  },

  sendButton: {
    border: 0,
    background: '#174f91',
    color: '#ffffff',
    padding: '0 18px',
    borderRadius: 8,
    fontWeight: 800,
  },

  discountArea: {
    textAlign: 'right',
    padding: '0 14px 12px',
  },

  discountLink: {
    border: 0,
    background: 'transparent',
    color: '#7b8490',
    fontSize: 10,
    textDecoration: 'underline',
    cursor: 'pointer',
  },

  discountInline: {
    display: 'flex',
    gap: 6,
    justifyContent: 'flex-end',
  },

  discountInput: {
    width: 260,
    padding: 7,
    border:
      '1px solid #d6dbe1',
    borderRadius: 7,
  },

  centerBox: {
    maxWidth: 600,
    margin: '100px auto',
    background: '#ffffff',
    padding: 30,
    textAlign: 'center',
  },

  emptyCard: {
    background: '#ffffff',
    padding: 25,
    borderRadius: 12,
  },

  primaryLink: {
    color: '#174f91',
  },
};