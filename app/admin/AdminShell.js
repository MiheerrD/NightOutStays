'use client';

import { usePathname } from 'next/navigation';
import AdminNav from './AdminNav';
import AdminExportTools from './AdminExportTools';

export default function AdminShell({ children }) {
  const pathname = usePathname();

  const isAdminLogin =
    pathname === '/admin/login';

  return (
    <>
      {!isAdminLogin && <AdminNav />}
      {!isAdminLogin && <AdminExportTools />}
      {children}
    </>
  );
}