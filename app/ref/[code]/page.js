'use client';
import {useEffect} from 'react';
import {useParams} from 'next/navigation';
export default function ReferralLanding(){const p=useParams();useEffect(()=>{const code=String(p?.code||'').toUpperCase();if(code)localStorage.setItem('nos_referral_code',code);location.replace(`/login?ref=${encodeURIComponent(code)}`)},[p]);return <main style={{minHeight:'60vh',display:'grid',placeItems:'center',fontFamily:'Arial',color:'#303a44'}}>Applying referral code…</main>}
