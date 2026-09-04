import { createClient } from '@supabase/supabase-js';
import HomeExperience from './components/HomeExperience';

const db = createClient('https://gxwemplbykjxhezefykh.supabase.co','sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS');
export const revalidate = 0;

export default async function Home(){
  const {data:rows=[]}=await db.from('properties').select('id,name,slug,location_name,address,latitude,longitude,bedrooms,bathrooms,max_guests,base_price,is_active,city,area,property_type,pets_allowed,parties_allowed,couples_allowed,family_friendly,property_photos(image_url,is_cover,sort_order)').eq('is_active',true).order('created_at',{ascending:false}).limit(80);
  const initialProperties=(rows||[]).map(p=>{const photos=[...(p.property_photos||[])].sort((a,b)=>Number(b.is_cover)-Number(a.is_cover)||Number(a.sort_order||0)-Number(b.sort_order||0));return {...p,cover_image:photos[0]?.image_url||'',property_photos:undefined,interest_count:0,promotion_type:''}});
  return <HomeExperience initialProperties={initialProperties}/>;
}
