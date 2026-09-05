import fs from 'fs/promises';
import { createClient } from '@supabase/supabase-js';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://gxwemplbykjxhezefykh.supabase.co';
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const tables=['properties','property_photos','guests','host_profiles','bookings','booking_messages','blocked_dates','external_calendar_feeds','property_subscriptions','host_settlements','host_payment_hold_history','referrals','referral_rewards','booking_financial_ledger'];
const stamp=new Date().toISOString().replace(/[:.]/g,'-');const dir=`backups/${stamp}`;await fs.mkdir(dir,{recursive:true});
for(const table of tables){let from=0,all=[];while(true){const{data,error}=await db.from(table).select('*').range(from,from+999);if(error)throw new Error(`${table}: ${error.message}`);all.push(...(data||[]));if(!data||data.length<1000)break;from+=1000}await fs.writeFile(`${dir}/${table}.json`,JSON.stringify(all,null,2));console.log(table,all.length)}
await fs.writeFile(`${dir}/MANIFEST.json`,JSON.stringify({createdAt:new Date().toISOString(),tables},null,2));console.log(`Backup written to ${dir}`);
