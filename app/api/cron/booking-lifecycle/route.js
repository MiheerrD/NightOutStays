import { createClient } from '@supabase/supabase-js';
import { sendEmail, bookingUrl, esc, date } from '../../../lib/serverEmail';

const URL = 'https://gxwemplbykjxhezefykh.supabase.co';

function db() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  return createClient(URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function allowed(req) {
  const secret = process.env.CRON_SECRET;
  const auth = String(req.headers.get('authorization') || '');
  if (secret) return auth === `Bearer ${secret}`;
  return req.headers.get('x-vercel-cron') === '1' || String(req.headers.get('user-agent') || '').toLowerCase().includes('vercel-cron');
}

async function sent(d, bookingId, eventType, recipientType) {
  const { data } = await d.from('booking_email_events').select('id').eq('booking_id', bookingId).eq('event_type', eventType).eq('recipient_type', recipientType).maybeSingle();
  return Boolean(data);
}

async function mark(d, bookingId, eventType, recipientType, email, providerId, status = 'sent') {
  try { await d.from('booking_email_events').insert({ booking_id: bookingId, event_type: eventType, recipient_type: recipientType, recipient_email: email || null, provider_id: providerId || null, status }); } catch {}
}

export async function GET(req) {
  if (!allowed(req)) return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });

  const d = db();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let processed = 0;

  try {
    const { data: rows, error } = await d
      .from('bookings')
      .select('id,booking_code,property_id,guest_id,check_in,check_out,payment_status,booking_status,host_decision,payment_due_at')
      .or('payment_status.eq.paid,and(payment_status.eq.unpaid,host_decision.eq.approved)')
      .limit(300);
    if (error) throw error;

    const propertyIds = [...new Set((rows || []).map((x) => x.property_id).filter(Boolean))];
    const guestIds = [...new Set((rows || []).map((x) => x.guest_id).filter(Boolean))];
    const [{ data: props }, { data: guests }] = await Promise.all([
      propertyIds.length ? d.from('properties').select('id,name,host_id').in('id', propertyIds) : Promise.resolve({ data: [] }),
      guestIds.length ? d.from('guests').select('id,user_id,full_name,email,phone').in('id', guestIds) : Promise.resolve({ data: [] }),
    ]);
    const pmap = Object.fromEntries((props || []).map((x) => [x.id, x]));
    const gmap = Object.fromEntries((guests || []).map((x) => [x.id, x]));
    const hostIds = [...new Set((props || []).map((x) => x.host_id).filter(Boolean))];
    const { data: hosts } = hostIds.length
      ? await d.from('host_profiles').select('id,user_id,full_name,business_name,email,phone').in('id', hostIds)
      : { data: [] };
    const hmap = Object.fromEntries((hosts || []).map((x) => [x.id, x]));

    for (const b of rows || []) {
      const p = pmap[b.property_id] || {};
      const g = gmap[b.guest_id] || {};
      const h = hmap[p.host_id] || {};
      const paid = String(b.payment_status || '').toLowerCase() === 'paid';

      if (!paid && b.payment_due_at && new Date(b.payment_due_at) < now && String(b.booking_status || '').toLowerCase() !== 'cancelled') {
        await d.from('bookings').update({ booking_status: 'cancelled', updated_at: now.toISOString() }).eq('id', b.id).eq('payment_status', 'unpaid');
        try { await d.from('booking_messages').insert({ booking_id: b.id, sender_type: 'system', sender_name: 'NightOutStays', message: 'The 24-hour payment window expired. This unpaid booking request is now closed.', message_type: 'system', is_read: false }); } catch {}

        if (g.email && !(await sent(d, b.id, 'payment_expired', 'guest'))) {
          try {
            const r = await sendEmail({
              to: g.email,
              subject: `Payment window expired - ${p.name || b.booking_code}`,
              title: 'Your payment window expired',
              bodyHtml: `<p style="font-size:14px;color:#5d6670;line-height:1.6">The 24-hour payment window for <b>${esc(p.name || 'your stay')}</b> has expired. The dates are no longer reserved for this request.</p>`,
              ctaLabel: 'Search stays',
              ctaUrl: bookingUrl('/'),
            });
            await mark(d, b.id, 'payment_expired', 'guest', g.email, r.id);
          } catch {}
        }

        if (h.email && !(await sent(d, b.id, 'payment_expired', 'host'))) {
          try {
            const r = await sendEmail({
              to: h.email,
              subject: `Booking request expired - ${b.booking_code}`,
              title: 'An unpaid request expired',
              bodyHtml: `<p style="font-size:14px;color:#5d6670;line-height:1.6">The Guest did not complete payment within 24 hours for <b>${esc(p.name || 'your property')}</b>. The request has been closed.</p>`,
              ctaLabel: 'Open bookings',
              ctaUrl: bookingUrl('/host/bookings'),
            });
            await mark(d, b.id, 'payment_expired', 'host', h.email, r.id);
          } catch {}
        }
        processed += 1;
        continue;
      }

      if (paid && (b.check_in === today || b.check_in === tomorrow) && g.email && !(await sent(d, b.id, 'checkin_reminder', 'guest'))) {
        try {
          const r = await sendEmail({
            to: g.email,
            subject: `Check-in reminder - ${p.name || b.booking_code}`,
            title: b.check_in === today ? 'Your check-in is today' : 'Your check-in is tomorrow',
            bodyHtml: `<p style="font-size:14px;color:#5d6670;line-height:1.6">Your stay at <b>${esc(p.name || 'your property')}</b> starts on ${date(b.check_in)}.</p>${h.phone ? `<div style="background:#fff4f9;border:1px solid #ffd0e7;border-radius:12px;padding:13px"><b>Host contact</b><br/>${esc(h.business_name || h.full_name || 'Host')} · ${esc(h.phone)}</div>` : ''}`,
            ctaLabel: 'Open booking',
            ctaUrl: bookingUrl('/account/bookings'),
          });
          await mark(d, b.id, 'checkin_reminder', 'guest', g.email, r.id);
          processed += 1;
        } catch {}
      }

      if (paid && b.check_out && b.check_out < today && g.email && !(await sent(d, b.id, 'review_request', 'guest'))) {
        try {
          const r = await sendEmail({
            to: g.email,
            subject: `How was your stay at ${p.name || 'NightOutStays'}?`,
            title: 'Share your stay review',
            bodyHtml: `<p style="font-size:14px;color:#5d6670;line-height:1.6">Your stay at <b>${esc(p.name || 'the property')}</b> is complete. Your review helps future Guests and helps us recognise great Hosts.</p>`,
            ctaLabel: 'Share Review',
            ctaUrl: bookingUrl('/account/reviews'),
          });
          await mark(d, b.id, 'review_request', 'guest', g.email, r.id);
          processed += 1;
        } catch {}
      }
    }

    return Response.json({ success: true, processed, at: now.toISOString() });
  } catch (e) {
    console.error('booking lifecycle cron', e);
    return Response.json({ success: false, error: e?.message || 'Lifecycle processing failed.' }, { status: 500 });
  }
}
