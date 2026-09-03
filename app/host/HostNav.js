'use client';

import Link from 'next/link';

import {
  usePathname,
  useRouter,
} from 'next/navigation';

import {
  createClient,
} from '@supabase/supabase-js';


const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);


const HOST_MENU_ITEMS = [
  {
    label: 'Dashboard',
    href: '/host',
    icon: '⌂',
  },
  {
    label: 'My Properties',
    href: '/host/properties',
    icon: '▥',
  },
  {
    label: 'Bookings',
    href: '/host/bookings',
    icon: '▣',
  },
  {
    label: 'Calendar',
    href: '/host/calendar',
    icon: '▦',
  },
  {
    label: 'Messages',
    href: '/host/messages',
    icon: '▭',
  },
  {
    label: 'Offers',
    href: '/host/offers',
    icon: '◇',
  },
  {
    label: 'Reviews',
    href: '/host/reviews',
    icon: '★',
  },
  {
    label: 'Subscription',
    href: '/host/subscription',
    icon: '▤',
  },
  {
    label: 'Promotions',
    href: '/host/promotions',
    icon: '◆',
  },
  {
    label: 'Payouts',
    href: '/host/payouts',
    icon: '▰',
  },
  {
    label: 'Support',
    href: '/host/help',
    icon: '?',
  },
  {
    label: 'Profile',
    href: '/host/profile',
    icon: '♙',
  },
];


export default function HostNav({
  host,
}) {

  const pathname =
    usePathname();

  const router =
    useRouter();


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


  async function handleLogout() {

    await supabase.auth.signOut();

    router.replace('/login');

    router.refresh();
  }


  const hostName =
    host?.business_name ||
    host?.full_name ||
    'Host';


  const hostPerson =
    host?.full_name &&
    host?.business_name &&
    host.full_name !==
      host.business_name
      ? host.full_name
      : 'Host Account';


  return (
    <>
      <div className="nosHostNavRoot">

        <div className="nosHostBlueMenuRow">

          <div
            className="nosHostBlueMenuGrid"
            style={{
              gridTemplateColumns:
                `repeat(${HOST_MENU_ITEMS.length}, minmax(0, 1fr))`,
            }}
          >

            {HOST_MENU_ITEMS.map(
              (item) => {

                const active =
                  isActive(
                    item.href
                  );


                return (

                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      active
                        ? 'nosHostBlueMenuItem active'
                        : 'nosHostBlueMenuItem'
                    }
                  >

                    <span className="nosHostBlueMenuIcon">
                      {item.icon}
                    </span>

                    <span className="nosHostBlueMenuLabel">
                      {item.label}
                    </span>

                  </Link>

                );
              }
            )}

          </div>

        </div>


        <div className="nosHostDetailRow">

          <div className="nosHostDetailInner">

            <div className="nosHostDetailLeft">

              <span className="nosHostRoleBadge">
                HOST
              </span>


              <div className="nosHostIdentity">

                <strong>
                  {hostName}
                </strong>

                <span>
                  {hostPerson}
                </span>

              </div>

            </div>


            <div className="nosHostDetailRight">

              <Link
                href="/"
                target="_blank"
                className="nosHostWebsiteButton"
              >
                ↗ View Website
              </Link>


              <button
                type="button"
                onClick={
                  handleLogout
                }
                className="nosHostLogoutButton"
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

      .nosHostNavRoot,
      .nosHostNavRoot * {
        box-sizing: border-box;
      }


      .nosHostNavRoot {

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


      .nosHostBlueMenuRow {

        display: block !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #082f5a !important;
        overflow: hidden !important;
      }


      .nosHostBlueMenuGrid {

        display: grid !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        align-items: stretch;
        background: #082f5a;
      }


      .nosHostBlueMenuItem {

        position: relative;
        min-width: 0 !important;
        min-height: 70px;
        padding: 8px 2px;

        display: flex !important;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        gap: 5px;

        color: #ffffff !important;
        background: transparent;

        text-decoration: none !important;

        overflow: hidden;
      }


      .nosHostBlueMenuItem:hover {

        background:
          rgba(255,255,255,0.10)
          !important;
      }


      .nosHostBlueMenuItem.active {

        background:
          #35618c !important;
      }


      .nosHostBlueMenuItem.active::after {

        content: '';

        position: absolute;

        left: 20%;
        right: 20%;
        bottom: 0;

        height: 4px;

        background:
          #ffffff;

        border-radius:
          4px 4px 0 0;
      }


      .nosHostBlueMenuIcon {

        display: block;

        color:
          #ffffff !important;

        font-size:
          15px;

        line-height:
          1;
      }


      .nosHostBlueMenuLabel {

        display: block;

        width: 100%;

        color:
          #ffffff !important;

        font-size:
          8px;

        font-weight:
          900;

        line-height:
          1.15;

        text-align:
          center;

        white-space:
          normal;
      }


      .nosHostDetailRow {

        display: block !important;

        width:
          100% !important;

        background:
          #ffffff !important;

        border-bottom:
          1px solid #dfe5ec;
      }


      .nosHostDetailInner {

        width:
          calc(100% - 64px);

        max-width:
          1500px;

        min-height:
          62px;

        margin:
          0 auto;

        display:
          flex !important;

        flex-direction:
          row !important;

        align-items:
          center !important;

        justify-content:
          space-between !important;

        gap:
          20px;
      }


      .nosHostDetailLeft {

        display:
          flex;

        align-items:
          center;

        gap:
          14px;
      }


      .nosHostRoleBadge {

        min-height:
          27px;

        padding:
          0 12px;

        display:
          inline-flex;

        align-items:
          center;

        justify-content:
          center;

        border-radius:
          999px;

        background:
          #082f5a;

        color:
          #ffffff;

        font-size:
          9px;

        font-weight:
          900;

        letter-spacing:
          .6px;
      }


      .nosHostIdentity {

        display:
          flex;

        flex-direction:
          column;
      }


      .nosHostIdentity strong {

        color:
          #101828;

        font-size:
          13px;

        font-weight:
          900;
      }


      .nosHostIdentity span {

        margin-top:
          2px;

        color:
          #667085;

        font-size:
          10px;

        font-weight:
          700;
      }


      .nosHostDetailRight {

        display:
          flex;

        align-items:
          center;

        gap:
          10px;
      }


      .nosHostWebsiteButton,
      .nosHostLogoutButton {

        min-height:
          36px;

        padding:
          0 14px;

        display:
          inline-flex;

        align-items:
          center;

        justify-content:
          center;

        border:
          1px solid #ccd6e1;

        border-radius:
          8px;

        background:
          #ffffff;

        font-size:
          10px;

        font-weight:
          900;

        cursor:
          pointer;
      }


      .nosHostWebsiteButton {

        color:
          #0b579e;

        text-decoration:
          none;
      }


      .nosHostLogoutButton {

        color:
          #25364a;
      }


      .nosHostWebsiteButton:hover,
      .nosHostLogoutButton:hover {

        background:
          #f5f7fa;
      }


      @media (max-width: 1100px) {

        .nosHostBlueMenuLabel {
          font-size: 7px;
        }

        .nosHostBlueMenuIcon {
          font-size: 13px;
        }

        .nosHostDetailInner {
          width: calc(100% - 30px);
        }

      }


      @media (max-width: 750px) {

        .nosHostBlueMenuGrid {
          grid-template-columns:
            repeat(4,1fr)
            !important;
        }

        .nosHostBlueMenuItem {
          min-height: 60px;
        }

        .nosHostBlueMenuLabel {
          font-size: 9px;
        }

        .nosHostRoleBadge {
          display: none;
        }

        .nosHostIdentity span {
          display: none;
        }

        .nosHostWebsiteButton {
          display: none;
        }

      }


      @media (max-width: 450px) {

        .nosHostBlueMenuGrid {
          grid-template-columns:
            repeat(3,1fr)
            !important;
        }

        .nosHostDetailInner {
          width: calc(100% - 20px);
        }

      }


      html,
      body {

        max-width:
          100%;

        overflow-x:
          hidden !important;
      }

    `}</style>
  );
}