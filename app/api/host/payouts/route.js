import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function clientForToken(token) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

const num = (v) => Number(v || 0);
const isPaid = (b) =>
  String(b.payment_status || '').toLowerCase() === 'paid' ||
  Boolean(b.razorpay_payment_id) ||
  Boolean(b.paid_at);

export async function GET(request) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

    // The browser normally supplies the Supabase session through cookies/client auth.
    // Fallback: accept access token query only when Authorization is unavailable.
    const url = new URL(request.url);
    const supplied = token || url.searchParams.get('access_token');
    if (!supplied) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const supabase = clientForToken(supplied);
    const { data: userData, error: userError } = await supabase.auth.getUser(supplied);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });
    }

    const { data: host, error: hostError } = await supabase
      .from('host_profiles')
      .select('id,user_id,bank_account_name,bank_account_number,bank_ifsc,bank_name,bank_branch,bank_account_type,cancelled_cheque_path,pan_number,gstin,status')
      .eq('user_id', userData.user.id)
      .eq('status', 'active')
      .single();

    if (hostError || !host) {
      return NextResponse.json({ error: 'Active Host account not found.' }, { status: 403 });
    }

    const { data: properties, error: propertyError } = await supabase
      .from('properties')
      .select('id,name')
      .eq('host_id', host.id)
      .order('name');

    if (propertyError) throw propertyError;
    const propertyIds = (properties || []).map((p) => p.id);

    let bookings = [];
    if (propertyIds.length) {
      const { data, error } = await supabase
        .from('bookings')
        .select('id,booking_code,property_id,guest_id,check_in,check_out,guests_count,nights,nightly_rate,cleaning_fee,security_deposit,total_amount,booking_status,payment_status,paid_at,base_amount,auto_discount_amount,host_discount_amount,final_payable_amount,taxable_amount,gst_rate,gst_amount,amount_including_gst,razorpay_payment_id')
        .in('property_id', propertyIds)
        .order('paid_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      bookings = (data || []).filter(isPaid);
    }

    const guestIds = [...new Set(bookings.map((b) => b.guest_id).filter(Boolean))];
    let guests = [];
    if (guestIds.length) {
      const { data } = await supabase.from('guests').select('id,full_name').in('id', guestIds);
      guests = data || [];
    }

    const propertyMap = Object.fromEntries((properties || []).map((p) => [p.id, p.name]));
    const guestMap = Object.fromEntries(guests.map((g) => [g.id, g.full_name]));

    const rows = bookings.map((b) => {
      const taxable = num(b.taxable_amount) || num(b.final_payable_amount) || num(b.total_amount);
      const gst = num(b.gst_amount);
      const paidAmount = num(b.amount_including_gst) || (taxable + gst) || num(b.total_amount);
      return {
        ...b,
        property_name: propertyMap[b.property_id] || 'Property',
        guest_name: guestMap[b.guest_id] || 'Guest',
        taxable_amount: taxable,
        gst_amount: gst,
        paid_amount: paidAmount,
      };
    });

    const summary = rows.reduce((a, b) => {
      a.paid_bookings += 1;
      a.gross_paid_value += num(b.paid_amount);
      a.taxable_amount += num(b.taxable_amount);
      a.gst_amount += num(b.gst_amount);
      a.security_deposits += num(b.security_deposit);
      return a;
    }, { paid_bookings: 0, gross_paid_value: 0, taxable_amount: 0, gst_amount: 0, security_deposits: 0 });

    const propertySummary = (properties || []).map((p) => {
      const own = rows.filter((b) => b.property_id === p.id);
      return {
        property_id: p.id,
        property_name: p.name,
        paid_bookings: own.length,
        gross_paid_value: own.reduce((sum, b) => sum + num(b.paid_amount), 0),
      };
    });

    const bankComplete = Boolean(
      host.bank_account_name &&
      host.bank_account_number &&
      host.bank_ifsc &&
      host.bank_name &&
      host.bank_account_type
    );
    const account = String(host.bank_account_number || '');
    const masked = account ? `${'•'.repeat(Math.max(0, account.length - 4))}${account.slice(-4)}` : null;

    return NextResponse.json({
      summary,
      properties: properties || [],
      property_summary: propertySummary,
      bookings: rows,
      bank: {
        complete: bankComplete,
        account_name: host.bank_account_name,
        bank_name: host.bank_name,
        masked_account_number: masked,
        ifsc: host.bank_ifsc,
        account_type: host.bank_account_type,
        has_bank_proof: Boolean(host.cancelled_cheque_path),
      },
      phase: 1,
    });
  } catch (error) {
    console.error('Host payouts error:', error);
    return NextResponse.json({ error: 'Unable to load payout information.' }, { status: 500 });
  }
}
