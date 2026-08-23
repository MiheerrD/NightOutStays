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
        { error: 'Missing payment verification data.' },
        { status: 400 }
      );
    }

    const generatedSignature = crypto
      .createHmac(
        'sha256',
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(
        `${razorpay_order_id}|${razorpay_payment_id}`
      )
      .digest('hex');

    const signatureMatches = crypto.timingSafeEqual(
      Buffer.from(generatedSignature),
      Buffer.from(razorpay_signature)
    );

    if (!signatureMatches) {
      return Response.json(
        { error: 'Payment signature verification failed.' },
        { status: 400 }
      );
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(
        'id, booking_code, total_amount, razorpay_order_id, payment_status'
      )
      .eq('booking_code', bookingCode)
      .single();

    if (bookingError || !booking) {
      return Response.json(
        { error: 'Booking not found.' },
        { status: 404 }
      );
    }

    if (booking.razorpay_order_id !== razorpay_order_id) {
      return Response.json(
        { error: 'Order ID does not match this booking.' },
        { status: 400 }
      );
    }

    const auth = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
    ).toString('base64');

    const paymentResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${razorpay_payment_id}`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    const payment = await paymentResponse.json();

    if (!paymentResponse.ok) {
      return Response.json(
        { error: 'Unable to verify payment with Razorpay.' },
        { status: 500 }
      );
    }

    const expectedAmount = Math.round(
      Number(booking.total_amount) * 100
    );

    if (
      payment.order_id !== razorpay_order_id ||
      payment.amount !== expectedAmount ||
      payment.currency !== 'INR' ||
      payment.status !== 'captured'
    ) {
      return Response.json(
        {
          error:
            'Payment has not been successfully captured.',
        },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        payment_status: 'paid',
        booking_status: 'confirmed',
        razorpay_payment_id,
        razorpay_signature,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id);

    if (updateError) {
      console.error(updateError);

      return Response.json(
        { error: 'Payment succeeded but booking update failed.' },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      bookingCode: booking.booking_code,
      paymentId: razorpay_payment_id,
      status: 'paid',
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: 'Server error while verifying payment.' },
      { status: 500 }
    );
  }
}