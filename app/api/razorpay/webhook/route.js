import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
const U='https://gxwemplbykjxhezefykh.supabase.co';
function db(){const k=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!k)throw new Error('Server database key missing.');return createClient(U,k,{auth:{persistSession:false,autoRefreshToken:false}})}
export async function POST(req){
  const secret=process.env.RAZORPAY_WEBHOOK_SECRET;
  if(!secret) return Response.json({ok:false,error:'Webhook is not configured.'},{status:503});
  const raw=await req.text();
  const sig=String(req.headers.get('x-razorpay-signature')||'');
  const expected=crypto.createHmac('sha256',secret).update(raw).digest('hex');
  const a=Buffer.from(sig),b=Buffer.from(expected);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b)) return Response.json({ok:false,error:'Invalid signature.'},{status:401});
  let event;try{event=JSON.parse(raw)}catch{return Response.json({ok:false,error:'Invalid payload.'},{status:400})}
  const payment=event?.payload?.payment?.entity||{};
  const orderId=payment.order_id||event?.payload?.order?.entity?.id||null;
  const paymentId=payment.id||null;
  const eventId=String(req.headers.get('x-razorpay-event-id')||event?.id||'').trim()||null;
  const d=db();
  const {data:booking}=orderId?await d.from('bookings').select('id,booking_code,payment_status,razorpay_payment_id').eq('razorpay_order_id',orderId).maybeSingle():{data:null};
  const row={provider:'razorpay',provider_event_id:eventId,event_type:String(event?.event||'unknown'),payment_id:paymentId,order_id:orderId,booking_id:booking?.id||null,payload:event,processing_status:'received'};
  const {data:saved,error}=await d.from('payment_webhook_events').upsert(row,{onConflict:'provider,provider_event_id',ignoreDuplicates:true}).select('id').maybeSingle();
  if(error && !String(error.message||'').toLowerCase().includes('duplicate')) return Response.json({ok:false,error:'Webhook storage failed.'},{status:500});
  // The checkout verification route remains authoritative for confirmation. The webhook is a durable recovery signal.
  if(saved?.id) await d.from('payment_webhook_events').update({processing_status:'processed',processed_at:new Date().toISOString()}).eq('id',saved.id);
  return Response.json({ok:true,recorded:true,bookingMatched:Boolean(booking)});
}
