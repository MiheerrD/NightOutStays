'use client';
import { useEffect,useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import GuestNav from './GuestNav';
const supabase=createClient('https://gxwemplbykjxhezefykh.supabase.co','sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS');
export default function GuestPortalShell({children}){const pathname=usePathname();const [guest,setGuest]=useState(null);const publicRoute=pathname==='/account/register'||pathname?.startsWith('/account/register/');useEffect(()=>{if(publicRoute)return;let alive=true;(async()=>{const {data:{session}}=await supabase.auth.getSession();if(!session?.user)return;const {data}=await supabase.from('guests').select('id,user_id,full_name,email,phone').eq('user_id',session.user.id).maybeSingle();if(alive)setGuest(data||null);const saved=localStorage.getItem('nos_referral_code');if(saved&&session?.access_token){try{const r=await fetch('/api/referrals',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({code:saved})});const j=await r.json();if(r.ok&&j.success)localStorage.removeItem('nos_referral_code')}catch{}}})();return()=>{alive=false}},[publicRoute]);if(publicRoute)return children;return <><GuestNav guest={guest}/><div className="guestPortalSurface">{children}</div></>}
