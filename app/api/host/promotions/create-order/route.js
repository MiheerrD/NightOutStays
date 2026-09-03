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

const num = (v, d = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
};

export async function POST(request) {
  try {
    const supabase = adminClient();
    const { host } = await requireHost(request, supabase);
    const body = await request.json();
    const propertyId = body?.propertyId;
    const promotionType = String(body?.promotionType || 'premium').toLowerCase();
    const durationDays = Math.max(1, Math.floor(num(body?.durationDays, 30)));

    if (!propertyId) return Response.json({ error: 'Property is required.' }, { status: 400 });
    if (!['featured', 'premium', 'boosted'].includes(promotionType)) {
      return Response.json({ error: 'Invalid promotion level.' }, { status: 400 });
    }

    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id,name,base_price,host_id,is_active,moderation_status')
      .eq('id', propertyId)
      .eq('host_id', host.id)
      .single();

    if (propertyError || !property) return Response.json({ error: 'Property not found.' }, { status: 404 });
    if (property.moderation_status !== 'approved' || property.is_active !== true) {
      return Response.json({ error: 'Only approved and live properties can be promoted.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    await supabase.from('property_promotions').update({ status: 'expired', updated_at: now })
      .eq('property_id', property.id).eq('host_id', host.id).eq('status', 'active').lte('expires_at', now);

    const { data: blockingRows, error: blockingError } = await supabase
      .from('property_promotions').select('id,status').eq('property_id', property.id).eq('host_id', host.id)
      .in('status', ['pending_payment', 'pending_approval', 'active']).limit(1);
    if (blockingError) throw blockingError;
    if (blockingRows?.length) {
      const status = blockingRows[0].status;
      const message = status === 'pending_approval'
        ? 'This property already has a promotion awaiting Admin approval.'
        : status === 'active'
          ? 'This property already has an active promotion.'
          : 'A promotion payment is already pending for this property.';
      return Response.json({ error: message }, { status: 409 });
    }

    const { data: quote, error: quoteError } = await supabase.rpc('get_property_promotion_quote', {
      p_property_id: property.id,
      p_promotion_type: promotionType,
      p_duration_days: durationDays,
    });
    if (quoteError) throw quoteError;
    if (!quote || quote.error) {
      return Response.json({ error: quote?.error || 'No promotion pricing is available for this selection.' }, { status: 400 });
    }

    const fee = num(quote.fee_before_gst ?? quote.promotion_fee_before_gst ?? quote.final_fee_before_gst);
    const gstRate = num(quote.gst_rate, 18);
    const gst = num(quote.gst_amount);
    const total = num(quote.total_amount ?? quote.total);
    const subscriptionFee = num(quote.subscription_fee ?? quote.subscription_fee_snapshot);
    const standardFee = num(quote.standard_promotion_fee ?? quote.standard_promotion_fee_snapshot ?? fee);
    const discountAmount = num(quote.discount_amount ?? quote.discount_amount_snapshot);

    const row = {
      property_id: property.id,
      host_id: host.id,
      promotion_type: promotionType,
      plan_months: Math.max(1, Math.ceil(durationDays / 30)),
      nightly_rate_snapshot: num(property.base_price),
      subscription_fee_snapshot: subscriptionFee,
      promotion_fee_before_gst: fee,
      gst_rate: gstRate,
      gst_amount: gst,
      total_amount: total,
      status: total <= 0 ? 'pending_approval' : 'pending_payment',
      duration_days: durationDays,
      pricing_rule_id: quote.pricing_rule_id || quote.rule_id || null,
      pricing_scope_snapshot: quote.pricing_scope || quote.scope_type || null,
      pricing_rule_name_snapshot: quote.pricing_rule_name || quote.rule_name || null,
      pricing_method_snapshot: quote.pricing_method || null,
      standard_promotion_fee_snapshot: standardFee,
      discount_id: quote.discount_id || null,
      discount_name_snapshot: quote.discount_name || null,
      discount_type_snapshot: quote.discount_type || null,
      discount_value_snapshot: quote.discount_value == null ? null : num(quote.discount_value),
      discount_amount_snapshot: discountAmount,
      pricing_quoted_at: quote.quoted_at || now,
      requested_at: now,
    };

    const { data: promotion, error: insertError } = await supabase.from('property_promotions').insert(row).select('id').single();
    if (insertError) throw insertError;

    if (total <= 0) {
      if (row.discount_id) {
        const { data: d } = await supabase.from('host_promotion_discounts').select('used_count').eq('id', row.discount_id).maybeSingle();
        if (d) await supabase.from('host_promotion_discounts').update({ used_count: num(d.used_count) + 1, updated_at: new Date().toISOString() }).eq('id', row.discount_id);
      }
      return Response.json({
        success: true, freePromotion: true, promotionId: promotion.id, status: 'pending_approval',
        propertyName: property.name, promotionType, durationDays, fee, gst, total,
        discountName: row.discount_name_snapshot,
      });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new Error('Razorpay environment variables are not configured.');

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(total * 100),
        currency: 'INR',
        receipt: `promo_${promotion.id.slice(0, 18)}`,
        notes: { type: 'property_promotion', promotion_id: promotion.id, property_id: property.id, promotion_type: promotionType },
      }),
    });
    const order = await razorpayResponse.json();

    if (!razorpayResponse.ok) {
      await supabase.from('property_promotions').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', promotion.id);
      return Response.json({ error: order?.error?.description || 'Unable to create Razorpay order.' }, { status: 500 });
    }

    await supabase.from('property_promotions').update({ razorpay_order_id: order.id, updated_at: new Date().toISOString() }).eq('id', promotion.id);

    return Response.json({
      success: true, keyId, orderId: order.id, amount: order.amount, currency: order.currency,
      promotionId: promotion.id, propertyName: property.name, promotionType, durationDays,
      fee, gst, total, standardFee, discountAmount, discountName: row.discount_name_snapshot,
    });
  } catch (error) {
    const message = error?.message || 'Unable to start promotion payment.';
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'HOST_ACCESS_DENIED' ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
