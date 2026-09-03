import crypto from 'crypto';
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

async function markDiscountUsed(supabase, discountId) {
  if (!discountId) return;

  const { data: discountRow, error: discountError } = await supabase
    .from('host_subscription_discounts')
    .select('used_count')
    .eq('id', discountId)
    .maybeSingle();

  if (discountError || !discountRow) {
    if (discountError) {
      console.warn(
        'Unable to read subscription discount usage:',
        discountError
      );
    }
    return;
  }

  const { error: updateError } = await supabase
    .from('host_subscription_discounts')
    .update({
      used_count: Number(discountRow.used_count || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', discountId);

  if (updateError) {
    console.warn(
      'Unable to increment subscription discount usage:',
      updateError
    );
  }
}

export async function POST(request) {
  try {
    const supabase = adminClient();
    const { host } = await requireHost(request, supabase);

    const body = await request.json();

    const {
      subscriptionId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    if (
      !subscriptionId ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return Response.json(
        { error: 'Incomplete payment verification data.' },
        { status: 400 }
      );
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const keyId = process.env.RAZORPAY_KEY_ID;

    if (!keySecret || !keyId) {
      throw new Error(
        'Razorpay environment variables are not configured.'
      );
    }

    const { data: subscription, error: subError } = await supabase
      .from('property_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('host_id', host.id)
      .single();

    if (subError || !subscription) {
      return Response.json(
        { error: 'Subscription not found.' },
        { status: 404 }
      );
    }

    if (
      subscription.status === 'active' &&
      subscription.razorpay_payment_id
    ) {
      return Response.json({
        success: true,
        alreadyVerified: true,
        startsAt: subscription.starts_at,
        expiresAt: subscription.expires_at,
      });
    }

    /*
      A complimentary subscription is activated directly by create-order
      and never reaches Razorpay verification.
    */
    if (
      subscription.status === 'active' &&
      Number(subscription.total_amount || 0) === 0
    ) {
      return Response.json({
        success: true,
        alreadyVerified: true,
        freeSubscription: true,
        startsAt: subscription.starts_at,
        expiresAt: subscription.expires_at,
      });
    }

    if (subscription.razorpay_order_id !== razorpay_order_id) {
      return Response.json(
        { error: 'Order does not match this subscription.' },
        { status: 400 }
      );
    }

    const expected = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const signatureBuffer = Buffer.from(
      String(razorpay_signature),
      'utf8'
    );

    if (
      expectedBuffer.length !== signatureBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
    ) {
      return Response.json(
        { error: 'Payment signature verification failed.' },
        { status: 400 }
      );
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const paymentResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(
        razorpay_payment_id
      )}`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
        cache: 'no-store',
      }
    );

    const payment = await paymentResponse.json();

    if (!paymentResponse.ok) {
      return Response.json(
        {
          error:
            payment?.error?.description ||
            'Unable to verify Razorpay payment.',
        },
        { status: 500 }
      );
    }

    if (
      payment.order_id !== razorpay_order_id ||
      payment.currency !== 'INR' ||
      payment.status !== 'captured'
    ) {
      return Response.json(
        {
          error:
            'Razorpay payment is not valid or captured.',
        },
        { status: 400 }
      );
    }

    const expectedAmount = Math.round(
      Number(subscription.total_amount || 0) * 100
    );

    if (Number(payment.amount) !== expectedAmount) {
      return Response.json(
        {
          error:
            'Paid amount does not match the subscription amount.',
        },
        { status: 400 }
      );
    }

    const now = new Date();

    const { data: activeRows, error: activeError } = await supabase
      .from('property_subscriptions')
      .select('expires_at')
      .eq('property_id', subscription.property_id)
      .eq('status', 'active')
      .gt('expires_at', now.toISOString())
      .order('expires_at', { ascending: false })
      .limit(1);

    if (activeError) {
      throw activeError;
    }

    const currentExpiry =
      activeRows?.[0]?.expires_at
        ? new Date(activeRows[0].expires_at)
        : null;

    const startsAt =
      currentExpiry && currentExpiry > now
        ? currentExpiry
        : now;

    const planMonths = Math.max(
      Number(subscription.plan_months || 1),
      1
    );

    const expiresAt = addMonths(startsAt, planMonths);

    const paidAt = payment.created_at
      ? new Date(Number(payment.created_at) * 1000)
      : now;

    /*
      IMPORTANT:
      We deliberately do not recalculate the price here.
      The amount, rule and discount saved when the order was created
      are the permanent transaction snapshot.
    */
    const { error: updateError } = await supabase
      .from('property_subscriptions')
      .update({
        status: 'active',
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        razorpay_payment_id,
        razorpay_signature,
        paid_at: paidAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)
      .eq('status', 'pending');

    if (updateError) {
      throw updateError;
    }

    const { error: settingError } = await supabase
      .from('property_subscription_settings')
      .upsert(
        {
          property_id: subscription.property_id,
          subscription_required: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'property_id' }
      );

    if (settingError) {
      throw settingError;
    }

    await markDiscountUsed(
      supabase,
      subscription.discount_id || null
    );

    return Response.json({
      success: true,
      freeSubscription: false,
      startsAt: startsAt.toISOString(),
      expiresAt: expiresAt.toISOString(),

      pricing: {
        pricingRuleId: subscription.pricing_rule_id || null,
        pricingScope:
          subscription.pricing_scope_snapshot || null,
        pricingRuleName:
          subscription.pricing_rule_name_snapshot || null,

        standardMonthlyFee: Number(
          subscription.standard_monthly_fee_snapshot || 0
        ),

        discountId: subscription.discount_id || null,
        discountName:
          subscription.discount_name_snapshot || null,
        discountType:
          subscription.discount_type_snapshot || null,
        discountValue: Number(
          subscription.discount_value_snapshot || 0
        ),
        discountAmount: Number(
          subscription.discount_amount_snapshot || 0
        ),

        feeBeforeGst: Number(
          subscription.fee_before_gst || 0
        ),
        gstRate: Number(subscription.gst_rate || 0),
        gstAmount: Number(subscription.gst_amount || 0),
        totalAmount: Number(subscription.total_amount || 0),
      },
    });
  } catch (error) {
    console.error('Host subscription verify error:', error);

    const message =
      error?.message || 'Unable to verify subscription payment.';

    const status =
      message === 'UNAUTHORIZED'
        ? 401
        : message === 'HOST_ACCESS_DENIED'
        ? 403
        : 500;

    return Response.json({ error: message }, { status });
  }
}
