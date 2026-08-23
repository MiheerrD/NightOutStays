'use client';

import { usePathname } from 'next/navigation';

export default function AdminNav() {
  const pathname = usePathname();

  const items = [
    {
      label: 'Bookings',
      href: '/admin/bookings',
    },
    {
      label: 'Properties',
      href: '/admin/properties',
    },
    {
      label: 'Messages',
      href: '/admin/messages',
    },
    {
      label: 'Notifications',
      href: '/admin/notifications',
    },
    {
      label: 'Reports',
      href: '/admin/reports',
    },
  ];

  return (
    <nav style={styles.nav}>
      {items.map((item) => {
        const active =
          pathname === item.href ||
          pathname.startsWith(item.href + '/');

        return (
          <a
            key={item.href}
            href={item.href}
            style={{
              ...styles.link,
              ...(active ? styles.activeLink : {}),
            }}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

const styles = {
  nav: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },

  link: {
    textDecoration: 'none',
    color: '#0b3f82',
    fontSize: '14px',
    fontWeight: '700',
    padding: '10px 14px',
    borderRadius: '999px',
    transition: 'all 0.2s ease',
  },

  activeLink: {
    background: '#0b3f82',
    color: '#ffffff',
  },
};