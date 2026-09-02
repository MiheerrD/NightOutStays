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

  const [adminProfile, setAdminProfile] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    loadAdminAccess();
  }, []);

  async function loadAdminAccess() {
    setLoadingProfile(true);

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
        .select(
          `
            user_id,
            full_name,
            email,
            role,
            is_active,
            full_access
          `
        )
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!profile || !profile.is_active) {
        await supabase.auth.signOut();
        router.replace('/admin/login');
        return;
      }

      if (
        profile.role !== 'super_admin' &&
        profile.role !== 'admin'
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
          .select(
            `
              module,
              can_view
            `
          )
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
      } else {
        setPermissions({});
      }
    } catch (error) {
      console.error(
        'Admin navigation access error:',
        error
      );
    } finally {
      setLoadingProfile(false);
    }
  }

  const visibleMenuItems = useMemo(() => {
    if (!adminProfile) {
      return [];
    }

    if (
      adminProfile.role === 'super_admin' ||
      adminProfile.full_access
    ) {
      return ALL_MENU_ITEMS.filter(
        (item) =>
          !item.superAdminOnly ||
          adminProfile.role ===
            'super_admin'
      );
    }

    return ALL_MENU_ITEMS.filter(
      (item) => {
        if (item.superAdminOnly) {
          return false;
        }

        if (item.module === 'dashboard') {
          return true;
        }

        return permissions[item.module] === true;
      }
    );
  }, [adminProfile, permissions]);

  function isActive(href) {
    if (href === '/admin') {
      return pathname === '/admin';
    }

    return pathname?.startsWith(href);
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } finally {
      router.replace('/admin/login');
      router.refresh();
    }
  }

  if (loadingProfile) {
    return (
      <>
        <div className="nosAdminHeaderLoading">
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
      <header className="nosAdminHeader">
        <div className="nosAdminIdentityRow">
          <div className="nosAdminIdentityInner">
            <div className="nosAdminPortalInfo">
              <div className="nosAdminPortalTitle">
                Admin Portal
              </div>

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

              <Link
                href="/"
                target="_blank"
                className="nosAdminViewSite"
              >
                ↗ View Website
              </Link>
            </div>

            <div className="nosAdminAccount">
              <div className="nosAdminAccountText">
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

              <button
                type="button"
                className="nosAdminLogoutButton"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>
        </div>

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

      .nosAdminHeader {
        position: sticky;
        top: 0;
        z-index: 1000;
        width: 100%;
        background: #ffffff;
        border-bottom: 1px solid #dfe5ec;
      }

      .nosAdminIdentityRow {
        width: 100%;
        background: #ffffff;
      }

      .nosAdminIdentityInner {
        width: calc(100% - 64px);
        max-width: 1600px;
        min-height: 64px;
        margin: 0 auto;

        display: flex;
        align-items: center;
        justify-content: space-between;

        gap: 24px;
      }

      .nosAdminPortalInfo {
        display: flex;
        align-items: center;
        gap: 13px;
        min-width: 0;
      }

      .nosAdminPortalTitle {
        color: #0a4b89;
        font-size: 20px;
        font-weight: 900;
        letter-spacing: -0.5px;
        white-space: nowrap;
      }

      .nosAdminRoleBadge {
        min-height: 25px;

        display: inline-flex;
        align-items: center;
        justify-content: center;

        padding: 0 11px;

        border-radius: 999px;

        background: #eaf2fb;
        color: #0b579e;

        font-size: 9px;
        font-weight: 900;
        letter-spacing: 0.6px;

        white-space: nowrap;
      }

      .nosAdminRoleBadge.super {
        background: #0a315d;
        color: #ffffff;
      }

      .nosAdminViewSite {
        color: #0a579f;
        font-size: 11px;
        font-weight: 800;
        text-decoration: none;
        white-space: nowrap;
      }

      .nosAdminViewSite:hover {
        text-decoration: underline;
      }

      .nosAdminAccount {
        display: flex;
        align-items: center;
        gap: 13px;
        flex-shrink: 0;
      }

      .nosAdminAccountText {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }

      .nosAdminAccountText strong {
        color: #101828;
        font-size: 12px;
        font-weight: 900;
      }

      .nosAdminAccountText span {
        margin-top: 2px;

        color: #667085;

        font-size: 9px;
        font-weight: 700;
      }

      .nosAdminLogoutButton {
        min-height: 36px;

        padding: 0 14px;

        border: 1px solid #ccd5df;
        border-radius: 8px;

        background: #ffffff;
        color: #26384c;

        font-size: 11px;
        font-weight: 800;

        cursor: pointer;
      }

      .nosAdminLogoutButton:hover {
        background: #f5f7fa;
      }

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
          rgba(255, 255, 255, 0.35)
          transparent;
      }

      .nosAdminMenuInner::-webkit-scrollbar {
        height: 5px;
      }

      .nosAdminMenuInner::-webkit-scrollbar-track {
        background: transparent;
      }

      .nosAdminMenuInner::-webkit-scrollbar-thumb {
        border-radius: 999px;
        background: rgba(
          255,
          255,
          255,
          0.32
        );
      }

      .nosAdminMenuItem {
        position: relative;

        flex: 1 0 92px;

        min-width: 92px;
        min-height: 72px;

        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        gap: 6px;

        padding: 9px 10px;

        color: #ffffff !important;
        text-decoration: none !important;

        opacity: 0.86;

        transition:
          background 0.15s ease,
          opacity 0.15s ease;
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
        background: #315b85;

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

        border-radius:
          4px 4px 0 0;

        background: #ffffff;
      }

      .nosAdminMenuIcon {
        color: #ffffff !important;

        font-size: 18px;
        font-weight: 400;
        line-height: 1;
      }

      .nosAdminMenuLabel {
        color: #ffffff !important;

        font-size: 10px;
        font-weight: 900;
        line-height: 1.15;

        text-align: center;

        white-space: nowrap;
      }

      .nosAdminHeaderLoading {
        width: 100%;
        min-height: 64px;

        display: flex;
        align-items: center;
        justify-content: center;

        background: #ffffff;
        border-bottom: 1px solid #dfe5ec;

        color: #667085;

        font-size: 11px;
        font-weight: 800;
      }

      @media (min-width: 1500px) {
        .nosAdminMenuItem {
          flex-basis: 100px;
        }
      }

      @media (max-width: 1000px) {
        .nosAdminIdentityInner {
          width: calc(100% - 30px);
        }

        .nosAdminMenuItem {
          flex: 0 0 92px;
        }
      }

      @media (max-width: 750px) {
        .nosAdminIdentityInner {
          min-height: 60px;
        }

        .nosAdminPortalInfo {
          gap: 9px;
        }

        .nosAdminPortalTitle {
          font-size: 18px;
        }

        .nosAdminViewSite {
          display: none;
        }

        .nosAdminAccountText {
          display: none;
        }

        .nosAdminRoleBadge {
          display: none;
        }
      }

      @media (max-width: 500px) {
        .nosAdminIdentityInner {
          width: calc(100% - 20px);
        }

        .nosAdminMenuItem {
          flex-basis: 84px;
          min-width: 84px;
        }

        .nosAdminMenuLabel {
          font-size: 9px;
        }
      }
    `}</style>
  );
}