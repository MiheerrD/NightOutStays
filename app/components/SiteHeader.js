'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import styles from './SiteHeader.module.css';

export default function SiteHeader({
  notificationCount = 0,
  userName = '',
  onLogout = null,
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isAdmin = pathname?.startsWith('/admin');
  const isHost = pathname?.startsWith('/host');

  if (isAdmin || isHost) {
    return null;
  }

  const guestLinks = [
    {
      label: 'My Bookings',
      href: '/account/bookings',
    },
    {
      label: 'Messages',
      href: '/account/messages',
    },
    {
      label: 'Notifications',
      href: '/account/notifications',
      badge: notificationCount,
    },
    {
      label: 'Profile',
      href: '/account/profile',
    },
  ];

  function isActive(href) {
    if (!pathname) {
      return false;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a
          href="/"
          className={styles.brand}
          onClick={closeMenu}
        >
          NightOutStays
        </a>

        <nav className={styles.desktopNav}>
          {guestLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={
                isActive(link.href)
                  ? styles.activeLink
                  : styles.link
              }
            >
              <span>{link.label}</span>

              {Number(link.badge) > 0 && (
                <span className={styles.badge}>
                  {link.badge > 99 ? '99+' : link.badge}
                </span>
              )}
            </a>
          ))}

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className={styles.logoutButton}
            >
              Logout
            </button>
          )}
        </nav>

        <button
          type="button"
          className={styles.menuButton}
          onClick={() =>
            setMenuOpen((current) => !current)
          }
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
        >
          <span className={styles.menuIcon}>
            ☰
          </span>

          <span>Menu</span>

          {notificationCount > 0 && (
            <span className={styles.mobileBadge}>
              {notificationCount > 99
                ? '99+'
                : notificationCount}
            </span>
          )}
        </button>
      </div>

      {menuOpen && (
        <div className={styles.mobileMenu}>
          {guestLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={closeMenu}
              className={
                isActive(link.href)
                  ? styles.mobileActiveLink
                  : styles.mobileLink
              }
            >
              <span>{link.label}</span>

              {Number(link.badge) > 0 && (
                <span className={styles.badge}>
                  {link.badge > 99
                    ? '99+'
                    : link.badge}
                </span>
              )}
            </a>
          ))}

          {onLogout && (
            <button
              type="button"
              onClick={() => {
                closeMenu();
                onLogout();
              }}
              className={styles.mobileLogout}
            >
              Logout
            </button>
          )}
        </div>
      )}
    </header>
  );
}