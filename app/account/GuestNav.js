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


const GUEST_MENU_ITEMS = [
  {
    label: 'Browse Stays',
    href: '/',
    icon: '⌂',
  },
  {
    label: 'My Bookings',
    href: '/account/bookings',
    icon: '▣',
  },
  {
    label: 'Messages',
    href: '/account/messages',
    icon: '▭',
  },
  {
    label: 'Notifications',
    href: '/account/notifications',
    icon: '◈',
  },
  {
    label: 'Reviews',
    href: '/account/reviews',
    icon: '★',
  },
  {
    label: 'Support',
    href: '/account/help',
    icon: '?',
  },
  {
    label: 'Profile',
    href: '/account/profile',
    icon: '♙',
  },
];


export default function GuestNav({
  guest,
}) {

  const pathname =
    usePathname();

  const router =
    useRouter();


  function isActive(
    href
  ) {

    if (
      href === '/'
    ) {

      return pathname === '/';
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


  const guestName =
    guest?.full_name ||
    'Guest';


  return (
    <>
      <div className="nosGuestNavRoot">

        <div className="nosGuestBlueMenuRow">

          <div
            className="nosGuestBlueMenuGrid"
            style={{
              gridTemplateColumns:
                `repeat(${GUEST_MENU_ITEMS.length}, minmax(0, 1fr))`,
            }}
          >

            {GUEST_MENU_ITEMS.map(
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
                        ? 'nosGuestBlueMenuItem active'
                        : 'nosGuestBlueMenuItem'
                    }
                  >

                    <span className="nosGuestBlueMenuIcon">
                      {item.icon}
                    </span>

                    <span className="nosGuestBlueMenuLabel">
                      {item.label}
                    </span>

                  </Link>

                );
              }
            )}

          </div>

        </div>


        <div className="nosGuestDetailRow">

          <div className="nosGuestDetailInner">

            <div className="nosGuestDetailLeft">

              <span className="nosGuestRoleBadge">
                GUEST
              </span>


              <div className="nosGuestIdentity">

                <strong>
                  {guestName}
                </strong>

                <span>
                  Guest Account
                </span>

              </div>

            </div>


            <div className="nosGuestDetailRight">

              <Link
                href="/"
                className="nosGuestWebsiteButton"
              >
                ↗ Browse Stays
              </Link>


              <button
                type="button"
                onClick={
                  handleLogout
                }
                className="nosGuestLogoutButton"
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

      .nosGuestNavRoot,
      .nosGuestNavRoot * {
        box-sizing: border-box;
      }


      .nosGuestNavRoot {

        display: block !important;
        position: relative !important;
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff;
        z-index: 1000;
      }


      .nosGuestBlueMenuRow {

        width: 100% !important;
        background: #082f5a !important;
      }


      .nosGuestBlueMenuGrid {

        display: grid !important;
        width: 100% !important;
        align-items: stretch;
        background: #082f5a;
      }


      .nosGuestBlueMenuItem {

        position: relative;
        min-height: 70px;

        display: flex !important;

        flex-direction:
          column;

        align-items:
          center;

        justify-content:
          center;

        gap:
          5px;

        padding:
          8px 2px;

        color:
          #ffffff !important;

        text-decoration:
          none !important;
      }


      .nosGuestBlueMenuItem:hover {

        background:
          rgba(255,255,255,.10)
          !important;
      }


      .nosGuestBlueMenuItem.active {

        background:
          #35618c !important;
      }


      .nosGuestBlueMenuItem.active::after {

        content: '';

        position:
          absolute;

        left:
          20%;

        right:
          20%;

        bottom:
          0;

        height:
          4px;

        background:
          #ffffff;
      }


      .nosGuestBlueMenuIcon {

        font-size:
          15px;

        color:
          #ffffff;
      }


      .nosGuestBlueMenuLabel {

        width:
          100%;

        font-size:
          9px;

        font-weight:
          900;

        text-align:
          center;

        color:
          #ffffff;
      }


      .nosGuestDetailRow {

        width:
          100%;

        background:
          #ffffff;

        border-bottom:
          1px solid #dfe5ec;
      }


      .nosGuestDetailInner {

        width:
          calc(100% - 64px);

        max-width:
          1500px;

        min-height:
          62px;

        margin:
          auto;

        display:
          flex;

        align-items:
          center;

        justify-content:
          space-between;
      }


      .nosGuestDetailLeft {

        display:
          flex;

        align-items:
          center;

        gap:
          14px;
      }


      .nosGuestRoleBadge {

        padding:
          7px 14px;

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
      }


      .nosGuestIdentity {

        display:
          flex;

        flex-direction:
          column;
      }


      .nosGuestIdentity strong {

        font-size:
          13px;

        font-weight:
          900;

        color:
          #101828;
      }


      .nosGuestIdentity span {

        margin-top:
          2px;

        font-size:
          10px;

        color:
          #667085;
      }


      .nosGuestDetailRight {

        display:
          flex;

        align-items:
          center;

        gap:
          10px;
      }


      .nosGuestWebsiteButton,
      .nosGuestLogoutButton {

        min-height:
          36px;

        padding:
          0 14px;

        border:
          1px solid #ccd6e1;

        border-radius:
          8px;

        background:
          #ffffff;

        display:
          inline-flex;

        align-items:
          center;

        justify-content:
          center;

        font-size:
          10px;

        font-weight:
          900;

        text-decoration:
          none;

        cursor:
          pointer;
      }


      .nosGuestWebsiteButton {

        color:
          #0b579e;
      }


      .nosGuestLogoutButton {

        color:
          #25364a;
      }


      @media (max-width: 750px) {

        .nosGuestBlueMenuGrid {

          grid-template-columns:
            repeat(4,1fr)
            !important;
        }


        .nosGuestRoleBadge {

          display:
            none;
        }


        .nosGuestIdentity span {

          display:
            none;
        }


        .nosGuestWebsiteButton {

          display:
            none;
        }

      }


      @media (max-width: 450px) {

        .nosGuestBlueMenuGrid {

          grid-template-columns:
            repeat(3,1fr)
            !important;
        }


        .nosGuestDetailInner {

          width:
            calc(100% - 20px);
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