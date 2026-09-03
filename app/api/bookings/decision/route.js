import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxwemplbykjxhezefykh.supabase.co';

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request) {
  try {
    const supabase = adminClient();
    const token = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return Response.json({ success: false, error: 'Authentication required.' }, { status: 401 });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return Response.json({ success: false, error: 'Invalid login session.' }, { status: 401 });

    const body = await request.json();
    const bookingId = String(body?.bookingId || '').trim();
    const decision = String(body?.decision || '').trim().toLowerCase();
    if (!bookingId || !['approved', 'declined'].includes(decision)) {
      return Response.json({ success: false, error: 'Valid booking and decision are required.' }, { status: 400 });
    }

    const { data: host, error: hostError } = await supabase
      .from('host_profiles')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (hostError || !host || host.status !== 'active') {
      return Response.json({ success: false, error: 'Active Host account required.' }, { status: 403 });
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, booking_code, property_id, payment_status, booking_status, host_decision, offer_status')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError || !booking) return Response.json({ success: false, error: 'Booking not found.' }, { status: 404 });

    const { data: property } = await supabase
      .from('properties')
      .select('id, host_id')
      .eq('id', booking.property_id)
      .maybeSingle();

    if (!property || property.host_id !== host.id) {
      return Response.json({ success: false, error: 'You cannot manage this booking.' }, { status: 403 });
    }

    if (String(booking.payment_status || '').toLowerCase() === 'paid') {
      return Response.json({ success: false, error: 'Paid bookings cannot be approved or declined here.' }, { status: 409 });
    }

    const now = new Date();
    const update = decision === 'approved'
      ? {
          host_decision: 'approved', host_decision_at: now.toISOString(), host_decision_by: user.id,
          booking_status: 'confirmed', payment_status: booking.payment_status || 'unpaid',
          payment_due_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), updated_at: now.toISOString(),
        }
      : {
          host_decision: 'declined', host_decision_at: now.toISOString(), host_decision_by: user.id,
          booking_status: 'cancelled', payment_due_at: null,
          offer_status: booking.offer_status === 'host_offered' ? 'declined' : booking.offer_status,
          updated_at: now.toISOString(),
        };

    const { error: updateError } = await supabase.from('bookings').update(update).eq('id', booking.id);
    if (updateError) throw updateError;

    await supabase.from('booking_messages').insert({
      booking_id: booking.id,
      sender_type: 'system',
      message: decision === 'approved'
        ? `Booking ${booking.booking_code} was approved by the host. Payment is due within 24 hours.`
        : `Booking ${booking.booking_code} was declined by the host.`,
      message_type: decision === 'approved' ? 'approval' : 'decline',
    }).then(() => {}).catch(() => {});

    return Response.json({ success: true, decision, paymentDueAt: update.payment_due_at || null });
  } catch (error) {
    console.error('Host booking decision error:', error);
    return Response.json({ success: false, error: error?.message || 'Unable to update booking.' }, { status: 500 });
  }
}
