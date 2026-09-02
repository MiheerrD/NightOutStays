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
    label: 'Admins',
    href: '/admin/admins',
    icon: '♛',
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
    icon: '⇄',
  },
  {
    label: 'Payouts',
    href: '/admin/payouts',
    icon: '▰',
  },
  {
    label: 'Payment Holds',
    href: '/admin/payment-holds',
    icon: '◈',
  },
  {
    label: 'Messages',
    href: '/admin/messages',
    icon: '▭',
  },
  {
    label: 'Reports',
    href: '/admin/reports',
    icon: '≣',
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

  const [adminName, setAdminName] =
    useState('');

  const [adminRole, setAdminRole] =
    useState('');

  useEffect(() => {
    loadAdminProfile();
  }, []);

  async function loadAdminProfile() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const {
        data,
        error,
      } = await supabase
        .from('admin_profiles')
        .select(
          `
            full_name,
            role,
            is_active
          `
        )
        .eq(
          'user_id',
          session.user.id
        )
        .maybeSingle();

      if (error) {
        console.error(error);
        return;
      }

      if (!data) return;

      setAdminName(
        data.full_name || 'Admin'
      );

      setAdminRole(
        data.role || 'admin'
      );
    } catch (error) {
      console.error(
        'Unable to load admin profile:',
        error
      );
    }
  }

  function isActive(href) {
    if (href === '/admin') {
      return pathname === '/admin';
    }

    return pathname?.startsWith(href);
  }

  async function handleLogout() {
    await supabase.auth.signOut();

    router.replace('/admin/login');
    router.refresh();
  }

  return (
    <>
      <header className="nosAdminHeader">
        <div className="nosAdminTopRow">
          <div className="nosAdminTopInner">
            <div className="nosAdminBrandArea">
              <Link
                href="/admin"
                className="nosAdminBrand"
              >
                NightOutStays
              </Link>

              <span className="nosAdminBadge">
                {adminRole === 'super_admin'
                  ? 'SUPER ADMIN'
                  : 'ADMIN'}
              </span>

              <Link
                href="/"
                target="_blank"
                className="nosViewWebsite"
              >
                ↗ View Website
              </Link>
            </div>

            <div className="nosAdminUserArea">
              <div className="nosAdminUserText">
                <strong>
                  {adminName ||
                    'Administrator'}
                </strong>

                <span>
                  {adminRole === 'super_admin'
                    ? 'Super Admin'
                    : 'Admin'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="nosAdminLogout"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        <nav className="nosAdminMenuBar">
          <div className="nosAdminMenuScroll">
            {menuItems.map((item) => {
              const active =
                isActive(item.href);

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

                  <span className="nosAdminMenuLabel">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        .nosAdminHeader {
          width: 100%;
          position: sticky;
          top: 0;
          z-index: 1000;
          background: #ffffff;
          border-bottom: 1px solid #dde3eb;
        }

        .nosAdminTopRow {
          width: 100%;
          background: #ffffff;
        }

        .nosAdminTopInner {
          width: calc(100% - 64px);
          max-width: 1500px;
          min-height: 70px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }

        .nosAdminBrandArea {
          display: flex;
          align-items: center;
          gap: 16px;
          min-width: 0;
        }

        .nosAdminBrand {
          color: #0a4b89;
          font-size: 24px;
          font-weight: 900;
          text-decoration: none;
          letter-spacing: -0.7px;
          white-space: nowrap;
        }

        .nosAdminBadge {
          min-height: 25px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 11px;
          border-radius: 999px;
          background: #0b315d;
          color: #ffffff;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.7px;
          white-space: nowrap;
        }

        .nosViewWebsite {
          color: #0c4f8f;
          font-size: 12px;
          font-weight: 800;
          text-decoration: none;
          white-space: nowrap;
        }

        .nosViewWebsite:hover {
          text-decoration: underline;
        }

        .nosAdminUserArea {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-shrink: 0;
        }

        .nosAdminUserText {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          line-height: 1.2;
        }

        .nosAdminUserText strong {
          color: #101828;
          font-size: 12px;
          font-weight: 900;
        }

        .nosAdminUserText span {
          margin-top: 3px;
          color: #667085;
          font-size: 9px;
          font-weight: 700;
        }

        .nosAdminLogout {
          min-height: 36px;
          padding: 0 14px;
          border: 1px solid #ccd5df;
          border-radius: 8px;
          background: #ffffff;
          color: #23344a;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .nosAdminLogout:hover {
          background: #f5f7fa;
        }

        .nosAdminMenuBar {
          width: 100%;
          background: #082f5a;
        }

        .nosAdminMenuScroll {
          width: calc(100% - 64px);
          max-width: 1500px;
          min-height: 72px;
          margin: 0 auto;
          display: flex;
          align-items: stretch;
          overflow-x: auto;
          scrollbar-width: thin;
        }

        .nosAdminMenuScroll::-webkit-scrollbar {
          height: 5px;
        }

        .nosAdminMenuScroll::-webkit-scrollbar-thumb {
          background: rgba(
            255,
            255,
            255,
            0.25
          );
          border-radius: 999px;
        }

        .nosAdminMenuItem {
          min-width: 91px;
          min-height: 72px;
          padding: 9px 11px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          position: relative;
          color: #ffffff !important;
          text-decoration: none;
          opacity: 0.86;
          transition: 0.15s ease;
          flex-shrink: 0;
        }

        .nosAdminMenuItem:hover {
          background: rgba(
            255,
            255,
            255,
            0.09
          );
          color: #ffffff !important;
          opacity: 1;
        }

        .nosAdminMenuItem.active {
          background: rgba(
            255,
            255,
            255,
            0.14
          );
          color: #ffffff !important;
          opacity: 1;
        }

        .nosAdminMenuItem.active::after {
          content: '';
          position: absolute;
          left: 18px;
          right: 18px;
          bottom: 0;
          height: 4px;
          border-radius: 4px 4px 0 0;
          background: #ffffff;
        }

        .nosAdminMenuIcon {
          color: #ffffff !important;
          font-size: 19px;
          line-height: 1;
          font-weight: 400;
        }

        .nosAdminMenuLabel {
          color: #ffffff !important;
          font-size: 10px;
          line-height: 1.2;
          font-weight: 800;
          text-align: center;
          white-space: nowrap;
        }

        @media (max-width: 900px) {
          .nosAdminTopInner {
            width: calc(100% - 30px);
          }

          .nosAdminMenuScroll {
            width: 100%;
            padding: 0 12px;
          }

          .nosAdminBrandArea {
            gap: 10px;
          }

          .nosAdminBrand {
            font-size: 20px;
          }

          .nosViewWebsite {
            display: none;
          }
        }

        @media (max-width: 650px) {
          .nosAdminTopInner {
            min-height: 65px;
          }

          .nosAdminBadge {
            display: none;
          }

          .nosAdminUserText {
            display: none;
          }

          .nosAdminLogout {
            min-height: 34px;
            padding: 0 11px;
          }

          .nosAdminMenuItem {
            min-width: 82px;
          }
        }
      `}</style>
    </>
  );
}