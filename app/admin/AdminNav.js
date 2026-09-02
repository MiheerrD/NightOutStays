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

  const [adminProfile, setAdminProfile] =
    useState(null);

  const [permissions, setPermissions] =
    useState({});

  const [loading, setLoading] =
    useState(true);

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
        !['super_admin', 'admin'].includes(
          profile.role
        )
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
          error: permissionsError,
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

        if (permissionsError) {
          throw permissionsError;
        }

        const permissionMap = {};

        (permissionRows || []).forEach(
          (row) => {
            permissionMap[row.module] =
              row.can_view === true;
          }
        );

        setPermissions(permissionMap);
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
        (item) => !item.superAdminOnly
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
        <div className="nosAdminMenuLoading">
          Loading...
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
      <header className="nosAdminNavigation">

        {/* DARK BLUE MENU ONLY */}
        <nav className="nosAdminMenuBar">
          <div className="nosAdminMenuInner">

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
              }
            )}

          </div>
        </nav>

        {/* WHITE ADMIN DETAILS BELOW MENU */}
        <div className="nosAdminInfoRow">

          <div className="nosAdminInfoInner">

            <div className="nosAdminRoleArea">

              <span
                className={
                  isSuperAdmin
                    ? 'nosAdminRoleBadge super'
                    : 'nosAdminRoleBadge'
                }
              >
                {isSuperAdmin
                  ? 'SUPER ADMIN'
                  : adminProfile.full_access
                    ? 'ADMIN · FULL ACCESS'
                    : 'ADMIN · LIMITED ACCESS'}
              </span>

              <div className="nosAdminName">
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

            <div className="nosAdminActions">

              <Link
                href="/"
                target="_blank"
                className="nosAdminWebsiteButton"
              >
                ↗ View Website
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="nosAdminLogoutButton"
              >
                Logout
              </button>

            </div>

          </div>

        </div>

      </header>

      <Styles />
    </>
  );
}

function Styles() {
  return (
    <style jsx global>{`

      * {
        box-sizing: border-box;
      }

      /*
      ==============================
      COMPLETE ADMIN NAVIGATION
      ==============================
      */

      .nosAdminNavigation {
        width: 100%;
        background: #ffffff;
        position: relative;
        z-index: 1000;
      }


      /*
      ==============================
      DARK BLUE MENU
      ==============================
      */

      .nosAdminMenuBar {
        width: 100%;
        background: #082f5a;
      }

      .nosAdminMenuInner {
        width: 100%;

        display: flex;
        align-items: stretch;

        overflow-x: auto;

        scrollbar-width: thin;
        scrollbar-color:
          rgba(255,255,255,0.35)
          transparent;
      }

      .nosAdminMenuInner::-webkit-scrollbar {
        height: 5px;
      }

      .nosAdminMenuInner::-webkit-scrollbar-track {
        background: transparent;
      }

      .nosAdminMenuInner::-webkit-scrollbar-thumb {
        background:
          rgba(255,255,255,0.30);

        border-radius: 999px;
      }


      /*
      ==============================
      MENU ITEMS
      ==============================
      */

      .nosAdminMenuItem {
        position: relative;

        flex: 1 0 92px;

        min-width: 92px;
        min-height: 74px;

        display: flex;
        flex-direction: column;

        align-items: center;
        justify-content: center;

        gap: 7px;

        padding: 10px 9px;

        color: #ffffff !important;
        text-decoration: none !important;

        opacity: 0.88;

        transition:
          background 0.15s ease,
          opacity 0.15s ease;
      }

      .nosAdminMenuItem:hover {
        background:
          rgba(255,255,255,0.10);

        opacity: 1;

        color: #ffffff !important;
      }

      .nosAdminMenuItem.active {
        background: #35618c;

        opacity: 1;

        color: #ffffff !important;
      }

      .nosAdminMenuItem.active::after {
        content: '';

        position: absolute;

        left: 16px;
        right: 16px;

        bottom: 0;

        height: 4px;

        border-radius:
          4px 4px 0 0;

        background: #ffffff;
      }

      .nosAdminMenuIcon {
        color: #ffffff !important;

        font-size: 18px;

        line-height: 1;
      }

      .nosAdminMenuLabel {
        color: #ffffff !important;

        font-size: 10px;

        font-weight: 900;

        line-height: 1.2;

        text-align: center;

        white-space: nowrap;
      }


      /*
      ==============================
      WHITE INFORMATION ROW
      BELOW MENU
      ==============================
      */

      .nosAdminInfoRow {
        width: 100%;

        background: #ffffff;

        border-bottom:
          1px solid #dfe5ec;
      }

      .nosAdminInfoInner {
        width: calc(100% - 64px);

        max-width: 1500px;

        min-height: 66px;

        margin: 0 auto;

        display: flex;

        align-items: center;

        justify-content: space-between;

        gap: 20px;
      }


      /*
      ==============================
      ADMIN ROLE + NAME
      ==============================
      */

      .nosAdminRoleArea {
        display: flex;

        align-items: center;

        gap: 14px;
      }

      .nosAdminRoleBadge {
        display: inline-flex;

        align-items: center;

        justify-content: center;

        min-height: 27px;

        padding: 0 12px;

        border-radius: 999px;

        background: #e8f1fb;

        color: #0a569d;

        font-size: 9px;

        font-weight: 900;

        letter-spacing: 0.7px;

        white-space: nowrap;
      }

      .nosAdminRoleBadge.super {
        background: #082f5a;

        color: #ffffff;
      }

      .nosAdminName {
        display: flex;

        flex-direction: column;
      }

      .nosAdminName strong {
        color: #101828;

        font-size: 13px;

        font-weight: 900;
      }

      .nosAdminName span {
        margin-top: 2px;

        color: #667085;

        font-size: 10px;

        font-weight: 700;
      }


      /*
      ==============================
      WEBSITE + LOGOUT
      ==============================
      */

      .nosAdminActions {
        display: flex;

        align-items: center;

        gap: 10px;
      }

      .nosAdminWebsiteButton {
        display: inline-flex;

        align-items: center;

        justify-content: center;

        min-height: 37px;

        padding: 0 15px;

        border: 1px solid #cdd7e2;

        border-radius: 8px;

        background: #ffffff;

        color: #0a579f;

        font-size: 11px;

        font-weight: 900;

        text-decoration: none;
      }

      .nosAdminWebsiteButton:hover {
        background: #f5f8fb;
      }

      .nosAdminLogoutButton {
        min-height: 37px;

        padding: 0 16px;

        border: 1px solid #cdd7e2;

        border-radius: 8px;

        background: #ffffff;

        color: #26384c;

        font-size: 11px;

        font-weight: 900;

        cursor: pointer;
      }

      .nosAdminLogoutButton:hover {
        background: #f5f8fb;
      }


      /*
      ==============================
      LOADING
      ==============================
      */

      .nosAdminMenuLoading {
        width: 100%;

        min-height: 74px;

        display: flex;

        align-items: center;

        justify-content: center;

        background: #082f5a;

        color: #ffffff;

        font-size: 11px;

        font-weight: 800;
      }


      /*
      ==============================
      RESPONSIVE
      ==============================
      */

      @media (max-width: 1000px) {

        .nosAdminMenuItem {
          flex: 0 0 92px;
        }

        .nosAdminInfoInner {
          width: calc(100% - 30px);
        }

      }


      @media (max-width: 650px) {

        .nosAdminInfoInner {
          min-height: 60px;
        }

        .nosAdminRoleBadge {
          display: none;
        }

        .nosAdminName span {
          display: none;
        }

        .nosAdminWebsiteButton {
          display: none;
        }

        .nosAdminMenuItem {
          min-width: 84px;
          flex-basis: 84px;
        }

      }


      @media (max-width: 450px) {

        .nosAdminInfoInner {
          width: calc(100% - 20px);
        }

        .nosAdminName strong {
          max-width: 150px;

          overflow: hidden;

          white-space: nowrap;

          text-overflow: ellipsis;
        }

        .nosAdminMenuLabel {
          font-size: 9px;
        }

      }

    `}</style>
  );
}