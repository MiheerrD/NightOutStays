'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import styles from './SiteHeader.module.css';

export default function SiteHeader({ notificationCount = 0, onLogout = null }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isPortal = pathname?.startsWith('/admin') || pathname?.startsWith('/host') || pathname?.startsWith('/account');
  if (isPortal) return null;

  const links = [
    { label:'My Bookings', href:'/account/bookings' },
    { label:'Messages', href:'/account/messages' },
    { label:'Notifications', href:'/account/notifications', badge:notificationCount },
    { label:'Profile', href:'/account/profile' },
  ];
  const active=(href)=>pathname===href || pathname?.startsWith(`${href}/`);
  return <header className={styles.header}><div className={styles.inner}>
    <a href="/" className={styles.brand} onClick={()=>setMenuOpen(false)}>NightOutStays</a>
    <nav className={styles.desktopNav}>{links.map(l=><a key={l.href} href={l.href} className={active(l.href)?styles.activeLink:styles.link}>{l.label}{Number(l.badge)>0&&<span className={styles.badge}>{l.badge>99?'99+':l.badge}</span>}</a>)}</nav>
    <button type="button" className={styles.menuButton} onClick={()=>setMenuOpen(v=>!v)} aria-label="Open menu"><span className={styles.menuIcon}>☰</span><span>Menu</span></button>
  </div>{menuOpen&&<div className={styles.mobileMenu}>{links.map(l=><a key={l.href} href={l.href} onClick={()=>setMenuOpen(false)} className={active(l.href)?styles.mobileActiveLink:styles.mobileLink}>{l.label}{Number(l.badge)>0&&<span className={styles.badge}>{l.badge}</span>}</a>)}{onLogout&&<button onClick={onLogout} className={styles.mobileLogout}>Logout</button>}</div>}</header>;
}
