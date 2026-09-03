import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxwemplbykjxhezefykh.supabase.co';

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireActiveHost(request, supabase) {
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

async function hostBooking(supabase, hostId, bookingId) {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select(`
      id,
      booking_code,
      property_id,
      guest_id,
      check_in,
      check_out,
      guests_count,
      booking_status,
      payment_status,
      host_decision,
      guest_discount_requested,
      offer_status,
      created_at,
      updated_at
    `)
    .eq('id', bookingId)
    .maybeSingle();

  if (error || !booking) return null;

  const { data: property } = await supabase
    .from('properties')
    .select('id, name, location_name, host_id')
    .eq('id', booking.property_id)
    .maybeSingle();

  if (!property || property.host_id !== hostId) return null;

  return { ...booking, property };
}

export async function GET(request) {
  try {
    const supabase = adminClient();
    const auth = await requireActiveHost(request, supabase);
    if (auth.error) return auth.error;

    const { host } = auth;

    const { data: properties, error: propertyError } = await supabase
      .from('properties')
      .select('id, name, location_name')
      .eq('host_id', host.id)
      .order('name', { ascending: true });

    if (propertyError) throw propertyError;

    const propertyIds = (properties || []).map((p) => p.id);
    if (!propertyIds.length) {
      return Response.json({ success: true, host, threads: [] });
    }

    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_code,
        property_id,
        guest_id,
        check_in,
        check_out,
        guests_count,
        booking_status,
        payment_status,
        host_decision,
        guest_discount_requested,
        offer_status,
        created_at,
        updated_at
      `)
      .in('property_id', propertyIds)
      .order('updated_at', { ascending: false });

    if (bookingError) throw bookingError;

    const rows = bookings || [];
    if (!rows.length) {
      return Response.json({ success: true, host, threads: [] });
    }

    const bookingIds = rows.map((b) => b.id);
    const guestIds = [...new Set(rows.map((b) => b.guest_id).filter(Boolean))];

    const [{ data: guests }, { data: messages, error: messageError }] = await Promise.all([
      guestIds.length
        ? supabase.from('guests').select('id, full_name, phone, email').in('id', guestIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from('booking_messages')
        .select('id, booking_id, sender_type, sender_name, message, message_type, is_read, created_at')
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: true }),
    ]);

    if (messageError) throw messageError;

    const propertyMap = Object.fromEntries((properties || []).map((p) => [p.id, p]));
    const guestMap = Object.fromEntries((guests || []).map((g) => [g.id, g]));
    const messagesByBooking = {};

    (messages || []).forEach((m) => {
      if (!messagesByBooking[m.booking_id]) messagesByBooking[m.booking_id] = [];
      messagesByBooking[m.booking_id].push(m);
    });

    const threads = rows.map((booking) => {
      const list = messagesByBooking[booking.id] || [];
      const unread = list.filter((m) => m.sender_type === 'guest' && !m.is_read).length;
      return {
        booking,
        property: propertyMap[booking.property_id] || null,
        guest: guestMap[booking.guest_id] || null,
        messages: list,
        unread,
        lastMessage: list.length ? list[list.length - 1] : null,
      };
    });

    threads.sort((a, b) => {
      const aTime = new Date(a.lastMessage?.created_at || a.booking.updated_at || a.booking.created_at || 0).getTime();
      const bTime = new Date(b.lastMessage?.created_at || b.booking.updated_at || b.booking.created_at || 0).getTime();
      return bTime - aTime;
    });

    return Response.json({ success: true, host, threads });
  } catch (error) {
    console.error('Host messages GET error:', error);
    return Response.json({ success: false, error: error?.message || 'Unable to load Host messages.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = adminClient();
    const auth = await requireActiveHost(request, supabase);
    if (auth.error) return auth.error;

    const { host } = auth;
    const body = await request.json();
    const bookingId = String(body?.bookingId || '').trim();
    const text = String(body?.message || '').trim();

    if (!bookingId || !text) {
      return Response.json({ success: false, error: 'Booking and message are required.' }, { status: 400 });
    }

    if (text.length > 3000) {
      return Response.json({ success: false, error: 'Message is too long.' }, { status: 400 });
    }

    const booking = await hostBooking(supabase, host.id, bookingId);
    if (!booking) {
      return Response.json({ success: false, error: 'You cannot access this booking conversation.' }, { status: 403 });
    }

    const senderName = host.business_name || host.full_name || 'Host';

    const { data: message, error: insertError } = await supabase
      .from('booking_messages')
      .insert({
        booking_id: bookingId,
        sender_type: 'host',
        sender_name: senderName,
        message: text,
        message_type: 'message',
        is_read: false,
      })
      .select('id, booking_id, sender_type, sender_name, message, message_type, is_read, created_at')
      .single();

    if (insertError) throw insertError;

    return Response.json({ success: true, message });
  } catch (error) {
    console.error('Host messages POST error:', error);
    return Response.json({ success: false, error: error?.message || 'Unable to send message.' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const supabase = adminClient();
    const auth = await requireActiveHost(request, supabase);
    if (auth.error) return auth.error;

    const { host } = auth;
    const body = await request.json();
    const bookingId = String(body?.bookingId || '').trim();

    if (!bookingId) {
      return Response.json({ success: false, error: 'Booking is required.' }, { status: 400 });
    }

    const booking = await hostBooking(supabase, host.id, bookingId);
    if (!booking) {
      return Response.json({ success: false, error: 'You cannot access this booking conversation.' }, { status: 403 });
    }

    const { error: updateError } = await supabase
      .from('booking_messages')
      .update({ is_read: true })
      .eq('booking_id', bookingId)
      .eq('sender_type', 'guest')
      .eq('is_read', false);

    if (updateError) throw updateError;

    return Response.json({ success: true });
  } catch (error) {
    console.error('Host messages PATCH error:', error);
    return Response.json({ success: false, error: error?.message || 'Unable to update messages.' }, { status: 500 });
  }
}
