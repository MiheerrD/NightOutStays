import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxwemplbykjxhezefykh.supabase.co';

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function authenticateHost(supabase, request) {
  const token = String(request.headers.get('authorization') || '')
    .replace(/^Bearer\s+/i, '')
    .trim();

  if (!token) {
    return { error: Response.json({ success: false, error: 'Authentication required.' }, { status: 401 }) };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) {
    return { error: Response.json({ success: false, error: 'Invalid login session.' }, { status: 401 }) };
  }

  const { data: host, error: hostError } = await supabase
    .from('host_profiles')
    .select('id, user_id, full_name, business_name, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (hostError || !host || host.status !== 'active') {
    return { error: Response.json({ success: false, error: 'Active Host account required.' }, { status: 403 }) };
  }

  return { user, host };
}

export async function GET(request) {
  try {
    const supabase = adminClient();
    const auth = await authenticateHost(supabase, request);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const propertyId = String(url.searchParams.get('propertyId') || '').trim();

    const { data: properties, error: propertyError } = await supabase
      .from('properties')
      .select('id, name, slug, location_name, is_active, moderation_status')
      .eq('host_id', auth.host.id)
      .order('name', { ascending: true });

    if (propertyError) throw propertyError;
    const propertyRows = properties || [];

    if (!propertyId) {
      return Response.json({ success: true, host: auth.host, properties: propertyRows, bookings: [], blockedDates: [] });
    }

    const property = propertyRows.find((row) => row.id === propertyId);
    if (!property) {
      return Response.json({ success: false, error: 'Property not found for this Host.' }, { status: 404 });
    }

    const [bookingResult, blockedResult] = await Promise.all([
      supabase
        .from('bookings')
        .select(`
          id,
          booking_code,
          property_id,
          guest_id,
          check_in,
          check_out,
          guests_count,
          nights,
          booking_status,
          payment_status,
          host_decision,
          guest_discount_requested,
          offer_status,
          final_payable_amount,
          total_amount,
          created_at,
          payment_due_at,
          guests (
            id,
            full_name,
            phone,
            email
          )
        `)
        .eq('property_id', propertyId)
        .order('check_in', { ascending: true }),
      supabase
        .from('blocked_dates')
        .select('id, property_id, start_date, end_date, reason, source, external_uid, created_at')
        .eq('property_id', propertyId)
        .order('start_date', { ascending: true }),
    ]);

    if (bookingResult.error) throw bookingResult.error;
    if (blockedResult.error) throw blockedResult.error;

    return Response.json({
      success: true,
      host: auth.host,
      properties: propertyRows,
      property,
      bookings: (bookingResult.data || []).map((b) => {
        const paid = String(b.payment_status || '').toLowerCase() === 'paid';
        const guest = b.guests ? { ...b.guests, phone: paid ? b.guests.phone : null, email: paid ? b.guests.email : null } : null;
        return { ...b, guests: guest, contactsUnlocked: paid };
      }),
      blockedDates: blockedResult.data || [],
      interestDates: (bookingResult.data || []).filter(b=>String(b.payment_status||'').toLowerCase()!=='paid' && !['cancelled','declined','expired'].includes(String(b.booking_status||'').toLowerCase())).map(b=>({booking_id:b.id,booking_code:b.booking_code,check_in:b.check_in,check_out:b.check_out,status:b.host_decision==='approved'?'payment_due':'requested'})),
    });
  } catch (error) {
    console.error('Host calendar load error:', error);
    return Response.json({ success: false, error: error?.message || 'Unable to load Host calendar.' }, { status: 500 });
  }
}
