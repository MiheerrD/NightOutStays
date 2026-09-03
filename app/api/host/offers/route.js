import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxwemplbykjxhezefykh.supabase.co';

function getAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearerToken(request) {
  const header = request.headers.get('authorization') || '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}

async function requireHost(request) {
  const supabase = getAdminClient();
  const token = bearerToken(request);
  if (!token) return { error: 'Host login required.', status: 401 };

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user) return { error: 'Invalid or expired session.', status: 401 };

  const { data: host, error: hostError } = await supabase
    .from('host_profiles')
    .select('id,user_id,full_name,business_name,status')
    .eq('user_id', user.id)
    .single();

  if (hostError || !host || host.status !== 'active') {
    return { error: 'Active Host account required.', status: 403 };
  }

  return { supabase, user, host };
}

async function hostOwnsProperty(supabase, hostId, propertyId) {
  const { data } = await supabase
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .eq('host_id', hostId)
    .maybeSingle();
  return Boolean(data);
}

function normalizeOffer(body) {
  const category = String(body.offer_category || 'custom').trim().toLowerCase();
  const requiredMin = category === 'weekly' ? 6 : category === 'fortnightly' ? 12 : category === 'monthly' ? 20 : null;
  const discountType = requiredMin ? 'percent' : String(body.discount_type || 'percent').trim().toLowerCase();
  const discountValue = Number(body.discount_value);
  const minNights = requiredMin || Math.max(1, Number(body.min_nights) || 1);

  let applicableDays = Array.isArray(body.applicable_days)
    ? body.applicable_days.map(Number).filter((v) => Number.isInteger(v) && v >= 0 && v <= 6)
    : [];

  if (category === 'weekday') applicableDays = [1, 2, 3, 4, 5];
  if (category === 'weekend') applicableDays = [0, 6];
  if (requiredMin) applicableDays = [];

  const applyScope = requiredMin ? 'entire_booking' : String(body.apply_scope || 'eligible_nights').trim();

  return {
    property_id: String(body.property_id || '').trim(),
    title: String(body.title || '').trim(),
    description: String(body.description || '').trim() || null,
    discount_type: discountType,
    discount_value: discountValue,
    start_date: body.start_date || null,
    end_date: body.end_date || null,
    min_nights: minNights,
    offer_category: category,
    applicable_days: applicableDays,
    apply_scope: applyScope,
    guest_selectable: body.guest_selectable !== false,
    is_active: body.is_active !== false,
    offer_type: 'discount',
    is_host_special: false,
  };
}

function validateOffer(offer) {
  if (!offer.property_id) return 'Please select a property.';
  if (!offer.title) return 'Offer title is required.';
  if (!['percent', 'fixed'].includes(offer.discount_type)) return 'Invalid discount type.';
  if (!Number.isFinite(offer.discount_value) || offer.discount_value <= 0) return 'Enter a valid discount value.';
  if (offer.discount_type === 'percent' && offer.discount_value > 100) return 'Percentage discount cannot exceed 100%.';
  if (offer.start_date && offer.end_date && offer.end_date < offer.start_date) return 'End date cannot be before start date.';
  return '';
}

export async function GET(request) {
  try {
    const auth = await requireHost(request);
    if (auth.error) return Response.json({ success: false, error: auth.error }, { status: auth.status });
    const { supabase, host } = auth;

    const { data: properties, error: propertiesError } = await supabase
      .from('properties')
      .select('id,name,location_name,city,area,is_active,moderation_status')
      .eq('host_id', host.id)
      .order('name');
    if (propertiesError) throw propertiesError;

    const propertyIds = (properties || []).map((p) => p.id);
    let offers = [];
    if (propertyIds.length) {
      const { data, error } = await supabase
        .from('property_offers')
        .select('*')
        .in('property_id', propertyIds)
        .eq('is_host_special', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      offers = data || [];
    }

    return Response.json({ success: true, host, properties: properties || [], offers });
  } catch (error) {
    console.error('Host offers GET error:', error);
    return Response.json({ success: false, error: 'Unable to load offers.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await requireHost(request);
    if (auth.error) return Response.json({ success: false, error: auth.error }, { status: auth.status });
    const { supabase, user, host } = auth;
    const body = await request.json();
    const offer = normalizeOffer(body);
    const validationError = validateOffer(offer);
    if (validationError) return Response.json({ success: false, error: validationError }, { status: 400 });

    if (!(await hostOwnsProperty(supabase, host.id, offer.property_id))) {
      return Response.json({ success: false, error: 'You can create offers only for your own properties.' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('property_offers')
      .insert({ ...offer, created_by: user.id })
      .select('*')
      .single();
    if (error) throw error;
    return Response.json({ success: true, offer: data });
  } catch (error) {
    console.error('Host offers POST error:', error);
    return Response.json({ success: false, error: 'Unable to create offer.' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const auth = await requireHost(request);
    if (auth.error) return Response.json({ success: false, error: auth.error }, { status: auth.status });
    const { supabase, host } = auth;
    const body = await request.json();
    const id = String(body.id || '').trim();
    if (!id) return Response.json({ success: false, error: 'Offer ID is required.' }, { status: 400 });

    const { data: existing } = await supabase.from('property_offers').select('*').eq('id', id).maybeSingle();
    if (!existing || existing.is_host_special) return Response.json({ success: false, error: 'Offer not found.' }, { status: 404 });
    if (!(await hostOwnsProperty(supabase, host.id, existing.property_id))) {
      return Response.json({ success: false, error: 'You cannot update this offer.' }, { status: 403 });
    }

    if (body.action === 'toggle') {
      const { data, error } = await supabase
        .from('property_offers')
        .update({ is_active: !existing.is_active, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return Response.json({ success: true, offer: data });
    }

    const offer = normalizeOffer({ ...existing, ...body, property_id: existing.property_id });
    const validationError = validateOffer(offer);
    if (validationError) return Response.json({ success: false, error: validationError }, { status: 400 });

    const { data, error } = await supabase
      .from('property_offers')
      .update({
        title: offer.title,
        description: offer.description,
        discount_type: offer.discount_type,
        discount_value: offer.discount_value,
        start_date: offer.start_date,
        end_date: offer.end_date,
        min_nights: offer.min_nights,
        offer_category: offer.offer_category,
        applicable_days: offer.applicable_days,
        apply_scope: offer.apply_scope,
        guest_selectable: offer.guest_selectable,
        is_active: offer.is_active,
        offer_type: 'discount',
        is_host_special: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return Response.json({ success: true, offer: data });
  } catch (error) {
    console.error('Host offers PATCH error:', error);
    return Response.json({ success: false, error: 'Unable to update offer.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const auth = await requireHost(request);
    if (auth.error) return Response.json({ success: false, error: auth.error }, { status: auth.status });
    const { supabase, host } = auth;
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return Response.json({ success: false, error: 'Offer ID is required.' }, { status: 400 });

    const { data: existing } = await supabase.from('property_offers').select('id,property_id,is_host_special').eq('id', id).maybeSingle();
    if (!existing || existing.is_host_special) return Response.json({ success: false, error: 'Offer not found.' }, { status: 404 });
    if (!(await hostOwnsProperty(supabase, host.id, existing.property_id))) {
      return Response.json({ success: false, error: 'You cannot delete this offer.' }, { status: 403 });
    }

    const { error } = await supabase.from('property_offers').delete().eq('id', id);
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    console.error('Host offers DELETE error:', error);
    return Response.json({ success: false, error: 'Unable to delete offer.' }, { status: 500 });
  }
}
