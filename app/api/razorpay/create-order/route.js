import {
  createClient,
} from '@supabase/supabase-js';

const SUPABASE_URL =
  'https://gxwemplbykjxhezefykh.supabase.co';

function getSupabaseAdmin() {
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured.'
    );
  }

  return createClient(
    SUPABASE_URL,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

export async function POST(request) {
  try {
    const supabase =
      getSupabaseAdmin();

    const {
      bookingCode,
    } =
      await request.json();

    const cleanBookingCode =
      String(
        bookingCode || ''
      ).trim();

    if (
      !cleanBookingCode
    ) {
      return Response.json(
        {
          error:
            'Booking code is required.',
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: booking,
      error:
        bookingError,
    } =
      await supabase
        .from('bookings')
        .select(`
          id,
          booking_code,
          total_amount,
          amount_including_gst,
          final_payable_amount,
          offer_status,
          booking_status,
          payment_status,
          host_decision,
          host_decision_at,
          payment_due_at,
          razorpay_order_id
        `)
        .eq(
          'booking_code',
          cleanBookingCode
        )
        .single();

    if (
      bookingError ||
      !booking
    ) {
      console.error(
        'Booking fetch error:',
        bookingError
      );

      return Response.json(
        {
          error:
            'Booking not found.',
        },
        {
          status: 404,
        }
      );
    }

    /*
      Already paid:
      never create another order.
    */
    if (
      booking.payment_status ===
      'paid'
    ) {
      return Response.json(
        {
          error:
            'This booking is already paid.',
        },
        {
          status: 400,
        }
      );
    }

    /*
      Closed bookings cannot
      proceed to payment.
    */
    if (
      booking.booking_status ===
        'cancelled' ||
      booking.booking_status ===
        'declined' ||
      booking.booking_status ===
        'completed'
    ) {
      return Response.json(
        {
          error:
            'This booking is no longer available for payment.',
        },
        {
          status: 400,
        }
      );
    }

    /*
      Host must approve before
      any payment is allowed.
    */
    if (
      booking.host_decision !==
      'approved' &&
      booking.offer_status !==
      'accepted'
    ) {
      return Response.json(
        {
          error:
            'Host approval is required before payment.',
        },
        {
          status: 400,
        }
      );
    }

    /*
      24-HOUR PAYMENT DEADLINE

      payment_due_at is the
      authoritative deadline.

      Guest accepting the offer
      does NOT restart this timer.
    */
    if (
      booking.payment_due_at
    ) {
      const paymentDueTime =
        new Date(
          booking.payment_due_at
        ).getTime();

      if (
        Number.isFinite(
          paymentDueTime
        ) &&
        Date.now() >
          paymentDueTime
      ) {
        const now =
          new Date().toISOString();

        const {
          error:
            expiryUpdateError,
        } =
          await supabase
            .from('bookings')
            .update({
              booking_status:
                'cancelled',

              updated_at:
                now,
            })
            .eq(
              'id',
              booking.id
            )
            .eq(
              'payment_status',
              'unpaid'
            );

        if (
          expiryUpdateError
        ) {
          console.error(
            'Unable to expire booking:',
            expiryUpdateError
          );
        }

        const {
          error:
            expiryMessageError,
        } =
          await supabase
            .from(
              'booking_messages'
            )
            .insert({
              booking_id:
                booking.id,

              sender_type:
                'system',

              sender_name:
                'NightOutStays',

              message:
                'Host approval expired because payment was not completed within 24 hours. Please submit a new booking request.',

              message_type:
                'system',

              is_read:
                false,
            });

        if (
          expiryMessageError
        ) {
          console.warn(
            'Expiry message failed:',
            expiryMessageError
          );
        }

        return Response.json(
          {
            expired:
              true,

            error:
              'The 24-hour payment period has expired. Please submit a new booking request.',
          },
          {
            status: 410,
          }
        );
      }
    }

    /*
      PAYMENT AMOUNT
    */
    let payableAmount =
      0;

    let paymentType =
      'normal';

    /*
      Only an ACCEPTED host
      special offer overrides
      the normal booking amount.
    */
    if (
      booking.offer_status ===
        'accepted' &&
      Number(
        booking.final_payable_amount
      ) > 0
    ) {
      payableAmount =
        Number(
          booking.final_payable_amount
        );

      paymentType =
        'special_offer';
    } else {
      /*
        Normal booking:
        amount including GST
        is preferred.
      */
      payableAmount =
        Number(
          booking.amount_including_gst ||
          booking.total_amount ||
          0
        );

      paymentType =
        'normal';
    }

    if (
      !Number.isFinite(
        payableAmount
      ) ||
      payableAmount <= 0
    ) {
      return Response.json(
        {
          error:
            'Invalid booking payment amount.',
        },
        {
          status: 400,
        }
      );
    }

    const amountInPaise =
      Math.round(
        payableAmount *
          100
      );

    if (
      amountInPaise < 100
    ) {
      return Response.json(
        {
          error:
            'Invalid payment amount.',
        },
        {
          status: 400,
        }
      );
    }

    /*
      RAZORPAY ENVIRONMENT
    */
    const razorpayKeyId =
      process.env.RAZORPAY_KEY_ID;

    const razorpayKeySecret =
      process.env.RAZORPAY_KEY_SECRET;

    if (
      !razorpayKeyId ||
      !razorpayKeySecret
    ) {
      throw new Error(
        'Razorpay environment variables are not configured.'
      );
    }

    const auth =
      Buffer.from(
        `${razorpayKeyId}:${razorpayKeySecret}`
      ).toString(
        'base64'
      );

    /*
      CREATE RAZORPAY ORDER
    */
    const razorpayResponse =
      await fetch(
        'https://api.razorpay.com/v1/orders',
        {
          method:
            'POST',

          headers: {
            Authorization:
              `Basic ${auth}`,

            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify({
              amount:
                amountInPaise,

              currency:
                'INR',

              receipt:
                booking.booking_code,

              notes: {
                booking_code:
                  booking.booking_code,

                payment_type:
                  paymentType,
              },
            }),
        }
      );

    const razorpayOrder =
      await razorpayResponse.json();

    if (
      !razorpayResponse.ok
    ) {
      console.error(
        'Razorpay order error:',
        razorpayOrder
      );

      return Response.json(
        {
          error:
            razorpayOrder
              ?.error
              ?.description ||
            'Unable to create Razorpay order.',
        },
        {
          status: 500,
        }
      );
    }

    /*
      SAVE ORDER ID
    */
    const {
      error:
        updateError,
    } =
      await supabase
        .from('bookings')
        .update({
          razorpay_order_id:
            razorpayOrder.id,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          booking.id
        );

    if (
      updateError
    ) {
      console.error(
        'Unable to save Razorpay order:',
        updateError
      );

      return Response.json(
        {
          error:
            'Unable to save payment order.',
        },
        {
          status: 500,
        }
      );
    }

    return Response.json({
      success:
        true,

      orderId:
        razorpayOrder.id,

      amount:
        razorpayOrder.amount,

      currency:
        razorpayOrder.currency,

      keyId:
        razorpayKeyId,

      bookingCode:
        booking.booking_code,

      paymentType,

      payableAmount,

      paymentDueAt:
        booking.payment_due_at,
    });
  } catch (error) {
    console.error(
      'Create Razorpay order error:',
      error
    );

    return Response.json(
      {
        error:
          error?.message ||
          'Server error while creating payment order.',
      },
      {
        status: 500,
      }
    );
  }
}