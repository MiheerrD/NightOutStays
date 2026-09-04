'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PropertyMap from './PropertyMap';

const TYPES = [
  ['all','All Types','⌂'],['villa','Villas','⌂'],['apartment','Apartments','▣'],['farm stay','Farm Stays','⌁'],['studio','Studio','▥'],['tree house','Tree House','♣'],['hotel room','Hotel Rooms','▤'],['lodging','Lodging','▦'],['separate room','Private Room','▭']
];

const DESTINATIONS = [
  ['Pune','City vibes'],['Lonavala','Hill escape'],['Alibaug','Beach stay'],['Mahabaleshwar','Cool weather'],['Goa','Sun & sea'],['Mumbai','Urban break']
];

function todayPlus(days){ const d=new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }
function money(v){return `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:0})}`}
function badgeText(p){ if(p.promotion_type==='boosted') return 'Boosted'; if(p.promotion_type==='premium') return 'Premium'; if(p.promotion_type==='featured') return 'Featured'; if(p.couples_allowed) return 'Couple Friendly'; if(p.family_friendly) return 'Family Friendly'; return ''; }

export default function HomeExperience({ initialProperties=[] }){
  const [properties,setProperties]=useState(initialProperties);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [selectedMapId,setSelectedMapId]=useState('');
  const [filters,setFilters]=useState({type:'all',city:'Pune',location:'',checkIn:todayPlus(1),checkOut:todayPlus(2),guests:2,family:false,couple:false,party:false,pet:false});

  const search=useCallback(async(overrides={})=>{
    const f={...filters,...overrides}; setFilters(f); setLoading(true); setError('');
    try{
      const qs=new URLSearchParams({type:f.type,city:f.city,location:f.location,checkIn:f.checkIn,checkOut:f.checkOut,guests:String(f.guests)});
      if(f.family)qs.set('family','1'); if(f.couple)qs.set('couple','1'); if(f.party)qs.set('party','1'); if(f.pet)qs.set('pet','1');
      const r=await fetch(`/api/search?${qs.toString()}`,{cache:'no-store'}); const j=await r.json(); if(!r.ok||!j.success)throw new Error(j.error||'Unable to search stays.'); setProperties(j.properties||[]);
    }catch(e){setError(e.message)}finally{setLoading(false)}
  },[filters]);

  const featured=useMemo(()=>properties.filter(p=>['featured','premium','boosted'].includes(p.promotion_type)).slice(0,10),[properties]);
  const featuredFallback=featured.length?featured:properties.slice(0,10);
  const boosted=useMemo(()=>properties.filter(p=>p.promotion_type==='boosted').slice(0,40),[properties]);
  const trending=useMemo(()=>[...properties].sort((a,b)=>Number(b.interest_count||0)-Number(a.interest_count||0)).slice(0,12),[properties]);
  const hero=properties.find(p=>p.cover_image)||initialProperties.find(p=>p.cover_image)||null;
  const selected=properties.find(p=>p.id===selectedMapId)||null;

  useEffect(()=>{ if(!properties.length) search(); },[]); // eslint-disable-line react-hooks/exhaustive-deps

  return <main className="homeV2">
    <section className="topHero" style={hero?.cover_image?{backgroundImage:`linear-gradient(90deg,rgba(6,21,54,.78),rgba(6,21,54,.2)),url(${hero.cover_image})`}:{}}>
      <div className="heroContent">
        <div className="heroKicker">STAYS BEYOND ORDINARY</div>
        <h1><span>TRAVEL.</span><span>STAY. <b>EXPLORE.</b></span><span><em>REPEAT.</em> ♡</span></h1>
        <p>More than stays, it’s a feeling.</p>
        <div className="heroTrust"><span>♥ Unique Stays</span><span>◉ Memorable Experiences</span><span>◆ Best Prices</span><span>✓ Verified Hosts</span></div>
      </div>
    </section>

    <section className="searchWrap">
      <div className="searchBar">
        <label><span>City</span><input list="nos-cities" value={filters.city} onChange={e=>setFilters({...filters,city:e.target.value})}/></label>
        <datalist id="nos-cities">{DESTINATIONS.map(([c])=><option key={c} value={c}/>)}</datalist>
        <label><span>Location</span><input value={filters.location} onChange={e=>setFilters({...filters,location:e.target.value})} placeholder="Area / locality"/></label>
        <label><span>Check-in</span><input type="date" value={filters.checkIn} onChange={e=>setFilters({...filters,checkIn:e.target.value})}/></label>
        <label><span>Check-out</span><input type="date" value={filters.checkOut} min={filters.checkIn} onChange={e=>setFilters({...filters,checkOut:e.target.value})}/></label>
        <label><span>Guests</span><input type="number" min="1" max="30" value={filters.guests} onChange={e=>setFilters({...filters,guests:Number(e.target.value||1)})}/></label>
        <button onClick={()=>search()} disabled={loading}>{loading?'Searching…':'⌕ Search'}</button>
      </div>
      <div className="typeRow">
        {TYPES.map(([value,label,icon])=><button key={value} className={filters.type===value?'active':''} onClick={()=>search({type:value})}><i>{icon}</i>{label}</button>)}
      </div>
      <div className="friendlyRow">
        {[["family","Family Friendly"],["couple","Couple Friendly"],["party","Party Friendly"],["pet","Pet Friendly"]].map(([k,l])=><button key={k} className={filters[k]?'on':''} onClick={()=>setFilters({...filters,[k]:!filters[k]})}>{filters[k]?'✓ ':''}{l}</button>)}
      </div>
      {error&&<div className="homeError">{error}</div>}
    </section>

    <section className="mapFeatureSection">
      <div className="mapPanel">
        <div className="sectionHead"><div><span>EXPLORE VISUALLY</span><h2>Explore stays on map</h2><p>Compare locations and nightly rates at a glance.</p></div><b>{properties.length}+ stays</b></div>
        <PropertyMap properties={properties} selectedId={selectedMapId} onSelect={setSelectedMapId}/>
        {selected&&<a className="mapSelected" href={`/property/${selected.slug}`}><img src={selected.cover_image||'/favicon.ico'} alt=""/><div><strong>{selected.name}</strong><span>{selected.location_name||selected.area||selected.city}</span><b>{money(selected.base_price)} / night</b></div><em>View →</em></a>}
      </div>
      <div className="featuredPanel">
        <div className="sectionHead"><div><span>CURATED FOR YOU</span><h2>Featured in {filters.city||'your city'}</h2><p>Promoted and handpicked stays rotate fairly.</p></div></div>
        <div className="featureList">{featuredFallback.slice(0,10).map(p=><PropertyRow key={p.id} p={p}/>)}</div>
      </div>
    </section>

    <section className="sectionBlock"><div className="sectionTitle"><div><span>POPULAR NOW</span><h2>Trending stays</h2><p>Most viewed and most requested properties.</p></div><a href="#all-stays">View all →</a></div><div className="cardsGrid">{trending.slice(0,4).map(p=><PropertyCard key={p.id} p={p}/>)}</div></section>

    <section className="destinationBand"><div><h2>Where do you want to go?</h2><p>Quick escapes, long weekends and city breaks.</p></div><div className="destinationGrid">{DESTINATIONS.map(([city,sub],idx)=><button key={city} onClick={()=>search({city,location:''})}><strong>{city}</strong><span>{sub}</span><i>{[120,85,60,55,120,100][idx]}+ stays</i></button>)}</div></section>

    {boosted.length>0&&<section className="sectionBlock"><div className="sectionTitle"><div><span>EXTRA VISIBILITY</span><h2>Boosted stays</h2><p>High-interest properties selected by hosts.</p></div></div><div className="cardsGrid boostedGrid">{boosted.slice(0,4).map(p=><PropertyCard key={p.id} p={p}/>)}</div></section>}

    <section id="all-stays" className="sectionBlock"><div className="sectionTitle"><div><span>ALL MATCHES</span><h2>Stays matching your search</h2><p>{properties.length} properties available for the selected filters.</p></div></div><div className="cardsGrid">{properties.map((p,i)=><div key={p.id} className="allCardWrap"><PropertyCard p={p}/>{i>0&&i%12===11&&boosted.length>0?<div className="boostInsert">Boosted picks continue below</div>:null}</div>)}</div>{!properties.length&&!loading&&<div className="emptyHome">No matching stays. Try another city, date or filter.</div>}</section>

    <section className="promoBand"><article><strong>Turn Weekends into <em>Memories</em></strong><span>Curated stays. Amazing experiences. Unforgettable moments.</span><a href="#all-stays">Explore Stays →</a></article><article><strong>Offers that feel worth it</strong><span>Watch for property-level discounts and host special rates.</span><a href="#all-stays">View Offers →</a></article><article><strong>List Your Property</strong><span>Reach travellers directly with NightOutStays.</span><a href="/host/register">Get Started →</a></article></section>
    <section className="trustStrip"><div>✓<span><b>Verified</b> properties</span></div><div>▣<span><b>Secure</b> payments</span></div><div>◉<span><b>24/7</b> support</span></div><div>★<span><b>Transparent</b> pricing</span></div><div>♡<span><b>Built for</b> better stays</span></div></section>

    <style jsx global>{`
      .homeV2{--navy:#061f4c;--blue:#0b5bd3;--pink:#f4007d;--yellow:#ffd429;--ink:#0d1b36;--muted:#64748b;background:#fff;color:var(--ink);min-height:100vh;font-family:Arial,sans-serif}.topHero{min-height:410px;background:radial-gradient(circle at 75% 25%,#ffba54 0,#fa58a4 28%,#243b79 72%,#0b1d45 100%);background-size:cover;background-position:center;display:flex;align-items:flex-end;padding:44px max(26px,5vw) 88px;position:relative;overflow:hidden}.topHero:after{content:'';position:absolute;inset:auto -10% -70px -10%;height:150px;background:radial-gradient(ellipse at center,rgba(244,0,125,.55),rgba(244,0,125,0) 70%);filter:blur(18px)}.heroContent{position:relative;z-index:2;color:#fff;max-width:700px;text-shadow:0 2px 20px rgba(0,0,0,.28)}.heroKicker{font-weight:900;letter-spacing:1.7px;font-size:12px}.heroContent h1{display:grid;margin:13px 0 10px;font-size:clamp(42px,6vw,76px);line-height:.93;font-weight:1000}.heroContent h1 b{color:#ff39a0}.heroContent h1 em{font-style:normal;color:var(--yellow)}.heroContent p{font-size:21px;font-weight:800}.heroTrust{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}.heroTrust span{background:rgba(4,20,52,.56);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.18);padding:9px 12px;border-radius:999px;font-weight:800;font-size:12px}.searchWrap{max-width:1450px;margin:-58px auto 0;padding:0 24px;position:relative;z-index:5}.searchBar{display:grid;grid-template-columns:1.2fr 1.2fr 1fr 1fr .7fr auto;background:#fff;border-radius:22px;padding:9px;box-shadow:0 18px 50px rgba(31,38,91,.18);border:1px solid #edf1f5}.searchBar label{padding:8px 13px;border-right:1px solid #e7eaf0}.searchBar label span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.9px;font-weight:900;color:#64748b}.searchBar input{width:100%;border:0;outline:0;padding:6px 0 0;background:transparent;font-weight:850;color:#12274b}.searchBar>button{border:0;border-radius:16px;background:linear-gradient(135deg,#ff087e,#e50074);color:white;padding:0 29px;font-size:16px;font-weight:950;cursor:pointer}.typeRow,.friendlyRow{display:flex;gap:9px;overflow-x:auto;padding:18px 2px 2px;scrollbar-width:none}.typeRow::-webkit-scrollbar,.friendlyRow::-webkit-scrollbar{display:none}.typeRow button,.friendlyRow button{white-space:nowrap;border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:10px 14px;font-weight:850;color:#1e3a5f;cursor:pointer;box-shadow:0 3px 10px rgba(15,23,42,.04)}.typeRow button i{font-style:normal;margin-right:7px}.typeRow button.active{background:#f4007d;color:#fff;border-color:#f4007d}.friendlyRow{padding-top:10px}.friendlyRow button.on{background:#fff0f7;border-color:#f4007d;color:#bd0060}.homeError{max-width:900px;margin:14px 0;background:#fff1f2;color:#a61b2b;border:1px solid #fecdd3;padding:11px 14px;border-radius:12px}.mapFeatureSection{max-width:1450px;margin:34px auto;padding:0 24px;display:grid;grid-template-columns:minmax(0,1.45fr) minmax(340px,.8fr);gap:22px}.mapPanel,.featuredPanel{background:#fff;border:1px solid #e5eaf1;border-radius:26px;padding:18px;box-shadow:0 12px 40px rgba(15,23,42,.06)}.sectionHead,.sectionTitle{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;margin-bottom:15px}.sectionHead span,.sectionTitle span{font-size:10px;font-weight:950;letter-spacing:1.2px;color:#f4007d}.sectionHead h2,.sectionTitle h2{font-size:26px;margin:4px 0;color:#0b2147}.sectionHead p,.sectionTitle p{margin:0;color:#64748b;font-size:13px}.sectionHead>b{background:#eef5ff;color:#0b5bd3;border-radius:999px;padding:8px 11px;font-size:11px}.mapSelected{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #e5eaf1;border-radius:15px;padding:10px;margin-top:12px;text-decoration:none;box-shadow:0 6px 20px rgba(15,23,42,.08)}.mapSelected img{width:80px;height:58px;border-radius:11px;object-fit:cover}.mapSelected div{display:grid;gap:3px;min-width:0;flex:1}.mapSelected strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mapSelected span{font-size:11px;color:#64748b}.mapSelected b{color:#0b5bd3}.mapSelected em{font-style:normal;font-weight:900;color:#f4007d}.featuredPanel{max-height:625px;overflow:hidden}.featureList{display:grid;gap:10px;overflow:auto;max-height:520px;padding-right:3px}.propertyRow{display:grid;grid-template-columns:104px 1fr auto;align-items:center;gap:12px;text-decoration:none;color:#0d1b36;border:1px solid #e9edf3;border-radius:15px;padding:8px;transition:.18s}.propertyRow:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(15,23,42,.08)}.propertyRow img{width:104px;height:76px;object-fit:cover;border-radius:11px;background:#eef2f7}.propertyRow div{min-width:0}.propertyRow strong,.propertyRow span,.propertyRow small{display:block}.propertyRow strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.propertyRow span{font-size:11px;color:#64748b;margin:3px 0}.propertyRow small{font-weight:900;color:#0b5bd3}.propertyRow>em{font-style:normal;font-size:20px;color:#0b5bd3}.sectionBlock{max-width:1450px;margin:42px auto;padding:0 24px}.sectionTitle a{font-weight:900;color:#0b5bd3;text-decoration:none}.cardsGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.propertyCard{display:block;border:1px solid #e6ebf2;border-radius:19px;overflow:hidden;background:#fff;text-decoration:none;color:#0d1b36;box-shadow:0 8px 24px rgba(15,23,42,.06);transition:.2s;position:relative}.propertyCard:hover{transform:translateY(-4px);box-shadow:0 14px 32px rgba(15,23,42,.11)}.propertyCard figure{margin:0;aspect-ratio:16/10;background:#eef2f7;position:relative}.propertyCard img{width:100%;height:100%;object-fit:cover}.propertyCard figure span{position:absolute;left:10px;top:10px;background:#f4007d;color:#fff;border-radius:999px;padding:6px 9px;font-size:10px;font-weight:950}.propertyCard .heart{position:absolute;right:12px;top:10px;color:#fff;font-size:24px;text-shadow:0 2px 8px rgba(0,0,0,.45)}.propertyCard .pcBody{padding:13px}.propertyCard h3{margin:0 0 5px;font-size:16px}.propertyCard .pcLoc{color:#64748b;font-size:11px}.propertyCard .pcMeta{display:flex;gap:8px;flex-wrap:wrap;color:#52657a;font-size:10px;margin:9px 0}.propertyCard .pcBottom{display:flex;justify-content:space-between;align-items:end}.propertyCard .pcBottom strong{font-size:17px}.propertyCard .pcBottom small{display:block;color:#64748b;font-size:10px}.propertyCard .rating{color:#f5a600;font-weight:900}.destinationBand{max-width:1450px;margin:40px auto;padding:24px;border-radius:28px;background:linear-gradient(135deg,#082f5a,#104e82);color:#fff}.destinationBand>div:first-child h2{margin:0;font-size:28px}.destinationBand>div:first-child p{margin:5px 0 18px;color:#dbeafe}.destinationGrid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}.destinationGrid button{min-height:130px;text-align:left;border:1px solid rgba(255,255,255,.16);border-radius:18px;padding:15px;color:#fff;background:linear-gradient(160deg,rgba(255,255,255,.17),rgba(255,255,255,.05));cursor:pointer}.destinationGrid strong,.destinationGrid span,.destinationGrid i{display:block}.destinationGrid strong{font-size:18px}.destinationGrid span{font-size:11px;margin:5px 0 25px;color:#dbeafe}.destinationGrid i{font-style:normal;font-size:10px}.promoBand{max-width:1450px;margin:40px auto;padding:0 24px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.promoBand article{min-height:160px;border-radius:22px;padding:22px;display:flex;flex-direction:column;justify-content:flex-end;background:linear-gradient(135deg,#dceeff,#f4e3ff);overflow:hidden;position:relative}.promoBand article:nth-child(2){background:linear-gradient(135deg,#ffe0ec,#fff0c7)}.promoBand article:nth-child(3){background:linear-gradient(135deg,#edf4ff,#e9f9ef)}.promoBand strong{font-size:23px;color:#082f5a}.promoBand strong em{font-style:normal;color:#f4007d}.promoBand span{font-size:12px;color:#52657a;margin:5px 0 12px}.promoBand a{width:max-content;background:#082f5a;color:white;border-radius:999px;padding:9px 13px;text-decoration:none;font-size:11px;font-weight:900}.trustStrip{max-width:1450px;margin:0 auto 50px;padding:22px 24px;display:grid;grid-template-columns:repeat(5,1fr);gap:10px;border-top:1px solid #edf0f5}.trustStrip>div{display:flex;align-items:center;gap:10px;font-size:20px;color:#f4007d}.trustStrip span{font-size:11px;color:#64748b}.trustStrip b{display:block;color:#0d1b36}.emptyHome{text-align:center;color:#64748b;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:18px;padding:40px}.boostInsert{display:none}
      @media(max-width:1100px){.searchBar{grid-template-columns:repeat(3,1fr)}.searchBar>button{min-height:52px}.searchBar label:nth-of-type(3){border-left:0}.mapFeatureSection{grid-template-columns:1fr}.featuredPanel{max-height:none}.featureList{grid-template-columns:repeat(2,1fr);max-height:none}.cardsGrid{grid-template-columns:repeat(3,1fr)}.destinationGrid{grid-template-columns:repeat(3,1fr)}.trustStrip{grid-template-columns:repeat(3,1fr)}}
      @media(max-width:760px){.topHero{min-height:360px;padding:30px 18px 64px;background-position:center}.heroContent h1{font-size:46px}.heroContent p{font-size:16px}.heroTrust{gap:7px}.heroTrust span{font-size:9px;padding:7px 9px}.searchWrap{padding:0 12px;margin-top:-42px}.searchBar{grid-template-columns:1fr 1fr;border-radius:18px;padding:8px}.searchBar label{border:0;border-bottom:1px solid #edf0f4;padding:8px}.searchBar label:nth-of-type(5){grid-column:1/2}.searchBar>button{grid-column:2/3;min-height:52px;padding:0 12px}.typeRow button,.friendlyRow button{padding:9px 11px;font-size:11px}.mapFeatureSection,.sectionBlock,.promoBand{padding-left:12px;padding-right:12px}.mapFeatureSection{margin-top:22px}.mapPanel,.featuredPanel{border-radius:18px;padding:12px}.sectionHead h2,.sectionTitle h2{font-size:22px}.featureList{display:flex;overflow-x:auto;gap:10px}.propertyRow{min-width:285px}.cardsGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.propertyCard h3{font-size:14px}.propertyCard .pcBody{padding:10px}.destinationBand{margin:28px 12px;padding:18px;border-radius:20px}.destinationGrid{display:flex;overflow-x:auto}.destinationGrid button{min-width:150px}.promoBand{grid-template-columns:1fr}.trustStrip{grid-template-columns:repeat(2,1fr);padding:18px 14px}.featuredPanel{display:none}}
      @media(max-width:480px){.heroContent h1{font-size:39px}.searchBar{grid-template-columns:1fr 1fr}.searchBar label:nth-of-type(1),.searchBar label:nth-of-type(2){grid-column:span 1}.cardsGrid{grid-template-columns:1fr 1fr}.propertyCard .pcMeta{display:none}.propertyCard .pcBottom strong{font-size:14px}.sectionBlock{margin-top:30px}.sectionTitle{align-items:flex-start}.sectionTitle p{display:none}.trustStrip{grid-template-columns:1fr 1fr}.friendlyRow{padding-bottom:2px}}
    `}</style>
  </main>
}

function PropertyRow({p}){return <a className="propertyRow" href={`/property/${p.slug}`}><img src={p.cover_image||''} alt=""/><div><strong>{p.name}</strong><span>{p.location_name||p.area||p.city||'Location'}</span><small>{money(p.base_price)} / night</small></div><em>›</em></a>}
function PropertyCard({p}){const badge=badgeText(p);return <a className="propertyCard" href={`/property/${p.slug}`}><figure>{p.cover_image?<img src={p.cover_image} alt={p.name}/>:null}{badge&&<span>{badge}</span>}<i className="heart">♡</i></figure><div className="pcBody"><h3>{p.name}</h3><div className="pcLoc">⌖ {p.location_name||p.area||p.city||'Location'}</div><div className="pcMeta"><span>{p.bedrooms||1} Beds</span><span>{p.bathrooms||1} Baths</span><span>{p.max_guests||2} Guests</span>{Number(p.interest_count)>0&&<span>{p.interest_count} interested</span>}</div><div className="pcBottom"><div><strong>{money(p.base_price)}</strong><small>/ night</small></div><span className="rating">★ 4.7</span></div></div></a>}
