'use client';

import { useEffect, useRef } from 'react';

const FALLBACK = [18.5204, 73.8567];

function money(v) {
  return `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fallbackPoint(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const a = ((h % 1000) / 1000 - 0.5) * 0.16;
  const b = ((((h / 1000) | 0) % 1000) / 1000 - 0.5) * 0.18;
  return [FALLBACK[0] + a, FALLBACK[1] + b];
}

function ensureLeaflet() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.L) return Promise.resolve(true);
  return new Promise((resolve) => {
    if (!document.querySelector('link[data-nos-leaflet]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.dataset.nosLeaflet = '1';
      document.head.appendChild(link);
    }
    const existing = document.querySelector('script[data-nos-leaflet]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.dataset.nosLeaflet = '1';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PropertyMap({ properties = [], selectedId = '', onSelect }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    let alive = true;
    ensureLeaflet().then((ok) => {
      if (!alive || !ok || !ref.current || !window.L) return;
      const L = window.L;
      if (!mapRef.current) {
        mapRef.current = L.map(ref.current, { zoomControl: true, scrollWheelZoom: false }).setView(FALLBACK, 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(mapRef.current);
      }
      if (layerRef.current) layerRef.current.remove();
      const layer = L.layerGroup().addTo(mapRef.current);
      layerRef.current = layer;
      const bounds = [];
      properties.forEach((p) => {
        const lat = Number(p.latitude);
        const lng = Number(p.longitude);
        const [fy, fx] = fallbackPoint(p.id);
        const point = [Number.isFinite(lat) ? lat : fy, Number.isFinite(lng) ? lng : fx];
        bounds.push(point);
        const isSelected = p.id === selectedId;
        const icon = L.divIcon({
          className: 'nos-map-marker',
          html: `<div class="nos-map-pill ${isSelected ? 'selected' : ''}">${money(p.base_price)}</div>`,
          iconSize: [86, 34],
          iconAnchor: [43, 17],
        });
        const marker = L.marker(point, { icon }).addTo(layer);
        const image = p.cover_image ? `<img src="${String(p.cover_image).replace(/"/g, '&quot;')}" alt="" style="width:100%;height:82px;object-fit:cover;border-radius:10px;margin-bottom:8px"/>` : '';
        marker.bindPopup(`${image}<strong>${p.name || 'Stay'}</strong><br/><span>${p.location_name || p.area || p.city || ''}</span><br/><b>${money(p.base_price)} / night</b>`, { closeButton: false, minWidth: 185 });
        marker.on('click', () => onSelect?.(p.id));
      });
      if (bounds.length > 1) mapRef.current.fitBounds(bounds, { padding: [28, 28], maxZoom: 12 });
      else if (bounds.length === 1) mapRef.current.setView(bounds[0], 12);
      setTimeout(() => mapRef.current?.invalidateSize(), 80);
    });
    return () => { alive = false; };
  }, [properties, selectedId, onSelect]);

  return (
    <div className="nosMapShell">
      <div ref={ref} className="nosMapCanvas" />
      <style jsx global>{`
        .nosMapShell{position:relative;width:100%;height:100%;min-height:430px;border-radius:24px;overflow:hidden;background:linear-gradient(135deg,#e7f7ef,#e7f0ff)}
        .nosMapCanvas{position:absolute;inset:0;z-index:1}
        .nos-map-marker{background:transparent!important;border:0!important}
        .nos-map-pill{display:flex;align-items:center;justify-content:center;min-width:74px;height:30px;padding:0 10px;border-radius:999px;background:#0b5bd3;color:#fff;font:900 12px/1 Arial,sans-serif;box-shadow:0 6px 20px rgba(11,91,211,.28);border:2px solid #fff;white-space:nowrap}
        .nos-map-pill.selected{background:#f4007d;transform:scale(1.08)}
        .leaflet-popup-content{margin:10px!important;font-family:Arial,sans-serif;line-height:1.4}.leaflet-popup-content-wrapper{border-radius:14px!important}
        @media(max-width:720px){.nosMapShell{min-height:360px;border-radius:18px}}
      `}</style>
    </div>
  );
}
