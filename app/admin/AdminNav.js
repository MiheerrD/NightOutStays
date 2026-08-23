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
      label: 'Offers',
      href: '/admin/offers',
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
          pathname.startsWith(
            item.href + '/'
          );

        return (
          <a
            key={item.href}
            href={item.href}
            style={{
              ...styles.link,
              ...(active
                ? styles.activeLink
                : {}),
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
    color: '#163c74',
    padding: '9px 13px',
    borderRadius: '20px',
    fontWeight: '700',
    fontSize: '14px',
    border: '1px solid transparent',
  },

  activeLink: {
    background: '#163c74',
    color: '#ffffff',
  },
};