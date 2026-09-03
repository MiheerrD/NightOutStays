import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxwemplbykjxhezefykh.supabase.co';

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireHost(request, supabase) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) throw new Error('UNAUTHORIZED');

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) throw new Error('UNAUTHORIZED');

  const { data: host, error: hostError } = await supabase
    .from('host_profiles')
    .select('id,user_id,full_name,business_name,status')
    .eq('user_id', user.id)
    .single();

  if (hostError || !host || host.status !== 'active') throw new Error('HOST_ACCESS_DENIED');
  return { user, host };
}

function subscriptionSlab(rate) {
  const nightly = Number(rate || 0);
  return nightly <= 4999 ? 2500 : nightly <= 9999 ? 3500 : 5000;
}

function promotionPrice(rate) {
  const subscriptionFee = subscriptionSlab(rate);
  const fee = subscriptionFee * 2;
  const gst = Math.round(fee * 0.18 * 100) / 100;
  return { subscriptionFee, fee, gst, total: fee + gst };
}

function normalizePromotionStatus(promotion) {
  if (!promotion) return 'not_started';
  if (
    promotion.status === 'active' &&
    promotion.expires_at &&
    new Date(promotion.expires_at).getTime() <= Date.now()
  ) return 'expired';
  return promotion.status || 'not_started';
}

export async function GET(request) {
  try {
    const supabase = adminClient();
    const { host } = await requireHost(request, supabase);

    const { data: properties, error: propertyError } = await supabase
      .from('properties')
      .select('id,name,slug,base_price,is_active,moderation_status,city,area,created_at')
      .eq('host_id', host.id)
      .order('created_at', { ascending: false });
    if (propertyError) throw propertyError;

    const ids = (properties || []).map((property) => property.id);
    let promotions = [];
    if (ids.length) {
      const { data, error } = await supabase
        .from('property_promotions')
        .select('*')
        .in('property_id', ids)
        .order('created_at', { ascending: false });
      if (error) throw error;
      promotions = data || [];
    }

    const rows = (properties || []).map((property) => {
      const history = promotions.filter((promotion) => promotion.property_id === property.id);
      const current = history.find((promotion) => {
        if (promotion.status !== 'active') return false;
        if (!promotion.expires_at) return true;
        return new Date(promotion.expires_at).getTime() > Date.now();
      }) || null;
      const pendingApproval = history.find((promotion) => promotion.status === 'pending_approval') || null;
      const pendingPayment = history.find((promotion) => promotion.status === 'pending_payment') || null;
      const latest = history[0] || null;
      const pricing = promotionPrice(property.base_price);
      const relevant = current || pendingApproval || pendingPayment || latest;

      return {
        ...property,
        eligible: property.is_active === true && property.moderation_status === 'approved',
        promotion_status: normalizePromotionStatus(relevant),
        current_promotion: current,
        pending_approval: pendingApproval,
        latest_promotion: latest,
        promotion_history: history,
        subscription_base_fee: pricing.subscriptionFee,
        promotion_fee: pricing.fee,
        gst_amount: pricing.gst,
        total_payable: pricing.total,
      };
    });

    return Response.json({ success: true, host, properties: rows });
  } catch (error) {
    const message = error?.message || 'Unable to load promotions.';
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'HOST_ACCESS_DENIED' ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
