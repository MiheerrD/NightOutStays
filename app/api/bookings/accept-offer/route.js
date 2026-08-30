import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();

    const bookingCode =
      String(
        body?.bookingCode || ''
      ).trim();

    if (!bookingCode) {
      return Response.json(
        {
          success: false,
          error: 'Booking code is required.',
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: booking,
      error: bookingError,
    } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_code,
        offer_status,
        final_payable_amount,
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
        'Accept offer booking error:',
        bookingError
      );

      return Response.json(
        {
          success: false,
          error: 'Booking not found.',
        },
        {
          status: 404,
        }
      );
    }

    if (
      booking.payment_status ===
      'paid'
    ) {
      return Response.json(
        {
          success: false,
          error:
            'This booking is already paid.',
        },
        {
          status: 400,
        }
      );
    }

    if (
      booking.booking_status ===
      'cancelled'
    ) {
      return Response.json(
        {
          success: false,
          error:
            'Cancelled booking cannot accept an offer.',
        },
        {
          status: 400,
        }
      );
    }

    if (
      booking.offer_status ===
      'accepted'
    ) {
      return Response.json({
        success: true,

        bookingCode:
          booking.booking_code,

        offerStatus:
          'accepted',

        finalPayableAmount:
          Number(
            booking.final_payable_amount ||
              0
          ),

        alreadyAccepted:
          true,
      });
    }

    if (
      booking.offer_status !==
      'host_offered'
    ) {
      return Response.json(
        {
          success: false,
          error:
            'There is no active host offer to accept.',
        },
        {
          status: 400,
        }
      );
    }

    const finalPayable =
      Number(
        booking.final_payable_amount ||
          0
      );

    if (
      !Number.isFinite(
        finalPayable
      ) ||
      finalPayable <= 0
    ) {
      return Response.json(
        {
          success: false,
          error:
            'Invalid special offer amount.',
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: updatedBooking,
      error: updateError,
    } = await supabase
      .from('bookings')
      .update({
        offer_status:
          'accepted',

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        booking.id
      )
      .select(`
        id,
        booking_code,
        offer_status,
        final_payable_amount
      `)
      .single();

    if (
      updateError ||
      !updatedBooking
    ) {
      console.error(
        'Accept offer update error:',
        updateError
      );

      return Response.json(
        {
          success: false,
          error:
            'Unable to accept special offer.',
        },
        {
          status: 500,
        }
      );
    }

    const {
      error: messageError,
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
          `Guest accepted the host special offer. Final payable amount: ₹${finalPayable.toLocaleString(
            'en-IN',
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          )}.`,

        message_type:
          'system',

        is_read:
          false,
      });

    if (messageError) {
      console.warn(
        'Offer accepted but message insert failed:',
        messageError
      );
    }

    return Response.json(
      {
        success: true,

        bookingCode:
          updatedBooking.booking_code,

        offerStatus:
          updatedBooking.offer_status,

        finalPayableAmount:
          Number(
            updatedBooking.final_payable_amount
          ),
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      'Accept offer server error:',
      error
    );

    return Response.json(
      {
        success: false,

        error:
          error?.message ||
          'Server error while accepting offer.',
      },
      {
        status: 500,
      }
    );
  }
}