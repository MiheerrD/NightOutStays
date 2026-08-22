import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
const db=createClient('https://gxwemplbykjxhezefykh.supabase.co','sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS');
export const revalidate=0;
export default async function PropertyPage({params}){
 const {slug}=await params;
 const {data:p}=await db.from('properties').select('*,property_photos(image_url,alt_text,is_cover,sort_order)').eq('slug',slug).eq('is_active',true).single(); if(!p)notFound();
 const photos=[...(p.property_photos||[])].sort((a,b)=>(b.is_cover-a.is_cover)||(a.sort_order-b.sort_order));
 return <main className="detail"><a className="back" href="/">← All stays</a><p className="eyebrow">{p.location_name}</p><h1>{p.name}</h1>
 <div className="gallery">{photos.map((x,i)=><img className={i===0?'mainphoto':''} key={x.image_url} src={x.image_url} alt={x.alt_text||p.name}/>)}</div>
 <div className="detailgrid"><section><h2>About this stay</h2><p>{p.description||p.short_description}</p><div className="facts">{p.bedrooms} bedrooms • {p.bathrooms} bathrooms • up to {p.max_guests} guests</div><h2>Amenities</h2><div className="amenities">{(p.amenities||[]).map(a=><span key={a}>✓ {a}</span>)}</div>{p.google_maps_url&&<a className="map" href={p.google_maps_url} target="_blank">View location on Google Maps ↗</a>}</section>
 <aside><div className="price">₹{Number(p.base_price).toLocaleString('en-IN')} <small>/ night</small></div><label>CHECK-IN</label><input type="date"/><label>CHECK-OUT</label><input type="date"/><label>GUESTS</label><input type="number" min="1" max={p.max_guests} defaultValue="2"/><button>Check availability</button><small>Booking confirmation will be enabled in the next step.</small></aside></div></main>}
