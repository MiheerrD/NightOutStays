'use client';

import { useEffect, useRef } from 'react';

const FALLBACK = [18.5204, 73.8567];
let leafletPromise;

function money(v){return `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:0})}`}
function fallbackPoint(id=''){
  let h=0;
  for(const c of String(id)) h=(h*31+c.charCodeAt(0))>>>0;
  const a=((h%1000)/1000-.5)*.18;
  const b=(((h>>8)%1000)/1000-.5)*.18;
  return [FALLBACK[0]+a,FALLBACK[1]+b];
}
function ensureLeaflet(){
  if(typeof window==='undefined') return Promise.resolve(false);
  if(window.L) return Promise.resolve(true);
  if(leafletPromise) return leafletPromise;
  leafletPromise=new Promise((resolve)=>{
    if(!document.querySelector('link[data-nos-leaflet]')){
      const link=document.createElement('link');
      link.rel='stylesheet'; link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; link.dataset.nosLeaflet='1';
      document.head.appendChild(link);
    }
    const old=document.querySelector('script[data-nos-leaflet]');
    if(old){ old.addEventListener('load',()=>resolve(!!window.L),{once:true}); old.addEventListener('error',()=>resolve(false),{once:true}); return; }
    const s=document.createElement('script'); s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.async=true; s.dataset.nosLeaflet='1';
    s.onload=()=>resolve(!!window.L); s.onerror=()=>resolve(false); document.body.appendChild(s);
  });
  return leafletPromise;
}

export default function PropertyMap({properties=[],selectedId='',onSelect}){
  const el=useRef(null), map=useRef(null), layer=useRef(null);
  useEffect(()=>{
    let alive=true;
    ensureLeaflet().then(ok=>{
      if(!alive||!ok||!el.current||!window.L) return;
      const L=window.L;
      if(!map.current){
        map.current=L.map(el.current,{
          zoomControl:true,
          scrollWheelZoom:true,
          doubleClickZoom:true,
          touchZoom:true,
          boxZoom:true,
          keyboard:true,
          dragging:true,
          zoomSnap:.5,
          wheelPxPerZoomLevel:80,
        }).setView(FALLBACK,11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map.current);
      }
      if(layer.current) layer.current.remove();
      layer.current=L.layerGroup().addTo(map.current);
      const bounds=[];
      properties.forEach(p=>{
        const lat=Number(p.latitude), lng=Number(p.longitude);
        if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return;
        const pt=[lat,lng]; bounds.push(pt);
        const icon=L.divIcon({
          className:'nos-map-marker',
          html:`<div class="nos-map-pill ${p.id===selectedId?'selected':''}">${money(p.base_price)}</div>`,
          iconSize:[86,34], iconAnchor:[43,17]
        });
        const marker=L.marker(pt,{icon}).addTo(layer.current);
        const image=p.cover_image?`<img src="${String(p.cover_image).replace(/"/g,'&quot;')}" alt="" style="width:100%;height:86px;object-fit:cover;border-radius:12px;margin-bottom:8px"/>`:'';
        marker.bindPopup(`${image}<strong>${p.name||'Stay'}</strong><br/><span>${p.location_name||p.area||p.city||''}</span><br/><b>${money(p.base_price)} / night</b>`,{closeButton:false,minWidth:190});
        marker.on('click',()=>onSelect?.(p.id));
      });
      if(bounds.length>1) map.current.fitBounds(bounds,{padding:[34,34],maxZoom:12});
      else if(bounds.length===1) map.current.setView(bounds[0],12);
      const invalidate=()=>map.current?.invalidateSize();
      setTimeout(invalidate,80); setTimeout(invalidate,350);
    });
    return()=>{alive=false};
  },[properties,selectedId,onSelect]);

  return <div className="nosMapShell"><div ref={el} className="nosMapCanvas"/><div className="mapHint">Use mouse wheel or trackpad to zoom · pins use saved property locations</div><style jsx global>{`
    .nosMapShell{position:relative;width:100%;height:460px;border-radius:22px;overflow:hidden;background:#edf3f7;isolation:isolate}
    .nosMapCanvas{position:absolute;inset:0;z-index:1}.nos-map-marker{background:transparent!important;border:0!important}
    .nos-map-pill{display:flex;align-items:center;justify-content:center;min-width:74px;height:30px;padding:0 10px;border-radius:999px;background:#1769c2;color:#fff;font:900 12px/1 Arial,sans-serif;box-shadow:0 5px 18px rgba(23,105,194,.28);border:2px solid #fff;white-space:nowrap}.nos-map-pill.selected{background:#f00078;transform:scale(1.08)}
    .leaflet-popup-content{margin:10px!important;font-family:Arial,sans-serif;line-height:1.4;color:#39424e}.leaflet-popup-content-wrapper{border-radius:14px!important}.leaflet-control-zoom a{color:#39424e!important}
    .mapHint{position:absolute;z-index:500;left:50%;bottom:12px;transform:translateX(-50%);background:rgba(255,255,255,.92);color:#5a6572;border:1px solid #dde3ea;border-radius:999px;padding:7px 11px;font:700 10px Arial;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.08)}
    @media(max-width:760px){.nosMapShell{height:360px;border-radius:18px}.mapHint{font-size:9px;bottom:8px}}
  `}</style></div>
}
