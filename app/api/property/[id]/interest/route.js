import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gxwemplbykjxhezefykh.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function addDay(value) {
  const d = new Date(`${value}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function GET(req, { params }) {
  try {
    if (!SERVICE_ROLE) return Response.json({ error: 'Server configuration is missing.' }, { status: 500 });
    const { id } = await params;
    if (!id) return Response.json({ error: 'Property id is required.' }, { status: 400 });

    const requestUrl = new URL(req.url);
    const from = requestUrl.searchParams.get('from') || new Date().toISOString().slice(0, 10);
    const to = requestUrl.searchParams.get('to') || (() => {
      const d = new Date(); d.setMonth(d.getMonth() + 3); return d.toISOString().slice(0,10);
    })();

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase
      .from('bookings')
      .select('id,check_in,check_out,booking_status,payment_status,host_decision')
      .eq('property_id', id)
      .lt('check_in', to)
      .gt('check_out', from)
      .neq('booking_status', 'cancelled');
    if (error) throw error;

    const counts = {};
    for (const booking of data || []) {
      if (booking.payment_status === 'paid' || booking.booking_status === 'confirmed') continue;
      let day = booking.check_in;
      while (day && day < booking.check_out) {
        if (day >= from && day <= to) counts[day] = (counts[day] || 0) + 1;
        day = addDay(day);
      }
    }
    return Response.json({ success: true, counts });
  } catch (error) {
    console.error('Property interest API:', error);
    return Response.json({ error: error?.message || 'Unable to load date interest.' }, { status: 500 });
  }
}
