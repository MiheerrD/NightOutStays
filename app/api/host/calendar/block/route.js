import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxwemplbykjxhezefykh.supabase.co';

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getHost(supabase, request) {
  const token = String(request.headers.get('authorization') || '')
    .replace(/^Bearer\s+/i, '')
    .trim();

  if (!token) return null;
  const { data } = await supabase.auth.getUser(token);
  const user = data?.user;
  if (!user) return null;

  const { data: host } = await supabase
    .from('host_profiles')
    .select('id, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!host || host.status !== 'active') return null;
  return { user, host };
}

async function ownsProperty(supabase, hostId, propertyId) {
  const { data } = await supabase
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .eq('host_id', hostId)
    .maybeSingle();
  return Boolean(data);
}

export async function POST(request) {
  try {
    const supabase = adminClient();
    const auth = await getHost(supabase, request);
    if (!auth) return Response.json({ success: false, error: 'Active Host login required.' }, { status: 401 });

    const body = await request.json();
    const propertyId = String(body?.propertyId || '').trim();
    const startDate = String(body?.startDate || '').slice(0, 10);
    const endDate = String(body?.endDate || '').slice(0, 10);
    const reason = String(body?.reason || 'Host blocked').trim().slice(0, 250) || 'Host blocked';

    if (!propertyId || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return Response.json({ success: false, error: 'Property, start date and end date are required.' }, { status: 400 });
    }
    if (endDate < startDate) {
      return Response.json({ success: false, error: 'End date cannot be before start date.' }, { status: 400 });
    }
    if (!(await ownsProperty(supabase, auth.host.id, propertyId))) {
      return Response.json({ success: false, error: 'You cannot manage this property.' }, { status: 403 });
    }

    const { data: paidBookings, error: paidError } = await supabase
      .from('bookings')
      .select('id, booking_code, check_in, check_out')
      .eq('property_id', propertyId)
      .eq('payment_status', 'paid')
      .lt('check_in', new Date(new Date(`${endDate}T00:00:00`).getTime() + 86400000).toISOString().slice(0, 10))
      .gt('check_out', startDate);

    if (paidError) throw paidError;
    if ((paidBookings || []).length) {
      return Response.json({ success: false, error: 'These dates overlap a paid booking and cannot be blocked.' }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('blocked_dates')
      .insert({
        property_id: propertyId,
        start_date: startDate,
        end_date: endDate,
        reason,
        source: 'manual',
      })
      .select('id, property_id, start_date, end_date, reason, source, created_at')
      .single();

    if (error) throw error;
    return Response.json({ success: true, block: data });
  } catch (error) {
    console.error('Host calendar block error:', error);
    return Response.json({ success: false, error: error?.message || 'Unable to block dates.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const supabase = adminClient();
    const auth = await getHost(supabase, request);
    if (!auth) return Response.json({ success: false, error: 'Active Host login required.' }, { status: 401 });

    const body = await request.json();
    const blockId = String(body?.blockId || '').trim();
    if (!blockId) return Response.json({ success: false, error: 'Block ID is required.' }, { status: 400 });

    const { data: block } = await supabase
      .from('blocked_dates')
      .select('id, property_id, source')
      .eq('id', blockId)
      .maybeSingle();

    if (!block) return Response.json({ success: false, error: 'Calendar block not found.' }, { status: 404 });
    if (String(block.source || '').toLowerCase() !== 'manual') {
      return Response.json({ success: false, error: 'External calendar blocks cannot be removed manually here.' }, { status: 409 });
    }
    if (!(await ownsProperty(supabase, auth.host.id, block.property_id))) {
      return Response.json({ success: false, error: 'You cannot manage this property.' }, { status: 403 });
    }

    const { error } = await supabase.from('blocked_dates').delete().eq('id', blockId);
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    console.error('Host calendar unblock error:', error);
    return Response.json({ success: false, error: error?.message || 'Unable to unblock dates.' }, { status: 500 });
  }
}
