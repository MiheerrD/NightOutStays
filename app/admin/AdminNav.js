'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

const menuItems = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: '⌂',
  },
  {
    label: 'Hosts',
    href: '/admin/hosts',
    icon: '♙',
  },
  {
    label: 'Properties',
    href: '/admin/properties',
    icon: '▥',
  },
  {
    label: 'Guests',
    href: '/admin/guests',
    icon: '♙',
  },
  {
    label: 'Bookings',
    href: '/admin/bookings',
    icon: '▣',
  },
  {
    label: 'Subscriptions',
    href: '/admin/subscriptions',
    icon: '▤',
  },
  {
    label: 'Promotions',
    href: '/admin/promotions',
    icon: '◇',
  },
  {
    label: 'Referrals',
    href: '/admin/referrals',
    icon: '⌯',
  },
  {
    label: 'Payouts',
    href: '/admin/payouts',
    icon: '▱',
  },
  {
    label: 'Payment Holds',
    href: '/admin/payment-holds',
    icon: '♢',
  },
  {
    label: 'Messages',
    href: '/admin/messages',
    icon: '▢',
  },
  {
    label: 'Reports',
    href: '/admin/reports',
    icon: '▥',
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: '⚙',
  },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  const [adminName, setAdminName] = useState('Super Admin');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    loadAdmin();
  }, []);

  async function loadAdmin() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        return;
      }

      const { data } = await supabase
        .from('admin_profiles')
        .select('full_name, role')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (data?.full_name) {
        setAdminName(data.full_name);
        return;
      }

      if (session.user.user_metadata?.full_name) {
        setAdminName(session.user.user_metadata.full_name);
        return;
      }

      if (session.user.email) {
        setAdminName(session.user.email.split('@')[0]);
      }
    } catch (error) {
      console.error('Unable to load admin profile:', error);
    }
  }

  function isActive(href) {
    if (href === '/admin') {
      return pathname === '/admin';
    }

    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await supabase.auth.signOut();
      router.replace('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
      setLoggingOut(false);
    }
  }

  return (
    <header className="nosAdminHeader">
      <div className="nosAdminTopRow">
        <div className="nosAdminTopLeft">
          <Link href="/admin" className="nosAdminBrand">
            NightOutStays
          </Link>

          <span className="nosAdminBadge">
            SUPER ADMIN
          </span>

          <Link
            href="/"
            target="_blank"
            rel="noreferrer"
            className="nosAdminWebsite"
          >
            <span className="nosAdminExternalIcon">
              ↗
            </span>

            View Website
          </Link>
        </div>

        <div className="nosAdminAccount">
          <div className="nosAdminIdentity">
            <strong>{adminName}</strong>
            <span>Super_admin</span>
          </div>

          <button
            type="button"
            className="nosAdminLogout"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? 'Logging out...' : 'Logout'}
          </button>
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
                  {item.icon}
                </span>

                <span className="nosAdminMenuText">
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

        .nosAdminTopRow {
          width: 100%;
          min-height: 98px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          gap: 30px;

          padding: 0 36px;

          background: #ffffff;
        }

        .nosAdminTopLeft {
          display: flex;
          align-items: center;
          gap: 17px;
          min-width: 0;
        }

        .nosAdminBrand {
          color: #0a376c;

          font-size: 31px;
          line-height: 1;
          font-weight: 900;

          letter-spacing: -1px;

          text-decoration: none;
          white-space: nowrap;
        }

        .nosAdminBadge {
          min-height: 31px;

          display: inline-flex;
          align-items: center;
          justify-content: center;

          padding: 0 14px;

          border-radius: 999px;

          background: #0b1d3a;
          color: #ffffff;

          font-size: 10px;
          line-height: 1;
          font-weight: 900;

          letter-spacing: 0.8px;

          white-space: nowrap;
        }

        .nosAdminWebsite {
          min-height: 40px;

          display: inline-flex;
          align-items: center;
          justify-content: center;

          gap: 8px;

          color: #0b315d;

          font-size: 14px;
          font-weight: 800;

          text-decoration: none;

          padding: 0 4px;

          white-space: nowrap;
        }

        .nosAdminWebsite:hover {
          color: #0759a5;
        }

        .nosAdminExternalIcon {
          width: 21px;
          height: 21px;

          display: inline-flex;
          align-items: center;
          justify-content: center;

          font-size: 20px;
          line-height: 1;

          font-weight: 800;
        }

        .nosAdminAccount {
          display: flex;
          align-items: center;
          gap: 18px;

          flex-shrink: 0;
        }

        .nosAdminIdentity {
          display: flex;
          flex-direction: column;
          align-items: flex-start;

          gap: 3px;
        }

        .nosAdminIdentity strong {
          color: #101828;

          font-size: 14px;
          line-height: 1.2;

          font-weight: 900;

          white-space: nowrap;
        }

        .nosAdminIdentity span {
          color: #155da8;

          font-size: 11px;
          line-height: 1.2;

          font-weight: 700;
        }

        .nosAdminLogout {
          min-height: 42px;

          padding: 0 17px;

          border: 1px solid #d5dde7;
          border-radius: 10px;

          background: #ffffff;
          color: #172033;

          font-size: 13px;
          font-weight: 800;

          cursor: pointer;

          transition:
            background 0.15s ease,
            border-color 0.15s ease;
        }

        .nosAdminLogout:hover {
          background: #f8fafc;
          border-color: #b9c5d2;
        }

        .nosAdminLogout:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .nosAdminMenuBar {
          width: 100%;

          background:
            linear-gradient(
              90deg,
              #073b76 0%,
              #062c59 100%
            );

          border-top:
            1px solid
            rgba(255, 255, 255, 0.06);
        }

        .nosAdminMenu {
          width: 100%;

          display: grid;

          grid-template-columns:
            repeat(
              13,
              minmax(92px, 1fr)
            );

          align-items: stretch;

          overflow-x: auto;
          overflow-y: hidden;

          scrollbar-width: thin;

          scrollbar-color:
            rgba(255, 255, 255, 0.25)
            transparent;

          padding: 0 24px;
        }

        .nosAdminMenu::-webkit-scrollbar {
          height: 5px;
        }

        .nosAdminMenu::-webkit-scrollbar-track {
          background: transparent;
        }

        .nosAdminMenu::-webkit-scrollbar-thumb {
          background:
            rgba(255, 255, 255, 0.25);

          border-radius: 999px;
        }

        .nosAdminMenuItem {
          position: relative;

          min-height: 90px;

          display: flex;
          flex-direction: column;

          align-items: center;
          justify-content: center;

          gap: 6px;

          padding: 10px 8px;

          color:
            rgba(
              255,
              255,
              255,
              0.9
            );

          text-decoration: none;
          text-align: center;

          white-space: nowrap;

          transition:
            background 0.15s ease,
            color 0.15s ease;
        }

        .nosAdminMenuItem:hover {
          background:
            rgba(
              255,
              255,
              255,
              0.07
            );

          color: #ffffff;
        }

        .nosAdminMenuItem.active {
          background:
            linear-gradient(
              180deg,
              #0c4c92 0%,
              #0b407b 100%
            );

          color: #ffffff;
        }

        .nosAdminMenuItem.active::after {
          content: '';

          position: absolute;

          left: 0;
          right: 0;
          bottom: 0;

          height: 4px;

          background: #ffffff;
        }

        .nosAdminMenuIcon {
          min-height: 30px;

          display: flex;
          align-items: center;
          justify-content: center;

          color: inherit;

          font-size: 27px;
          line-height: 1;

          font-weight: 400;
        }

        .nosAdminMenuText {
          color: inherit;

          font-size: 12px;
          line-height: 1.2;

          font-weight: 800;
        }

        @media (max-width: 1200px) {
          .nosAdminTopRow {
            min-height: 84px;
            padding: 0 22px;
          }

          .nosAdminBrand {
            font-size: 27px;
          }

          .nosAdminMenu {
            display: flex;
            padding: 0 12px;
          }

          .nosAdminMenuItem {
            min-width: 100px;
          }
        }

        @media (max-width: 800px) {
          .nosAdminTopRow {
            min-height: 74px;

            padding: 10px 14px;

            gap: 14px;
          }

          .nosAdminTopLeft {
            gap: 9px;
          }

          .nosAdminBrand {
            font-size: 22px;
          }

          .nosAdminBadge {
            min-height: 24px;
            padding: 0 8px;
            font-size: 8px;
          }

          .nosAdminWebsite {
            font-size: 11px;
          }

          .nosAdminAccount {
            gap: 8px;
          }

          .nosAdminIdentity {
            display: none;
          }

          .nosAdminLogout {
            min-height: 34px;

            padding: 0 10px;

            font-size: 11px;
          }

          .nosAdminMenuItem {
            min-width: 88px;
            min-height: 73px;
          }

          .nosAdminMenuIcon {
            font-size: 23px;
          }

          .nosAdminMenuText {
            font-size: 10px;
          }
        }

        @media (max-width: 540px) {
          .nosAdminWebsite {
            display: none;
          }

          .nosAdminBrand {
            font-size: 20px;
          }

          .nosAdminTopRow {
            padding-left: 11px;
            padding-right: 11px;
          }
        }
      `}</style>
    </header>
  );
}