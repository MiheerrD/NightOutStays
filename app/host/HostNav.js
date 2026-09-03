'use client';

import { usePathname } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';


const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);


const menuItems = [
  {
    label: 'Dashboard',
    href: '/host',
  },
  {
    label: 'My Properties',
    href: '/host/properties',
  },
  {
    label: 'Bookings',
    href: '/host/bookings',
  },
  {
    label: 'Calendar',
    href: '/host/calendar',
  },
  {
    label: 'Messages',
    href: '/host/messages',
  },
  {
    label: 'Offers',
    href: '/host/offers',
  },
  {
    label: 'Reviews',
    href: '/host/reviews',
  },
  {
    label: 'Subscription',
    href: '/host/subscription',
  },
  {
    label: 'Promotions',
    href: '/host/promotions',
  },
  {
    label: 'Payouts',
    href: '/host/payouts',
  },
  {
    label: 'Profile',
    href: '/host/profile',
  },
];


export default function HostNav({
  host,
}) {

  const pathname =
    usePathname();


  async function logout() {

    await supabase.auth.signOut();

    window.location.replace(
      '/login'
    );
  }


  function isActive(
    href
  ) {

    if (
      href === '/host'
    ) {

      return pathname === '/host';
    }


    return (
      pathname === href ||
      pathname?.startsWith(
        `${href}/`
      )
    );
  }


  const hostName =
    host?.business_name ||
    host?.full_name ||
    'Host Account';


  return (
    <>
      <header className="sharedHostHeader">

        {/* ================================================
            ROW 1 — DARK NAVIGATION
        ================================================ */}

        <nav className="sharedHostMenu">

          {menuItems.map(
            (item) => (

              <a
                key={item.href}
                href={item.href}
                className={
                  isActive(
                    item.href
                  )
                    ? 'active'
                    : ''
                }
              >
                {item.label}
              </a>

            )
          )}

        </nav>


        {/* ================================================
            ROW 2 — HOST INFORMATION
        ================================================ */}

        <div className="sharedHostInfoRow">

          <div className="sharedHostIdentity">

            <span className="sharedHostRole">
              HOST
            </span>

            <span className="sharedHostDivider">
              |
            </span>

            <strong>
              {hostName}
            </strong>

          </div>


          <div className="sharedHostActions">

            <a href="/">
              View Website
            </a>

            <button
              type="button"
              onClick={logout}
            >
              Logout
            </button>

          </div>

        </div>

      </header>


      <style jsx global>{`

        /* ================================================
           SHARED HOST HEADER
        ================================================ */

        .sharedHostHeader {

          position: sticky;

          top: 0;

          z-index: 1000;

          width: 100%;

          background: #ffffff;

          border-bottom:
            1px solid #e5e7eb;

          font-family:
            Arial,
            Helvetica,
            sans-serif;
        }


        /* ================================================
           DARK MENU ROW
        ================================================ */

        .sharedHostMenu {

          width: 100%;

          min-height: 58px;

          display: grid;

          grid-template-columns:
            repeat(
              11,
              minmax(0, 1fr)
            );

          align-items: stretch;

          background: #101827;

          padding: 7px 12px;

          gap: 5px;
        }


        .sharedHostMenu a {

          min-width: 0;

          min-height: 44px;

          display: flex;

          align-items: center;

          justify-content: center;

          padding: 6px 6px;

          border-radius: 7px;

          color: #ffffff;

          text-decoration: none;

          text-align: center;

          font-size: 12px;

          line-height: 1.15;

          font-weight: 800;

          white-space: normal;

          transition:
            background .15s ease,
            color .15s ease;
        }


        .sharedHostMenu a:hover {

          background:
            rgba(
              255,
              255,
              255,
              .10
            );
        }


        .sharedHostMenu a.active {

          background: #ffffff;

          color: #101827;
        }


        /* ================================================
           WHITE IDENTITY ROW
        ================================================ */

        .sharedHostInfoRow {

          min-height: 55px;

          display: flex;

          align-items: center;

          justify-content:
            space-between;

          gap: 20px;

          padding: 0 24px;

          background: #ffffff;
        }


        .sharedHostIdentity {

          min-width: 0;

          display: flex;

          align-items: center;

          gap: 9px;

          color: #111827;

          font-size: 12px;
        }


        .sharedHostRole {

          color: #0b4b8c;

          font-size: 10px;

          font-weight: 900;

          letter-spacing: .8px;
        }


        .sharedHostDivider {

          color: #d1d5db;
        }


        .sharedHostIdentity strong {

          overflow: hidden;

          text-overflow:
            ellipsis;

          white-space: nowrap;

          font-size: 12px;
        }


        /* ================================================
           RIGHT ACTIONS
        ================================================ */

        .sharedHostActions {

          display: flex;

          align-items: center;

          gap: 8px;

          flex: 0 0 auto;
        }


        .sharedHostActions a,
        .sharedHostActions button {

          min-height: 35px;

          display: inline-flex;

          align-items: center;

          justify-content: center;

          padding: 0 11px;

          border-radius: 7px;

          font-size: 11px;

          font-weight: 800;

          cursor: pointer;
        }


        .sharedHostActions a {

          border:
            1px solid #d1d5db;

          background: #ffffff;

          color: #374151;

          text-decoration: none;
        }


        .sharedHostActions button {

          border: 0;

          background: #101827;

          color: #ffffff;
        }


        /* ================================================
           TABLET
        ================================================ */

        @media (
          max-width: 1100px
        ) {

          .sharedHostMenu {

            grid-template-columns:
              repeat(
                6,
                minmax(0, 1fr)
              );
          }

        }


        /* ================================================
           MOBILE
        ================================================ */

        @media (
          max-width: 650px
        ) {

          .sharedHostMenu {

            grid-template-columns:
              repeat(
                3,
                minmax(0, 1fr)
              );

            padding: 6px;
          }


          .sharedHostMenu a {

            min-height: 40px;

            padding: 5px 3px;

            font-size: 10px;
          }


          .sharedHostInfoRow {

            min-height: 52px;

            padding: 8px 10px;

            gap: 10px;
          }


          .sharedHostIdentity {

            gap: 5px;

            font-size: 10px;
          }


          .sharedHostRole {

            font-size: 9px;
          }


          .sharedHostIdentity strong {

            max-width: 125px;

            font-size: 10px;
          }


          .sharedHostActions {

            gap: 5px;
          }


          .sharedHostActions a,
          .sharedHostActions button {

            min-height: 32px;

            padding: 0 8px;

            font-size: 9px;
          }


          .sharedHostActions a {

            display: none;
          }

        }

      `}</style>
    </>
  );
}