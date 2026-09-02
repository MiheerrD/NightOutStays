'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

const FILTERS = [
  { key: 'all', label: 'All Properties' },
  { key: 'live', label: 'Live' },
  { key: 'pending_review', label: 'Pending Review' },
  { key: 'draft', label: 'Draft' },
  { key: 'changes_requested', label: 'Changes Requested' },
  { key: 'declined', label: 'Declined' },
];

export default function AdminHostDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const hostId =
    typeof params?.id === 'string'
      ? params.id
      : '';

  const [host, setHost] =
    useState(null);

  const [properties, setProperties] =
    useState([]);

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
    if (hostId) {
      loadHostPage();
    }
  }, [hostId]);

  async function loadHostPage(
    refresh = false
  ) {
    if (refresh) {
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
        router.replace(
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

      const allowed =
        (roles || []).some(
          (item) =>
            (
              item.role ===
                'super_admin' ||
              item.role === 'admin'
            ) &&
            item.is_active === true
        );

      if (!allowed) {
        throw new Error(
          'Admin access is required.'
        );
      }

      const {
        data: hostRow,
        error: hostError,
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
        .eq('id', hostId)
        .maybeSingle();

      if (hostError) {
        throw hostError;
      }

      if (!hostRow) {
        throw new Error(
          'Host not found.'
        );
      }

      const {
        data: propertyRows,
        error: propertyError,
      } = await supabase
        .from('properties')
        .select(`
          id,
          name,
          slug,
          location_name,
          address,
          city,
          area,
          property_type,
          bedrooms,
          bathrooms,
          max_guests,
          base_price,
          moderation_status,
          moderation_notes,
          submitted_for_review_at,
          reviewed_at,
          is_active,
          created_at,
          updated_at
        `)
        .eq('host_id', hostId)
        .order(
          'created_at',
          {
            ascending: false,
          }
        );

      if (propertyError) {
        throw propertyError;
      }

      setHost(hostRow);
      setProperties(
        propertyRows || []
      );
    } catch (err) {
      console.error(
        'Host Details error:',
        err
      );

      setError(
        err?.message ||
          'Unable to load Host.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const counts = useMemo(() => {
    return {
      total: properties.length,

      live:
        properties.filter(
          (property) =>
            property.is_active ===
              true &&
            property.moderation_status ===
              'approved'
        ).length,

      pending:
        properties.filter(
          (property) =>
            property.moderation_status ===
            'pending_review'
        ).length,

      draft:
        properties.filter(
          (property) =>
            property.moderation_status ===
            'draft'
        ).length,

      changes:
        properties.filter(
          (property) =>
            property.moderation_status ===
            'changes_requested'
        ).length,

      declined:
        properties.filter(
          (property) =>
            property.moderation_status ===
            'declined'
        ).length,
    };
  }, [properties]);

  const filteredProperties =
    useMemo(() => {
      const cleanSearch =
        search
          .trim()
          .toLowerCase();

      return properties.filter(
        (property) => {
          let matchesFilter = true;

          if (
            activeFilter === 'live'
          ) {
            matchesFilter =
              property.is_active ===
                true &&
              property.moderation_status ===
                'approved';
          } else if (
            activeFilter !== 'all'
          ) {
            matchesFilter =
              property.moderation_status ===
              activeFilter;
          }

          if (!matchesFilter) {
            return false;
          }

          if (!cleanSearch) {
            return true;
          }

          const searchable = [
            property.name,
            property.location_name,
            property.address,
            property.city,
            property.area,
            property.property_type,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return searchable.includes(
            cleanSearch
          );
        }
      );
    }, [
      properties,
      activeFilter,
      search,
    ]);

  function bankDetailsComplete() {
    if (!host) {
      return false;
    }

    return Boolean(
      host.bank_account_name &&
        host.bank_name &&
        host.bank_account_number &&
        host.bank_ifsc &&
        host.bank_account_type
    );
  }

  if (loading) {
    return (
      <>
        <main className="nosHostDetailPage">
          <div className="nosHostDetailLoading">
            Loading Host...
          </div>
        </main>

        <Styles />
      </>
    );
  }

  if (!host) {
    return (
      <>
        <main className="nosHostDetailPage">
          <div className="nosHostDetailLoading">
            <h2>
              Host not available
            </h2>

            <p>
              {error}
            </p>

            <Link
              href="/admin/hosts"
              className="nosBackHosts"
            >
              ← Back to Hosts
            </Link>
          </div>
        </main>

        <Styles />
      </>
    );
  }

  const displayName =
    host.business_name ||
    host.full_name ||
    'Host';

  return (
    <>
      <main className="nosHostDetailPage">
        <div className="nosHostDetailContainer">

          <div className="nosHostTopActions">

            <Link
              href="/admin/hosts"
              className="nosBackHosts"
            >
              ← Back to Hosts
            </Link>

            <button
              type="button"
              className="nosHostRefresh"
              onClick={() =>
                loadHostPage(true)
              }
              disabled={refreshing}
            >
              {refreshing
                ? 'Refreshing...'
                : '↻ Refresh'}
            </button>

          </div>


          {error && (
            <div className="nosHostError">
              {error}
            </div>
          )}


          <section className="nosHostProfileCard">

            <div className="nosHostProfileTop">

              <div className="nosHostLargeAvatar">
                {displayName
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div className="nosHostProfileTitle">

                <span className="nosEyebrow">
                  HOST PROFILE
                </span>

                <h1>
                  {displayName}
                </h1>

                {host.full_name &&
                  host.business_name &&
                  host.full_name !==
                    host.business_name && (
                    <p>
                      {host.full_name}
                    </p>
                  )}

              </div>

              <HostStatus
                status={host.status}
              />

            </div>


            <div className="nosHostInformationGrid">

              <InfoCard
                label="Phone"
                value={
                  host.phone || '—'
                }
              />

              <InfoCard
                label="Email"
                value={
                  host.email || '—'
                }
              />

              <InfoCard
                label="Location"
                value={
                  [
                    host.city,
                    host.state,
                  ]
                    .filter(Boolean)
                    .join(', ') || '—'
                }
              />

              <InfoCard
                label="Pincode"
                value={
                  host.pincode || '—'
                }
              />

              <InfoCard
                label="PAN"
                value={
                  host.pan_number
                    ? 'Available'
                    : 'Not Added'
                }
              />

              <InfoCard
                label="GSTIN"
                value={
                  host.gstin
                    ? host.gstin
                    : 'Not Added'
                }
              />

              <InfoCard
                label="Bank Details"
                value={
                  bankDetailsComplete()
                    ? 'Complete'
                    : 'Incomplete'
                }
                success={
                  bankDetailsComplete()
                }
              />

              <InfoCard
                label="Joined"
                value={formatDate(
                  host.created_at
                )}
              />

            </div>

          </section>


          <section className="nosHostPropertiesSection">

            <div className="nosHostPropertiesHeading">

              <div>

                <span className="nosEyebrow">
                  HOST INVENTORY
                </span>

                <h2>
                  Properties by {displayName}
                </h2>

                <p>
                  Every property uploaded
                  by this Host is shown
                  here with its current
                  moderation status.
                </p>

              </div>

            </div>


            <div className="nosHostPropertyStats">

              <FilterCard
                label="All Properties"
                value={counts.total}
                active={
                  activeFilter === 'all'
                }
                onClick={() =>
                  setActiveFilter('all')
                }
              />

              <FilterCard
                label="Live"
                value={counts.live}
                active={
                  activeFilter === 'live'
                }
                onClick={() =>
                  setActiveFilter('live')
                }
              />

              <FilterCard
                label="Pending Review"
                value={counts.pending}
                active={
                  activeFilter ===
                  'pending_review'
                }
                onClick={() =>
                  setActiveFilter(
                    'pending_review'
                  )
                }
              />

              <FilterCard
                label="Draft"
                value={counts.draft}
                active={
                  activeFilter === 'draft'
                }
                onClick={() =>
                  setActiveFilter('draft')
                }
              />

              <FilterCard
                label="Changes Requested"
                value={counts.changes}
                active={
                  activeFilter ===
                  'changes_requested'
                }
                onClick={() =>
                  setActiveFilter(
                    'changes_requested'
                  )
                }
              />

              <FilterCard
                label="Declined"
                value={counts.declined}
                active={
                  activeFilter ===
                  'declined'
                }
                onClick={() =>
                  setActiveFilter(
                    'declined'
                  )
                }
              />

            </div>


            <div className="nosPropertyTools">

              <div>
                <h3>
                  {filterHeading(
                    activeFilter
                  )}
                </h3>

                <p>
                  {
                    filteredProperties.length
                  }{' '}
                  {filteredProperties.length ===
                  1
                    ? 'property'
                    : 'properties'}
                </p>
              </div>

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search property, location or type..."
                className="nosPropertySearch"
              />

            </div>


            {filteredProperties.length ===
            0 ? (
              <div className="nosPropertyEmpty">
                No properties found in
                this category.
              </div>
            ) : (
              <div className="nosHostPropertiesGrid">

                {filteredProperties.map(
                  (property) => (
                    <PropertyCard
                      key={property.id}
                      property={property}
                    />
                  )
                )}

              </div>
            )}

          </section>

        </div>
      </main>

      <Styles />
    </>
  );
}


function PropertyCard({
  property,
}) {
  const status =
    property.moderation_status ||
    'draft';

  const live =
    property.is_active === true &&
    status === 'approved';

  return (
    <article className="nosHostPropertyCard">

      <div className="nosPropertyCardTop">

        <div>

          <h3>
            {property.name ||
              'Unnamed Property'}
          </h3>

          <p>
            {[
              property.area,
              property.city,
              property.location_name,
            ]
              .filter(Boolean)
              .join(', ') || 'Location not added'}
          </p>

        </div>


        <div className="nosPropertyBadges">

          <span
            className={`nosModerationBadge ${status}`}
          >
            {prettyStatus(status)}
          </span>

          {live && (
            <span className="nosLiveBadge">
              LIVE
            </span>
          )}

        </div>

      </div>


      <div className="nosPropertyPrice">

        ₹
        {Number(
          property.base_price || 0
        ).toLocaleString('en-IN')}

        <span>
          / night
        </span>

      </div>


      <div className="nosPropertyNumbers">

        <PropertyInfo
          label="Bedrooms"
          value={
            property.bedrooms ?? '—'
          }
        />

        <PropertyInfo
          label="Bathrooms"
          value={
            property.bathrooms ?? '—'
          }
        />

        <PropertyInfo
          label="Guests"
          value={
            property.max_guests ?? '—'
          }
        />

      </div>


      <div className="nosPropertyMeta">

        <div>
          <span>
            Property Type
          </span>

          <strong>
            {property.property_type ||
              '—'}
          </strong>
        </div>

        <div>
          <span>
            Submitted
          </span>

          <strong>
            {formatDate(
              property.submitted_for_review_at
            )}
          </strong>
        </div>

      </div>


      {status ===
        'changes_requested' &&
        property.moderation_notes && (
          <div className="nosPropertyNote">
            <strong>
              Changes Requested
            </strong>

            <p>
              {
                property.moderation_notes
              }
            </p>
          </div>
        )}


      {status === 'declined' &&
        property.moderation_notes && (
          <div className="nosPropertyNote declined">
            <strong>
              Decline Note
            </strong>

            <p>
              {
                property.moderation_notes
              }
            </p>
          </div>
        )}


      <div className="nosPropertyActions">

        <Link
          href="/admin/properties"
          className="nosManageProperty"
        >
          Open Property Management
        </Link>

        {property.slug &&
          live && (
            <Link
              href={`/properties/${property.slug}`}
              target="_blank"
              className="nosViewLiveProperty"
            >
              View Live
            </Link>
          )}

      </div>

    </article>
  );
}


function PropertyInfo({
  label,
  value,
}) {
  return (
    <div className="nosPropertyInfo">

      <strong>
        {value}
      </strong>

      <span>
        {label}
      </span>

    </div>
  );
}


function FilterCard({
  label,
  value,
  active,
  onClick,
}) {
  return (
    <button
      type="button"
      className={
        active
          ? 'nosHostFilterCard active'
          : 'nosHostFilterCard'
      }
      onClick={onClick}
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </button>
  );
}


function InfoCard({
  label,
  value,
  success = false,
}) {
  return (
    <div className="nosHostInfoCard">

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


function HostStatus({
  status,
}) {
  const value =
    status || 'active';

  return (
    <span
      className={`nosHostStatusBadge ${value}`}
    >
      {prettyStatus(value)}
    </span>
  );
}


function prettyStatus(value) {
  if (!value) {
    return 'Draft';
  }

  return value
    .replaceAll('_', ' ')
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}


function filterHeading(value) {
  const filter =
    FILTERS.find(
      (item) =>
        item.key === value
    );

  return (
    filter?.label ||
    'Properties'
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

      .nosHostDetailPage {
        min-height: 100vh;

        background: #f5f7fa;

        color: #101828;
      }


      .nosHostDetailContainer {
        width: calc(100% - 64px);

        max-width: 1500px;

        margin: 0 auto;

        padding: 28px 0 70px;
      }


      /*
      TOP ACTIONS
      */

      .nosHostTopActions {
        display: flex;

        align-items: center;

        justify-content:
          space-between;

        gap: 20px;

        margin-bottom: 18px;
      }


      .nosBackHosts {
        color: #0a579f;

        font-size: 11px;

        font-weight: 900;

        text-decoration: none;
      }


      .nosHostRefresh {
        min-height: 42px;

        padding: 0 16px;

        border: 0;

        border-radius: 8px;

        background: #07569f;

        color: #ffffff;

        font-size: 11px;

        font-weight: 900;

        cursor: pointer;
      }


      /*
      PROFILE
      */

      .nosHostProfileCard {
        border: 1px solid #d9e2ec;

        border-radius: 16px;

        background: #ffffff;

        padding: 23px;

        margin-bottom: 25px;
      }


      .nosHostProfileTop {
        display: flex;

        align-items: center;

        gap: 15px;
      }


      .nosHostLargeAvatar {
        width: 62px;

        height: 62px;

        flex: 0 0 62px;

        display: flex;

        align-items: center;

        justify-content: center;

        border-radius: 15px;

        background: #e6eff9;

        color: #07569f;

        font-size: 25px;

        font-weight: 900;
      }


      .nosHostProfileTitle {
        flex: 1;
      }


      .nosEyebrow {
        display: block;

        margin-bottom: 5px;

        color: #68778c;

        font-size: 9px;

        font-weight: 900;

        letter-spacing: 1px;
      }


      .nosHostProfileTitle h1 {
        margin: 0;

        color: #071d38;

        font-size: 29px;

        letter-spacing: -0.6px;
      }


      .nosHostProfileTitle p {
        margin: 4px 0 0;

        color: #667085;

        font-size: 12px;
      }


      .nosHostStatusBadge,
      .nosModerationBadge,
      .nosLiveBadge {
        min-height: 25px;

        display: inline-flex;

        align-items: center;

        justify-content: center;

        padding: 0 10px;

        border-radius: 999px;

        font-size: 9px;

        font-weight: 900;
      }


      .nosHostStatusBadge.active,
      .nosModerationBadge.approved,
      .nosLiveBadge {
        background: #e5f7eb;

        color: #14743b;
      }


      .nosHostStatusBadge.suspended,
      .nosModerationBadge.pending_review {
        background: #fff3da;

        color: #976400;
      }


      .nosHostStatusBadge.blocked,
      .nosHostStatusBadge.rejected,
      .nosModerationBadge.declined {
        background: #feeceb;

        color: #b42318;
      }


      .nosModerationBadge.draft {
        background: #eef2f6;

        color: #495b70;
      }


      .nosModerationBadge.changes_requested {
        background: #eaf2ff;

        color: #175fa7;
      }


      .nosHostInformationGrid {
        display: grid;

        grid-template-columns:
          repeat(
            4,
            minmax(0,1fr)
          );

        gap: 10px;

        margin-top: 22px;
      }


      .nosHostInfoCard {
        min-height: 67px;

        padding: 12px;

        border: 1px solid #e0e6ed;

        border-radius: 9px;

        background: #fafbfd;
      }


      .nosHostInfoCard span {
        color: #728095;

        font-size: 9px;

        font-weight: 900;
      }


      .nosHostInfoCard strong {
        display: block;

        margin-top: 6px;

        color: #172c46;

        font-size: 11px;

        overflow-wrap:
          anywhere;
      }


      .nosHostInfoCard strong.success {
        color: #14743b;
      }


      /*
      PROPERTY SECTION
      */

      .nosHostPropertiesSection {
        margin-top: 10px;
      }


      .nosHostPropertiesHeading h2 {
        margin: 0;

        color: #071d38;

        font-size: 27px;
      }


      .nosHostPropertiesHeading p {
        margin: 6px 0 0;

        color: #65758a;

        font-size: 12px;

        line-height: 1.55;
      }


      .nosHostPropertyStats {
        display: grid;

        grid-template-columns:
          repeat(
            6,
            minmax(0,1fr)
          );

        gap: 11px;

        margin: 20px 0 24px;
      }


      .nosHostFilterCard {
        min-height: 95px;

        display: flex;

        flex-direction: column;

        align-items: flex-start;

        justify-content:
          center;

        padding: 15px;

        border: 1px solid #d8e1eb;

        border-radius: 12px;

        background: #ffffff;

        color: #101828;

        cursor: pointer;
      }


      .nosHostFilterCard.active {
        border-color: #082f5a;

        background: #082f5a;

        color: #ffffff;
      }


      .nosHostFilterCard span {
        font-size: 10px;

        font-weight: 900;

        color: #53647a;
      }


      .nosHostFilterCard.active span {
        color: #ffffff;
      }


      .nosHostFilterCard strong {
        margin-top: 8px;

        font-size: 23px;
      }


      /*
      SEARCH
      */

      .nosPropertyTools {
        display: flex;

        align-items: flex-end;

        justify-content:
          space-between;

        gap: 20px;

        margin-bottom: 13px;
      }


      .nosPropertyTools h3 {
        margin: 0;

        font-size: 20px;
      }


      .nosPropertyTools p {
        margin: 3px 0 0;

        color: #667085;

        font-size: 10px;
      }


      .nosPropertySearch {
        width: min(
          420px,
          100%
        );

        min-height: 41px;

        padding: 0 13px;

        border: 1px solid #ccd6e1;

        border-radius: 8px;

        background: #ffffff;

        outline: none;
      }


      /*
      PROPERTY CARDS
      */

      .nosHostPropertiesGrid {
        display: grid;

        grid-template-columns:
          repeat(
            2,
            minmax(0,1fr)
          );

        gap: 16px;
      }


      .nosHostPropertyCard {
        border: 1px solid #d8e1eb;

        border-radius: 15px;

        background: #ffffff;

        padding: 20px;
      }


      .nosPropertyCardTop {
        display: flex;

        justify-content:
          space-between;

        align-items:
          flex-start;

        gap: 15px;
      }


      .nosPropertyCardTop h3 {
        margin: 0;

        color: #071d38;

        font-size: 18px;
      }


      .nosPropertyCardTop p {
        margin: 5px 0 0;

        color: #68778c;

        font-size: 11px;
      }


      .nosPropertyBadges {
        display: flex;

        align-items: center;

        justify-content:
          flex-end;

        gap: 6px;

        flex-wrap: wrap;
      }


      .nosPropertyPrice {
        margin-top: 18px;

        color: #071d38;

        font-size: 24px;

        font-weight: 900;
      }


      .nosPropertyPrice span {
        color: #667085;

        font-size: 9px;

        font-weight: 600;
      }


      .nosPropertyNumbers {
        display: grid;

        grid-template-columns:
          repeat(
            3,
            minmax(0,1fr)
          );

        gap: 8px;

        margin-top: 14px;
      }


      .nosPropertyInfo {
        min-height: 59px;

        display: flex;

        flex-direction: column;

        justify-content:
          center;

        padding: 10px;

        border: 1px solid #dce4ed;

        border-radius: 8px;
      }


      .nosPropertyInfo strong {
        color: #112b47;

        font-size: 14px;
      }


      .nosPropertyInfo span {
        margin-top: 3px;

        color: #6b7a8e;

        font-size: 8px;
      }


      .nosPropertyMeta {
        display: grid;

        grid-template-columns:
          1fr 1fr;

        gap: 15px;

        margin-top: 13px;

        padding-top: 12px;

        border-top: 1px solid #e5eaf0;
      }


      .nosPropertyMeta div:last-child {
        text-align: right;
      }


      .nosPropertyMeta span {
        display: block;

        color: #718095;

        font-size: 8px;
      }


      .nosPropertyMeta strong {
        display: block;

        margin-top: 4px;

        color: #26384c;

        font-size: 10px;
      }


      .nosPropertyNote {
        margin-top: 13px;

        padding: 11px;

        border-radius: 8px;

        background: #edf5ff;

        color: #175fa7;
      }


      .nosPropertyNote.declined {
        background: #fff0ef;

        color: #b42318;
      }


      .nosPropertyNote strong {
        font-size: 10px;
      }


      .nosPropertyNote p {
        margin: 4px 0 0;

        font-size: 10px;

        line-height: 1.45;
      }


      .nosPropertyActions {
        display: flex;

        gap: 8px;

        margin-top: 16px;
      }


      .nosManageProperty,
      .nosViewLiveProperty {
        min-height: 38px;

        display: inline-flex;

        align-items: center;

        justify-content: center;

        padding: 0 13px;

        border-radius: 8px;

        font-size: 10px;

        font-weight: 900;

        text-decoration: none;
      }


      .nosManageProperty {
        background: #082f5a;

        color: #ffffff;
      }


      .nosViewLiveProperty {
        border: 1px solid #ccd6e1;

        background: #ffffff;

        color: #07569f;
      }


      .nosPropertyEmpty,
      .nosHostDetailLoading {
        padding: 45px 20px;

        border: 1px solid #d8e1eb;

        border-radius: 14px;

        background: #ffffff;

        text-align: center;
      }


      .nosHostDetailLoading {
        width: calc(100% - 40px);

        max-width: 900px;

        margin: 40px auto;
      }


      .nosHostError {
        margin-bottom: 17px;

        padding: 11px 13px;

        border: 1px solid #f0b7b0;

        border-radius: 8px;

        background: #fff3f2;

        color: #b42318;

        font-size: 11px;
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

        .nosHostInformationGrid {
          grid-template-columns:
            repeat(
              2,
              minmax(0,1fr)
            );
        }

        .nosHostPropertyStats {
          grid-template-columns:
            repeat(
              3,
              minmax(0,1fr)
            );
        }

        .nosHostPropertiesGrid {
          grid-template-columns:
            1fr;
        }

      }


      @media (
        max-width: 700px
      ) {

        .nosHostDetailContainer {
          width:
            calc(100% - 24px);
        }

        .nosHostProfileTop {
          align-items:
            flex-start;
        }

        .nosHostProfileTitle h1 {
          font-size: 24px;
        }

        .nosPropertyTools {
          flex-direction: column;

          align-items: stretch;
        }

        .nosPropertySearch {
          width: 100%;
        }

        .nosHostPropertyStats {
          grid-template-columns:
            repeat(
              2,
              minmax(0,1fr)
            );
        }

      }


      @media (
        max-width: 480px
      ) {

        .nosHostInformationGrid {
          grid-template-columns:
            1fr;
        }

        .nosHostProfileTop {
          flex-wrap: wrap;
        }

        .nosHostStatusBadge {
          margin-left: 77px;
        }

        .nosPropertyCardTop {
          flex-direction: column;
        }

        .nosPropertyBadges {
          justify-content:
            flex-start;
        }

        .nosPropertyActions {
          flex-direction: column;
        }

      }

    `}</style>
  );
}