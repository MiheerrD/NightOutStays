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
      label: 'Calendar',
      href: '/admin/calendar',
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
    <>
      <nav className="adminNav">
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
              className={
                active
                  ? 'adminNavLink active'
                  : 'adminNavLink'
              }
            >
              {item.label}
            </a>
          );
        })}
      </nav>

      <style jsx>{`
        .adminNav {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          min-width: 0;
        }

        .adminNavLink {
          min-height: 42px;

          display: inline-flex;
          align-items: center;
          justify-content: center;

          padding: 0 14px;

          border-radius: 999px;

          text-decoration: none;

          color: #0b3f82;

          font-size: 14px;
          font-weight: 700;

          white-space: nowrap;

          transition:
            background 0.2s ease,
            color 0.2s ease;
        }

        .adminNavLink.active {
          background: #0b3f82;
          color: #ffffff;
        }

        @media (max-width: 900px) {
          .adminNav {
            width: 100%;

            flex-wrap: nowrap;

            overflow-x: auto;

            padding: 4px 0 7px;

            -webkit-overflow-scrolling: touch;

            scrollbar-width: none;
          }

          .adminNav::-webkit-scrollbar {
            display: none;
          }

          .adminNavLink {
            flex: 0 0 auto;

            min-height: 44px;

            padding: 0 15px;

            font-size: 13px;
          }
        }

        @media (max-width: 480px) {
          .adminNav {
            gap: 5px;
          }

          .adminNavLink {
            min-height: 44px;

            padding: 0 13px;

            font-size: 12px;
          }
        }
      `}</style>
    </>
  );
}