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
  const { data } = await supabase.auth.getUser(token);
  const user = data?.user;
  if (!user) throw new Error('UNAUTHORIZED');
  const { data: host } = await supabase.from('host_profiles').select('id,status').eq('user_id', user.id).single();
  if (!host || host.status !== 'active') throw new Error('HOST_ACCESS_DENIED');
  return { user, host };
}

function slabFor(rate) {
  const nightly = Number(rate || 0);
  const fee = nightly <= 4999 ? 2500 : nightly <= 9999 ? 3500 : 5000;
  const gst = Math.round(fee * 0.18 * 100) / 100;
  return { fee, gst, total: fee + gst };
}

export async function POST(request) {
  try {
    const supabase = adminClient();
    const { host } = await requireHost(request, supabase);
    const { propertyId } = await request.json();
    if (!propertyId) return Response.json({ error: 'Property is required.' }, { status: 400 });

    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id,name,base_price,host_id')
      .eq('id', propertyId)
      .eq('host_id', host.id)
      .single();
    if (propertyError || !property) return Response.json({ error: 'Property not found.' }, { status: 404 });

    const pricing = slabFor(property.base_price);
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new Error('Razorpay environment variables are not configured.');

    const { data: subscription, error: insertError } = await supabase
      .from('property_subscriptions')
      .insert({
        property_id: property.id,
        host_id: host.id,
        plan_months: 1,
        nightly_rate_snapshot: Number(property.base_price || 0),
        fee_before_gst: pricing.fee,
        gst_rate: 18,
        gst_amount: pricing.gst,
        total_amount: pricing.total,
        status: 'pending',
      })
      .select('id')
      .single();
    if (insertError) throw insertError;

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(pricing.total * 100),
        currency: 'INR',
        receipt: `sub_${subscription.id.slice(0, 20)}`,
        notes: { type: 'property_subscription', subscription_id: subscription.id, property_id: property.id },
      }),
    });
    const order = await razorpayResponse.json();
    if (!razorpayResponse.ok) {
      await supabase.from('property_subscriptions').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', subscription.id);
      return Response.json({ error: order?.error?.description || 'Unable to create Razorpay order.' }, { status: 500 });
    }

    await supabase.from('property_subscriptions').update({ razorpay_order_id: order.id, updated_at: new Date().toISOString() }).eq('id', subscription.id);

    return Response.json({
      success: true,
      keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      subscriptionId: subscription.id,
      propertyName: property.name,
      fee: pricing.fee,
      gst: pricing.gst,
      total: pricing.total,
    });
  } catch (error) {
    const message = error?.message || 'Unable to start subscription payment.';
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'HOST_ACCESS_DENIED' ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
