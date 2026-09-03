import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxwemplbykjxhezefykh.supabase.co';

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function requireHost(request, supabase) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) throw new Error('UNAUTHORIZED');
  const { data, error } = await supabase.auth.getUser(token);
  const user = data?.user;
  if (error || !user) throw new Error('UNAUTHORIZED');
  const { data: host } = await supabase.from('host_profiles').select('id,status').eq('user_id', user.id).single();
  if (!host || host.status !== 'active') throw new Error('HOST_ACCESS_DENIED');
  return { host };
}

export async function POST(request) {
  try {
    const supabase = adminClient();
    const { host } = await requireHost(request, supabase);
    const body = await request.json();
    const { promotionId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!promotionId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return Response.json({ error: 'Incomplete payment verification data.' }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keySecret || !keyId) throw new Error('Razorpay environment variables are not configured.');

    const { data: promotion, error: promotionError } = await supabase
      .from('property_promotions')
      .select('*')
      .eq('id', promotionId)
      .eq('host_id', host.id)
      .single();
    if (promotionError || !promotion) return Response.json({ error: 'Promotion not found.' }, { status: 404 });

    if (promotion.status === 'pending_approval' && promotion.razorpay_payment_id) {
      return Response.json({ success: true, alreadyVerified: true, status: 'pending_approval' });
    }
    if (promotion.razorpay_order_id !== razorpay_order_id) {
      return Response.json({ error: 'Order does not match this promotion.' }, { status: 400 });
    }

    const expected = crypto.createHmac('sha256', keySecret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(String(razorpay_signature), 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return Response.json({ error: 'Payment signature verification failed.' }, { status: 400 });
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpay_payment_id)}`, {
      headers: { Authorization: `Basic ${auth}` },
      cache: 'no-store',
    });
    const payment = await paymentResponse.json();
    if (!paymentResponse.ok) {
      return Response.json({ error: payment?.error?.description || 'Unable to verify Razorpay payment.' }, { status: 500 });
    }

    if (payment.order_id !== razorpay_order_id || payment.currency !== 'INR' || payment.status !== 'captured') {
      return Response.json({ error: 'Razorpay payment is not valid or captured.' }, { status: 400 });
    }
    if (Number(payment.amount) !== Math.round(Number(promotion.total_amount) * 100)) {
      return Response.json({ error: 'Paid amount does not match the promotion amount.' }, { status: 400 });
    }

    const paidAt = payment.created_at
      ? new Date(Number(payment.created_at) * 1000).toISOString()
      : new Date().toISOString();

    const { error: updateError } = await supabase
      .from('property_promotions')
      .update({
        status: 'pending_approval',
        razorpay_payment_id,
        razorpay_signature,
        paid_at: paidAt,
        requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', promotion.id);
    if (updateError) throw updateError;

    return Response.json({ success: true, status: 'pending_approval' });
  } catch (error) {
    const message = error?.message || 'Unable to verify promotion payment.';
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'HOST_ACCESS_DENIED' ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
