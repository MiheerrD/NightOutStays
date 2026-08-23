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

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(
        'id, booking_code, total_amount, booking_status, payment_status, razorpay_order_id'
      )
      .eq('booking_code', bookingCode)
      .single();

    if (bookingError || !booking) {
      return Response.json(
        { error: 'Booking not found.' },
        { status: 404 }
      );
    }

    if (booking.payment_status === 'paid') {
      return Response.json(
        { error: 'This booking is already paid.' },
        { status: 400 }
      );
    }

    if (booking.booking_status === 'cancelled') {
      return Response.json(
        { error: 'Cancelled bookings cannot be paid.' },
        { status: 400 }
      );
    }

    const amountInPaise = Math.round(
      Number(booking.total_amount) * 100
    );

    if (amountInPaise < 100) {
      return Response.json(
        { error: 'Invalid payment amount.' },
        { status: 400 }
      );
    }

    const auth = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
    ).toString('base64');

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
          },
        }),
      }
    );

    const razorpayOrder = await razorpayResponse.json();

    if (!razorpayResponse.ok) {
      console.error('Razorpay order error:', razorpayOrder);

      return Response.json(
        {
          error:
            razorpayOrder?.error?.description ||
            'Unable to create Razorpay order.',
        },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        razorpay_order_id: razorpayOrder.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id);

    if (updateError) {
      console.error(updateError);

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
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: 'Server error while creating payment order.' },
      { status: 500 }
    );
  }
}