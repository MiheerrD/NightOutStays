import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxwemplbykjxhezefykh.supabase.co';

function dbClient(){
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  return createClient(SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function bearer(req){ return String(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim(); }
async function requireGuest(req,db){
  const token=bearer(req); if(!token) throw Object.assign(new Error('Authentication required.'),{status:401});
  const {data:u,error:e}=await db.auth.getUser(token); if(e||!u?.user) throw Object.assign(new Error('Invalid login session.'),{status:401});
  const {data:g,error:ge}=await db.from('guests').select('id,user_id,full_name,phone,email,status,profile_photo_url').eq('user_id',u.user.id).maybeSingle();
  if(ge||!g) throw Object.assign(new Error('Guest account required.'),{status:403});
  return {user:u.user,guest:g};
}
async function ownedBooking(db,guestId,bookingId){
  const {data:b,error}=await db.from('bookings').select('*').eq('id',bookingId).eq('guest_id',guestId).maybeSingle();
  if(error||!b) return null;
  const {data:p}=await db.from('properties').select('id,name,location_name,host_id').eq('id',b.property_id).maybeSingle();
  return {...b,property:p||null};
}
async function notifyHost(db,booking,title,body,type='message'){
  if(!booking?.property?.host_id) return;
  const {data:h}=await db.from('host_profiles').select('id,user_id').eq('id',booking.property.host_id).maybeSingle();
  if(!h?.user_id) return;
  await db.from('notifications').insert({recipient_type:'host',recipient_user_id:h.user_id,host_id:h.id,booking_id:booking.id,property_id:booking.property_id,type,title,body:String(body||'').slice(0,500),priority:'normal',action_url:`/host/messages?booking=${booking.id}`,email_status:'pending'});
}

export async function GET(req){
  try{
    const db=dbClient(); const {guest}=await requireGuest(req,db);
    const cutoff=new Date(); cutoff.setMonth(cutoff.getMonth()-6);
    const {data:bookings,error:be}=await db.from('bookings').select('*').eq('guest_id',guest.id).gte('created_at',cutoff.toISOString()).order('updated_at',{ascending:false});
    if(be) throw be;
    const rows=bookings||[]; const propertyIds=[...new Set(rows.map(x=>x.property_id).filter(Boolean))]; const bookingIds=rows.map(x=>x.id);
    const [{data:properties},{data:messages,error:me}]=await Promise.all([
      propertyIds.length?db.from('properties').select('id,name,location_name,slug,host_id').in('id',propertyIds):Promise.resolve({data:[]}),
      bookingIds.length?db.from('booking_messages').select('id,booking_id,sender_type,sender_name,message,message_type,is_read,created_at').in('booking_id',bookingIds).order('created_at',{ascending:true}):Promise.resolve({data:[]})
    ]);
    if(me) throw me;
    const hostIds=[...new Set((properties||[]).map(p=>p.host_id).filter(Boolean))];
    const {data:hosts}=hostIds.length?await db.from('host_profiles').select('id,full_name,business_name,profile_photo_url').in('id',hostIds):{data:[]};
    const pmap=Object.fromEntries((properties||[]).map(p=>[p.id,p])); const hmap=Object.fromEntries((hosts||[]).map(h=>[h.id,h])); const mmap={};
    (messages||[]).forEach(m=>{(mmap[m.booking_id] ||= []).push(m);});
    const threads=rows.map(b=>{const list=mmap[b.id]||[]; const property=pmap[b.property_id]||null; return {booking:b,property,host:property?.host_id?hmap[property.host_id]||null:null,guest,messages:list,unread:list.filter(m=>m.sender_type==='host'&&!m.is_read).length,lastMessage:list.at(-1)||null};}).sort((a,b)=>new Date(b.lastMessage?.created_at||b.booking.updated_at||0)-new Date(a.lastMessage?.created_at||a.booking.updated_at||0));
    return Response.json({success:true,guest,threads,retentionMonths:6});
  }catch(e){ return Response.json({success:false,error:e?.message||'Unable to load messages.'},{status:e?.status||500}); }
}

export async function POST(req){
  try{
    const db=dbClient(); const {guest}=await requireGuest(req,db); const body=await req.json();
    const action=String(body.action||'message'); const bookingId=String(body.bookingId||'').trim();
    const booking=await ownedBooking(db,guest.id,bookingId); if(!booking) throw Object.assign(new Error('You cannot access this booking conversation.'),{status:403});
    if(action==='message'){
      const text=String(body.message||'').trim(); if(!text) throw Object.assign(new Error('Message is required.'),{status:400}); if(text.length>3000) throw Object.assign(new Error('Message is too long.'),{status:400});
      const {data:m,error}=await db.from('booking_messages').insert({booking_id:booking.id,sender_type:'guest',sender_name:guest.full_name||'Guest',message:text,message_type:'message',is_read:false}).select('*').single(); if(error) throw error;
      return Response.json({success:true,message:m});
    }
    if(action==='request_special_rate'){
      const note=String(body.message||'').trim(); if(!note) throw Object.assign(new Error('Please write your special-rate request.'),{status:400});
      const {error:ue}=await db.from('bookings').update({guest_discount_requested:true,guest_discount_message:note,updated_at:new Date().toISOString()}).eq('id',booking.id); if(ue) throw ue;
      const {data:m,error:me}=await db.from('booking_messages').insert({booking_id:booking.id,sender_type:'guest',sender_name:guest.full_name||'Guest',message:note,message_type:'discount_request',is_read:false}).select('*').single(); if(me) throw me;
      await notifyHost(db,booking,'Special rate requested',note,'discount_request');
      return Response.json({success:true,message:m});
    }
    if(action==='offer_decision'){
      const decision=String(body.decision||'').toLowerCase(); if(!['accepted','declined'].includes(decision)) throw Object.assign(new Error('Invalid offer decision.'),{status:400});
      if(String(booking.offer_status||'')!=='host_offered') throw Object.assign(new Error('No active special offer is available.'),{status:400});
      const update=decision==='accepted'?{offer_status:'accepted',host_decision:'approved',booking_status:'confirmed',payment_due_at:booking.payment_due_at||new Date(Date.now()+24*60*60*1000).toISOString(),updated_at:new Date().toISOString()}:{offer_status:'declined',updated_at:new Date().toISOString()};
      const {error:ue}=await db.from('bookings').update(update).eq('id',booking.id); if(ue) throw ue;
      const text=decision==='accepted'?'Guest accepted the special rate.':'Guest declined the special rate.';
      const {data:m,error:me}=await db.from('booking_messages').insert({booking_id:booking.id,sender_type:'guest',sender_name:guest.full_name||'Guest',message:text,message_type:'offer_decision',is_read:false}).select('*').single(); if(me) throw me;
      await notifyHost(db,booking,decision==='accepted'?'Special rate accepted':'Special rate declined',text,'offer_decision');
      return Response.json({success:true,message:m,paymentUrl:decision==='accepted'?`/booking/${booking.booking_code}/pay`:null});
    }
    throw Object.assign(new Error('Invalid action.'),{status:400});
  }catch(e){ return Response.json({success:false,error:e?.message||'Unable to update conversation.'},{status:e?.status||500}); }
}

export async function PATCH(req){
  try{
    const db=dbClient(); const {guest}=await requireGuest(req,db); const body=await req.json(); const bookingId=String(body.bookingId||'').trim();
    const booking=await ownedBooking(db,guest.id,bookingId); if(!booking) throw Object.assign(new Error('You cannot access this booking conversation.'),{status:403});
    const {error}=await db.from('booking_messages').update({is_read:true}).eq('booking_id',booking.id).eq('sender_type','host').eq('is_read',false); if(error) throw error;
    return Response.json({success:true});
  }catch(e){ return Response.json({success:false,error:e?.message||'Unable to update messages.'},{status:e?.status||500}); }
}
