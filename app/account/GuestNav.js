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

    if (href === '/') {

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

        {/* =====================================
            ROW 1
            BLUE GUEST MENU
        ====================================== */}

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


        {/* =====================================
            ROW 2
            GUEST DETAILS
        ====================================== */}

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


// ============================================================
// STYLES
// ============================================================

function Styles() {

  return (

    <style jsx global>{`

      /*
      ==========================================
      RESET
      ==========================================
      */

      .nosGuestNavRoot,
      .nosGuestNavRoot * {

        box-sizing:
          border-box;
      }


      .nosGuestNavRoot {

        display:
          block !important;

        position:
          relative !important;

        width:
          100% !important;

        max-width:
          none !important;

        margin:
          0 !important;

        padding:
          0 !important;

        overflow:
          visible !important;

        background:
          #ffffff;

        z-index:
          1000;
      }


      /*
      ==========================================
      ROW 1
      BLUE MENU
      ==========================================
      */

      .nosGuestBlueMenuRow {

        display:
          block !important;

        width:
          100% !important;

        margin:
          0 !important;

        padding:
          0 !important;

        background:
          #082f5a !important;

        overflow:
          hidden !important;
      }


      .nosGuestBlueMenuGrid {

        display:
          grid !important;

        width:
          100% !important;

        margin:
          0 !important;

        padding:
          0 !important;

        align-items:
          stretch;

        background:
          #082f5a;

        overflow:
          hidden !important;
      }


      /*
      ==========================================
      MENU ITEM
      ==========================================
      */

      .nosGuestBlueMenuItem {

        position:
          relative;

        min-width:
          0 !important;

        min-height:
          70px;

        padding:
          8px 3px;

        display:
          flex !important;

        flex-direction:
          column;

        align-items:
          center;

        justify-content:
          center;

        gap:
          5px;

        background:
          transparent;

        color:
          #ffffff !important;

        text-decoration:
          none !important;

        overflow:
          hidden;
      }


      .nosGuestBlueMenuItem:hover {

        background:
          rgba(
            255,
            255,
            255,
            0.10
          ) !important;
      }


      .nosGuestBlueMenuItem.active {

        background:
          #35618c !important;
      }


      .nosGuestBlueMenuItem.active::after {

        content:
          '';

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

        border-radius:
          4px 4px 0 0;
      }


      .nosGuestBlueMenuIcon {

        display:
          block;

        color:
          #ffffff !important;

        font-size:
          16px;

        line-height:
          1;
      }


      .nosGuestBlueMenuLabel {

        display:
          block;

        width:
          100%;

        color:
          #ffffff !important;

        font-size:
          9px;

        font-weight:
          900;

        line-height:
          1.15;

        text-align:
          center;

        white-space:
          normal;

        overflow-wrap:
          normal;

        word-break:
          normal;
      }


      /*
      ==========================================
      ROW 2
      WHITE GUEST DETAILS
      ==========================================
      */

      .nosGuestDetailRow {

        display:
          block !important;

        width:
          100% !important;

        margin:
          0 !important;

        background:
          #ffffff !important;

        border-bottom:
          1px solid #dfe5ec;
      }


      .nosGuestDetailInner {

        width:
          calc(
            100% - 64px
          );

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

        background:
          #ffffff;
      }


      /*
      ==========================================
      LEFT SIDE
      ==========================================
      */

      .nosGuestDetailLeft {

        display:
          flex;

        align-items:
          center;

        gap:
          14px;
      }


      .nosGuestRoleBadge {

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
          0.6px;

        white-space:
          nowrap;
      }


      .nosGuestIdentity {

        display:
          flex;

        flex-direction:
          column;
      }


      .nosGuestIdentity strong {

        color:
          #101828;

        font-size:
          13px;

        font-weight:
          900;
      }


      .nosGuestIdentity span {

        margin-top:
          2px;

        color:
          #667085;

        font-size:
          10px;

        font-weight:
          700;
      }


      /*
      ==========================================
      RIGHT SIDE
      ==========================================
      */

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


      .nosGuestWebsiteButton {

        color:
          #0b579e;

        text-decoration:
          none;
      }


      .nosGuestLogoutButton {

        color:
          #25364a;
      }


      .nosGuestWebsiteButton:hover,
      .nosGuestLogoutButton:hover {

        background:
          #f5f7fa;
      }


      /*
      ==========================================
      TABLET
      ==========================================
      */

      @media (
        max-width: 1000px
      ) {

        .nosGuestBlueMenuLabel {

          font-size:
            8px;
        }


        .nosGuestBlueMenuIcon {

          font-size:
            14px;
        }


        .nosGuestDetailInner {

          width:
            calc(
              100% - 30px
            );
        }

      }


      /*
      ==========================================
      MOBILE
      ==========================================
      */

      @media (
        max-width: 750px
      ) {

        .nosGuestBlueMenuGrid {

          grid-template-columns:
            repeat(
              4,
              1fr
            ) !important;
        }


        .nosGuestBlueMenuItem {

          min-height:
            60px;
        }


        .nosGuestBlueMenuLabel {

          font-size:
            9px;
        }


        .nosGuestDetailInner {

          min-height:
            58px;
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


      @media (
        max-width: 450px
      ) {

        .nosGuestBlueMenuGrid {

          grid-template-columns:
            repeat(
              3,
              1fr
            ) !important;
        }


        .nosGuestDetailInner {

          width:
            calc(
              100% - 20px
            );
        }


        .nosGuestIdentity strong {

          max-width:
            160px;

          overflow:
            hidden;

          text-overflow:
            ellipsis;

          white-space:
            nowrap;
        }

      }


      /*
      ==========================================
      PREVENT HORIZONTAL SCROLL
      ==========================================
      */

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
