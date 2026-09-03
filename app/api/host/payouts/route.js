import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxwemplbykjxhezefykh.supabase.co';

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }

  return createClient(
    SUPABASE_URL,
    key,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

const num = (value) => Number(value || 0);

function isPaid(booking) {
  return (
    String(booking.payment_status || '').toLowerCase() === 'paid' ||
    Boolean(booking.razorpay_payment_id) ||
    Boolean(booking.paid_at)
  );
}

export async function GET(request) {
  try {
    const supabase = adminClient();

    const token = String(
      request.headers.get('authorization') || ''
    )
      .replace(/^Bearer\s+/i, '')
      .trim();

    if (!token) {
      return Response.json(
        {
          success: false,
          error: 'Authentication required.',
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser(token);

    const user = userData?.user;

    if (userError || !user) {
      return Response.json(
        {
          success: false,
          error: 'Invalid login session.',
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: host,
      error: hostError,
    } = await supabase
      .from('host_profiles')
      .select(
        `
          id,
          user_id,
          bank_account_name,
          bank_account_number,
          bank_ifsc,
          bank_name,
          bank_branch,
          bank_account_type,
          cancelled_cheque_path,
          pan_number,
          gstin,
          status
        `
      )
      .eq('user_id', user.id)
      .maybeSingle();

    if (
      hostError ||
      !host ||
      host.status !== 'active'
    ) {
      return Response.json(
        {
          success: false,
          error: 'Active Host account required.',
        },
        {
          status: 403,
        }
      );
    }

    const {
      data: properties,
      error: propertyError,
    } = await supabase
      .from('properties')
      .select('id, name')
      .eq('host_id', host.id)
      .order('name');

    if (propertyError) {
      throw propertyError;
    }

    const propertyRows =
      properties || [];

    const propertyIds =
      propertyRows.map(
        (property) => property.id
      );

    let bookings = [];

    if (propertyIds.length) {
      const {
        data,
        error,
      } = await supabase
        .from('bookings')
        .select(
          `
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
            paid_at,
            base_amount,
            auto_discount_amount,
            host_discount_amount,
            final_payable_amount,
            taxable_amount,
            gst_rate,
            gst_amount,
            amount_including_gst,
            razorpay_payment_id
          `
        )
        .in(
          'property_id',
          propertyIds
        )
        .order(
          'paid_at',
          {
            ascending: false,
            nullsFirst: false,
          }
        );

      if (error) {
        throw error;
      }

      bookings =
        (data || []).filter(
          isPaid
        );
    }

    const guestIds = [
      ...new Set(
        bookings
          .map(
            (booking) =>
              booking.guest_id
          )
          .filter(Boolean)
      ),
    ];

    let guests = [];

    if (guestIds.length) {
      const {
        data,
        error,
      } = await supabase
        .from('guests')
        .select(
          'id, full_name'
        )
        .in(
          'id',
          guestIds
        );

      if (!error) {
        guests =
          data || [];
      }
    }

    const propertyMap =
      Object.fromEntries(
        propertyRows.map(
          (property) => [
            property.id,
            property.name,
          ]
        )
      );

    const guestMap =
      Object.fromEntries(
        guests.map(
          (guest) => [
            guest.id,
            guest.full_name,
          ]
        )
      );

    const rows =
      bookings.map(
        (booking) => {
          const taxable =
            num(
              booking.taxable_amount
            ) ||
            num(
              booking.final_payable_amount
            ) ||
            num(
              booking.total_amount
            );

          const gst =
            num(
              booking.gst_amount
            );

          const paidAmount =
            num(
              booking.amount_including_gst
            ) ||
            taxable + gst ||
            num(
              booking.total_amount
            );

          return {
            ...booking,
            property_name:
              propertyMap[
                booking.property_id
              ] ||
              'Property',
            guest_name:
              guestMap[
                booking.guest_id
              ] ||
              'Guest',
            taxable_amount:
              taxable,
            gst_amount:
              gst,
            paid_amount:
              paidAmount,
          };
        }
      );

    const summary =
      rows.reduce(
        (
          totals,
          booking
        ) => {
          totals.paid_bookings += 1;
          totals.gross_paid_value +=
            num(
              booking.paid_amount
            );
          totals.taxable_amount +=
            num(
              booking.taxable_amount
            );
          totals.gst_amount +=
            num(
              booking.gst_amount
            );
          totals.security_deposits +=
            num(
              booking.security_deposit
            );

          return totals;
        },
        {
          paid_bookings: 0,
          gross_paid_value: 0,
          taxable_amount: 0,
          gst_amount: 0,
          security_deposits: 0,
        }
      );

    const propertySummary =
      propertyRows.map(
        (property) => {
          const ownBookings =
            rows.filter(
              (booking) =>
                booking.property_id ===
                property.id
            );

          return {
            property_id:
              property.id,
            property_name:
              property.name,
            paid_bookings:
              ownBookings.length,
            gross_paid_value:
              ownBookings.reduce(
                (
                  total,
                  booking
                ) =>
                  total +
                  num(
                    booking.paid_amount
                  ),
                0
              ),
          };
        }
      );

    const bankComplete =
      Boolean(
        host.bank_account_name &&
        host.bank_account_number &&
        host.bank_ifsc &&
        host.bank_name &&
        host.bank_account_type
      );

    const account =
      String(
        host.bank_account_number ||
          ''
      );

    const maskedAccount =
      account
        ? `${'•'.repeat(
            Math.max(
              0,
              account.length - 4
            )
          )}${account.slice(-4)}`
        : null;

    return Response.json(
      {
        success: true,
        summary,
        properties:
          propertyRows,
        property_summary:
          propertySummary,
        bookings:
          rows,
        bank: {
          complete:
            bankComplete,
          account_name:
            host.bank_account_name,
          bank_name:
            host.bank_name,
          masked_account_number:
            maskedAccount,
          ifsc:
            host.bank_ifsc,
          account_type:
            host.bank_account_type,
          has_bank_proof:
            Boolean(
              host.cancelled_cheque_path
            ),
        },
        phase: 1,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      'Host payouts error:',
      error
    );

    return Response.json(
      {
        success: false,
        error:
          error?.message ||
          'Unable to load payout information.',
      },
      {
        status: 500,
      }
    );
  }
}
