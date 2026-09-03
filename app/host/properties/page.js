'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  createClient,
} from '@supabase/supabase-js';



const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);


const tabs = [
  {
    key: 'all',
    label: 'All',
  },
  {
    key: 'draft',
    label: 'Draft',
  },
  {
    key: 'pending_review',
    label: 'Pending Review',
  },
  {
    key: 'changes_requested',
    label: 'Changes Requested',
  },
  {
    key: 'approved',
    label: 'Approved',
  },
  {
    key: 'declined',
    label: 'Declined',
  },
];


export default function HostPropertiesPage() {

  const [host, setHost] =
    useState(null);

  const [
    properties,
    setProperties,
  ] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [
    activeTab,
    setActiveTab,
  ] =
    useState('all');


  useEffect(() => {
    loadPage();
  }, []);


  async function loadPage() {

    try {

      setLoading(true);
      setError('');


      // ======================================================
      // SESSION
      // ======================================================

      const {
        data: {
          session,
        },
        error: sessionError,
      } =
        await supabase.auth.getSession();


      if (sessionError) {
        throw sessionError;
      }


      if (!session?.user) {

        window.location.replace(
          '/login?redirect=/host/properties'
        );

        return;
      }


      // ======================================================
      // ROLE
      // ======================================================

      const {
        data: roles,
        error: roleError,
      } =
        await supabase.rpc(
          'get_my_platform_roles'
        );


      if (roleError) {
        throw roleError;
      }


      const isSuperAdmin =
        (roles || []).some(
          (item) =>
            item.role ===
              'super_admin' &&
            item.is_active === true
        );


      if (isSuperAdmin) {

        window.location.replace(
          '/admin'
        );

        return;
      }


      const isHost =
        (roles || []).some(
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


      // ======================================================
      // HOST PROFILE
      // ======================================================

      const {
        data: hostData,
        error: hostError,
      } =
        await supabase
          .from('host_profiles')
          .select(`
            id,
            user_id,
            full_name,
            business_name,
            status
          `)
          .eq(
            'user_id',
            session.user.id
          )
          .single();


      if (hostError) {
        throw hostError;
      }


      setHost(
        hostData
      );


      // ======================================================
      // HOST PROPERTIES
      // ======================================================

      const {
        data: propertyData,
        error: propertyError,
      } =
        await supabase
          .from('properties')
          .select(`
            id,
            name,
            slug,
            location_name,
            bedrooms,
            bathrooms,
            max_guests,
            base_price,
            is_active,
            moderation_status,
            submitted_for_review_at,
            reviewed_at,
            created_at,
            updated_at
          `)
          .eq(
            'host_id',
            hostData.id
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          );


      if (propertyError) {
        throw propertyError;
      }


      setProperties(
        propertyData || []
      );

    } catch (err) {

      console.error(err);


      setError(
        err?.message ||
          'Unable to load your properties.'
      );

    } finally {

      setLoading(false);

    }
  }


  // ==========================================================
  // COUNTS
  // ==========================================================

  const counts =
    useMemo(() => {

      const result = {

        all:
          properties.length,

        draft: 0,

        pending_review: 0,

        changes_requested: 0,

        approved: 0,

        declined: 0,
      };


      properties.forEach(
        (property) => {

          const status =
            property
              .moderation_status ||
            'draft';


          if (
            result[status] !==
            undefined
          ) {

            result[status] += 1;
          }
        }
      );


      return result;

    }, [properties]);


  // ==========================================================
  // FILTERED PROPERTIES
  // ==========================================================

  const visibleProperties =
    useMemo(() => {

      if (
        activeTab === 'all'
      ) {

        return properties;
      }


      return properties.filter(
        (property) =>
          (
            property
              .moderation_status ||
            'draft'
          ) === activeTab
      );

    }, [
      properties,
      activeTab,
    ]);


  // ==========================================================
  // HELPERS
  // ==========================================================

  function formatMoney(
    value
  ) {

    const amount =
      Number(
        value || 0
      );


    return new Intl.NumberFormat(
      'en-IN',
      {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }
    ).format(
      amount
    );
  }


  function formatStatus(
    value
  ) {

    return (
      value || 'draft'
    )
      .replaceAll(
        '_',
        ' '
      )
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase()
      );
  }


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {

    return (
      <main className="loadingPage">

        Loading your properties...

        <Styles />

      </main>
    );
  }


  // ==========================================================
  // PAGE
  // ==========================================================

  return (
    <main className="page">
      <section className="content">

        {/* ====================================================
            PAGE HEADER
        ==================================================== */}

        <div className="pageHeader">

          <div>

            <p className="eyebrow">
              HOST PORTAL
            </p>

            <h1>
              My Properties
            </h1>

            <p className="subtitle">
              Create, edit and manage
              your NightOutStays
              listings.
            </p>

          </div>


          <a
            href="/host/properties/new"
            className="addButton"
          >
            + Add Property
          </a>

        </div>


        {/* ====================================================
            SUMMARY
        ==================================================== */}

        <section className="summaryGrid">

          <SummaryCard
            label="Total Properties"
            value={counts.all}
          />

          <SummaryCard
            label="Draft"
            value={counts.draft}
          />

          <SummaryCard
            label="Pending Review"
            value={
              counts.pending_review
            }
          />

          <SummaryCard
            label="Live Properties"
            value={
              counts.approved
            }
          />

        </section>


        {/* ====================================================
            PROPERTY PANEL
        ==================================================== */}

        <section className="panel">

          {/* ==================================================
              TABS
          ================================================== */}

          <div className="tabs">

            {tabs.map(
              (tab) => (

                <button
                  type="button"
                  key={tab.key}
                  className={
                    activeTab ===
                    tab.key
                      ? 'tab active'
                      : 'tab'
                  }
                  onClick={() =>
                    setActiveTab(
                      tab.key
                    )
                  }
                >

                  {tab.label}

                  <span>
                    {
                      counts[
                        tab.key
                      ]
                    }
                  </span>

                </button>

              )
            )}

          </div>


          {/* ==================================================
              ERROR
          ================================================== */}

          {error ? (

            <div className="state error">

              {error}

            </div>

          ) : visibleProperties.length ===
            0 ? (

            /* ================================================
               EMPTY STATE
            ================================================ */

            <div className="emptyState">

              <div className="plusCircle">
                +
              </div>


              <h2>

                {activeTab ===
                'all'
                  ? 'No properties added yet'
                  : `No ${formatStatus(
                      activeTab
                    )} properties`}

              </h2>


              <p>
                Add your first property
                and complete the listing
                details.
              </p>


              <a
                href="/host/properties/new"
                className="primaryButton"
              >
                Add Property
              </a>

            </div>

          ) : (

            /* ================================================
               PROPERTY GRID
            ================================================ */

            <div className="propertyGrid">

              {visibleProperties.map(
                (property) => (

                  <article
                    key={
                      property.id
                    }
                    className="propertyCard"
                  >

                    {/* ========================================
                        PROPERTY TOP
                    ======================================== */}

                    <div className="propertyTop">

                      <div>

                        <h3>
                          {property.name ||
                            'Unnamed Property'}
                        </h3>

                        <p>
                          {property.location_name ||
                            'Location not added'}
                        </p>

                      </div>


                      <span
                        className={`status status-${
                          property
                            .moderation_status ||
                          'draft'
                        }`}
                      >

                        {formatStatus(
                          property
                            .moderation_status
                        )}

                      </span>

                    </div>


                    {/* ========================================
                        PROPERTY DETAILS
                    ======================================== */}

                    <div className="propertyDetails">

                      <div>

                        <span>
                          Nightly Rate
                        </span>

                        <strong>
                          {formatMoney(
                            property
                              .base_price
                          )}
                        </strong>

                      </div>


                      <div>

                        <span>
                          Bedrooms
                        </span>

                        <strong>
                          {property
                            .bedrooms ??
                            '—'}
                        </strong>

                      </div>


                      <div>

                        <span>
                          Bathrooms
                        </span>

                        <strong>
                          {property
                            .bathrooms ??
                            '—'}
                        </strong>

                      </div>


                      <div>

                        <span>
                          Max Guests
                        </span>

                        <strong>
                          {property
                            .max_guests ??
                            '—'}
                        </strong>

                      </div>

                    </div>


                    {/* ========================================
                        PROPERTY FOOTER
                    ======================================== */}

                    <div className="propertyFooter">

                      <a
                        href={`/host/properties/${property.id}/edit`}
                        className="editButton"
                      >
                        Edit Property
                      </a>


                      {property
                        .moderation_status ===
                      'approved' ? (

                        <a
                          href={`/property/${property.slug}`}
                          className="viewButton"
                        >
                          View Listing
                        </a>

                      ) : (

                        <span className="reviewNote">

                          {property
                            .moderation_status ===
                          'pending_review'
                            ? 'Under Admin Review'
                            : property
                                .moderation_status ===
                              'changes_requested'
                            ? 'Changes Required'
                            : property
                                .moderation_status ===
                              'declined'
                            ? 'Listing Declined'
                            : 'Not submitted yet'}

                        </span>

                      )}

                    </div>

                  </article>

                )
              )}

            </div>

          )}

        </section>

      </section>


      <Styles />

    </main>
  );
}


// ============================================================
// SUMMARY CARD
// ============================================================

function SummaryCard({
  label,
  value,
}) {

  return (
    <div className="summaryCard">

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  );
}


// ============================================================
// PAGE STYLES
// ============================================================

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

        font-family:
          Arial,
          sans-serif;
      }


      .loadingPage {

        display: flex;

        align-items: center;

        justify-content: center;

        padding: 30px;

        font-weight: 700;
      }


      /* ======================================================
         CONTENT
      ====================================================== */

      .content {

        width: 100%;

        max-width: 1500px;

        margin: 0 auto;

        padding: 32px;
      }


      /* ======================================================
         PAGE HEADER
      ====================================================== */

      .pageHeader {

        display: flex;

        justify-content:
          space-between;

        align-items:
          flex-start;

        gap: 20px;

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


      /* ======================================================
         BUTTONS
      ====================================================== */

      .addButton,
      .primaryButton {

        display: inline-flex;

        align-items: center;

        justify-content: center;

        border-radius: 9px;

        background: #111827;

        color: #ffffff;

        text-decoration: none;

        font-weight: 900;
      }


      .addButton {

        min-height: 44px;

        padding: 0 18px;

        font-size: 14px;
      }


      .primaryButton {

        min-height: 42px;

        padding: 0 17px;

        font-size: 13px;
      }


      /* ======================================================
         SUMMARY
      ====================================================== */

      .summaryGrid {

        display: grid;

        grid-template-columns:
          repeat(
            4,
            minmax(0, 1fr)
          );

        gap: 16px;

        margin-bottom: 20px;
      }


      .summaryCard {

        padding: 20px;

        border:
          1px solid #e5e7eb;

        border-radius: 14px;

        background: #ffffff;
      }


      .summaryCard span {

        display: block;

        margin-bottom: 9px;

        color: #6b7280;

        font-size: 12px;

        font-weight: 800;
      }


      .summaryCard strong {

        font-size: 30px;
      }


      /* ======================================================
         PANEL
      ====================================================== */

      .panel {

        overflow: hidden;

        border:
          1px solid #e5e7eb;

        border-radius: 14px;

        background: #ffffff;
      }


      /* ======================================================
         TABS
      ====================================================== */

      .tabs {

        display: flex;

        gap: 8px;

        padding: 16px;

        overflow-x: auto;

        border-bottom:
          1px solid #eef0f2;
      }


      .tab {

        padding: 9px 13px;

        border: 0;

        border-radius: 999px;

        background: #f3f4f6;

        color: #4b5563;

        font-size: 12px;

        font-weight: 900;

        cursor: pointer;

        white-space: nowrap;
      }


      .tab span {

        margin-left: 6px;

        opacity: .65;
      }


      .tab.active {

        background: #111827;

        color: white;
      }


      /* ======================================================
         STATE
      ====================================================== */

      .state,
      .emptyState {

        padding: 60px 24px;

        text-align: center;
      }


      .state.error {

        color: #b91c1c;
      }


      .plusCircle {

        width: 55px;

        height: 55px;

        display: flex;

        align-items: center;

        justify-content: center;

        margin:
          0 auto 15px;

        border-radius: 50%;

        background: #f3f4f6;

        font-size: 30px;
      }


      .emptyState h2 {

        margin: 0 0 8px;

        font-size: 20px;
      }


      .emptyState p {

        margin: 0 0 20px;

        color: #6b7280;
      }


      /* ======================================================
         PROPERTY GRID
      ====================================================== */

      .propertyGrid {

        display: grid;

        grid-template-columns:
          repeat(
            2,
            minmax(0, 1fr)
          );

        gap: 16px;

        padding: 18px;
      }


      .propertyCard {

        padding: 18px;

        border:
          1px solid #e5e7eb;

        border-radius: 13px;

        background: #ffffff;
      }


      /* ======================================================
         PROPERTY TOP
      ====================================================== */

      .propertyTop {

        display: flex;

        justify-content:
          space-between;

        align-items:
          flex-start;

        gap: 14px;
      }


      .propertyTop h3 {

        margin: 0 0 5px;

        font-size: 18px;
      }


      .propertyTop p {

        margin: 0;

        color: #6b7280;

        font-size: 13px;
      }


      /* ======================================================
         STATUS
      ====================================================== */

      .status {

        height: fit-content;

        padding: 6px 9px;

        border-radius: 999px;

        font-size: 10px;

        font-weight: 900;

        white-space: nowrap;
      }


      .status-draft {

        background: #f3f4f6;

        color: #4b5563;
      }


      .status-pending_review {

        background: #fff7ed;

        color: #9a3412;
      }


      .status-changes_requested {

        background: #fef3c7;

        color: #92400e;
      }


      .status-approved {

        background: #ecfdf5;

        color: #047857;
      }


      .status-declined {

        background: #fef2f2;

        color: #b91c1c;
      }


      /* ======================================================
         PROPERTY DETAILS
      ====================================================== */

      .propertyDetails {

        display: grid;

        grid-template-columns:
          repeat(
            4,
            minmax(0, 1fr)
          );

        gap: 12px;

        margin: 20px 0;
      }


      .propertyDetails span {

        display: block;

        margin-bottom: 5px;

        color: #6b7280;

        font-size: 10px;

        font-weight: 800;
      }


      .propertyDetails strong {

        font-size: 13px;
      }


      /* ======================================================
         PROPERTY FOOTER
      ====================================================== */

      .propertyFooter {

        display: flex;

        align-items: center;

        justify-content:
          space-between;

        gap: 12px;

        padding-top: 14px;

        border-top:
          1px solid #eef0f2;
      }


      .editButton,
      .viewButton {

        padding: 9px 13px;

        border-radius: 8px;

        font-size: 12px;

        font-weight: 800;

        text-decoration: none;
      }


      .editButton {

        background: #111827;

        color: white;
      }


      .viewButton {

        border:
          1px solid #d1d5db;

        color: #374151;
      }


      .reviewNote {

        color: #6b7280;

        font-size: 11px;

        font-weight: 700;
      }


      /* ======================================================
         TABLET
      ====================================================== */

      @media (
        max-width: 900px
      ) {

        .summaryGrid {

          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
        }


        .propertyGrid {

          grid-template-columns:
            1fr;
        }

      }


      /* ======================================================
         MOBILE
      ====================================================== */

      @media (
        max-width: 650px
      ) {

        .content {

          padding:
            20px 12px;
        }


        .pageHeader {

          flex-direction:
            column;
        }


        .addButton {

          width: 100%;
        }


        .summaryGrid {

          grid-template-columns:
            1fr;
        }


        .propertyDetails {

          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
        }


        h1 {

          font-size: 28px;
        }

      }

    `}</style>
  );
}