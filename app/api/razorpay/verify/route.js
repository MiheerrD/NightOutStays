import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const {
      bookingCode,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = await request.json();

    if (
      !bookingCode ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return Response.json(
        {
          error:
            'Missing payment verification data.',
        },
        { status: 400 }
      );
    }

    /*
      VERIFY RAZORPAY SIGNATURE
    */

    const generatedSignature = crypto
      .createHmac(
        'sha256',
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(
        `${razorpay_order_id}|${razorpay_payment_id}`
      )
      .digest('hex');

    const generatedBuffer =
      Buffer.from(
        generatedSignature,
        'utf8'
      );

    const receivedBuffer =
      Buffer.from(
        razorpay_signature,
        'utf8'
      );

    if (
      generatedBuffer.length !==
      receivedBuffer.length
    ) {
      return Response.json(
        {
          error:
            'Payment signature verification failed.',
        },
        { status: 400 }
      );
    }

    const signatureMatches =
      crypto.timingSafeEqual(
        generatedBuffer,
        receivedBuffer
      );

    if (!signatureMatches) {
      return Response.json(
        {
          error:
            'Payment signature verification failed.',
        },
        { status: 400 }
      );
    }

    /*
      FETCH CURRENT BOOKING

      Important:
      payment amount is determined again
      from the database.

      We never trust an amount sent
      from the browser.
    */

    const {
      data: booking,
      error: bookingError,
    } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_code,
        property_id,
        check_in,
        check_out,
        total_amount,
        amount_including_gst,
        final_payable_amount,
        offer_status,
        razorpay_order_id,
        payment_status,
        booking_status
      `)
      .eq(
        'booking_code',
        bookingCode
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
        { status: 404 }
      );
    }

    /*
      ALREADY PAID
    */

    if (
      booking.payment_status ===
      'paid'
    ) {
      return Response.json(
        {
          success: true,
          bookingCode:
            booking.booking_code,
          paymentId:
            razorpay_payment_id,
          status:
            'paid',
          alreadyPaid:
            true,
        }
      );
    }

    /*
      CANCELLED BOOKING
    */

    if (
      booking.booking_status ===
      'cancelled'
    ) {
      return Response.json(
        {
          error:
            'Cancelled bookings cannot be paid.',
        },
        { status: 400 }
      );
    }

    /*
      VERIFY THIS RAZORPAY ORDER
      BELONGS TO THIS BOOKING
    */

    if (
      booking.razorpay_order_id !==
      razorpay_order_id
    ) {
      return Response.json(
        {
          error:
            'Order ID does not match this booking.',
        },
        { status: 400 }
      );
    }

    /*
      DETERMINE EXPECTED AMOUNT

      Accepted host offer:
      use final_payable_amount.

      Otherwise:
      use normal amount including GST.
    */

    let expectedPayableAmount =
      0;

    let paymentType =
      'normal';

    if (
      booking.offer_status ===
        'accepted' &&
      Number(
        booking.final_payable_amount
      ) > 0
    ) {
      expectedPayableAmount =
        Number(
          booking.final_payable_amount
        );

      paymentType =
        'special_offer';
    } else {
      expectedPayableAmount =
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
        expectedPayableAmount
      ) ||
      expectedPayableAmount <= 0
    ) {
      return Response.json(
        {
          error:
            'Invalid expected booking payment amount.',
        },
        { status: 400 }
      );
    }

    const expectedAmountInPaise =
      Math.round(
        expectedPayableAmount *
          100
      );

    /*
      FETCH PAYMENT DIRECTLY
      FROM RAZORPAY
    */

    const auth =
      Buffer.from(
        `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
      ).toString(
        'base64'
      );

    const paymentResponse =
      await fetch(
        `https://api.razorpay.com/v1/payments/${razorpay_payment_id}`,
        {
          headers: {
            Authorization:
              `Basic ${auth}`,
          },
          cache:
            'no-store',
        }
      );

    const payment =
      await paymentResponse.json();

    if (
      !paymentResponse.ok
    ) {
      console.error(
        'Razorpay payment fetch error:',
        payment
      );

      return Response.json(
        {
          error:
            'Unable to verify payment with Razorpay.',
        },
        { status: 500 }
      );
    }

    /*
      FINAL PAYMENT VALIDATION
    */

    if (
      payment.order_id !==
      razorpay_order_id
    ) {
      return Response.json(
        {
          error:
            'Razorpay order does not match.',
        },
        { status: 400 }
      );
    }

    if (
      Number(
        payment.amount
      ) !==
      expectedAmountInPaise
    ) {
      return Response.json(
        {
          error:
            'Paid amount does not match the booking amount.',
        },
        { status: 400 }
      );
    }

    if (
      payment.currency !==
      'INR'
    ) {
      return Response.json(
        {
          error:
            'Invalid payment currency.',
        },
        { status: 400 }
      );
    }

    if (
      payment.status !==
      'captured'
    ) {
      return Response.json(
        {
          error:
            'Payment has not been successfully captured.',
        },
        { status: 400 }
      );
    }

    /*
      DOUBLE BOOKING SAFETY CHECK

      Before confirming this booking,
      check whether another booking for
      the same property and dates has
      already become paid + confirmed.

      Pending unpaid bookings do not block.
    */

    const {
      data:
        conflictingBookings,
      error:
        conflictError,
    } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_code,
        check_in,
        check_out
      `)
      .eq(
        'property_id',
        booking.property_id
      )
      .eq(
        'payment_status',
        'paid'
      )
      .eq(
        'booking_status',
        'confirmed'
      )
      .neq(
        'id',
        booking.id
      )
      .lt(
        'check_in',
        booking.check_out
      )
      .gt(
        'check_out',
        booking.check_in
      );

    if (
      conflictError
    ) {
      console.error(
        'Conflict check failed:',
        conflictError
      );

      return Response.json(
        {
          error:
            'Unable to verify booking availability after payment.',
        },
        { status: 500 }
      );
    }

    if (
      conflictingBookings &&
      conflictingBookings.length >
        0
    ) {
      /*
        Important:
        payment has already succeeded,
        so do NOT silently confirm an
        overlapping booking.

        This should later trigger manual
        refund handling.
      */

      console.error(
        'Paid booking conflict detected:',
        {
          booking:
            booking.booking_code,
          conflicts:
            conflictingBookings,
        }
      );

      return Response.json(
        {
          error:
            'Payment succeeded, but these dates were already confirmed by another booking. Please contact support.',
          paymentCaptured:
            true,
        },
        { status: 409 }
      );
    }

    /*
      PAYMENT SUCCESS

      Paid means:
      booking confirmed
      dates blocked

      Availability pages already treat
      paid + confirmed bookings as blocked.
    */

    const paidAt =
      new Date().toISOString();

    const {
      data:
        updatedBooking,
      error:
        updateError,
    } = await supabase
      .from('bookings')
      .update({
        payment_status:
          'paid',

        booking_status:
          'confirmed',

        razorpay_payment_id,

        razorpay_signature,

        paid_at:
          paidAt,

        updated_at:
          paidAt,
      })
      .eq(
        'id',
        booking.id
      )
      .select(`
        id,
        booking_code,
        property_id,
        check_in,
        check_out,
        payment_status,
        booking_status,
        offer_status,
        final_payable_amount,
        amount_including_gst
      `)
      .single();

    if (
      updateError ||
      !updatedBooking
    ) {
      console.error(
        'Booking update error:',
        updateError
      );

      return Response.json(
        {
          error:
            'Payment succeeded but booking update failed.',
          paymentCaptured:
            true,
        },
        { status: 500 }
      );
    }

    /*
      ADD SYSTEM MESSAGE

      This lets both guest and host
      immediately see that payment
      succeeded.
    */

    const {
      error:
        messageError,
    } = await supabase
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
          paymentType ===
          'special_offer'
            ? `Payment received for the accepted special offer. Booking ${booking.booking_code} is confirmed.`
            : `Payment received. Booking ${booking.booking_code} is confirmed.`,

        message_type:
          'confirmation',

        is_read:
          false,
      });

    if (
      messageError
    ) {
      console.warn(
        'Booking confirmed but confirmation message could not be created:',
        messageError
      );
    }

    return Response.json({
      success:
        true,

      bookingCode:
        updatedBooking.booking_code,

      paymentId:
        razorpay_payment_id,

      status:
        'paid',

      bookingStatus:
        'confirmed',

      paymentType,

      amountPaid:
        expectedPayableAmount,

      datesBlocked:
        true,
    });
  } catch (
    error
  ) {
    console.error(
      'Razorpay verify error:',
      error
    );

    return Response.json(
      {
        error:
          'Server error while verifying payment.',
      },
      { status: 500 }
    );
  }
}