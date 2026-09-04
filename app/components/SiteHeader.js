'use client';
import { useEffect,useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import styles from './SiteHeader.module.css';
const supabase=createClient('https://gxwemplbykjxhezefykh.supabase.co','sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS');

export default function SiteHeader(){
  const pathname=usePathname();
  const [menuOpen,setMenuOpen]=useState(false);
  const [counts,setCounts]=useState({messages:0,notifications:0,bookings:0});
  const [loggedIn,setLoggedIn]=useState(false);
  const isPortal=pathname?.startsWith('/admin')||pathname?.startsWith('/host')||pathname?.startsWith('/account');
  useEffect(()=>{if(isPortal)return;let live=true;async function load(){const {data:{session}}=await supabase.auth.getSession();if(!live)return;setLoggedIn(!!session);if(!session?.access_token){setCounts({messages:0,notifications:0,bookings:0});return}try{const r=await fetch('/api/portal/summary?portal=guest',{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'});const j=await r.json();if(live&&j.success)setCounts(j)}catch{}}load();const ch=supabase.channel('site-header-live').on('postgres_changes',{event:'*',schema:'public',table:'notifications'},load).on('postgres_changes',{event:'*',schema:'public',table:'booking_messages'},load).on('postgres_changes',{event:'*',schema:'public',table:'bookings'},load).subscribe();return()=>{live=false;supabase.removeChannel(ch)}},[isPortal]);
  if(isPortal)return null;
  const links=[
    {label:'Stays',href:'/#all-stays'},
    {label:'Favorites',href:'/account/favorites'},
    {label:'Bookings',href:'/account/bookings',badge:counts.bookings},
    {label:'Messages',href:'/account/messages',badge:counts.messages},
    {label:'Notifications',href:'/account/notifications',badge:counts.notifications},
  ];
  return <header className={styles.header}><div className={styles.inner}><a href="/" className={styles.brand} onClick={()=>setMenuOpen(false)}>NightOut<span>Stays</span></a><nav className={styles.desktopNav}>{links.map(l=><a key={l.label} href={l.href} className={styles.link}>{l.label}{Number(l.badge)>0&&<span className={styles.badge}>{l.badge>99?'99+':l.badge}</span>}</a>)}<a className={styles.hostButton} href="/host/register">List your property</a><a className={styles.accountButton} href={loggedIn?'/account/profile':'/login'}>{loggedIn?'My account':'Login'}</a></nav><button type="button" className={styles.menuButton} onClick={()=>setMenuOpen(v=>!v)} aria-label="Open menu">☰</button></div>{menuOpen&&<div className={styles.mobileMenu}>{links.map(l=><a key={l.label} href={l.href} onClick={()=>setMenuOpen(false)} className={styles.mobileLink}>{l.label}{Number(l.badge)>0&&<span className={styles.badge}>{l.badge}</span>}</a>)}<a href="/host/register" className={styles.mobileLink}>List your property</a><a href={loggedIn?'/account/profile':'/login'} className={styles.mobileLink}>{loggedIn?'My account':'Login'}</a></div>}</header>
}
