import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gxwemplbykjxhezefykh.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req) {
  let createdUserId = null;
  try {
    if (!SERVICE_ROLE) return Response.json({ error: 'Server configuration is missing.' }, { status: 500 });
    const body = await req.json();
    const fullName = String(body.fullName || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
    const password = String(body.password || '');
    const city = String(body.city || '').trim();
    if (!fullName || !email || !phone || !city || password.length < 8) {
      return Response.json({ error: 'Full name, email, phone, city and a minimum 8 character password are required.' }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: existingHost } = await supabase.from('host_profiles').select('id,status').eq('email', email).maybeSingle();
    if (existingHost) return Response.json({ error: 'A Host application already exists for this email.' }, { status: 409 });

    const { data: created, error: userError } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: fullName, account_type: 'host' },
    });
    if (userError) throw userError;
    createdUserId = created?.user?.id;
    if (!createdUserId) throw new Error('Host account could not be created.');

    const { data: host, error: hostError } = await supabase.from('host_profiles').insert({
      user_id: createdUserId,
      full_name: fullName,
      business_name: String(body.businessName || '').trim() || null,
      email, phone, city,
      state: String(body.state || '').trim() || null,
      address: String(body.address || '').trim() || null,
      pincode: String(body.pincode || '').trim() || null,
      gstin: String(body.gstin || '').trim() || null,
      pan_number: String(body.panNumber || '').trim().toUpperCase() || null,
      status: 'pending',
    }).select('id,status').single();
    if (hostError) throw hostError;

    const { error: roleError } = await supabase.from('user_roles').upsert({ user_id: createdUserId, role: 'host', is_active: false }, { onConflict: 'user_id,role' });
    if (roleError) throw roleError;

    return Response.json({ success: true, host, message: 'Host application submitted. Admin approval is required before Host login.' });
  } catch (error) {
    console.error('Host registration:', error);
    if (createdUserId && SERVICE_ROLE) {
      try { const sb = createClient(SUPABASE_URL, SERVICE_ROLE); await sb.auth.admin.deleteUser(createdUserId); } catch {}
    }
    const message = String(error?.message || 'Unable to submit Host application.');
    return Response.json({ error: message.toLowerCase().includes('already') ? 'An account already exists with this email address.' : message }, { status: 500 });
  }
}
