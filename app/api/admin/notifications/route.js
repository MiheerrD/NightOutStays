
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

export async function GET(req){try{
 const sb=db(),a=await requireAdmin(req,sb,"view");if(a.error)return a.error;
 const {data,error}=await sb.from("notifications").select("*").eq("recipient_type","admin").eq("recipient_user_id",a.user.id).order("created_at",{ascending:false}).limit(300);
 if(error)throw error;
 const rows=data||[],unread=rows.filter(x=>!x.is_read);
 return Response.json({success:true,notifications:rows,summary:{unread:unread.length,urgent:unread.filter(x=>x.priority==="urgent").length,important:unread.filter(x=>x.priority==="important").length,total:rows.length}});
}catch(e){return Response.json({error:e.message||"Unable to load notifications."},{status:500})}}
export async function POST(req){try{
 const sb=db(),b=await req.json(),a=await requireAdmin(req,sb,"edit");if(a.error)return a.error;const now=new Date().toISOString();
 if(b.action==="read"){const {error}=await sb.from("notifications").update({is_read:true,read_at:now,updated_at:now}).eq("id",b.id).eq("recipient_type","admin").eq("recipient_user_id",a.user.id);if(error)throw error;return Response.json({success:true})}
 if(b.action==="unread"){const {error}=await sb.from("notifications").update({is_read:false,read_at:null,updated_at:now}).eq("id",b.id).eq("recipient_type","admin").eq("recipient_user_id",a.user.id);if(error)throw error;return Response.json({success:true})}
 if(b.action==="read_all"){const {error}=await sb.from("notifications").update({is_read:true,read_at:now,updated_at:now}).eq("recipient_type","admin").eq("recipient_user_id",a.user.id).eq("is_read",false);if(error)throw error;return Response.json({success:true})}
 return Response.json({error:"Unknown action."},{status:400});
}catch(e){return Response.json({error:e.message||"Unable to update notification."},{status:500})}}
