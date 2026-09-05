import { createClient } from '@supabase/supabase-js';
const U='https://gxwemplbykjxhezefykh.supabase.co';
export async function GET(){
  const started=Date.now();
  try{
    const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!key) return Response.json({ok:false,service:'nightoutstays',database:false,error:'Server configuration unavailable.'},{status:503});
    const d=createClient(U,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {error}=await d.from('properties').select('id',{head:true,count:'exact'}).limit(1);
    if(error) throw error;
    return Response.json({ok:true,service:'nightoutstays',database:true,responseMs:Date.now()-started,checkedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return Response.json({ok:false,service:'nightoutstays',database:false,responseMs:Date.now()-started,error:'Health check failed.',checkedAt:new Date().toISOString()},{status:503,headers:{'Cache-Control':'no-store'}})}
}
