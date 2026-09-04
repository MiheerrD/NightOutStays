import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxwemplbykjxhezefykh.supabase.co';

function db() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function overlap(aStart, aEnd, bStart, bEnd) {
  return String(aStart) < String(bEnd) && String(aEnd) > String(bStart);
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const city = String(url.searchParams.get('city') || '').trim().toLowerCase();
    const location = String(url.searchParams.get('location') || '').trim().toLowerCase();
    const type = String(url.searchParams.get('type') || '').trim().toLowerCase();
    const guests = Math.max(1, Number(url.searchParams.get('guests') || 1));
    const checkIn = String(url.searchParams.get('checkIn') || '').trim();
    const checkOut = String(url.searchParams.get('checkOut') || '').trim();
    const family = url.searchParams.get('family') === '1';
    const couple = url.searchParams.get('couple') === '1';
    const party = url.searchParams.get('party') === '1';
    const pet = url.searchParams.get('pet') === '1';
    const database = db();

    const { data: rows, error } = await database
      .from('properties')
      .select('id,name,slug,short_description,location_name,address,latitude,longitude,bedrooms,bathrooms,max_guests,base_price,cleaning_fee,is_active,moderation_status,city,area,property_type,pets_allowed,parties_allowed,couples_allowed,family_friendly,property_photos(image_url,is_cover,sort_order)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;

    let properties = (rows || []).map((p) => {
      const photos = [...(p.property_photos || [])].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || Number(a.sort_order || 0) - Number(b.sort_order || 0));
      return { ...p, cover_image: photos[0]?.image_url || '', property_photos: undefined };
    });

    properties = properties.filter((p) => {
      if (city && !String(p.city || p.location_name || '').toLowerCase().includes(city)) return false;
      if (location && ![p.area, p.location_name, p.address].filter(Boolean).join(' ').toLowerCase().includes(location)) return false;
      if (type && type !== 'all' && String(p.property_type || '').toLowerCase() !== type) return false;
      if (Number(p.max_guests || 0) < guests) return false;
      if (family && p.family_friendly !== true) return false;
      if (couple && p.couples_allowed !== true) return false;
      if (party && p.parties_allowed !== true) return false;
      if (pet && p.pets_allowed !== true) return false;
      return true;
    });

    const ids = properties.map((p) => p.id);
    let bookings = [], blocks = [], promotions = [];
    if (ids.length) {
      const [br, bl, pr] = await Promise.all([
        database.from('bookings').select('id,property_id,check_in,check_out,booking_status,payment_status,host_decision,created_at').in('property_id', ids),
        database.from('blocked_dates').select('property_id,start_date,end_date,source').in('property_id', ids),
        database.from('property_promotions').select('id,property_id,promotion_type,status,starts_at,expires_at,admin_granted').in('property_id', ids),
      ]);
      if (br.error) throw br.error;
      if (bl.error) throw bl.error;
      if (pr.error) throw pr.error;
      bookings = br.data || [];
      blocks = bl.data || [];
      promotions = pr.data || [];
    }

    const now = Date.now();
    const rank = { boosted: 3, premium: 2, featured: 1 };
    properties = properties.map((p) => {
      const pBookings = bookings.filter((b) => b.property_id === p.id);
      const interestCount = pBookings.filter((b) => String(b.payment_status).toLowerCase() !== 'paid' && !['cancelled','completed'].includes(String(b.booking_status).toLowerCase())).length;
      const activePromotion = promotions
        .filter((x) => x.property_id === p.id && x.status === 'active' && (!x.starts_at || new Date(x.starts_at).getTime() <= now) && (!x.expires_at || new Date(x.expires_at).getTime() >= now))
        .sort((a, b) => (rank[b.promotion_type] || 0) - (rank[a.promotion_type] || 0))[0] || null;
      let unavailable = false;
      if (checkIn && checkOut && checkOut > checkIn) {
        unavailable = blocks.some((b) => b.property_id === p.id && overlap(checkIn, checkOut, b.start_date, b.end_date));
        if (!unavailable) unavailable = pBookings.some((b) => String(b.payment_status).toLowerCase() === 'paid' && overlap(checkIn, checkOut, b.check_in, b.check_out));
      }
      return { ...p, interest_count: interestCount, promotion_type: activePromotion?.promotion_type || '', promoted: !!activePromotion, unavailable };
    }).filter((p) => !p.unavailable);

    properties.sort((a, b) => (rank[b.promotion_type] || 0) - (rank[a.promotion_type] || 0) || Number(b.interest_count || 0) - Number(a.interest_count || 0));
    return Response.json({ success: true, properties });
  } catch (e) {
    return Response.json({ success: false, error: e?.message || 'Unable to search stays.' }, { status: 500 });
  }
}
