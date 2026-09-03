'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

const ALL_MENU_ITEMS = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: '⌂',
    module: 'dashboard',
  },
  {
    label: 'Admins',
    href: '/admin/admins',
    icon: '♛',
    module: 'admins',
    superAdminOnly: true,
  },
  {
    label: 'Hosts',
    href: '/admin/hosts',
    icon: '♙',
    module: 'hosts',
  },
  {
    label: 'Properties',
    href: '/admin/properties',
    icon: '▥',
    module: 'properties',
  },
  {
    label: 'Guests',
    href: '/admin/guests',
    icon: '♙',
    module: 'guests',
  },
  {
    label: 'Bookings',
    href: '/admin/bookings',
    icon: '▣',
    module: 'bookings',
  },
  {
    label: 'Subscriptions',
    href: '/admin/subscriptions',
    icon: '▤',
    module: 'subscriptions',
  },
  {
    label: 'Promotions',
    href: '/admin/promotions',
    icon: '◇',
    module: 'promotions',
  },
  {
    label: 'Referrals',
    href: '/admin/referrals',
    icon: '⇄',
    module: 'referrals',
  },
  {
    label: 'Payouts',
    href: '/admin/payouts',
    icon: '▰',
    module: 'payouts',
  },
  {
    label: 'Payment Holds',
    href: '/admin/payment-holds',
    icon: '◈',
    module: 'payment_holds',
  },
  {
    label: 'Messages',
    href: '/admin/messages',
    icon: '▭',
    module: 'messages',
  },
  {
    label: 'Notifications',
    href: '/admin/notifications',
    icon: '♢',
    module: 'messages',
  },
  {
    label: 'Support',
    href: '/admin/support',
    icon: '?',
    module: 'messages',
  },
  {
    label: 'Reports',
    href: '/admin/reports',
    icon: '≣',
    module: 'reports',
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: '⚙',
    module: 'settings',
  },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  const [adminProfile, setAdminProfile] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdmin();
  }, []);

  async function loadAdmin() {
    setLoading(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        router.replace('/admin/login');
        return;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from('admin_profiles')
        .select(`
          user_id,
          full_name,
          email,
          role,
          is_active,
          full_access
        `)
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (
        !profile ||
        !profile.is_active ||
        !['super_admin', 'admin'].includes(profile.role)
      ) {
        await supabase.auth.signOut();
        router.replace('/admin/login');
        return;
      }

      setAdminProfile(profile);

      if (
        profile.role === 'admin' &&
        !profile.full_access
      ) {
        const {
          data: permissionRows,
          error: permissionError,
        } = await supabase
          .from('admin_permissions')
          .select(`
            module,
            can_view
          `)
          .eq(
            'admin_user_id',
            session.user.id
          );

        if (permissionError) {
          throw permissionError;
        }

        const map = {};

        (permissionRows || []).forEach(
          (row) => {
            map[row.module] =
              row.can_view === true;
          }
        );

        setPermissions(map);
      } else {
        setPermissions({});
      }
    } catch (error) {
      console.error(
        'Admin navigation error:',
        error
      );
    } finally {
      setLoading(false);
    }
  }

  const visibleMenuItems = useMemo(() => {
    if (!adminProfile) {
      return [];
    }

    if (
      adminProfile.role ===
      'super_admin'
    ) {
      return ALL_MENU_ITEMS;
    }

    if (adminProfile.full_access) {
      return ALL_MENU_ITEMS.filter(
        (item) =>
          !item.superAdminOnly
      );
    }

    return ALL_MENU_ITEMS.filter(
      (item) => {
        if (item.superAdminOnly) {
          return false;
        }

        if (
          item.module === 'dashboard'
        ) {
          return true;
        }

        return (
          permissions[item.module] ===
          true
        );
      }
    );
  }, [
    adminProfile,
    permissions,
  ]);

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

  if (loading) {
    return (
      <>
        <div className="nosNavLoading">
          Loading Admin...
        </div>

        <Styles />
      </>
    );
  }

  if (!adminProfile) {
    return null;
  }

  const isSuperAdmin =
    adminProfile.role === 'super_admin';

  return (
    <>
      <div className="nosAdminNavRoot">

        <div className="nosBlueMenuRow">

          <div
            className="nosBlueMenuGrid"
            style={{
              gridTemplateColumns:
                `repeat(${visibleMenuItems.length}, minmax(0, 1fr))`,
            }}
          >
            {visibleMenuItems.map(
              (item) => {
                const active =
                  isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      active
                        ? 'nosBlueMenuItem active'
                        : 'nosBlueMenuItem'
                    }
                  >
                    <span className="nosBlueMenuIcon">
                      {item.icon}
                    </span>

                    <span className="nosBlueMenuLabel">
                      {item.label}
                    </span>
                  </Link>
                );
              }
            )}
          </div>

        </div>

        <div className="nosAdminDetailRow">

          <div className="nosAdminDetailInner">

            <div className="nosAdminDetailLeft">

              <span
                className={
                  isSuperAdmin
                    ? 'nosRoleBadge super'
                    : 'nosRoleBadge'
                }
              >
                {isSuperAdmin
                  ? 'SUPER ADMIN'
                  : adminProfile.full_access
                    ? 'ADMIN · FULL ACCESS'
                    : 'ADMIN · LIMITED ACCESS'}
              </span>

              <div className="nosAdminIdentity">
                <strong>
                  {adminProfile.full_name ||
                    'Administrator'}
                </strong>

                <span>
                  {isSuperAdmin
                    ? 'Super Admin'
                    : adminProfile.full_access
                      ? 'Admin · Full Access'
                      : 'Admin · Limited Access'}
                </span>
              </div>

            </div>

            <div className="nosAdminDetailRight">

              <Link
                href="/"
                target="_blank"
                className="nosWebsiteButton"
              >
                ↗ View Website
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="nosLogoutButton"
              >
                Logout
              </button>

            </div>

          </div>

        </div>

      </div>

      <Styles />
    </>
  );
}

function Styles() {
  return (
    <style jsx global>{`

      .nosAdminNavRoot,
      .nosAdminNavRoot * {
        box-sizing: border-box;
      }

      .nosAdminNavRoot {
        display: block !important;
        position: relative !important;
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        background: #ffffff;
        z-index: 1000;
      }

      .nosBlueMenuRow {
        display: block !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #082f5a !important;
        overflow: hidden !important;
      }

      .nosBlueMenuGrid {
        display: grid !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        align-items: stretch;
        background: #082f5a;
        overflow: hidden !important;
      }

      .nosBlueMenuItem {
        position: relative;
        min-width: 0 !important;
        min-height: 70px;
        padding: 8px 2px;
        display: flex !important;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 5px;
        background: transparent;
        color: #ffffff !important;
        text-decoration: none !important;
        overflow: hidden;
      }

      .nosBlueMenuItem:hover {
        background:
          rgba(
            255,
            255,
            255,
            0.10
          ) !important;
      }

      .nosBlueMenuItem.active {
        background: #35618c !important;
      }

      .nosBlueMenuItem.active::after {
        content: '';
        position: absolute;
        left: 20%;
        right: 20%;
        bottom: 0;
        height: 4px;
        background: #ffffff;
        border-radius:
          4px 4px 0 0;
      }

      .nosBlueMenuIcon {
        display: block;
        color: #ffffff !important;
        font-size: 15px;
        line-height: 1;
      }

      .nosBlueMenuLabel {
        display: block;
        width: 100%;
        color: #ffffff !important;
        font-size: 8px;
        font-weight: 900;
        line-height: 1.15;
        text-align: center;
        white-space: normal;
        overflow-wrap: normal;
        word-break: normal;
      }

      .nosAdminDetailRow {
        display: block !important;
        width: 100% !important;
        margin: 0 !important;
        background: #ffffff !important;
        border-bottom:
          1px solid #dfe5ec;
      }

      .nosAdminDetailInner {
        width:
          calc(100% - 64px);
        max-width: 1500px;
        min-height: 62px;
        margin: 0 auto;
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        justify-content:
          space-between !important;
        gap: 20px;
        background: #ffffff;
      }

      .nosAdminDetailLeft {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .nosRoleBadge {
        min-height: 27px;
        padding: 0 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        background: #eaf2fb;
        color: #0b579e;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: 0.6px;
        white-space: nowrap;
      }

      .nosRoleBadge.super {
        background: #082f5a;
        color: #ffffff;
      }

      .nosAdminIdentity {
        display: flex;
        flex-direction: column;
      }

      .nosAdminIdentity strong {
        color: #101828;
        font-size: 13px;
        font-weight: 900;
      }

      .nosAdminIdentity span {
        margin-top: 2px;
        color: #667085;
        font-size: 10px;
        font-weight: 700;
      }

      .nosAdminDetailRight {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .nosWebsiteButton,
      .nosLogoutButton {
        min-height: 36px;
        padding: 0 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #ccd6e1;
        border-radius: 8px;
        background: #ffffff;
        font-size: 10px;
        font-weight: 900;
        cursor: pointer;
      }

      .nosWebsiteButton {
        color: #0b579e;
        text-decoration: none;
      }

      .nosLogoutButton {
        color: #25364a;
      }

      .nosWebsiteButton:hover,
      .nosLogoutButton:hover {
        background: #f5f7fa;
      }

      .nosNavLoading {
        width: 100%;
        min-height: 70px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #082f5a;
        color: #ffffff;
        font-size: 11px;
        font-weight: 900;
      }

      @media (max-width: 1100px) {

        .nosBlueMenuLabel {
          font-size: 7px;
        }

        .nosBlueMenuIcon {
          font-size: 13px;
        }

        .nosAdminDetailInner {
          width:
            calc(100% - 30px);
        }

      }

      @media (max-width: 750px) {

        .nosBlueMenuGrid {
          grid-template-columns:
            repeat(4, 1fr)
            !important;
        }

        .nosBlueMenuItem {
          min-height: 60px;
        }

        .nosBlueMenuLabel {
          font-size: 9px;
        }

        .nosAdminDetailInner {
          min-height: 58px;
        }

        .nosRoleBadge {
          display: none;
        }

        .nosAdminIdentity span {
          display: none;
        }

        .nosWebsiteButton {
          display: none;
        }

      }

      @media (max-width: 450px) {

        .nosBlueMenuGrid {
          grid-template-columns:
            repeat(3, 1fr)
            !important;
        }

        .nosAdminDetailInner {
          width:
            calc(100% - 20px);
        }

        .nosAdminIdentity strong {
          max-width: 160px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

      }

      html,
      body {
        max-width: 100%;
        overflow-x: hidden !important;
      }

    `}</style>
  );
}