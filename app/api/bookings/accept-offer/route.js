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
    /*
      IMPORTANT:

      Supabase client is created
      inside POST instead of when
      Next.js builds the route.

      This prevents:
      "supabaseKey is required"
      during npm run build.
    */
    const supabase =
      getSupabaseAdmin();

    const body =
      await request.json();

    const bookingCode =
      String(
        body?.bookingCode || ''
      ).trim();

    if (!bookingCode) {
      return Response.json(
        {
          success: false,
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
      error: bookingError,
    } =
      await supabase
        .from('bookings')
        .select(`
          id,
          booking_code,
          offer_status,
          final_payable_amount,
          payment_status,
          booking_status,
          host_decision,
          payment_due_at
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
          error:
            'Booking not found.',
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
        'cancelled' ||
      booking.booking_status ===
        'declined'
    ) {
      return Response.json(
        {
          success: false,
          error:
            'This booking is no longer active.',
        },
        {
          status: 400,
        }
      );
    }

    if (
      booking.host_decision !==
      'approved'
    ) {
      return Response.json(
        {
          success: false,
          error:
            'The host must approve the booking before the offer can be accepted.',
        },
        {
          status: 400,
        }
      );
    }

    /*
      Guest has only 24 hours
      after host approval.

      payment_due_at is the
      authoritative deadline.
    */
    if (
      booking.payment_due_at
    ) {
      const dueTime =
        new Date(
          booking.payment_due_at
        ).getTime();

      if (
        Number.isFinite(
          dueTime
        ) &&
        Date.now() >
          dueTime
      ) {
        await supabase
          .from('bookings')
          .update({
            booking_status:
              'cancelled',

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            booking.id
          )
          .eq(
            'payment_status',
            'unpaid'
          );

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

        return Response.json(
          {
            success: false,

            expired: true,

            error:
              'The 24-hour payment period has expired. Please submit a new booking request.',
          },
          {
            status: 410,
          }
        );
      }
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
    } =
      await supabase
        .from('bookings')
        .update({
          offer_status:
            'accepted',

          booking_status:
            'confirmed',

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          booking.id
        )
        .eq(
          'payment_status',
          'unpaid'
        )
        .select(`
          id,
          booking_code,
          offer_status,
          booking_status,
          final_payable_amount,
          payment_due_at
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
            `Guest accepted the host special offer. Final payable amount: ₹${finalPayable.toLocaleString(
              'en-IN',
              {
                minimumFractionDigits:
                  2,

                maximumFractionDigits:
                  2,
              }
            )}. Payment must be completed before the existing payment deadline.`,

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

        bookingStatus:
          updatedBooking.booking_status,

        finalPayableAmount:
          Number(
            updatedBooking.final_payable_amount ||
              0
          ),

        paymentDueAt:
          updatedBooking.payment_due_at,
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