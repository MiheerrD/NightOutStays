import {
  createClient,
} from '@supabase/supabase-js';

const SUPABASE_URL =
  'https://gxwemplbykjxhezefykh.supabase.co';

/*
  Create Supabase admin client only
  when the API route is called.

  This prevents the build-time
  "supabaseKey is required" error.
*/
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

/*
  Check whether two booking
  date ranges overlap.

  Checkout date is NOT occupied.

  Example:

  Existing:
  10 Sep -> 12 Sep

  New:
  12 Sep -> 14 Sep

  This is NOT an overlap because
  the first guest checks out on
  12 Sep.
*/
function rangesOverlap(
  startA,
  endA,
  startB,
  endB
) {
  return (
    startA < endB &&
    endA > startB
  );
}

function getHostResponseDeadline(
  createdAt
) {
  if (!createdAt) {
    return null;
  }

  const created =
    new Date(createdAt);

  if (
    Number.isNaN(
      created.getTime()
    )
  ) {
    return null;
  }

  return new Date(
    created.getTime() +
      24 * 60 * 60 * 1000
  );
}

export async function POST(request) {
  try {
    const supabase =
      getSupabaseAdmin();

    const body =
      await request.json();

    const guestId =
      String(
        body?.guestId || ''
      ).trim();

    const propertyId =
      String(
        body?.propertyId || ''
      ).trim();

    const checkIn =
      String(
        body?.checkIn || ''
      ).trim();

    const checkOut =
      String(
        body?.checkOut || ''
      ).trim();

    /*
      ============================
      BASIC VALIDATION
      ============================
    */

    if (!guestId) {
      return Response.json(
        {
          success: false,
          error:
            'Guest ID is required.',
        },
        {
          status: 400,
        }
      );
    }

    if (!propertyId) {
      return Response.json(
        {
          success: false,
          error:
            'Property ID is required.',
        },
        {
          status: 400,
        }
      );
    }

    if (
      !checkIn ||
      !checkOut
    ) {
      return Response.json(
        {
          success: false,
          error:
            'Check-in and check-out dates are required.',
        },
        {
          status: 400,
        }
      );
    }

    if (
      checkOut <= checkIn
    ) {
      return Response.json(
        {
          success: false,
          error:
            'Check-out must be after check-in.',
        },
        {
          status: 400,
        }
      );
    }

    /*
      ======================================
      FIND EXISTING REQUESTS FOR THIS GUEST
      + PROPERTY
      ======================================

      We fetch possible records securely
      using the server service-role client.

      We intentionally do not depend on
      browser RLS for duplicate protection.
    */

    const {
      data: bookings,
      error: bookingError,
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
          booking_status,
          payment_status,
          host_decision,
          host_decision_at,
          payment_due_at,
          offer_status,
          created_at,
          updated_at
        `)
        .eq(
          'guest_id',
          guestId
        )
        .eq(
          'property_id',
          propertyId
        )
        .order(
          'created_at',
          {
            ascending: false,
          }
        );

    if (bookingError) {
      console.error(
        'Check existing booking error:',
        bookingError
      );

      return Response.json(
        {
          success: false,
          error:
            'Unable to check existing booking requests.',
        },
        {
          status: 500,
        }
      );
    }

    /*
      ======================================
      FIND OVERLAPPING ACTIVE REQUEST
      ======================================

      A NEW request is allowed only when
      the previous overlapping request is:

      cancelled
      declined
      completed

      Pending / approved / confirmed /
      awaiting payment remain protected
      from duplication.
    */

    let existingBooking =
      null;

    for (
      const booking
      of bookings || []
    ) {
      const bookingStatus =
        String(
          booking.booking_status ||
            ''
        ).toLowerCase();

      /*
        These are closed states.
        They do not prevent a new request.
      */
      if (
        bookingStatus ===
          'cancelled' ||
        bookingStatus ===
          'declined' ||
        bookingStatus ===
          'completed'
      ) {
        continue;
      }

      const overlaps =
        rangesOverlap(
          checkIn,
          checkOut,
          booking.check_in,
          booking.check_out
        );

      if (overlaps) {
        existingBooking =
          booking;

        break;
      }
    }

    /*
      ======================================
      NO DUPLICATE
      ======================================
    */

    if (!existingBooking) {
      return Response.json(
        {
          success: true,

          exists: false,

          booking: null,
        },
        {
          status: 200,
        }
      );
    }

    /*
      ======================================
      HOST RESPONSE DEADLINE
      ======================================
    */

    const hostDeadline =
      getHostResponseDeadline(
        existingBooking.created_at
      );

    const hostDecision =
      String(
        existingBooking.host_decision ||
          'pending'
      ).toLowerCase();

    const bookingStatus =
      String(
        existingBooking.booking_status ||
          ''
      ).toLowerCase();

    let hostResponseExpired =
      false;

    if (
      hostDecision ===
        'pending' &&
      bookingStatus ===
        'pending' &&
      hostDeadline
    ) {
      hostResponseExpired =
        Date.now() >
        hostDeadline.getTime();
    }

    /*
      IMPORTANT:

      We DO NOT automatically allow a
      duplicate merely because the
      24-hour deadline has passed.

      The expiry process will first
      change the old booking to
      cancelled.

      Until that happens, this API keeps
      protecting against duplicate rows.
    */

    const canRemindHost =
      hostDecision ===
        'pending' &&
      bookingStatus ===
        'pending' &&
      !hostResponseExpired;

    /*
      ======================================
      RETURN SAFE BOOKING INFORMATION
      ======================================

      No sensitive payment or internal
      admin information is returned.
    */

    return Response.json(
      {
        success: true,

        exists: true,

        booking: {
          id:
            existingBooking.id,

          booking_code:
            existingBooking.booking_code,

          property_id:
            existingBooking.property_id,

          guest_id:
            existingBooking.guest_id,

          check_in:
            existingBooking.check_in,

          check_out:
            existingBooking.check_out,

          booking_status:
            existingBooking.booking_status,

          payment_status:
            existingBooking.payment_status,

          host_decision:
            existingBooking.host_decision,

          host_decision_at:
            existingBooking.host_decision_at,

          payment_due_at:
            existingBooking.payment_due_at,

          offer_status:
            existingBooking.offer_status,

          created_at:
            existingBooking.created_at,
        },

        hostResponseDeadline:
          hostDeadline
            ? hostDeadline.toISOString()
            : null,

        hostResponseExpired,

        canRemindHost,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      'Check existing booking server error:',
      error
    );

    return Response.json(
      {
        success: false,

        error:
          error?.message ||
          'Server error while checking existing booking requests.',
      },
      {
        status: 500,
      }
    );
  }
}