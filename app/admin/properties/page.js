'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

import PropertyPhotoManager from './PropertyPhotoManager';
import PropertyDiscountManager from './PropertyDiscountManager';
import PropertyCalendarManager from './PropertyCalendarManager';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

const FILTERS = [
  {
    key: 'all',
    label: 'All Properties',
    icon: '▦',
  },
  {
    key: 'pending_review',
    label: 'Pending Review',
    icon: '⌛',
  },
  {
    key: 'live',
    label: 'Live',
    icon: '✓',
  },
  {
    key: 'changes_requested',
    label: 'Changes Requested',
    icon: '•••',
  },
  {
    key: 'draft',
    label: 'Draft',
    icon: '✎',
  },
  {
    key: 'declined',
    label: 'Declined',
    icon: '×',
  },
];

function money(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

function formatDate(value) {
  if (!value) return '—';

  try {
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function statusLabel(status) {
  const map = {
    draft: 'Draft',
    pending_review: 'Pending Review',
    changes_requested: 'Changes Requested',
    approved: 'Approved',
    declined: 'Declined',
  };

  return map[status] || 'Draft';
}

function statusClass(status) {
  const map = {
    draft: 'draft',
    pending_review: 'pending',
    changes_requested: 'changes',
    approved: 'approved',
    declined: 'declined',
  };

  return map[status] || 'draft';
}

function hostName(property) {
  return (
    property?._host?.business_name ||
    property?._host?.full_name ||
    'Host Not Assigned'
  );
}

export default function AdminPropertiesPage() {
  const [session, setSession] = useState(null);
  const [admin, setAdmin] = useState(null);

  const [properties, setProperties] = useState([]);
  const [selected, setSelected] = useState(null);

  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState('details');

  const [reviewNote, setReviewNote] = useState('');

  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    initialise();
  }, []);

  async function initialise() {
    setChecking(true);
    setError('');

    try {
      const {
        data: { session: currentSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!currentSession) {
        window.location.replace('/login');
        return;
      }

      setSession(currentSession);

      const {
        data: adminData,
        error: adminError,
      } = await supabase
        .from('admin_profiles')
        .select(
          'user_id, full_name, role, is_active'
        )
        .eq('user_id', currentSession.user.id)
        .eq('is_active', true)
        .single();

      if (adminError || !adminData) {
        throw new Error(
          'Active Super Admin account not found.'
        );
      }

      if (adminData.role !== 'super_admin') {
        throw new Error(
          'Only Super Admin can access this page.'
        );
      }

      setAdmin(adminData);

      await loadProperties();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          'Unable to open property management.'
      );
    } finally {
      setChecking(false);
    }
  }

  async function loadProperties() {
    setLoading(true);
    setError('');

    try {
      const {
        data: propertyRows,
        error: propertyError,
      } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', {
          ascending: false,
        });

      if (propertyError) {
        throw propertyError;
      }

      const rows = propertyRows || [];

      const hostIds = [
        ...new Set(
          rows
            .map((property) => property.host_id)
            .filter(Boolean)
        ),
      ];

      const hostMap = {};

      if (hostIds.length > 0) {
        const {
          data: hostRows,
          error: hostError,
        } = await supabase
          .from('host_profiles')
          .select(
            `
              id,
              user_id,
              full_name,
              business_name,
              phone,
              email,
              city,
              state,
              status
            `
          )
          .in('id', hostIds);

        if (hostError) {
          throw hostError;
        }

        (hostRows || []).forEach((host) => {
          hostMap[host.id] = host;
        });
      }

      const enriched = rows.map((property) => ({
        ...property,

        moderation_status:
          property.moderation_status ||
          'draft',

        _host:
          hostMap[property.host_id] ||
          null,
      }));

      setProperties(enriched);

      if (selected?.id) {
        const updatedSelected =
          enriched.find(
            (property) =>
              property.id === selected.id
          );

        if (updatedSelected) {
          setSelected(updatedSelected);
        }
      }
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          'Unable to load properties.'
      );
    } finally {
      setLoading(false);
    }
  }

  function openProperty(
    property,
    nextTab = 'details'
  ) {
    setSelected(property);
    setTab(nextTab);

    setReviewNote(
      property.moderation_notes || ''
    );

    setError('');
    setSuccess('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function closeProperty() {
    setSelected(null);
    setTab('details');
    setReviewNote('');
    setError('');
    setSuccess('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function moderateProperty(action) {
    if (
      !selected?.id ||
      !session?.user?.id
    ) {
      return;
    }

    setError('');
    setSuccess('');

    const note = reviewNote.trim();

    if (
      action === 'changes_requested' &&
      !note
    ) {
      setError(
        'Please enter the changes required before requesting changes.'
      );
      return;
    }

    if (
      action === 'declined' &&
      !note
    ) {
      setError(
        'Please enter the reason for declining the property.'
      );
      return;
    }

    let confirmationMessage = '';

    if (action === 'approved') {
      confirmationMessage =
        'Approve this property and make it live?';
    }

    if (
      action === 'changes_requested'
    ) {
      confirmationMessage =
        'Send this property back to the Host for changes?';
    }

    if (action === 'declined') {
      confirmationMessage =
        'Decline this property?';
    }

    if (
      !window.confirm(
        confirmationMessage
      )
    ) {
      return;
    }

    setWorking(true);

    try {
      const now =
        new Date().toISOString();

      let payload = {};

      if (action === 'approved') {
        payload = {
          moderation_status:
            'approved',

          moderation_notes: null,

          is_active: true,

          reviewed_at: now,

          reviewed_by:
            session.user.id,

          updated_at: now,
        };
      }

      if (
        action === 'changes_requested'
      ) {
        payload = {
          moderation_status:
            'changes_requested',

          moderation_notes: note,

          is_active: false,

          reviewed_at: now,

          reviewed_by:
            session.user.id,

          updated_at: now,
        };
      }

      if (action === 'declined') {
        payload = {
          moderation_status:
            'declined',

          moderation_notes: note,

          is_active: false,

          reviewed_at: now,

          reviewed_by:
            session.user.id,

          updated_at: now,
        };
      }

      const {
        data,
        error: updateError,
      } = await supabase
        .from('properties')
        .update(payload)
        .eq('id', selected.id)
        .select('*')
        .single();

      if (updateError) {
        throw updateError;
      }

      setSelected((previous) => ({
        ...previous,
        ...data,
      }));

      setReviewNote(
        data.moderation_notes || ''
      );

      if (action === 'approved') {
        setSuccess(
          'Property approved and made live successfully.'
        );
      }

      if (
        action ===
        'changes_requested'
      ) {
        setSuccess(
          'Changes requested. The Host can edit and resubmit the property.'
        );
      }

      if (action === 'declined') {
        setSuccess(
          'Property declined successfully.'
        );
      }

      await loadProperties();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          'Unable to update moderation status.'
      );
    } finally {
      setWorking(false);
    }
  }

  async function changeLiveState(
    makeLive
  ) {
    if (!selected?.id) {
      return;
    }

    if (
      selected.moderation_status !==
      'approved'
    ) {
      setError(
        'Only approved properties can be made live.'
      );
      return;
    }

    const confirmed =
      window.confirm(
        makeLive
          ? 'Make this approved property live?'
          : 'Take this property offline?'
      );

    if (!confirmed) {
      return;
    }

    setWorking(true);
    setError('');
    setSuccess('');

    try {
      const {
        data,
        error: updateError,
      } = await supabase
        .from('properties')
        .update({
          is_active: makeLive,

          updated_at:
            new Date().toISOString(),
        })
        .eq('id', selected.id)
        .select('*')
        .single();

      if (updateError) {
        throw updateError;
      }

      setSelected((previous) => ({
        ...previous,
        ...data,
      }));

      setSuccess(
        makeLive
          ? 'Property is now live.'
          : 'Property is now offline.'
      );

      await loadProperties();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          'Unable to update property visibility.'
      );
    } finally {
      setWorking(false);
    }
  }

  const counts = useMemo(() => {
    return {
      all: properties.length,

      pending_review:
        properties.filter(
          (property) =>
            property.moderation_status ===
            'pending_review'
        ).length,

      live:
        properties.filter(
          (property) =>
            property.moderation_status ===
              'approved' &&
            property.is_active === true
        ).length,

      changes_requested:
        properties.filter(
          (property) =>
            property.moderation_status ===
            'changes_requested'
        ).length,

      draft:
        properties.filter(
          (property) =>
            property.moderation_status ===
            'draft'
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
      if (filter === 'all') {
        return properties;
      }

      if (filter === 'live') {
        return properties.filter(
          (property) =>
            property.moderation_status ===
              'approved' &&
            property.is_active
        );
      }

      return properties.filter(
        (property) =>
          property.moderation_status ===
          filter
      );
    }, [properties, filter]);

  if (checking) {
    return (
      <>
        <main className="nosPropertiesPage">
          <div className="nosLoading">
            Loading Property Management...
          </div>
        </main>

        <Styles />
      </>
    );
  }

  if (!admin) {
    return (
      <>
        <main className="nosPropertiesPage">
          <div className="nosLoading">
            <h2>Access Denied</h2>

            <p>
              {error ||
                'Super Admin access is required.'}
            </p>
          </div>
        </main>

        <Styles />
      </>
    );
  }

  if (selected) {
    return (
      <>
        <main className="nosPropertiesPage">
          <div className="nosContainer">
            <button
              type="button"
              className="nosBack"
              onClick={closeProperty}
            >
              ← Back to Properties
            </button>

            <div className="nosPropertyTitle">
              <div>
                <div className="nosEyebrow">
                  SUPER ADMIN PROPERTY MANAGEMENT
                </div>

                <h1>
                  {selected.name}
                </h1>

                <p>
                  {selected.area ||
                    selected.location_name ||
                    'Location not available'}

                  {selected.city
                    ? `, ${selected.city}`
                    : ''}
                </p>
              </div>

              <div className="nosStatusStack">
                <span
                  className={`nosStatusBadge ${statusClass(
                    selected.moderation_status
                  )}`}
                >
                  {statusLabel(
                    selected.moderation_status
                  )}
                </span>

                <span
                  className={
                    selected.is_active
                      ? 'nosLiveBadge'
                      : 'nosOfflineBadge'
                  }
                >
                  {selected.is_active
                    ? 'LIVE'
                    : 'OFFLINE'}
                </span>
              </div>
            </div>

            <div className="nosSummaryGrid">
              <SummaryCard
                label="Host"
                value={hostName(selected)}
                sub={
                  selected._host?.phone ||
                  selected._host?.email ||
                  ''
                }
              />

              <SummaryCard
                label="Nightly Rate"
                value={`₹${money(
                  selected.base_price
                )}`}
              />

              <SummaryCard
                label="Submitted"
                value={formatDate(
                  selected.submitted_for_review_at
                )}
              />

              <SummaryCard
                label="Reviewed"
                value={formatDate(
                  selected.reviewed_at
                )}
              />
            </div>

            {error && (
              <div className="nosError">
                {error}
              </div>
            )}

            {success && (
              <div className="nosSuccess">
                {success}
              </div>
            )}

            {selected.moderation_status !==
              'approved' && (
              <section className="nosModerationPanel">
                <div className="nosModerationHeading">
                  <div>
                    <div className="nosEyebrow">
                      SUPER ADMIN REVIEW
                    </div>

                    <h2>
                      Review Property
                    </h2>

                    <p>
                      Verify the property details
                      and photos before publishing
                      it on NightOutStays.
                    </p>
                  </div>
                </div>

                <label className="nosReviewNote">
                  <span>
                    Review Note to Host
                  </span>

                  <textarea
                    rows="3"
                    value={reviewNote}
                    onChange={(event) =>
                      setReviewNote(
                        event.target.value
                      )
                    }
                    placeholder="Write notes here when requesting changes or declining."
                  />
                </label>

                <div className="nosModerationActions">
                  <button
                    type="button"
                    className="nosApproveButton"
                    disabled={working}
                    onClick={() =>
                      moderateProperty(
                        'approved'
                      )
                    }
                  >
                    ✓ Approve & Make Live
                  </button>

                  <button
                    type="button"
                    className="nosChangesButton"
                    disabled={working}
                    onClick={() =>
                      moderateProperty(
                        'changes_requested'
                      )
                    }
                  >
                    Request Changes
                  </button>

                  <button
                    type="button"
                    className="nosDeclineButton"
                    disabled={working}
                    onClick={() =>
                      moderateProperty(
                        'declined'
                      )
                    }
                  >
                    Decline Property
                  </button>
                </div>
              </section>
            )}

            {selected.moderation_status ===
              'approved' && (
              <section className="nosApprovedPanel">
                <div>
                  <strong>
                    ✓ Property Approved
                  </strong>

                  <p>
                    {selected.is_active
                      ? 'This property is currently live and visible to guests.'
                      : 'This property is approved but currently offline.'}
                  </p>
                </div>

                <button
                  type="button"
                  className={
                    selected.is_active
                      ? 'nosOfflineButton'
                      : 'nosApproveButton'
                  }
                  disabled={working}
                  onClick={() =>
                    changeLiveState(
                      !selected.is_active
                    )
                  }
                >
                  {selected.is_active
                    ? 'Take Offline'
                    : 'Make Live'}
                </button>
              </section>
            )}

            {selected.moderation_status ===
              'changes_requested' &&
              selected.moderation_notes && (
                <div className="nosChangesNote">
                  <strong>
                    Changes Requested
                  </strong>

                  <p>
                    {
                      selected.moderation_notes
                    }
                  </p>
                </div>
              )}

            {selected.moderation_status ===
              'declined' &&
              selected.moderation_notes && (
                <div className="nosDeclinedNote">
                  <strong>
                    Decline Reason
                  </strong>

                  <p>
                    {
                      selected.moderation_notes
                    }
                  </p>
                </div>
              )}

            <div className="nosTabs">
              <button
                type="button"
                className={
                  tab === 'details'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setTab('details')
                }
              >
                Property Details
              </button>

              <button
                type="button"
                className={
                  tab === 'photos'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setTab('photos')
                }
              >
                Photos
              </button>

              <button
                type="button"
                className={
                  tab === 'offers'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setTab('offers')
                }
              >
                Pricing & Offers
              </button>

              <button
                type="button"
                className={
                  tab === 'calendar'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setTab('calendar')
                }
              >
                Calendar
              </button>
            </div>

            {tab === 'details' && (
              <PropertyDetails
                property={selected}
              />
            )}

            {tab === 'photos' && (
              <div className="nosManagerPanel">
                <h2>
                  Property Photos
                </h2>

                <p>
                  Review and manage property
                  photos.
                </p>

                <PropertyPhotoManager
                  propertyId={
                    selected.id
                  }
                  propertyName={
                    selected.name
                  }
                />
              </div>
            )}

            {tab === 'offers' && (
              <div className="nosManagerPanel">
                <h2>
                  Pricing & Offers
                </h2>

                <p>
                  Review pricing and offers for
                  this property.
                </p>

                <PropertyDiscountManager
                  propertyId={
                    selected.id
                  }
                  propertyName={
                    selected.name
                  }
                />
              </div>
            )}

            {tab === 'calendar' && (
              <div className="nosManagerPanel">
                <h2>
                  Property Calendar
                </h2>

                <p>
                  Manage availability and
                  date-wise pricing.
                </p>

                <PropertyCalendarManager
                  propertyId={
                    selected.id
                  }
                  propertyName={
                    selected.name
                  }
                />
              </div>
            )}
          </div>
        </main>

        <Styles />
      </>
    );
  }

  return (
    <>
      <main className="nosPropertiesPage">
        <div className="nosContainer">
          <div className="nosPageHeader">
            <div>
              <div className="nosEyebrow">
                SUPER ADMIN
              </div>

              <h1>
                Property Management
              </h1>

              <p>
                Review Host properties and
                control which listings become
                live on NightOutStays.
              </p>
            </div>

            <button
              type="button"
              className="nosRefreshButton"
              disabled={loading}
              onClick={loadProperties}
            >
              ↻{' '}
              {loading
                ? 'Refreshing...'
                : 'Refresh'}
            </button>
          </div>

          {error && (
            <div className="nosError">
              {error}
            </div>
          )}

          <div className="nosStatsGrid">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={
                  filter === item.key
                    ? 'nosStatCard active'
                    : 'nosStatCard'
                }
                onClick={() =>
                  setFilter(item.key)
                }
              >
                <div>
                  <span>
                    {item.label}
                  </span>

                  <strong>
                    {counts[item.key]}
                  </strong>
                </div>

                <div className="nosStatIcon">
                  {item.icon}
                </div>
              </button>
            ))}
          </div>

          <div className="nosListHeading">
            <h2>
              {
                FILTERS.find(
                  (item) =>
                    item.key === filter
                )?.label
              }
            </h2>

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

          {loading ? (
            <div className="nosEmptyState">
              Loading properties...
            </div>
          ) : filteredProperties.length ===
            0 ? (
            <div className="nosEmptyState">
              <h3>
                No properties found
              </h3>

              <p>
                There are currently no
                properties in this category.
              </p>
            </div>
          ) : (
            <div className="nosPropertyGrid">
              {filteredProperties.map(
                (property) => (
                  <PropertyCard
                    key={property.id}
                    property={property}
                    onOpen={openProperty}
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

function SummaryCard({
  label,
  value,
  sub,
}) {
  return (
    <div className="nosSummaryCard">
      <span>{label}</span>

      <strong>
        {value || '—'}
      </strong>

      {sub && (
        <small>{sub}</small>
      )}
    </div>
  );
}

function PropertyCard({
  property,
  onOpen,
}) {
  return (
    <article className="nosPropertyCard">
      <div className="nosPropertyCardHeader">
        <div>
          <h3>{property.name}</h3>

          <p>
            {property.area ||
              property.location_name ||
              'Location not added'}

            {property.city
              ? `, ${property.city}`
              : ''}
          </p>
        </div>

        <div className="nosPropertyBadges">
          <span
            className={`nosStatusBadge ${statusClass(
              property.moderation_status
            )}`}
          >
            {statusLabel(
              property.moderation_status
            )}
          </span>

          <span
            className={
              property.is_active
                ? 'nosLiveBadge'
                : 'nosOfflineBadge'
            }
          >
            {property.is_active
              ? 'LIVE'
              : 'OFFLINE'}
          </span>
        </div>
      </div>

      <div className="nosHostBox">
        <span>HOST</span>

        <strong>
          {hostName(property)}
        </strong>

        <small>
          {property._host?.city || ''}

          {property._host?.state
            ? `${
                property._host?.city
                  ? ', '
                  : ''
              }${property._host.state}`
            : ''}
        </small>
      </div>

      <div className="nosRate">
        ₹{money(property.base_price)}

        <span>/ night</span>
      </div>

      <div className="nosFeatureGrid">
        <MiniDetail
          value={property.bedrooms || 0}
          label="Bedrooms"
        />

        <MiniDetail
          value={
            property.bathrooms || 0
          }
          label="Bathrooms"
        />

        <MiniDetail
          value={
            property.max_guests || 0
          }
          label="Guests"
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
          <span>Submitted</span>

          <strong>
            {formatDate(
              property.submitted_for_review_at
            )}
          </strong>
        </div>
      </div>

      <div className="nosCardActions">
        <button
          type="button"
          className="nosManageButton"
          onClick={() =>
            onOpen(
              property,
              'details'
            )
          }
        >
          {property.moderation_status ===
          'pending_review'
            ? 'Review Property'
            : 'Manage Property'}
        </button>

        <button
          type="button"
          onClick={() =>
            onOpen(property, 'photos')
          }
        >
          Photos
        </button>

        <button
          type="button"
          onClick={() =>
            onOpen(property, 'offers')
          }
        >
          Offers
        </button>

        <button
          type="button"
          onClick={() =>
            onOpen(
              property,
              'calendar'
            )
          }
        >
          Calendar
        </button>
      </div>
    </article>
  );
}

function MiniDetail({
  value,
  label,
}) {
  return (
    <div className="nosMiniDetail">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function PropertyDetails({
  property,
}) {
  const amenities =
    Array.isArray(
      property.amenities
    )
      ? property.amenities
      : [];

  const kitchen =
    Array.isArray(
      property.kitchen_features
    )
      ? property.kitchen_features
      : [];

  const houseRules =
    Array.isArray(
      property.house_rules
    )
      ? property.house_rules
      : [];

  return (
    <div>
      <DetailSection title="Property Information">
        <Detail
          label="Property Name"
          value={property.name}
        />

        <Detail
          label="Property Type"
          value={property.property_type}
        />

        <Detail
          label="City"
          value={property.city}
        />

        <Detail
          label="Area"
          value={property.area}
        />

        <Detail
          label="Display Location"
          value={
            property.location_name
          }
        />

        <Detail
          label="Nightly Rate"
          value={`₹${money(
            property.base_price
          )}`}
        />
      </DetailSection>

      <DetailSection title="Description">
        <WideDetail
          label="Short Description"
          value={
            property.short_description
          }
        />

        <WideDetail
          label="Full Description"
          value={property.description}
        />
      </DetailSection>

      <DetailSection title="Address & Location">
        <WideDetail
          label="Address"
          value={property.address}
        />

        <WideDetail
          label="Google Maps"
          value={
            property.google_maps_url
          }
          link
        />

        <Detail
          label="Latitude"
          value={property.latitude}
        />

        <Detail
          label="Longitude"
          value={property.longitude}
        />
      </DetailSection>

      <DetailSection title="Rooms & Guests">
        <Detail
          label="Bedrooms"
          value={property.bedrooms}
        />

        <Detail
          label="Bathrooms"
          value={property.bathrooms}
        />

        <Detail
          label="Minimum Guests"
          value={property.min_guests}
        />

        <Detail
          label="Guests Included"
          value={
            property.included_guests
          }
        />

        <Detail
          label="Maximum Guests"
          value={property.max_guests}
        />

        <Detail
          label="Queen Beds"
          value={
            property.queen_bed_count
          }
        />

        <Detail
          label="Single Beds"
          value={
            property.single_bed_count
          }
        />

        <Detail
          label="Sofa Cum Beds"
          value={
            property.sofa_cum_bed_count
          }
        />
      </DetailSection>

      <DetailSection title="Pricing">
        <Detail
          label="Base Rate"
          value={`₹${money(
            property.base_price
          )}`}
        />

        <Detail
          label="Extra Guest Fee"
          value={`₹${money(
            property.extra_guest_fee
          )}`}
        />

        <Detail
          label="Cleaning Fee"
          value={`₹${money(
            property.cleaning_fee
          )}`}
        />

        <Detail
          label="Security Deposit"
          value={`₹${money(
            property.security_deposit
          )}`}
        />

        <Detail
          label="Minimum Nights"
          value={
            property.min_stay_nights
          }
        />

        <Detail
          label="Maximum Nights"
          value={
            property.max_stay_nights
          }
        />

        <Detail
          label="Late Checkout / Hour"
          value={`₹${money(
            property.late_checkout_hourly_fee
          )}`}
        />
      </DetailSection>

      <DetailSection title="Check-in & Check-out">
        <Detail
          label="Check-in"
          value={
            property.check_in_time
          }
        />

        <Detail
          label="Check-out"
          value={
            property.check_out_time
          }
        />
      </DetailSection>

      <DetailSection title="Facilities">
        <YesNo
          label="Wi-Fi"
          value={
            property.wifi_available
          }
        />

        <YesNo
          label="TV"
          value={
            property.tv_available
          }
        />

        <YesNo
          label="Fridge"
          value={
            property.fridge_available
          }
        />

        <YesNo
          label="Washing Machine"
          value={
            property.washing_machine_available
          }
        />

        <YesNo
          label="AC"
          value={
            property.ac_available
          }
        />

        <Detail
          label="AC Count"
          value={property.ac_count}
        />

        <Detail
          label="Water Heaters"
          value={
            property.water_heater_count
          }
        />
      </DetailSection>

      <DetailSection title="Guest Policies">
        <YesNo
          label="Pets Allowed"
          value={
            property.pets_allowed
          }
        />

        <YesNo
          label="Parties Allowed"
          value={
            property.parties_allowed
          }
        />

        <YesNo
          label="Couples Allowed"
          value={
            property.couples_allowed
          }
        />

        <YesNo
          label="Alcohol Allowed"
          value={
            property.alcohol_allowed
          }
        />

        <YesNo
          label="Smoking Allowed"
          value={
            property.smoking_allowed
          }
        />

        <YesNo
          label="Quiet Hours"
          value={
            property.quiet_hours_enabled
          }
        />
      </DetailSection>

      {amenities.length > 0 && (
        <TagsSection
          title="Amenities"
          items={amenities}
        />
      )}

      {kitchen.length > 0 && (
        <TagsSection
          title="Kitchen Features"
          items={kitchen}
        />
      )}

      {houseRules.length >
        0 && (
        <TagsSection
          title="House Rules"
          items={houseRules}
        />
      )}

      <DetailSection title="Directions">
        <WideDetail
          label="Direction Instructions"
          value={
            property.direction_instructions
          }
        />
      </DetailSection>

      <DetailSection title="Dynamic Pricing">
        <YesNo
          label="Dynamic Pricing"
          value={
            property.dynamic_pricing_enabled
          }
        />

        <Detail
          label="Weekend Markup"
          value={`${Number(
            property.weekend_markup_percent ||
              0
          )}%`}
        />

        <Detail
          label="Long Weekend"
          value={`${Number(
            property.long_weekend_markup_percent ||
              0
          )}%`}
        />

        <Detail
          label="Festival"
          value={`${Number(
            property.festival_markup_percent ||
              0
          )}%`}
        />

        <Detail
          label="Season"
          value={`${Number(
            property.season_markup_percent ||
              0
          )}%`}
        />
      </DetailSection>
    </div>
  );
}

function DetailSection({
  title,
  children,
}) {
  return (
    <section className="nosDetailSection">
      <h2>{title}</h2>

      <div className="nosDetailGrid">
        {children}
      </div>
    </section>
  );
}

function Detail({
  label,
  value,
}) {
  return (
    <div className="nosDetailBox">
      <span>{label}</span>

      <strong>
        {value === null ||
        value === undefined ||
        value === ''
          ? '—'
          : String(value)}
      </strong>
    </div>
  );
}

function WideDetail({
  label,
  value,
  link = false,
}) {
  return (
    <div className="nosDetailBox nosWideDetail">
      <span>{label}</span>

      {link && value ? (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
        >
          Open Google Maps
        </a>
      ) : (
        <strong>
          {value === null ||
          value === undefined ||
          value === ''
            ? '—'
            : String(value)}
        </strong>
      )}
    </div>
  );
}

function YesNo({
  label,
  value,
}) {
  return (
    <Detail
      label={label}
      value={
        value ? 'Yes' : 'No'
      }
    />
  );
}

function TagsSection({
  title,
  items,
}) {
  return (
    <section className="nosDetailSection">
      <h2>{title}</h2>

      <div className="nosTags">
        {items.map(
          (item, index) => (
            <span
              key={`${item}-${index}`}
            >
              {item}
            </span>
          )
        )}
      </div>
    </section>
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
        background: #f7f9fc;
        color: #101828;
      }

      .nosPropertiesPage {
        min-height: calc(100vh - 140px);
        background:
          radial-gradient(
            circle at 15% 0%,
            rgba(33, 93, 162, 0.04),
            transparent 28%
          ),
          #f7f9fc;
      }

      .nosContainer {
        width: calc(100% - 64px);
        max-width: 1500px;
        margin: 0 auto;
        padding: 34px 0 60px;
      }

      .nosPageHeader,
      .nosPropertyTitle {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 25px;
        margin-bottom: 26px;
      }

      .nosEyebrow {
        color: #667085;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 1.1px;
        margin-bottom: 8px;
      }

      .nosPageHeader h1,
      .nosPropertyTitle h1 {
        margin: 0;
        color: #101828;
        font-size: 34px;
        line-height: 1.15;
        letter-spacing: -0.8px;
      }

      .nosPageHeader p,
      .nosPropertyTitle p {
        margin: 9px 0 0;
        color: #5d6b82;
        font-size: 15px;
        line-height: 1.6;
      }

      .nosRefreshButton {
        border: 0;
        border-radius: 10px;
        background: #074b91;
        color: white;
        min-height: 46px;
        padding: 0 21px;
        font-size: 14px;
        font-weight: 800;
        cursor: pointer;
      }

      .nosStatsGrid {
        display: grid;
        grid-template-columns:
          repeat(
            6,
            minmax(0, 1fr)
          );
        gap: 15px;
        margin-bottom: 18px;
      }

      .nosStatCard {
        min-height: 105px;
        border: 1px solid #dce3ec;
        border-radius: 15px;
        background: white;
        padding: 20px;

        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;

        text-align: left;
        cursor: pointer;
      }

      .nosStatCard span {
        color: #53647c;
        font-size: 12px;
        font-weight: 800;
      }

      .nosStatCard strong {
        display: block;
        margin-top: 13px;
        color: #101828;
        font-size: 27px;
      }

      .nosStatIcon {
        font-size: 31px;
        color: #155ea9;
        opacity: 0.95;
      }

      .nosStatCard.active {
        border-color: #071c3d;
        background:
          linear-gradient(
            135deg,
            #06172f,
            #0a2750
          );
      }

      .nosStatCard.active span,
      .nosStatCard.active strong,
      .nosStatCard.active .nosStatIcon {
        color: white;
      }

      .nosListHeading {
        margin: 17px 0 12px;
      }

      .nosListHeading h2 {
        margin: 0;
        font-size: 22px;
      }

      .nosListHeading p {
        margin: 4px 0 0;
        color: #667085;
        font-size: 13px;
      }

      .nosPropertyGrid {
        display: grid;
        grid-template-columns:
          repeat(
            2,
            minmax(0, 1fr)
          );
        gap: 18px;
      }

      .nosPropertyCard {
        border: 1px solid #dce3ec;
        border-radius: 16px;
        background: white;
        padding: 22px;
        box-shadow:
          0 1px 2px
          rgba(16, 24, 40, 0.02);
      }

      .nosPropertyCardHeader {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
      }

      .nosPropertyCardHeader h3 {
        margin: 0;
        color: #101828;
        font-size: 19px;
        line-height: 1.3;
      }

      .nosPropertyCardHeader p {
        margin: 6px 0 0;
        color: #607087;
        font-size: 13px;
      }

      .nosPropertyBadges,
      .nosStatusStack {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
      }

      .nosStatusBadge,
      .nosLiveBadge,
      .nosOfflineBadge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 23px;
        border-radius: 999px;
        padding: 0 10px;

        font-size: 10px;
        font-weight: 900;
        white-space: nowrap;
      }

      .nosStatusBadge.draft {
        background: #f0f2f5;
        color: #475467;
      }

      .nosStatusBadge.pending {
        background: #fff3d6;
        color: #9a5b00;
      }

      .nosStatusBadge.changes {
        background: #fff0e1;
        color: #b54708;
      }

      .nosStatusBadge.approved {
        background: #e5f7eb;
        color: #137333;
      }

      .nosStatusBadge.declined {
        background: #fee9e7;
        color: #b42318;
      }

      .nosLiveBadge {
        background: #e5f7eb;
        color: #137333;
      }

      .nosOfflineBadge {
        background: #f2f4f7;
        color: #667085;
      }

      .nosHostBox {
        margin-top: 19px;
        border: 1px solid #e1e6ed;
        border-radius: 11px;
        background: #fafbfc;
        padding: 13px 14px;

        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .nosHostBox span,
      .nosSummaryCard span,
      .nosDetailBox span,
      .nosReviewNote span {
        color: #6a788d;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.7px;
        text-transform: uppercase;
      }

      .nosHostBox strong {
        font-size: 14px;
      }

      .nosHostBox small {
        color: #5f6c7b;
        font-size: 11px;
      }

      .nosRate {
        margin: 17px 0;
        color: #0d1117;
        font-size: 26px;
        font-weight: 900;
      }

      .nosRate span {
        margin-left: 4px;
        color: #667085;
        font-size: 12px;
        font-weight: 500;
      }

      .nosFeatureGrid {
        display: grid;
        grid-template-columns:
          repeat(
            3,
            minmax(0, 1fr)
          );
        gap: 10px;
      }

      .nosMiniDetail {
        border: 1px solid #dce3ec;
        border-radius: 10px;
        padding: 11px 12px;
      }

      .nosMiniDetail strong {
        display: block;
        font-size: 17px;
      }

      .nosMiniDetail span {
        display: block;
        margin-top: 2px;
        color: #667085;
        font-size: 10px;
      }

      .nosPropertyMeta {
        border-top: 1px solid #e9edf2;
        margin-top: 16px;
        padding-top: 13px;
        display: grid;
        gap: 8px;
      }

      .nosPropertyMeta div {
        display: flex;
        justify-content: space-between;
        gap: 15px;
        font-size: 12px;
      }

      .nosPropertyMeta span {
        color: #667085;
      }

      .nosCardActions {
        display: flex;
        flex-wrap: wrap;
        gap: 9px;
        margin-top: 17px;
      }

      .nosCardActions button {
        min-height: 39px;
        padding: 0 15px;
        border: 1px solid #d5dde7;
        border-radius: 8px;
        background: white;
        color: #193351;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
      }

      .nosCardActions .nosManageButton {
        border-color: #071c3d;
        background: #071c3d;
        color: white;
      }

      .nosBack {
        border: 0;
        padding: 0;
        margin-bottom: 18px;
        background: transparent;
        color: #3f5168;
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
      }

      .nosSummaryGrid {
        display: grid;
        grid-template-columns:
          repeat(
            4,
            minmax(0, 1fr)
          );
        gap: 12px;
        margin-bottom: 18px;
      }

      .nosSummaryCard {
        min-height: 75px;
        border: 1px solid #dce3ec;
        border-radius: 11px;
        background: white;
        padding: 14px;

        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      .nosSummaryCard strong {
        font-size: 13px;
      }

      .nosSummaryCard small {
        color: #667085;
        font-size: 11px;
      }

      .nosModerationPanel {
        position: sticky;
        top: 155px;
        z-index: 20;

        border: 2px solid #0b5cab;
        border-radius: 15px;
        background: #f5f9ff;
        padding: 19px;
        margin-bottom: 20px;

        box-shadow:
          0 8px 25px
          rgba(15, 70, 130, 0.08);
      }

      .nosModerationHeading h2 {
        margin: 3px 0;
        font-size: 21px;
      }

      .nosModerationHeading p {
        margin: 0;
        color: #667085;
        font-size: 13px;
      }

      .nosReviewNote {
        display: flex;
        flex-direction: column;
        gap: 7px;
        margin-top: 15px;
      }

      .nosReviewNote textarea {
        width: 100%;
        border: 1px solid #ccd6e2;
        border-radius: 9px;
        padding: 11px;
        font: inherit;
        resize: vertical;
        background: white;
      }

      .nosModerationActions {
        display: flex;
        flex-wrap: wrap;
        gap: 9px;
        margin-top: 13px;
      }

      .nosApproveButton,
      .nosChangesButton,
      .nosDeclineButton,
      .nosOfflineButton {
        min-height: 41px;
        border-radius: 8px;
        padding: 0 16px;
        font-size: 12px;
        font-weight: 900;
        cursor: pointer;
      }

      .nosApproveButton {
        border: 1px solid #14803c;
        background: #14803c;
        color: white;
      }

      .nosChangesButton {
        border: 1px solid #d97706;
        background: #d97706;
        color: white;
      }

      .nosDeclineButton,
      .nosOfflineButton {
        border: 1px solid #b42318;
        background: #b42318;
        color: white;
      }

      .nosApprovedPanel,
      .nosChangesNote,
      .nosDeclinedNote {
        border-radius: 13px;
        padding: 16px;
        margin-bottom: 17px;
      }

      .nosApprovedPanel {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 20px;
        border: 1px solid #a6e1b8;
        background: #edf9f1;
        color: #146c35;
      }

      .nosApprovedPanel p,
      .nosChangesNote p,
      .nosDeclinedNote p {
        margin: 4px 0 0;
      }

      .nosChangesNote {
        border: 1px solid #f3c180;
        background: #fff8ed;
        color: #9a5200;
      }

      .nosDeclinedNote {
        border: 1px solid #f1aaa4;
        background: #fff4f3;
        color: #a62017;
      }

      .nosTabs {
        display: flex;
        gap: 4px;
        border-bottom: 1px solid #dde3ea;
        overflow-x: auto;
        margin-bottom: 15px;
      }

      .nosTabs button {
        border: 0;
        border-bottom: 3px solid transparent;
        background: transparent;
        color: #53647c;
        padding: 12px 15px;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
        white-space: nowrap;
      }

      .nosTabs button.active {
        border-bottom-color: #0b4d91;
        color: #0b4d91;
      }

      .nosManagerPanel,
      .nosDetailSection {
        border: 1px solid #dce3ec;
        border-radius: 14px;
        background: white;
        padding: 18px;
        margin-bottom: 14px;
      }

      .nosManagerPanel > h2,
      .nosDetailSection h2 {
        margin: 0;
        font-size: 17px;
      }

      .nosManagerPanel > p {
        margin: 5px 0 18px;
        color: #667085;
      }

      .nosDetailGrid {
        display: grid;
        grid-template-columns:
          repeat(
            3,
            minmax(0, 1fr)
          );
        gap: 9px;
        margin-top: 14px;
      }

      .nosDetailBox {
        min-width: 0;
        border: 1px solid #dde3eb;
        border-radius: 8px;
        background: #fbfcfd;
        padding: 11px 12px;

        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      .nosDetailBox strong,
      .nosDetailBox a {
        color: #101828;
        font-size: 12px;
        line-height: 1.5;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }

      .nosDetailBox a {
        color: #0b57d0;
      }

      .nosWideDetail {
        grid-column: 1 / -1;
      }

      .nosTags {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 14px;
      }

      .nosTags span {
        border: 1px solid #d5dde7;
        border-radius: 999px;
        background: #fafbfc;
        padding: 6px 10px;
        font-size: 11px;
        font-weight: 700;
      }

      .nosError,
      .nosSuccess {
        border-radius: 9px;
        padding: 12px 14px;
        margin-bottom: 15px;
        font-size: 13px;
        font-weight: 700;
      }

      .nosError {
        border: 1px solid #f0aaa4;
        background: #fff4f3;
        color: #b42318;
      }

      .nosSuccess {
        border: 1px solid #a8dfb8;
        background: #eefaf2;
        color: #137333;
      }

      .nosEmptyState,
      .nosLoading {
        border: 1px solid #dce3ec;
        border-radius: 14px;
        background: white;
        padding: 45px 20px;
        text-align: center;
      }

      .nosLoading {
        width: min(
          800px,
          calc(100% - 40px)
        );
        margin: 50px auto;
      }

      @media (max-width: 1150px) {
        .nosStatsGrid {
          grid-template-columns:
            repeat(
              3,
              minmax(0, 1fr)
            );
        }

        .nosDetailGrid {
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
        }
      }

      @media (max-width: 900px) {
        .nosPropertyGrid {
          grid-template-columns: 1fr;
        }

        .nosSummaryGrid {
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
        }
      }

      @media (max-width: 700px) {
        .nosContainer {
          width: calc(100% - 24px);
          padding-top: 22px;
        }

        .nosPageHeader,
        .nosPropertyTitle {
          flex-direction: column;
        }

        .nosPageHeader h1,
        .nosPropertyTitle h1 {
          font-size: 27px;
        }

        .nosStatsGrid {
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
        }

        .nosDetailGrid {
          grid-template-columns: 1fr;
        }

        .nosWideDetail {
          grid-column: auto;
        }

        .nosApprovedPanel {
          flex-direction: column;
          align-items: flex-start;
        }

        .nosModerationPanel {
          position: static;
        }
      }

      @media (max-width: 450px) {
        .nosStatsGrid,
        .nosSummaryGrid,
        .nosFeatureGrid {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  );
}