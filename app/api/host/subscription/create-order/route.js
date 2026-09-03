import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxwemplbykjxhezefykh.supabase.co';

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }

  return createClient(SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function requireHost(request, supabase) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!token) {
    throw new Error('UNAUTHORIZED');
  }

  const { data, error } = await supabase.auth.getUser(token);
  const user = data?.user;

  if (error || !user) {
    throw new Error('UNAUTHORIZED');
  }

  const { data: host, error: hostError } = await supabase
    .from('host_profiles')
    .select('id,status')
    .eq('user_id', user.id)
    .single();

  if (hostError || !host || host.status !== 'active') {
    throw new Error('HOST_ACCESS_DENIED');
  }

  return { user, host };
}

function numberValue(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getUTCDate();

  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);

  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)
  ).getUTCDate();

  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

async function activateFreeSubscription({
  supabase,
  subscription,
  propertyId,
  discountId,
  planMonths,
}) {
  const now = new Date();

  const { data: activeRows, error: activeError } = await supabase
    .from('property_subscriptions')
    .select('expires_at')
    .eq('property_id', propertyId)
    .eq('status', 'active')
    .gt('expires_at', now.toISOString())
    .order('expires_at', { ascending: false })
    .limit(1);

  if (activeError) {
    throw activeError;
  }

  const currentExpiry =
    activeRows?.[0]?.expires_at ? new Date(activeRows[0].expires_at) : null;

  const startsAt =
    currentExpiry && currentExpiry > now ? currentExpiry : now;

  const expiresAt = addMonths(startsAt, planMonths);

  const { error: updateError } = await supabase
    .from('property_subscriptions')
    .update({
      status: 'active',
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      paid_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', subscription.id);

  if (updateError) {
    throw updateError;
  }

  const { error: settingError } = await supabase
    .from('property_subscription_settings')
    .upsert(
      {
        property_id: propertyId,
        subscription_required: true,
        updated_at: now.toISOString(),
      },
      { onConflict: 'property_id' }
    );

  if (settingError) {
    throw settingError;
  }

  if (discountId) {
    const { data: discountRow } = await supabase
      .from('host_subscription_discounts')
      .select('used_count')
      .eq('id', discountId)
      .maybeSingle();

    if (discountRow) {
      await supabase
        .from('host_subscription_discounts')
        .update({
          used_count: Number(discountRow.used_count || 0) + 1,
          updated_at: now.toISOString(),
        })
        .eq('id', discountId);
    }
  }

  return {
    startsAt: startsAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function POST(request) {
  try {
    const supabase = adminClient();
    const { host } = await requireHost(request, supabase);

    const body = await request.json();
    const propertyId = String(body?.propertyId || '').trim();
    const requestedPlanMonths = Number(body?.planMonths || 1);
    const planMonths =
      Number.isInteger(requestedPlanMonths) && requestedPlanMonths > 0
        ? requestedPlanMonths
        : 1;

    if (!propertyId) {
      return Response.json(
        { error: 'Property is required.' },
        { status: 400 }
      );
    }

    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id,name,base_price,host_id,city,property_type')
      .eq('id', propertyId)
      .eq('host_id', host.id)
      .single();

    if (propertyError || !property) {
      return Response.json(
        { error: 'Property not found.' },
        { status: 404 }
      );
    }

    const { data: quote, error: quoteError } = await supabase.rpc(
      'get_property_subscription_quote',
      {
        p_property_id: property.id,
        p_plan_months: planMonths,
      }
    );

    if (quoteError || !quote) {
      console.error('Subscription quote error:', quoteError);

      return Response.json(
        {
          error:
            quoteError?.message ||
            'Unable to calculate the subscription price.',
        },
        { status: 500 }
      );
    }

    if (String(quote.host_id || '') !== String(host.id)) {
      return Response.json(
        { error: 'Subscription quote does not belong to this Host.' },
        { status: 403 }
      );
    }

    const feeBeforeGst = numberValue(quote.fee_before_gst);
    const gstRate = numberValue(quote.gst_rate);
    const gstAmount = numberValue(quote.gst_amount);
    const totalAmount = numberValue(quote.total_amount);

    if (
      feeBeforeGst < 0 ||
      gstAmount < 0 ||
      totalAmount < 0
    ) {
      return Response.json(
        { error: 'Invalid subscription price calculated.' },
        { status: 500 }
      );
    }

    const { data: subscription, error: insertError } = await supabase
      .from('property_subscriptions')
      .insert({
        property_id: property.id,
        host_id: host.id,
        plan_months: planMonths,

        nightly_rate_snapshot: numberValue(quote.nightly_rate),

        fee_before_gst: feeBeforeGst,
        gst_rate: gstRate,
        gst_amount: gstAmount,
        total_amount: totalAmount,

        pricing_rule_id: quote.pricing_rule_id || null,
        pricing_scope_snapshot: quote.pricing_scope || null,
        pricing_rule_name_snapshot: quote.pricing_rule_name || null,
        standard_monthly_fee_snapshot: numberValue(quote.monthly_fee),

        discount_id: quote.discount_id || null,
        discount_name_snapshot: quote.discount_name || null,
        discount_type_snapshot: quote.discount_type || null,
        discount_value_snapshot: numberValue(quote.discount_value),
        discount_amount_snapshot: numberValue(quote.discount_amount),

        final_fee_before_gst_snapshot: feeBeforeGst,
        pricing_quoted_at: quote.quoted_at || new Date().toISOString(),

        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError) {
      throw insertError;
    }

    /*
      Complimentary / 100% discounted subscription:
      Razorpay cannot create a zero-value payment order, so activate
      the subscription immediately using the exact saved pricing snapshot.
    */
    if (totalAmount === 0) {
      const activation = await activateFreeSubscription({
        supabase,
        subscription,
        propertyId: property.id,
        discountId: quote.discount_id || null,
        planMonths,
      });

      return Response.json({
        success: true,
        freeSubscription: true,
        subscriptionId: subscription.id,
        propertyName: property.name,

        pricingRuleId: quote.pricing_rule_id || null,
        pricingRuleName: quote.pricing_rule_name || null,
        pricingScope: quote.pricing_scope || null,

        monthlyFee: numberValue(quote.monthly_fee),
        standardFeeBeforeDiscount: numberValue(
          quote.standard_fee_before_discount
        ),

        discountId: quote.discount_id || null,
        discountName: quote.discount_name || null,
        discountType: quote.discount_type || null,
        discountValue: numberValue(quote.discount_value),
        discountAmount: numberValue(quote.discount_amount),

        fee: feeBeforeGst,
        gst: gstAmount,
        total: totalAmount,

        startsAt: activation.startsAt,
        expiresAt: activation.expiresAt,
      });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new Error(
        'Razorpay environment variables are not configured.'
      );
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const razorpayResponse = await fetch(
      'https://api.razorpay.com/v1/orders',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(totalAmount * 100),
          currency: 'INR',
          receipt: `sub_${subscription.id.slice(0, 20)}`,
          notes: {
            type: 'property_subscription',
            subscription_id: subscription.id,
            property_id: property.id,
            host_id: host.id,
            pricing_rule_id: quote.pricing_rule_id || '',
            discount_id: quote.discount_id || '',
          },
        }),
      }
    );

    const order = await razorpayResponse.json();

    if (!razorpayResponse.ok) {
      await supabase
        .from('property_subscriptions')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      return Response.json(
        {
          error:
            order?.error?.description ||
            'Unable to create Razorpay order.',
        },
        { status: 500 }
      );
    }

    const { error: orderUpdateError } = await supabase
      .from('property_subscriptions')
      .update({
        razorpay_order_id: order.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);

    if (orderUpdateError) {
      throw orderUpdateError;
    }

    return Response.json({
      success: true,
      freeSubscription: false,

      keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,

      subscriptionId: subscription.id,
      propertyName: property.name,

      pricingRuleId: quote.pricing_rule_id || null,
      pricingRuleName: quote.pricing_rule_name || null,
      pricingScope: quote.pricing_scope || null,

      monthlyFee: numberValue(quote.monthly_fee),
      standardFeeBeforeDiscount: numberValue(
        quote.standard_fee_before_discount
      ),

      discountId: quote.discount_id || null,
      discountName: quote.discount_name || null,
      discountType: quote.discount_type || null,
      discountValue: numberValue(quote.discount_value),
      discountAmount: numberValue(quote.discount_amount),

      fee: feeBeforeGst,
      gst: gstAmount,
      total: totalAmount,
    });
  } catch (error) {
    console.error('Host subscription create-order error:', error);

    const message =
      error?.message || 'Unable to start subscription payment.';

    const status =
      message === 'UNAUTHORIZED'
        ? 401
        : message === 'HOST_ACCESS_DENIED'
        ? 403
        : 500;

    return Response.json({ error: message }, { status });
  }
}
