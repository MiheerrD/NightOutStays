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

function slabFor(rate) {
  const nightly = Number(rate || 0);
  const fee = nightly <= 4999 ? 2500 : nightly <= 9999 ? 3500 : 5000;
  const gst = Math.round(fee * 0.18 * 100) / 100;
  return { fee, gst, total: fee + gst };
}

export async function GET(request) {
  try {
    const supabase = adminClient();
    const { host } = await requireHost(request, supabase);

    const { data: properties, error: pError } = await supabase
      .from('properties')
      .select('id,name,slug,base_price,is_active,moderation_status')
      .eq('host_id', host.id)
      .order('created_at', { ascending: false });
    if (pError) throw pError;

    const ids = (properties || []).map((p) => p.id);
    let subscriptions = [];
    let settings = [];

    if (ids.length) {
      const [{ data: s, error: sError }, { data: st, error: stError }] = await Promise.all([
        supabase
          .from('property_subscriptions')
          .select('*')
          .in('property_id', ids)
          .order('created_at', { ascending: false }),
        supabase
          .from('property_subscription_settings')
          .select('property_id,subscription_required')
          .in('property_id', ids),
      ]);
      if (sError) throw sError;
      if (stError) throw stError;
      subscriptions = s || [];
      settings = st || [];
    }

    const now = Date.now();
    const rows = (properties || []).map((property) => {
      const list = subscriptions.filter((s) => s.property_id === property.id);
      const current = list.find((s) =>
        s.status === 'active' &&
        s.starts_at && s.expires_at &&
        new Date(s.starts_at).getTime() <= now &&
        new Date(s.expires_at).getTime() > now
      );
      const upcoming = list.find((s) =>
        s.status === 'active' && s.starts_at && new Date(s.starts_at).getTime() > now
      );
      const latest = list[0] || null;
      const setting = settings.find((s) => s.property_id === property.id);
      const pricing = slabFor(property.base_price);

      let status = 'not_started';
      if (current) status = 'active';
      else if (upcoming) status = 'upcoming';
      else if (latest?.status === 'pending') status = 'pending';
      else if (latest && latest.expires_at && new Date(latest.expires_at).getTime() <= now) status = 'expired';
      else if (latest?.status) status = latest.status;

      return {
        ...property,
        subscription_required: Boolean(setting?.subscription_required),
        subscription_status: status,
        current_subscription: current || null,
        upcoming_subscription: upcoming || null,
        latest_subscription: latest,
        subscription_fee: pricing.fee,
        gst_amount: pricing.gst,
        total_payable: pricing.total,
      };
    });

    return Response.json({ success: true, host, properties: rows });
  } catch (error) {
    const message = error?.message || 'Unable to load subscriptions.';
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'HOST_ACCESS_DENIED' ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
