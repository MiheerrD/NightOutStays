import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { bookingCode } = await request.json();

    if (!bookingCode) {
      return Response.json(
        { error: 'Booking code is required.' },
        { status: 400 }
      );
    }

    // Get booking and all payment-related fields
    const { data: booking, error: bookingError } = await supabase
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
        razorpay_order_id
      `)
      .eq('booking_code', bookingCode)
      .single();

    if (bookingError || !booking) {
      console.error('Booking fetch error:', bookingError);

      return Response.json(
        { error: 'Booking not found.' },
        { status: 404 }
      );
    }

    // Never allow payment twice
    if (booking.payment_status === 'paid') {
      return Response.json(
        { error: 'This booking is already paid.' },
        { status: 400 }
      );
    }

    // Cancelled booking cannot be paid
    if (booking.booking_status === 'cancelled') {
      return Response.json(
        { error: 'Cancelled bookings cannot be paid.' },
        { status: 400 }
      );
    }

    let payableAmount = 0;
    let paymentType = 'normal';

    /*
      SPECIAL OFFER RULE

      Only an ACCEPTED host offer can change
      the amount charged by Razorpay.

      host_offered alone is NOT enough.
    */
    if (
      booking.offer_status === 'accepted' &&
      Number(booking.final_payable_amount) > 0
    ) {
      payableAmount = Number(
        booking.final_payable_amount
      );

      paymentType = 'special_offer';
    } else {
      /*
        NORMAL BOOKING

        Prefer amount_including_gst because this
        represents the calculated booking amount
        including applicable GST.

        total_amount remains a fallback for older
        bookings.
      */
      payableAmount = Number(
        booking.amount_including_gst ||
        booking.total_amount ||
        0
      );

      paymentType = 'normal';
    }

    if (
      !Number.isFinite(payableAmount) ||
      payableAmount <= 0
    ) {
      return Response.json(
        { error: 'Invalid booking payment amount.' },
        { status: 400 }
      );
    }

    const amountInPaise = Math.round(
      payableAmount * 100
    );

    if (amountInPaise < 100) {
      return Response.json(
        { error: 'Invalid payment amount.' },
        { status: 400 }
      );
    }

    // Razorpay authentication
    const auth = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
    ).toString('base64');

    // Create Razorpay order
    const razorpayResponse = await fetch(
      'https://api.razorpay.com/v1/orders',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: booking.booking_code,

          notes: {
            booking_code: booking.booking_code,
            payment_type: paymentType,
          },
        }),
      }
    );

    const razorpayOrder =
      await razorpayResponse.json();

    if (!razorpayResponse.ok) {
      console.error(
        'Razorpay order error:',
        razorpayOrder
      );

      return Response.json(
        {
          error:
            razorpayOrder?.error?.description ||
            'Unable to create Razorpay order.',
        },
        { status: 500 }
      );
    }

    // Save Razorpay order against booking
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        razorpay_order_id: razorpayOrder.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id);

    if (updateError) {
      console.error(
        'Unable to save Razorpay order:',
        updateError
      );

      return Response.json(
        { error: 'Unable to save payment order.' },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,

      orderId: razorpayOrder.id,

      amount: razorpayOrder.amount,

      currency: razorpayOrder.currency,

      keyId: process.env.RAZORPAY_KEY_ID,

      bookingCode: booking.booking_code,

      paymentType,

      payableAmount,
    });
  } catch (error) {
    console.error(
      'Create Razorpay order error:',
      error
    );

    return Response.json(
      {
        error:
          'Server error while creating payment order.',
      },
      { status: 500 }
    );
  }
}