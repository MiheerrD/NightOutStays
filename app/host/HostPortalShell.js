'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import HostNav from './HostNav';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

export default function HostPortalShell({ children }) {
  const pathname = usePathname();
  const [host, setHost] = useState(null);

  const isPublicHostRoute =
    pathname === '/host/register' ||
    pathname?.startsWith('/host/register/');

  useEffect(() => {
    if (isPublicHostRoute) return;

    let alive = true;

    async function loadHostIdentity() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || !alive) return;

      const { data } = await supabase
        .from('host_profiles')
        .select('id, user_id, full_name, business_name, status')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (alive && data) setHost(data);const saved=localStorage.getItem('nos_referral_code');if(saved&&session?.access_token){try{const r=await fetch('/api/referrals',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({code:saved})});const j=await r.json();if(r.ok&&j.success)localStorage.removeItem('nos_referral_code')}catch{}}
    }

    loadHostIdentity();
    return () => { alive = false; };
  }, [isPublicHostRoute]);

  if (isPublicHostRoute) return children;

  return (
    <>
      <HostNav host={host} />
      {children}
    </>
  );
}
