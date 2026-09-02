'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminNav() {
  const pathname = usePathname();

  const menuItems = [
    {
      label: 'Dashboard',
      href: '/admin',
    },
    {
      label: 'Hosts',
      href: '/admin/hosts',
    },
    {
      label: 'Properties',
      href: '/admin/properties',
    },
    {
      label: 'Guests',
      href: '/admin/guests',
    },
    {
      label: 'Bookings',
      href: '/admin/bookings',
    },
    {
      label: 'Subscriptions',
      href: '/admin/subscriptions',
    },
    {
      label: 'Promotions',
      href: '/admin/promotions',
    },
    {
      label: 'Referrals',
      href: '/admin/referrals',
    },
    {
      label: 'Payouts',
      href: '/admin/payouts',
    },
    {
      label: 'Payment Holds',
      href: '/admin/payment-holds',
    },
    {
      label: 'Messages',
      href: '/admin/messages',
    },
    {
      label: 'Reports',
      href: '/admin/reports',
    },
    {
      label: 'Settings',
      href: '/admin/settings',
    },
  ];

  function isActive(href) {
    if (href === '/admin') {
      return pathname === '/admin';
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="admin-header">
      <div className="admin-topbar">
        <div className="brand-area">
          <Link href="/admin" className="brand">
            NightOutStays
          </Link>

          <span className="portal-badge">
            SUPER ADMIN
          </span>
        </div>

        <Link href="/" className="website-link">
          View Website
        </Link>
      </div>

      <nav className="admin-nav">
        {menuItems.map((item) => {
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${active ? 'active' : ''}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <style jsx>{`
        .admin-header {
          width: 100%;
          background: #ffffff;
          border-bottom: 1px solid #e5e7eb;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .admin-topbar {
          min-height: 68px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 0 28px;
          background: #ffffff;
        }

        .brand-area {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .brand {
          color: #111827;
          font-size: 22px;
          font-weight: 800;
          text-decoration: none;
          white-space: nowrap;
        }

        .portal-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 10px;
          border-radius: 999px;
          background: #111827;
          color: #ffffff;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.7px;
          white-space: nowrap;
        }

        .website-link {
          color: #374151;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          white-space: nowrap;
        }

        .website-link:hover {
          color: #111827;
        }

        .admin-nav {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow-x: auto;
          padding: 0 22px 12px;
          scrollbar-width: thin;
        }

        .nav-item {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 0 13px;
          border-radius: 8px;
          color: #4b5563;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          white-space: nowrap;
          transition:
            background 0.15s ease,
            color 0.15s ease;
        }

        .nav-item:hover {
          background: #f3f4f6;
          color: #111827;
        }

        .nav-item.active {
          background: #111827;
          color: #ffffff;
        }

        @media (max-width: 700px) {
          .admin-topbar {
            min-height: 62px;
            padding: 0 16px;
          }

          .brand {
            font-size: 19px;
          }

          .portal-badge {
            font-size: 9px;
            padding: 5px 8px;
          }

          .website-link {
            font-size: 12px;
          }

          .admin-nav {
            padding: 0 12px 10px;
          }

          .nav-item {
            min-height: 36px;
            padding: 0 11px;
            font-size: 12px;
          }
        }
      `}</style>
    </header>
  );
}