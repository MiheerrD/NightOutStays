'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminNav() {
  const pathname = usePathname();

  const menuItems = [
    { label: 'Dashboard', href: '/admin' },
    { label: 'Hosts', href: '/admin/hosts' },
    { label: 'Properties', href: '/admin/properties' },
    { label: 'Guests', href: '/admin/guests' },
    { label: 'Bookings', href: '/admin/bookings' },
    { label: 'Subscriptions', href: '/admin/subscriptions' },
    { label: 'Promotions', href: '/admin/promotions' },
    { label: 'Referrals', href: '/admin/referrals' },
    { label: 'Payouts', href: '/admin/payouts' },
    { label: 'Payment Holds', href: '/admin/payment-holds' },
    { label: 'Messages', href: '/admin/messages' },
    { label: 'Reports', href: '/admin/reports' },
    { label: 'Settings', href: '/admin/settings' },
  ];

  function isActive(href) {
    if (href === '/admin') {
      return pathname === '/admin';
    }

    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  return (
    <header className="adminHeader">
      <div className="topRow">
        <div className="brandSection">
          <Link href="/admin" className="brand">
            NightOutStays
          </Link>

          <span className="badge">
            SUPER ADMIN
          </span>
        </div>

        <Link href="/" className="viewWebsite">
          View Website
        </Link>
      </div>

      <div className="menuRow">
        <nav className="menu">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                isActive(item.href)
                  ? 'menuItem active'
                  : 'menuItem'
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <style jsx>{`
        .adminHeader {
          width: 100%;
          background: #ffffff;
          border-bottom: 1px solid #e5e7eb;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .topRow {
          min-height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 0 32px;
          border-bottom: 1px solid #f0f1f3;
        }

        .brandSection {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand {
          color: #0b4b8c;
          font-size: 25px;
          line-height: 1;
          font-weight: 900;
          text-decoration: none;
          white-space: nowrap;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 27px;
          padding: 0 11px;
          border-radius: 999px;
          background: #111827;
          color: #ffffff;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.7px;
          white-space: nowrap;
        }

        .viewWebsite {
          color: #374151;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          padding: 9px 13px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          white-space: nowrap;
        }

        .viewWebsite:hover {
          background: #f9fafb;
          color: #111827;
        }

        .menuRow {
          width: 100%;
          padding: 10px 24px;
          background: #ffffff;
        }

        .menu {
          display: flex;
          align-items: center;
          gap: 5px;
          width: 100%;
          overflow-x: auto;
          scrollbar-width: thin;
          padding-bottom: 2px;
        }

        .menuItem {
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
        }

        .menuItem:hover {
          background: #f3f4f6;
          color: #111827;
        }

        .menuItem.active {
          background: #111827;
          color: #ffffff;
        }

        @media (max-width: 700px) {
          .topRow {
            min-height: 64px;
            padding: 0 16px;
          }

          .brand {
            font-size: 21px;
          }

          .badge {
            font-size: 9px;
            min-height: 24px;
            padding: 0 8px;
          }

          .viewWebsite {
            font-size: 11px;
            padding: 7px 9px;
          }

          .menuRow {
            padding: 8px 12px;
          }

          .menuItem {
            min-height: 36px;
            padding: 0 11px;
            font-size: 12px;
          }
        }
      `}</style>
    </header>
  );
}