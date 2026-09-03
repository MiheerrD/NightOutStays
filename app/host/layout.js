import HostPortalShell from './HostPortalShell';

export default function HostLayout({ children }) {
  return (
    <HostPortalShell>
      {children}
    </HostPortalShell>
  );
}
