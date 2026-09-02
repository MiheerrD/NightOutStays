'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

const FILTERS = [
  { key: 'all', label: 'All Hosts' },
  { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'blocked', label: 'Blocked' },
];

export default function AdminHostsPage() {
  const [hosts, setHosts] = useState([]);
  const [properties, setProperties] = useState([]);

  const [activeFilter, setActiveFilter] =
    useState('all');

  const [search, setSearch] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        window.location.replace(
          '/admin/login'
        );

        return;
      }

      const {
        data: roles,
        error: roleError,
      } = await supabase.rpc(
        'get_my_platform_roles'
      );

      if (roleError) {
        throw roleError;
      }

      const isAdmin =
        (roles || []).some(
          (role) =>
            (
              role.role ===
                'super_admin' ||
              role.role === 'admin'
            ) &&
            role.is_active === true
        );

      if (!isAdmin) {
        throw new Error(
          'Admin access is required.'
        );
      }

      const {
        data: hostRows,
        error: hostsError,
      } = await supabase
        .from('host_profiles')
        .select(`
          id,
          user_id,
          full_name,
          business_name,
          phone,
          email,
          status,
          created_at,
          updated_at,
          address,
          city,
          state,
          pincode,
          gstin,
          pan_number,
          bank_account_name,
          bank_account_number,
          bank_ifsc,
          bank_name,
          bank_branch,
          bank_account_type,
          cancelled_cheque_path
        `)
        .order('created_at', {
          ascending: false,
        });

      if (hostsError) {
        throw hostsError;
      }

      const {
        data: propertyRows,
        error: propertiesError,
      } = await supabase
        .from('properties')
        .select(`
          id,
          host_id,
          moderation_status,
          is_active
        `);

      if (propertiesError) {
        throw propertiesError;
      }

      setHosts(hostRows || []);
      setProperties(propertyRows || []);
    } catch (err) {
      console.error(
        'Admin Hosts page error:',
        err
      );

      setError(
        err?.message ||
          'Unable to load Hosts.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function getPropertyCounts(hostId) {
    const hostProperties =
      properties.filter(
        (property) =>
          property.host_id === hostId
      );

    return {
      total: hostProperties.length,

      live:
        hostProperties.filter(
          (property) =>
            property.is_active ===
              true &&
            property.moderation_status ===
              'approved'
        ).length,

      pending:
        hostProperties.filter(
          (property) =>
            property.moderation_status ===
            'pending_review'
        ).length,

      draft:
        hostProperties.filter(
          (property) =>
            property.moderation_status ===
            'draft'
        ).length,

      changes:
        hostProperties.filter(
          (property) =>
            property.moderation_status ===
            'changes_requested'
        ).length,

      declined:
        hostProperties.filter(
          (property) =>
            property.moderation_status ===
            'declined'
        ).length,
    };
  }

  function isBankComplete(host) {
    return Boolean(
      host.bank_account_name &&
        host.bank_name &&
        host.bank_account_number &&
        host.bank_ifsc &&
        host.bank_account_type
    );
  }

  const hostData = useMemo(() => {
    return hosts.map((host) => ({
      ...host,

      propertyCounts:
        getPropertyCounts(host.id),

      bankComplete:
        isBankComplete(host),
    }));
  }, [hosts, properties]);

  const filteredHosts = useMemo(() => {
    const cleanSearch =
      search
        .trim()
        .toLowerCase();

    return hostData.filter((host) => {
      const matchesStatus =
        activeFilter === 'all' ||
        host.status === activeFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!cleanSearch) {
        return true;
      }

      const searchable = [
        host.full_name,
        host.business_name,
        host.email,
        host.phone,
        host.city,
        host.state,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(
        cleanSearch
      );
    });
  }, [
    hostData,
    activeFilter,
    search,
  ]);

  const summary = useMemo(() => {
    return {
      total: hostData.length,

      active:
        hostData.filter(
          (host) =>
            host.status === 'active'
        ).length,

      suspended:
        hostData.filter(
          (host) =>
            host.status === 'suspended'
        ).length,

      blocked:
        hostData.filter(
          (host) =>
            host.status === 'blocked'
        ).length,

      totalProperties:
        hostData.reduce(
          (total, host) =>
            total +
            host.propertyCounts.total,
          0
        ),
    };
  }, [hostData]);

  if (loading) {
    return (
      <>
        <main className="nosHostsPage">
          <div className="nosHostsLoading">
            Loading Hosts...
          </div>
        </main>

        <Styles />
      </>
    );
  }

  return (
    <>
      <main className="nosHostsPage">
        <div className="nosHostsContainer">

          <div className="nosHostsHeader">

            <div>
              <span className="nosHostsEyebrow">
                ADMIN
              </span>

              <h1>
                Host Management
              </h1>

              <p>
                View registered Hosts,
                their account status and
                properties listed on
                NightOutStays.
              </p>
            </div>

            <button
              type="button"
              className="nosHostsRefresh"
              disabled={refreshing}
              onClick={() =>
                loadPage(true)
              }
            >
              {refreshing
                ? 'Refreshing...'
                : '↻ Refresh'}
            </button>

          </div>


          {error && (
            <div className="nosHostsError">
              {error}
            </div>
          )}


          <div className="nosHostStats">

            <StatCard
              label="Total Hosts"
              value={summary.total}
              active={
                activeFilter === 'all'
              }
              onClick={() =>
                setActiveFilter('all')
              }
            />

            <StatCard
              label="Active"
              value={summary.active}
              active={
                activeFilter ===
                'active'
              }
              onClick={() =>
                setActiveFilter(
                  'active'
                )
              }
            />

            <StatCard
              label="Suspended"
              value={summary.suspended}
              active={
                activeFilter ===
                'suspended'
              }
              onClick={() =>
                setActiveFilter(
                  'suspended'
                )
              }
            />

            <StatCard
              label="Blocked"
              value={summary.blocked}
              active={
                activeFilter ===
                'blocked'
              }
              onClick={() =>
                setActiveFilter(
                  'blocked'
                )
              }
            />

            <StatCard
              label="Total Properties"
              value={
                summary.totalProperties
              }
            />

          </div>


          <div className="nosHostTools">

            <div className="nosHostFilterButtons">
              {FILTERS.map((filter) => (
                <button
                  type="button"
                  key={filter.key}
                  className={
                    activeFilter ===
                    filter.key
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setActiveFilter(
                      filter.key
                    )
                  }
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search host, business, phone, email or city..."
              className="nosHostSearch"
            />

          </div>


          <div className="nosHostsSectionTitle">

            <div>
              <h2>
                {activeFilter === 'all'
                  ? 'All Hosts'
                  : `${
                      activeFilter
                        .charAt(0)
                        .toUpperCase() +
                      activeFilter.slice(1)
                    } Hosts`}
              </h2>

              <p>
                {filteredHosts.length}{' '}
                {filteredHosts.length ===
                1
                  ? 'host'
                  : 'hosts'}
              </p>
            </div>

          </div>


          {filteredHosts.length === 0 ? (
            <div className="nosHostsEmpty">
              No Hosts found.
            </div>
          ) : (
            <div className="nosHostsGrid">

              {filteredHosts.map(
                (host) => (
                  <HostCard
                    key={host.id}
                    host={host}
                  />
                )
              )}

            </div>
          )}

        </div>
      </main>

      <Styles />
    </>
  );
}


function HostCard({ host }) {
  const displayName =
    host.business_name ||
    host.full_name ||
    'Host';

  return (
    <article className="nosHostCard">

      <div className="nosHostCardTop">

        <div className="nosHostAvatar">
          {displayName
            .charAt(0)
            .toUpperCase()}
        </div>

        <div className="nosHostIdentity">

          <span className="nosHostSmallLabel">
            HOST
          </span>

          <h3>
            {displayName}
          </h3>

          {host.business_name &&
            host.full_name &&
            host.business_name !==
              host.full_name && (
              <p>
                {host.full_name}
              </p>
            )}

        </div>

        <StatusBadge
          status={host.status}
        />

      </div>


      <div className="nosHostContactGrid">

        <Info
          label="Phone"
          value={
            host.phone || '—'
          }
        />

        <Info
          label="Email"
          value={
            host.email || '—'
          }
        />

        <Info
          label="City"
          value={
            [
              host.city,
              host.state,
            ]
              .filter(Boolean)
              .join(', ') || '—'
          }
        />

        <Info
          label="Bank Details"
          value={
            host.bankComplete
              ? 'Complete'
              : 'Incomplete'
          }
          success={
            host.bankComplete
          }
        />

      </div>


      <div className="nosHostPropertySummary">

        <PropertyCount
          label="All"
          value={
            host.propertyCounts.total
          }
        />

        <PropertyCount
          label="Live"
          value={
            host.propertyCounts.live
          }
          good
        />

        <PropertyCount
          label="Pending"
          value={
            host.propertyCounts.pending
          }
        />

        <PropertyCount
          label="Draft"
          value={
            host.propertyCounts.draft
          }
        />

        <PropertyCount
          label="Changes"
          value={
            host.propertyCounts.changes
          }
        />

        <PropertyCount
          label="Declined"
          value={
            host.propertyCounts.declined
          }
        />

      </div>


      <div className="nosHostCardFooter">

        <div className="nosHostJoined">
          Joined
          <strong>
            {' '}
            {formatDate(
              host.created_at
            )}
          </strong>
        </div>

        <Link
          href={`/admin/hosts/${host.id}`}
          className="nosViewHostButton"
        >
          View Host
        </Link>

      </div>

    </article>
  );
}


function StatCard({
  label,
  value,
  active = false,
  onClick,
}) {
  const content = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
    </>
  );

  if (!onClick) {
    return (
      <div className="nosHostStatCard">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={
        active
          ? 'nosHostStatCard active'
          : 'nosHostStatCard'
      }
      onClick={onClick}
    >
      {content}
    </button>
  );
}


function Info({
  label,
  value,
  success = false,
}) {
  return (
    <div className="nosHostInfo">

      <span>
        {label}
      </span>

      <strong
        className={
          success
            ? 'success'
            : ''
        }
      >
        {value}
      </strong>

    </div>
  );
}


function PropertyCount({
  label,
  value,
  good = false,
}) {
  return (
    <div className="nosHostPropertyCount">

      <span>
        {label}
      </span>

      <strong
        className={
          good
            ? 'good'
            : ''
        }
      >
        {value}
      </strong>

    </div>
  );
}


function StatusBadge({
  status,
}) {
  const normalized =
    status || 'active';

  return (
    <span
      className={`nosHostStatus ${normalized}`}
    >
      {normalized
        .replaceAll('_', ' ')
        .toUpperCase()}
    </span>
  );
}


function formatDate(value) {
  if (!value) {
    return '—';
  }

  try {
    return new Date(
      value
    ).toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    );
  } catch {
    return '—';
  }
}


function Styles() {
  return (
    <style jsx global>{`

      * {
        box-sizing: border-box;
      }

      .nosHostsPage {
        min-height: 100vh;

        background: #f5f7fa;

        color: #101828;
      }


      .nosHostsContainer {
        width: calc(100% - 64px);

        max-width: 1500px;

        margin: 0 auto;

        padding: 34px 0 70px;
      }


      /*
      HEADER
      */

      .nosHostsHeader {
        display: flex;

        justify-content:
          space-between;

        align-items:
          flex-start;

        gap: 20px;

        margin-bottom: 27px;
      }


      .nosHostsEyebrow {
        display: block;

        margin-bottom: 7px;

        color: #617086;

        font-size: 10px;

        font-weight: 900;

        letter-spacing: 1.2px;
      }


      .nosHostsHeader h1 {
        margin: 0;

        color: #071b35;

        font-size: 34px;

        line-height: 1.1;

        letter-spacing: -0.8px;
      }


      .nosHostsHeader p {
        margin: 9px 0 0;

        color: #5e6e82;

        font-size: 14px;

        line-height: 1.6;
      }


      .nosHostsRefresh {
        min-height: 46px;

        padding: 0 20px;

        border: 0;

        border-radius: 9px;

        background: #07569f;

        color: #ffffff;

        font-size: 12px;

        font-weight: 900;

        cursor: pointer;
      }


      /*
      SUMMARY
      */

      .nosHostStats {
        display: grid;

        grid-template-columns:
          repeat(
            5,
            minmax(0, 1fr)
          );

        gap: 14px;

        margin-bottom: 24px;
      }


      .nosHostStatCard {
        min-height: 105px;

        display: flex;

        flex-direction: column;

        align-items: flex-start;

        justify-content:
          center;

        padding: 19px;

        border: 1px solid #d7e0ea;

        border-radius: 14px;

        background: #ffffff;

        color: #101828;

        text-align: left;
      }


      button.nosHostStatCard {
        cursor: pointer;
      }


      .nosHostStatCard.active {
        border-color: #082f5a;

        background: #082f5a;

        color: #ffffff;
      }


      .nosHostStatCard span {
        color: #53647a;

        font-size: 11px;

        font-weight: 900;
      }


      .nosHostStatCard.active span {
        color: #ffffff;
      }


      .nosHostStatCard strong {
        display: block;

        margin-top: 9px;

        font-size: 27px;

        line-height: 1;
      }


      /*
      SEARCH/FILTER
      */

      .nosHostTools {
        display: flex;

        justify-content:
          space-between;

        align-items: center;

        gap: 15px;

        margin-bottom: 27px;
      }


      .nosHostFilterButtons {
        display: flex;

        gap: 8px;

        flex-wrap: wrap;
      }


      .nosHostFilterButtons button {
        min-height: 38px;

        padding: 0 14px;

        border: 1px solid #ccd7e2;

        border-radius: 8px;

        background: #ffffff;

        color: #40536a;

        font-size: 11px;

        font-weight: 900;

        cursor: pointer;
      }


      .nosHostFilterButtons button.active {
        border-color: #082f5a;

        background: #082f5a;

        color: #ffffff;
      }


      .nosHostSearch {
        width: min(
          430px,
          100%
        );

        min-height: 42px;

        padding: 0 13px;

        border: 1px solid #ccd7e2;

        border-radius: 9px;

        background: #ffffff;

        color: #101828;

        outline: none;
      }


      .nosHostSearch:focus {
        border-color: #07569f;
      }


      /*
      SECTION TITLE
      */

      .nosHostsSectionTitle {
        margin-bottom: 13px;
      }


      .nosHostsSectionTitle h2 {
        margin: 0;

        font-size: 22px;
      }


      .nosHostsSectionTitle p {
        margin: 3px 0 0;

        color: #667085;

        font-size: 11px;
      }


      /*
      GRID
      */

      .nosHostsGrid {
        display: grid;

        grid-template-columns:
          repeat(
            2,
            minmax(0, 1fr)
          );

        gap: 16px;
      }


      /*
      HOST CARD
      */

      .nosHostCard {
        border: 1px solid #d8e1eb;

        border-radius: 15px;

        background: #ffffff;

        padding: 19px;
      }


      .nosHostCardTop {
        display: flex;

        align-items: center;

        gap: 12px;
      }


      .nosHostAvatar {
        width: 50px;

        height: 50px;

        flex: 0 0 50px;

        display: flex;

        align-items: center;

        justify-content: center;

        border-radius: 13px;

        background: #e7eff8;

        color: #07569f;

        font-size: 20px;

        font-weight: 900;
      }


      .nosHostIdentity {
        min-width: 0;

        flex: 1;
      }


      .nosHostSmallLabel {
        color: #708095;

        font-size: 9px;

        font-weight: 900;

        letter-spacing: 1px;
      }


      .nosHostIdentity h3 {
        margin: 3px 0 0;

        color: #081d38;

        font-size: 18px;

        overflow-wrap:
          anywhere;
      }


      .nosHostIdentity p {
        margin: 3px 0 0;

        color: #667085;

        font-size: 11px;
      }


      /*
      STATUS
      */

      .nosHostStatus {
        min-height: 25px;

        display: inline-flex;

        align-items: center;

        justify-content: center;

        padding: 0 10px;

        border-radius: 999px;

        font-size: 9px;

        font-weight: 900;
      }


      .nosHostStatus.active {
        background: #e6f7ec;

        color: #14733a;
      }


      .nosHostStatus.suspended {
        background: #fff2d9;

        color: #9b6400;
      }


      .nosHostStatus.blocked,
      .nosHostStatus.rejected {
        background: #feeceb;

        color: #b42318;
      }


      .nosHostStatus.pending {
        background: #eef3f9;

        color: #45576d;
      }


      /*
      CONTACT
      */

      .nosHostContactGrid {
        display: grid;

        grid-template-columns:
          repeat(
            2,
            minmax(0, 1fr)
          );

        gap: 9px;

        margin-top: 17px;
      }


      .nosHostInfo {
        min-height: 63px;

        padding: 11px;

        border: 1px solid #e0e6ed;

        border-radius: 9px;

        background: #fafbfd;
      }


      .nosHostInfo span {
        display: block;

        color: #738096;

        font-size: 9px;

        font-weight: 900;

        letter-spacing: 0.5px;
      }


      .nosHostInfo strong {
        display: block;

        margin-top: 5px;

        color: #172b44;

        font-size: 11px;

        overflow-wrap:
          anywhere;
      }


      .nosHostInfo strong.success {
        color: #14733a;
      }


      /*
      PROPERTIES
      */

      .nosHostPropertySummary {
        display: grid;

        grid-template-columns:
          repeat(
            6,
            minmax(0, 1fr)
          );

        gap: 7px;

        margin-top: 14px;
      }


      .nosHostPropertyCount {
        min-height: 60px;

        display: flex;

        flex-direction: column;

        justify-content:
          center;

        align-items: center;

        border: 1px solid #dde4ec;

        border-radius: 9px;

        background: #ffffff;
      }


      .nosHostPropertyCount span {
        color: #66778c;

        font-size: 8px;

        font-weight: 900;
      }


      .nosHostPropertyCount strong {
        margin-top: 4px;

        color: #132b46;

        font-size: 18px;
      }


      .nosHostPropertyCount strong.good {
        color: #148044;
      }


      /*
      FOOTER
      */

      .nosHostCardFooter {
        display: flex;

        align-items: center;

        justify-content:
          space-between;

        gap: 12px;

        margin-top: 16px;

        padding-top: 14px;

        border-top: 1px solid #e7ebf0;
      }


      .nosHostJoined {
        color: #7a8797;

        font-size: 10px;
      }


      .nosHostJoined strong {
        color: #44566d;
      }


      .nosViewHostButton {
        min-height: 39px;

        display: inline-flex;

        align-items: center;

        justify-content: center;

        padding: 0 15px;

        border-radius: 8px;

        background: #082f5a;

        color: #ffffff;

        font-size: 11px;

        font-weight: 900;

        text-decoration: none;
      }


      /*
      OTHER
      */

      .nosHostsEmpty,
      .nosHostsLoading {
        padding: 45px 20px;

        border: 1px solid #d8e1eb;

        border-radius: 14px;

        background: #ffffff;

        text-align: center;
      }


      .nosHostsLoading {
        width:
          calc(100% - 64px);

        max-width: 1200px;

        margin: 40px auto;
      }


      .nosHostsError {
        margin-bottom: 20px;

        padding: 12px 14px;

        border: 1px solid #f3bbb5;

        border-radius: 9px;

        background: #fff4f3;

        color: #b42318;

        font-size: 12px;

        font-weight: 700;
      }


      button:disabled {
        opacity: 0.55;

        cursor: not-allowed;
      }


      /*
      RESPONSIVE
      */

      @media (
        max-width: 1050px
      ) {

        .nosHostStats {
          grid-template-columns:
            repeat(
              3,
              minmax(0, 1fr)
            );
        }

        .nosHostsGrid {
          grid-template-columns:
            1fr;
        }

      }


      @media (
        max-width: 760px
      ) {

        .nosHostsContainer {
          width:
            calc(100% - 24px);

          padding-top: 23px;
        }

        .nosHostsHeader {
          flex-direction: column;
        }

        .nosHostsHeader h1 {
          font-size: 28px;
        }

        .nosHostStats {
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
        }

        .nosHostTools {
          flex-direction: column;

          align-items: stretch;
        }

        .nosHostSearch {
          width: 100%;
        }

        .nosHostPropertySummary {
          grid-template-columns:
            repeat(
              3,
              minmax(0, 1fr)
            );
        }

      }


      @media (
        max-width: 500px
      ) {

        .nosHostStats {
          grid-template-columns:
            1fr 1fr;
        }

        .nosHostContactGrid {
          grid-template-columns:
            1fr;
        }

        .nosHostCardTop {
          align-items:
            flex-start;
        }

        .nosHostCardFooter {
          flex-direction: column;

          align-items: stretch;
        }

        .nosViewHostButton {
          width: 100%;
        }

      }

    `}</style>
  );
}