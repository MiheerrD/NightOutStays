'use client';

import {
  useEffect,
  useState,
} from 'react';

import Link from 'next/link';
import {
  usePathname,
} from 'next/navigation';

import {
  createClient,
} from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

const links = [
  {
    href: '/admin/bookings',
    label: 'Bookings',
  },
  {
    href: '/admin/properties',
    label: 'Properties',
  },
  {
    href: '/admin/calendar',
    label: 'Calendar',
  },
  {
    href: '/admin/messages',
    label: 'Messages',
  },
  {
    href: '/admin/notifications',
    label: 'Notifications',
  },
  {
    href: '/admin/reports',
    label: 'Reports',
  },
];

export default function AdminNav() {
  const pathname =
    usePathname();

  const [
    checking,
    setChecking,
  ] = useState(true);

  const [
    isAdmin,
    setIsAdmin,
  ] = useState(false);

  useEffect(() => {
    checkAdminAccess();

    const {
      data: authListener,
    } =
      supabase.auth.onAuthStateChange(
        () => {
          checkAdminAccess();
        }
      );

    return () => {
      authListener
        ?.subscription
        ?.unsubscribe();
    };
  }, []);

  async function checkAdminAccess() {
    setChecking(true);

    try {
      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      if (!session?.user) {
        setIsAdmin(false);
        return;
      }

      const user =
        session.user;

      /*
        IMPORTANT

        This checks for an admin role
        stored in Supabase user metadata.

        Supported examples:

        role: "admin"

        OR

        user_role: "admin"

        OR

        is_admin: true
      */

      const metadata = {
        ...(user.user_metadata ||
          {}),
        ...(user.app_metadata ||
          {}),
      };

      const role =
        String(
          metadata.role ||
            metadata.user_role ||
            ''
        )
          .trim()
          .toLowerCase();

      const adminFlag =
        metadata.is_admin ===
          true ||
        metadata.admin ===
          true;

      const allowed =
        role ===
          'admin' ||
        adminFlag;

      setIsAdmin(
        allowed
      );
    } catch (error) {
      console.error(
        'Admin navigation access check:',
        error
      );

      setIsAdmin(false);
    } finally {
      setChecking(false);
    }
  }

  /*
    While checking authentication,
    show nothing.

    This prevents the admin menu from
    flashing briefly for guests.
  */
  if (checking) {
    return null;
  }

  /*
    Guest / normal user:

    Do NOT render any admin menu.
  */
  if (!isAdmin) {
    return null;
  }

  return (
    <nav
      style={
        styles.nav
      }
    >
      <div
        style={
          styles.inner
        }
      >
        {links.map(
          (link) => {
            const active =
              pathname ===
                link.href ||
              pathname?.startsWith(
                `${link.href}/`
              );

            return (
              <Link
                key={
                  link.href
                }
                href={
                  link.href
                }
                style={{
                  ...styles.link,

                  ...(active
                    ? styles.activeLink
                    : {}),
                }}
              >
                {
                  link.label
                }
              </Link>
            );
          }
        )}
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    width: '100%',
    background:
      '#ffffff',
    borderBottom:
      '1px solid #e4e7ec',
    position:
      'sticky',
    top: 0,
    zIndex: 100,
    overflow:
      'hidden',
  },

  inner: {
    display:
      'flex',
    alignItems:
      'center',
    gap: 8,
    width: '100%',
    overflowX:
      'auto',
    padding:
      '10px 14px',
    boxSizing:
      'border-box',
    WebkitOverflowScrolling:
      'touch',
  },

  link: {
    flex:
      '0 0 auto',
    textDecoration:
      'none',
    color:
      '#174f91',
    fontWeight:
      700,
    fontSize:
      14,
    padding:
      '10px 14px',
    borderRadius:
      999,
    whiteSpace:
      'nowrap',
  },

  activeLink: {
    background:
      '#174f91',
    color:
      '#ffffff',
  },
};