import { createClient } from '@supabase/supabase-js';
const db=createClient('https://gxwemplbykjxhezefykh.supabase.co','sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS');
export const revalidate=0;
export default async function Home(){
 const {data:properties=[]}=await db.from('properties').select('id,name,slug,location_name,bedrooms,bathrooms,max_guests,base_price,property_photos(image_url,is_cover,sort_order)').eq('is_active',true).order('created_at',{ascending:false});
 return <main><header><div><div className="brand">NightOutStays</div><div className="tag">Direct stays. Simple booking.</div></div><div className="pill">Aanandee Realty</div></header>
 <section className="hero"><p className="eyebrow">STAY • RELAX • BOOK DIRECT</p><h1>Find your next stay around Pune.</h1><p>Browse our managed properties, check availability and book directly.</p></section>
 <section className="content"><h2>Places to stay</h2><div className="grid">{properties.map(p=>{const photos=[...(p.property_photos||[])].sort((a,b)=>(b.is_cover-a.is_cover)||(a.sort_order-b.sort_order));return <a className="card" href={'/property/'+p.slug} key={p.id}>{photos[0]?<img className="cover" src={photos[0].image_url} alt={p.name}/>:<div className="cover placeholder">Photo coming soon</div>}<div className="cardbody"><div className="loc">{p.location_name}</div><h3>{p.name}</h3><p>{p.bedrooms} bedrooms • {p.bathrooms} bathrooms • up to {p.max_guests} guests</p><strong>₹{Number(p.base_price).toLocaleString('en-IN')} <small>/ night</small></strong></div></a>})}</div></section></main>}
