'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminNav() {
  const pathname = usePathname();

  const menuItems = [
    {
      label: 'Dashboard',
      href: '/admin',
      short: 'DB',
    },
    {
      label: 'Hosts',
      href: '/admin/hosts',
      short: 'H',
    },
    {
      label: 'Properties',
      href: '/admin/properties',
      short: 'P',
    },
    {
      label: 'Guests',
      href: '/admin/guests',
      short: 'G',
    },
    {
      label: 'Bookings',
      href: '/admin/bookings',
      short: 'B',
    },
    {
      label: 'Subscriptions',
      href: '/admin/subscriptions',
      short: 'S',
    },
    {
      label: 'Promotions',
      href: '/admin/promotions',
      short: 'PR',
    },
    {
      label: 'Referrals',
      href: '/admin/referrals',
      short: 'R',
    },
    {
      label: 'Payouts',
      href: '/admin/payouts',
      short: '₹',
    },
    {
      label: 'Payment Holds',
      href: '/admin/payment-holds',
      short: 'PH',
    },
    {
      label: 'Messages',
      href: '/admin/messages',
      short: 'M',
    },
    {
      label: 'Reports',
      href: '/admin/reports',
      short: 'RP',
    },
    {
      label: 'Settings',
      href: '/admin/settings',
      short: 'ST',
    },
  ];

  function isActive(href) {
    if (href === '/admin') {
      return pathname === '/admin';
    }

    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  return (
    <header className="nosAdminHeader">
      <div className="nosAdminTop">
        <div className="nosAdminTopInner">
          <div className="nosAdminBrandGroup">
            <Link href="/admin" className="nosAdminBrand">
              NightOutStays
            </Link>

            <span className="nosAdminBadge">
              SUPER ADMIN
            </span>
          </div>

          <div className="nosAdminTopActions">
            <Link
              href="/"
              target="_blank"
              className="nosAdminWebsite"
            >
              View Website
            </Link>
          </div>
        </div>
      </div>

      <div className="nosAdminMenuBar">
        <nav className="nosAdminMenu">
          {menuItems.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? 'nosAdminMenuItem active'
                    : 'nosAdminMenuItem'
                }
              >
                <span className="nosAdminMenuIcon">
                  {item.short}
                </span>

                <span className="nosAdminMenuLabel">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      <style jsx>{`
        .nosAdminHeader {
          width: 100%;
          position: sticky;
          top: 0;
          z-index: 1000;
          background: #ffffff;
          box-shadow: 0 1px 0 rgba(15, 23, 42, 0.08);
        }

        .nosAdminTop {
          width: 100%;
          background: #ffffff;
        }

        .nosAdminTopInner {
          min-height: 74px;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 0 34px;
        }

        .nosAdminBrandGroup {
          display: flex;
          align-items: center;
          gap: 13px;
          min-width: 0;
        }

        .nosAdminBrand {
          color: #103f79;
          font-size: 27px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.7px;
          text-decoration: none;
          white-space: nowrap;
        }

        .nosAdminBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 26px;
          padding: 0 11px;
          border-radius: 999px;
          background: #0f172a;
          color: #ffffff;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.7px;
          white-space: nowrap;
        }

        .nosAdminTopActions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .nosAdminWebsite {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 0 15px;
          border: 1px solid #dbe2ea;
          border-radius: 9px;
          background: #ffffff;
          color: #24364b;
          font-size: 12px;
          font-weight: 800;
          text-decoration: none;
          white-space: nowrap;
          transition: 0.15s ease;
        }

        .nosAdminWebsite:hover {
          background: #f8fafc;
          border-color: #bfc9d5;
          color: #103f79;
        }

        .nosAdminMenuBar {
          width: 100%;
          background: linear-gradient(
            90deg,
            #0d3f7c 0%,
            #092f61 100%
          );
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .nosAdminMenu {
          width: 100%;
          display: flex;
          align-items: stretch;
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
          padding: 0 24px;
        }

        .nosAdminMenu::-webkit-scrollbar {
          height: 5px;
        }

        .nosAdminMenu::-webkit-scrollbar-track {
          background: transparent;
        }

        .nosAdminMenu::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.25);
          border-radius: 999px;
        }

        .nosAdminMenuItem {
          position: relative;
          min-width: 94px;
          min-height: 72px;
          padding: 10px 13px 9px;

          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;

          color: rgba(255, 255, 255, 0.84);
          text-decoration: none;
          white-space: nowrap;

          border-left: 1px solid transparent;
          border-right: 1px solid transparent;

          transition:
            background 0.15s ease,
            color 0.15s ease;
        }

        .nosAdminMenuItem:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
        }

        .nosAdminMenuItem.active {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.12);
        }

        .nosAdminMenuItem.active::after {
          content: '';
          position: absolute;
          left: 14px;
          right: 14px;
          bottom: 0;
          height: 4px;
          background: #ffffff;
          border-radius: 4px 4px 0 0;
        }

        .nosAdminMenuIcon {
          width: 29px;
          height: 29px;
          display: inline-flex;
          align-items: center;
          justify-content: center;

          border: 1px solid rgba(255, 255, 255, 0.35);
          border-radius: 8px;

          font-size: 10px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.2px;
        }

        .nosAdminMenuItem.active .nosAdminMenuIcon {
          background: rgba(255, 255, 255, 0.13);
          border-color: rgba(255, 255, 255, 0.7);
        }

        .nosAdminMenuLabel {
          font-size: 11px;
          line-height: 1.1;
          font-weight: 800;
        }

        @media (max-width: 1100px) {
          .nosAdminTopInner {
            padding: 0 22px;
          }

          .nosAdminMenu {
            padding: 0 12px;
          }

          .nosAdminMenuItem {
            min-width: 88px;
            padding-left: 10px;
            padding-right: 10px;
          }
        }

        @media (max-width: 700px) {
          .nosAdminTopInner {
            min-height: 64px;
            padding: 0 14px;
            gap: 12px;
          }

          .nosAdminBrandGroup {
            gap: 8px;
          }

          .nosAdminBrand {
            font-size: 21px;
          }

          .nosAdminBadge {
            min-height: 22px;
            padding: 0 7px;
            font-size: 7px;
          }

          .nosAdminWebsite {
            min-height: 34px;
            padding: 0 10px;
            font-size: 10px;
          }

          .nosAdminMenu {
            padding: 0 5px;
          }

          .nosAdminMenuItem {
            min-width: 80px;
            min-height: 64px;
            padding: 8px 8px;
          }

          .nosAdminMenuIcon {
            width: 25px;
            height: 25px;
            font-size: 8px;
          }

          .nosAdminMenuLabel {
            font-size: 9px;
          }
        }
      `}</style>
    </header>
  );
}