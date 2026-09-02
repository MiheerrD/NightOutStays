'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

export default function HostDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [host, setHost] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadHost();
  }, []);

  async function loadHost() {
    try {
      setLoading(true);
      setError('');

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session?.user) {
        window.location.replace(
          '/login?redirect=/host'
        );
        return;
      }

      const { data: roles, error: roleError } =
        await supabase.rpc(
          'get_my_platform_roles'
        );

      if (roleError) {
        throw roleError;
      }

      const isSuperAdmin = (roles || []).some(
        (item) =>
          item.role === 'super_admin' &&
          item.is_active === true
      );

      if (isSuperAdmin) {
        window.location.replace('/admin');
        return;
      }

      const isHost = (roles || []).some(
        (item) =>
          item.role === 'host' &&
          item.is_active === true
      );

      if (!isHost) {
        window.location.replace(
          '/account/bookings'
        );
        return;
      }

      const { data: hostData, error: hostError } =
        await supabase
          .from('host_profiles')
          .select(
            `
              id,
              user_id,
              full_name,
              business_name,
              email,
              phone,
              city,
              state,
              status,
              created_at
            `
          )
          .eq('user_id', session.user.id)
          .maybeSingle();

      if (hostError) {
        throw hostError;
      }

      if (!hostData) {
        throw new Error(
          'Your Host profile could not be found.'
        );
      }

      setHost(hostData);
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          'Unable to load Host Dashboard.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.replace('/login');
  }

  if (loading) {
    return (
      <main className="loadingPage">
        Loading Host Dashboard...
        <Styles />
      </main>
    );
  }

  if (error) {
    return (
      <main className="loadingPage">
        <div className="errorBox">
          <strong>
            Unable to load Host Dashboard
          </strong>

          <span>{error}</span>

          <button
            type="button"
            onClick={logout}
          >
            Logout
          </button>
        </div>

        <Styles />
      </main>
    );
  }

  return (
    <main className="page">
      <header className="hostHeader">
        <div className="topRow">
          <div>
            <a
              href="/host"
              className="brand"
            >
              NightOutStays
            </a>

            <span className="hostBadge">
              HOST
            </span>
          </div>

          <div className="headerRight">
            <a
              href="/"
              className="websiteButton"
            >
              View Website
            </a>

            <button
              type="button"
              className="logoutButton"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </div>

        <nav className="hostMenu">
          <a
            href="/host"
            className="active"
          >
            Dashboard
          </a>

          <a href="/host/properties">
            My Properties
          </a>

          <a href="/host/bookings">
            Bookings
          </a>

          <a href="/host/calendar">
            Calendar
          </a>

          <a href="/host/messages">
            Messages
          </a>

          <a href="/host/offers">
            Offers
          </a>

          <a href="/host/subscription">
            Subscription
          </a>

          <a href="/host/promotions">
            Promotions
          </a>

          <a href="/host/payouts">
            Payouts
          </a>

          <a href="/host/profile">
            Profile
          </a>
        </nav>
      </header>

      <section className="content">
        <div className="welcomeRow">
          <div>
            <p className="eyebrow">
              HOST DASHBOARD
            </p>

            <h1>
              Welcome
              {host?.full_name
                ? `, ${host.full_name}`
                : ''}
            </h1>

            <p className="subtitle">
              Manage your properties, bookings
              and NightOutStays account.
            </p>
          </div>

          <a
            href="/host/properties/new"
            className="addPropertyButton"
          >
            + Add Property
          </a>
        </div>

        <section className="accountCard">
          <div>
            <span>Host Account</span>

            <strong>
              {host?.business_name ||
                host?.full_name ||
                'Host'}
            </strong>
          </div>

          <div>
            <span>Status</span>

            <strong className="activeStatus">
              Active
            </strong>
          </div>

          <div>
            <span>Location</span>

            <strong>
              {[host?.city, host?.state]
                .filter(Boolean)
                .join(', ') || 'Not added'}
            </strong>
          </div>
        </section>

        <section className="summaryGrid">
          <DashboardCard
            title="My Properties"
            value="0"
            text="Properties added"
            href="/host/properties"
          />

          <DashboardCard
            title="Active Listings"
            value="0"
            text="Properties live"
            href="/host/properties"
          />

          <DashboardCard
            title="Bookings"
            value="0"
            text="Total bookings"
            href="/host/bookings"
          />

          <DashboardCard
            title="Pending Requests"
            value="0"
            text="Awaiting your action"
            href="/host/bookings"
          />
        </section>

        <section className="mainGrid">
          <div className="panel">
            <div className="panelHeader">
              <div>
                <h2>
                  Property Management
                </h2>

                <p>
                  Add your first property and
                  submit it for review.
                </p>
              </div>
            </div>

            <div className="emptyState">
              <div className="emptyIcon">
                +
              </div>

              <h3>
                Start listing your properties
              </h3>

              <p>
                Create a property listing with
                photos, pricing, amenities,
                house rules and availability.
              </p>

              <a
                href="/host/properties/new"
                className="primaryButton"
              >
                Add Property
              </a>
            </div>
          </div>

          <div className="sidePanel">
            <h2>Quick Actions</h2>

            <a href="/host/properties/new">
              <strong>Add Property</strong>
              <span>
                Create a new property listing
              </span>
            </a>

            <a href="/host/properties">
              <strong>My Properties</strong>
              <span>
                Edit and manage listings
              </span>
            </a>

            <a href="/host/calendar">
              <strong>Property Calendar</strong>
              <span>
                Manage availability and rates
              </span>
            </a>

            <a href="/host/bookings">
              <strong>Booking Requests</strong>
              <span>
                Review guest requests
              </span>
            </a>

            <a href="/host/subscription">
              <strong>Subscription</strong>
              <span>
                View plans and renewals
              </span>
            </a>
          </div>
        </section>

        <section className="reviewInfo">
          <div className="reviewIcon">
            ✓
          </div>

          <div>
            <strong>
              Property approval process
            </strong>

            <p>
              You can create and edit properties
              immediately. When your listing is
              ready, submit it for review.
              NightOutStays will approve it,
              request changes, or decline the
              listing. Only approved properties
              will appear publicly.
            </p>
          </div>
        </section>
      </section>

      <Styles />
    </main>
  );
}

function DashboardCard({
  title,
  value,
  text,
  href,
}) {
  return (
    <a
      href={href}
      className="summaryCard"
    >
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{text}</small>
    </a>
  );
}

function Styles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
      }

      .page,
      .loadingPage {
        min-height: 100vh;
        background: #f6f7f9;
        color: #111827;
        font-family: Arial, sans-serif;
      }

      .loadingPage {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 30px;
        font-weight: 700;
      }

      .errorBox {
        width: 100%;
        max-width: 480px;
        background: white;
        border: 1px solid #fecaca;
        border-radius: 14px;
        padding: 25px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .errorBox strong {
        color: #b91c1c;
        font-size: 18px;
      }

      .errorBox span {
        color: #6b7280;
      }

      .errorBox button {
        min-height: 42px;
        border: 0;
        border-radius: 8px;
        background: #111827;
        color: white;
        font-weight: 800;
        cursor: pointer;
      }

      .hostHeader {
        background: #ffffff;
        border-bottom: 1px solid #e5e7eb;
        position: sticky;
        top: 0;
        z-index: 100;
      }

      .topRow {
        min-height: 72px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 0 32px;
        border-bottom: 1px solid #eef0f2;
      }

      .topRow > div:first-child {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .brand {
        color: #0b4b8c;
        font-size: 25px;
        font-weight: 900;
        text-decoration: none;
      }

      .hostBadge {
        display: inline-flex;
        align-items: center;
        min-height: 27px;
        padding: 0 11px;
        background: #111827;
        color: #ffffff;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.8px;
      }

      .headerRight {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .websiteButton,
      .logoutButton {
        min-height: 38px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 13px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
      }

      .websiteButton {
        border: 1px solid #d1d5db;
        color: #374151;
        text-decoration: none;
      }

      .logoutButton {
        border: 0;
        background: #111827;
        color: white;
      }

      .hostMenu {
        display: flex;
        gap: 5px;
        padding: 10px 24px;
        overflow-x: auto;
      }

      .hostMenu a {
        display: inline-flex;
        align-items: center;
        min-height: 38px;
        padding: 0 13px;
        border-radius: 8px;
        color: #4b5563;
        text-decoration: none;
        font-size: 13px;
        font-weight: 800;
        white-space: nowrap;
      }

      .hostMenu a:hover {
        background: #f3f4f6;
        color: #111827;
      }

      .hostMenu a.active {
        background: #111827;
        color: white;
      }

      .content {
        padding: 32px;
        max-width: 1500px;
        margin: 0 auto;
      }

      .welcomeRow {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 25px;
        margin-bottom: 24px;
      }

      .eyebrow {
        margin: 0 0 7px;
        color: #6b7280;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 1px;
      }

      h1 {
        margin: 0;
        font-size: 34px;
      }

      .subtitle {
        margin: 8px 0 0;
        color: #6b7280;
        font-size: 15px;
      }

      .addPropertyButton,
      .primaryButton {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 9px;
        background: #111827;
        color: white;
        text-decoration: none;
        font-weight: 900;
      }

      .addPropertyButton {
        min-height: 45px;
        padding: 0 18px;
        font-size: 14px;
      }

      .primaryButton {
        min-height: 43px;
        padding: 0 18px;
        font-size: 13px;
      }

      .accountCard {
        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        margin-bottom: 20px;
        overflow: hidden;
      }

      .accountCard > div {
        padding: 18px 20px;
        border-right: 1px solid #eef0f2;
      }

      .accountCard > div:last-child {
        border-right: 0;
      }

      .accountCard span {
        display: block;
        margin-bottom: 7px;
        color: #6b7280;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
      }

      .accountCard strong {
        font-size: 14px;
      }

      .activeStatus {
        color: #047857;
      }

      .summaryGrid {
        display: grid;
        grid-template-columns:
          repeat(4, minmax(0, 1fr));
        gap: 16px;
        margin-bottom: 20px;
      }

      .summaryCard {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        padding: 20px;
        text-decoration: none;
        color: #111827;
      }

      .summaryCard:hover {
        border-color: #9ca3af;
      }

      .summaryCard span {
        display: block;
        color: #6b7280;
        font-size: 12px;
        font-weight: 800;
        margin-bottom: 10px;
      }

      .summaryCard strong {
        display: block;
        font-size: 30px;
        margin-bottom: 6px;
      }

      .summaryCard small {
        color: #9ca3af;
        font-size: 12px;
      }

      .mainGrid {
        display: grid;
        grid-template-columns:
          minmax(0, 2fr) minmax(280px, 1fr);
        gap: 20px;
        margin-bottom: 20px;
      }

      .panel,
      .sidePanel {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
      }

      .panelHeader {
        padding: 20px;
        border-bottom: 1px solid #eef0f2;
      }

      .panel h2,
      .sidePanel h2 {
        margin: 0;
        font-size: 18px;
      }

      .panelHeader p {
        margin: 6px 0 0;
        color: #6b7280;
        font-size: 13px;
      }

      .emptyState {
        min-height: 300px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 35px;
      }

      .emptyIcon {
        width: 52px;
        height: 52px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: #f3f4f6;
        font-size: 30px;
        margin-bottom: 14px;
      }

      .emptyState h3 {
        margin: 0 0 8px;
        font-size: 18px;
      }

      .emptyState p {
        max-width: 430px;
        margin: 0 0 20px;
        color: #6b7280;
        font-size: 13px;
        line-height: 1.6;
      }

      .sidePanel {
        padding: 20px;
      }

      .sidePanel h2 {
        margin-bottom: 15px;
      }

      .sidePanel a {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 14px;
        margin-bottom: 8px;
        border: 1px solid #eef0f2;
        border-radius: 10px;
        text-decoration: none;
        color: #111827;
      }

      .sidePanel a:hover {
        background: #f9fafb;
      }

      .sidePanel strong {
        font-size: 13px;
      }

      .sidePanel span {
        color: #6b7280;
        font-size: 11px;
      }

      .reviewInfo {
        display: flex;
        gap: 15px;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 14px;
        padding: 18px;
      }

      .reviewIcon {
        width: 34px;
        height: 34px;
        flex: 0 0 34px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #17457f;
        color: white;
        border-radius: 50%;
        font-weight: 900;
      }

      .reviewInfo strong {
        display: block;
        margin-bottom: 5px;
      }

      .reviewInfo p {
        margin: 0;
        color: #4b5563;
        font-size: 13px;
        line-height: 1.6;
      }

      @media (max-width: 900px) {
        .summaryGrid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .mainGrid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 650px) {
        .topRow {
          min-height: 64px;
          padding: 0 14px;
        }

        .brand {
          font-size: 20px;
        }

        .hostBadge {
          font-size: 9px;
          padding: 0 8px;
        }

        .websiteButton {
          display: none;
        }

        .hostMenu {
          padding: 8px 10px;
        }

        .content {
          padding: 20px 12px;
        }

        .welcomeRow {
          flex-direction: column;
        }

        .addPropertyButton {
          width: 100%;
        }

        .accountCard {
          grid-template-columns: 1fr;
        }

        .accountCard > div {
          border-right: 0;
          border-bottom:
            1px solid #eef0f2;
        }

        .accountCard > div:last-child {
          border-bottom: 0;
        }

        .summaryGrid {
          grid-template-columns: 1fr;
        }

        h1 {
          font-size: 28px;
        }
      }
    `}</style>
  );
}