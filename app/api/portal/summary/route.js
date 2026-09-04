import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL='https://gxwemplbykjxhezefykh.supabase.co';
function admin(){ const key=process.env.SUPABASE_SERVICE_ROLE_KEY; if(!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.'); return createClient(SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}}); }
function bearer(req){ return String(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim(); }
export async function GET(req){
  try{
    const db=admin(); const token=bearer(req); if(!token) return Response.json({success:false,error:'Authentication required.'},{status:401});
    const {data:u,error:e}=await db.auth.getUser(token); if(e||!u?.user) return Response.json({success:false,error:'Invalid session.'},{status:401});
    const user=u.user; const portal=new URL(req.url).searchParams.get('portal')||'';
    if(portal==='host'){
      const {data:h}=await db.from('host_profiles').select('id,user_id,status').eq('user_id',user.id).maybeSingle();
      if(!h) return Response.json({success:true,messages:0,notifications:0,bookings:0});
      const {data:props}=await db.from('properties').select('id').eq('host_id',h.id); const pids=(props||[]).map(x=>x.id);
      let bookingIds=[]; let bookings=0; if(pids.length){ const {data:bs}=await db.from('bookings').select('id,host_decision,payment_status,booking_status').in('property_id',pids); const rows=bs||[]; bookingIds=rows.map(x=>x.id); bookings=rows.filter(b=>!['approved','declined'].includes(String(b.host_decision||'').toLowerCase())&&String(b.payment_status||'').toLowerCase()!=='paid'&&!['cancelled','declined','expired'].includes(String(b.booking_status||'').toLowerCase())).length; }
      let messages=0; if(bookingIds.length){ const {count}=await db.from('booking_messages').select('id',{count:'exact',head:true}).in('booking_id',bookingIds).eq('sender_type','guest').eq('is_read',false); messages=count||0; }
      const {count:notif}=await db.from('notifications').select('id',{count:'exact',head:true}).eq('recipient_type','host').eq('recipient_user_id',user.id).eq('is_read',false);
      return Response.json({success:true,messages,notifications:notif||0,bookings});
    }
    if(portal==='guest'){
      const {data:g}=await db.from('guests').select('id,user_id').eq('user_id',user.id).maybeSingle(); if(!g) return Response.json({success:true,messages:0,notifications:0,bookings:0});
      const {data:bs}=await db.from('bookings').select('id,host_decision,payment_status,booking_status').eq('guest_id',g.id); const rows=bs||[]; const bids=rows.map(x=>x.id);
      let messages=0; if(bids.length){ const {count}=await db.from('booking_messages').select('id',{count:'exact',head:true}).in('booking_id',bids).eq('sender_type','host').eq('is_read',false); messages=count||0; }
      const {count:notif}=await db.from('notifications').select('id',{count:'exact',head:true}).eq('recipient_type','guest').eq('recipient_user_id',user.id).eq('is_read',false);
      const bookings=rows.filter(b=>String(b.payment_status||'').toLowerCase()!=='paid'&&!['cancelled','declined','expired'].includes(String(b.booking_status||'').toLowerCase())).length;
      return Response.json({success:true,messages,notifications:notif||0,bookings});
    }
    if(portal==='admin'){
      const {data:a}=await db.from('admin_profiles').select('user_id,is_active').eq('user_id',user.id).maybeSingle(); if(!a?.is_active) return Response.json({success:false,error:'Admin access required.'},{status:403});
      const {count:notif}=await db.from('notifications').select('id',{count:'exact',head:true}).eq('recipient_type','admin').eq('recipient_user_id',user.id).eq('is_read',false);
      return Response.json({success:true,messages:0,notifications:notif||0,bookings:0});
    }
    return Response.json({success:false,error:'Invalid portal.'},{status:400});
  }catch(err){ return Response.json({success:false,error:err?.message||'Unable to load counts.'},{status:500}); }
}

