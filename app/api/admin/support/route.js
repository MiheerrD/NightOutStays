
import { createClient } from "@supabase/supabase-js";
const URL="https://gxwemplbykjxhezefykh.supabase.co";
function db(){const k=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!k)throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");return createClient(URL,k,{auth:{persistSession:false,autoRefreshToken:false}})}
async function requireAdmin(req,sb,mode="view"){
 const auth=req.headers.get("authorization")||"",token=auth.startsWith("Bearer ")?auth.slice(7):"";
 if(!token)return{error:Response.json({error:"Unauthorized."},{status:401})};
 const {data:u}=await sb.auth.getUser(token),user=u?.user;if(!user)return{error:Response.json({error:"Unauthorized."},{status:401})};
 const {data:a}=await sb.from("admin_profiles").select("user_id,full_name,email,role,is_active,full_access").eq("user_id",user.id).maybeSingle();
 if(!a?.is_active)return{error:Response.json({error:"Access denied."},{status:403})};
 if(a.role!=="super_admin"&&!a.full_access){
   const {data:p}=await sb.from("admin_permissions").select("can_view,can_add,can_edit,can_approve").eq("admin_user_id",user.id).eq("module","messages").maybeSingle();
   const ok=mode==="view"?p?.can_view:mode==="add"?p?.can_add:mode==="approve"?p?.can_approve:p?.can_edit;
   if(!ok)return{error:Response.json({error:"You do not have permission for Support/Notifications."},{status:403})};
 }
 return{user,profile:a};
}

function clean(v){return String(v||"").trim()}
async function notifyRequester(sb,ticket,title,body,actionUrl){
 let recipientType=ticket.requester_type,recipientUserId=ticket.requester_user_id||null,recipientGuestId=ticket.requester_guest_id||null,hostId=ticket.requester_host_id||null;
 const {data:n,error}=await sb.from("notifications").insert({
   recipient_type:recipientType,recipient_user_id:recipientUserId,recipient_guest_id:recipientGuestId,
   host_id:hostId,support_ticket_id:ticket.id,property_id:ticket.property_id,booking_id:ticket.booking_id,promotion_id:ticket.promotion_id,
   type:"support_reply",title,body,priority:"important",action_url:actionUrl,email_status:ticket.requester_email?"pending":"skipped"
 }).select("id").single();
 if(error)throw error;
 if(ticket.requester_email)await sb.from("email_outbox").insert({notification_id:n.id,support_ticket_id:ticket.id,recipient_type:recipientType,recipient_email:ticket.requester_email,recipient_name:ticket.requester_name,template_key:"support_reply",subject:title,body_text:body,priority:"important",status:"pending"});
}
export async function GET(req){try{
 const sb=db(),a=await requireAdmin(req,sb,"view");if(a.error)return a.error;
 const url=new URL(req.url),ticketId=url.searchParams.get("ticket");
 const [tr,fr,ar]=await Promise.all([
   sb.from("support_tickets").select("*").order("last_message_at",{ascending:false}).limit(300),
   sb.from("support_faqs").select("*").order("sort_order").order("created_at"),
   sb.from("admin_profiles").select("user_id,full_name,email,role,is_active").eq("is_active",true).order("full_name")
 ]);
 if(tr.error)throw tr.error;if(fr.error)throw fr.error;if(ar.error)throw ar.error;
 let messages=[];if(ticketId){const mr=await sb.from("support_ticket_messages").select("*").eq("ticket_id",ticketId).order("created_at");if(mr.error)throw mr.error;messages=mr.data||[]}
 const tickets=tr.data||[],open=tickets.filter(x=>!["resolved","closed"].includes(x.status));
 return Response.json({success:true,tickets,faqs:fr.data||[],admins:ar.data||[],messages,summary:{open:open.length,urgent:open.filter(x=>x.priority==="urgent").length,important:open.filter(x=>x.priority==="important").length,waiting:open.filter(x=>x.status==="waiting").length}});
}catch(e){return Response.json({error:e.message||"Unable to load support."},{status:500})}}
export async function POST(req){try{
 const sb=db(),b=await req.json(),action=clean(b.action),mode=["approve_free_boost","reject_free_boost"].includes(action)?"approve":["reply","create_faq"].includes(action)?"add":"edit",a=await requireAdmin(req,sb,mode);if(a.error)return a.error;const now=new Date().toISOString();

 if(action==="reply"){
   const {data:t}=await sb.from("support_tickets").select("*").eq("id",b.ticketId).maybeSingle();if(!t)return Response.json({error:"Ticket not found."},{status:404});
   const text=clean(b.message);if(!text)return Response.json({error:"Reply cannot be empty."},{status:400});
   const {error}=await sb.from("support_ticket_messages").insert({ticket_id:t.id,sender_type:"admin",sender_user_id:a.user.id,sender_name:a.profile.full_name||"Admin",message_text:text});if(error)throw error;
   await sb.from("support_tickets").update({status:b.status||"in_progress",last_message_at:now,first_admin_response_at:t.first_admin_response_at||now,updated_at:now}).eq("id",t.id);
   await notifyRequester(sb,t,"NightOutStays Support replied",text,t.requester_type==="host"?"/host/help":"/account/help");
   return Response.json({success:true,message:"Reply sent."});
 }
 if(action==="update_ticket"){
   const allowedStatus=["open","in_progress","waiting","resolved","closed"],allowedPriority=["normal","important","urgent"];
   const patch={updated_at:now};if(allowedStatus.includes(b.status))patch.status=b.status;if(allowedPriority.includes(b.priority))patch.priority=b.priority;if("assignedAdminUserId" in b)patch.assigned_admin_user_id=b.assignedAdminUserId||null;
   if(patch.status==="resolved")patch.resolved_at=now;if(patch.status==="closed")patch.closed_at=now;
   const {error}=await sb.from("support_tickets").update(patch).eq("id",b.ticketId);if(error)throw error;return Response.json({success:true,message:"Ticket updated."});
 }
 if(action==="approve_free_boost"){
   const {data:t}=await sb.from("support_tickets").select("*").eq("id",b.ticketId).maybeSingle();if(!t)return Response.json({error:"Ticket not found."},{status:404});
   if(t.category!=="promotion"||!t.property_id||!t.requester_host_id)return Response.json({error:"This is not a valid Free Boost request."},{status:400});
   const {data:p}=await sb.from("properties").select("id,host_id,base_price").eq("id",t.property_id).eq("host_id",t.requester_host_id).maybeSingle();if(!p)return Response.json({error:"Property not found for this Host."},{status:404});
   const {data:block}=await sb.from("property_promotions").select("id,status").eq("property_id",p.id).in("status",["active","pending_approval","pending_payment"]).limit(1);
   if(block?.length)return Response.json({error:"Property already has an active or pending promotion."},{status:409});
   const ex=new Date();ex.setUTCDate(ex.getUTCDate()+30);
   const {data:promo,error:pe}=await sb.from("property_promotions").insert({
     property_id:p.id,host_id:t.requester_host_id,promotion_type:"boosted",plan_months:1,nightly_rate_snapshot:Number(p.base_price||0),
     subscription_fee_snapshot:0,promotion_fee_before_gst:0,gst_rate:18,gst_amount:0,total_amount:0,status:"active",
     requested_at:t.created_at,approved_at:now,approved_by:a.user.id,starts_at:now,expires_at:ex.toISOString(),duration_days:30,
     pricing_scope_snapshot:"admin_granted",pricing_rule_name_snapshot:"Free Boost Approved by Admin",pricing_method_snapshot:"complimentary",
     standard_promotion_fee_snapshot:0,discount_name_snapshot:"Admin Free Boost",discount_type_snapshot:"free",discount_value_snapshot:0,discount_amount_snapshot:0,
     pricing_quoted_at:now,admin_granted:true
   }).select("id").single();if(pe)throw pe;
   await sb.from("support_ticket_messages").insert({ticket_id:t.id,sender_type:"admin",sender_user_id:a.user.id,sender_name:a.profile.full_name||"Admin",message_text:"Your free Boost request has been approved for 30 days.",message_type:"system"});
   await sb.from("support_tickets").update({status:"resolved",promotion_id:promo.id,resolved_at:now,first_admin_response_at:t.first_admin_response_at||now,last_message_at:now,updated_at:now}).eq("id",t.id);
   await notifyRequester(sb,{...t,promotion_id:promo.id},"Free Boost approved","Your property has been Boosted for 30 days by NightOutStays Admin.","/host/promotions");
   return Response.json({success:true,message:"Free Boost approved for 30 days."});
 }
 if(action==="reject_free_boost"){
   const reason=clean(b.reason);if(!reason)return Response.json({error:"Rejection reason is required."},{status:400});
   const {data:t}=await sb.from("support_tickets").select("*").eq("id",b.ticketId).maybeSingle();if(!t)return Response.json({error:"Ticket not found."},{status:404});
   await sb.from("support_ticket_messages").insert({ticket_id:t.id,sender_type:"admin",sender_user_id:a.user.id,sender_name:a.profile.full_name||"Admin",message_text:`Free Boost request declined: ${reason}`,message_type:"system"});
   await sb.from("support_tickets").update({status:"resolved",resolved_at:now,first_admin_response_at:t.first_admin_response_at||now,last_message_at:now,updated_at:now}).eq("id",t.id);
   await notifyRequester(sb,t,"Free Boost request declined",reason,"/host/promotions");
   return Response.json({success:true,message:"Free Boost request declined."});
 }
 if(action==="create_faq"){
   const q=clean(b.question),answer=clean(b.answer),category=clean(b.category)||"general";if(!q||!answer)return Response.json({error:"Question and answer are required."},{status:400});
   const keywords=clean(b.keywords).split(",").map(x=>x.trim()).filter(Boolean);
   const {error}=await sb.from("support_faqs").insert({category,question:q,answer,keywords,sort_order:Number(b.sortOrder||0),is_active:true,created_by:a.user.id,updated_by:a.user.id});if(error)throw error;return Response.json({success:true,message:"FAQ created."});
 }
 if(action==="toggle_faq"){const {error}=await sb.from("support_faqs").update({is_active:Boolean(b.isActive),updated_by:a.user.id,updated_at:now}).eq("id",b.id);if(error)throw error;return Response.json({success:true,message:"FAQ updated."})}
 if(action==="delete_faq"){const {error}=await sb.from("support_faqs").delete().eq("id",b.id);if(error)throw error;return Response.json({success:true,message:"FAQ deleted."})}
 return Response.json({error:"Unknown support action."},{status:400});
}catch(e){return Response.json({error:e.message||"Unable to update support."},{status:500})}}
