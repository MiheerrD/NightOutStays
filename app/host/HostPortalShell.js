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

      if (alive && data) setHost(data);
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
