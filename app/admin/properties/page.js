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
  { key: 'all', label: 'All Properties' },
  { key: 'pending_review', label: 'Pending Review' },
  { key: 'live', label: 'Live' },
  { key: 'changes_requested', label: 'Changes Requested' },
  { key: 'draft', label: 'Draft' },
  { key: 'declined', label: 'Declined' },
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
    draft: 'nosapBadgeDraft',
    pending_review: 'nosapBadgePending',
    changes_requested: 'nosapBadgeChanges',
    approved: 'nosapBadgeApproved',
    declined: 'nosapBadgeDeclined',
  };

  return map[status] || 'nosapBadgeDraft';
}

function hostName(property) {
  return (
    property?._host?.business_name ||
    property?._host?.full_name ||
    (property?.host_id ? 'Host' : 'No Host Assigned')
  );
}

export default function AdminPropertiesPage() {
  const [session, setSession] = useState(null);
  const [admin, setAdmin] = useState(null);

  const [properties, setProperties] = useState([]);
  const [selected, setSelected] = useState(null);

  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState('review');

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

      if (sessionError) throw sessionError;

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
        .select('user_id, full_name, role, is_active')
        .eq('user_id', currentSession.user.id)
        .eq('is_active', true)
        .single();

      if (adminError || !adminData) {
        throw new Error('Active Admin account not found.');
      }

      if (adminData.role !== 'super_admin') {
        throw new Error(
          'Only the Super Admin can access Property Moderation.'
        );
      }

      setAdmin(adminData);

      await loadProperties();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Unable to open Property Management.');
    } finally {
      setChecking(false);
    }
  }

  async function loadProperties() {
    setLoading(true);

    try {
      const {
        data: propertyRows,
        error: propertyError,
      } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

      if (propertyError) throw propertyError;

      const rows = propertyRows || [];

      const hostIds = [
        ...new Set(rows.map((item) => item.host_id).filter(Boolean)),
      ];

      const hostMap = {};

      if (hostIds.length > 0) {
        const {
          data: hostRows,
          error: hostError,
        } = await supabase
          .from('host_profiles')
          .select(
            'id, user_id, full_name, business_name, phone, email, city, state, status'
          )
          .in('id', hostIds);

        if (hostError) throw hostError;

        (hostRows || []).forEach((host) => {
          hostMap[host.id] = host;
        });
      }

      const enriched = rows.map((property) => ({
        ...property,
        moderation_status: property.moderation_status || 'draft',
        _host: property.host_id ? hostMap[property.host_id] || null : null,
      }));

      setProperties(enriched);

      if (selected?.id) {
        const refreshed = enriched.find(
          (property) => property.id === selected.id
        );

        if (refreshed) {
          setSelected(refreshed);
          setReviewNote(refreshed.moderation_notes || '');
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Unable to load properties.');
    } finally {
      setLoading(false);
    }
  }

  function openProperty(property, nextTab = 'review') {
    setSelected(property);
    setTab(nextTab);
    setReviewNote(property.moderation_notes || '');
    setError('');
    setSuccess('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function closeProperty() {
    setSelected(null);
    setTab('review');
    setReviewNote('');
    setError('');
    setSuccess('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function updateModeration(action) {
    if (!selected?.id || !session?.user?.id) return;

    setError('');
    setSuccess('');

    const note = reviewNote.trim();

    if (
      (action === 'changes_requested' || action === 'declined') &&
      !note
    ) {
      setError(
        action === 'changes_requested'
          ? 'Please enter the changes required for the Host.'
          : 'Please enter the reason for declining this property.'
      );
      return;
    }

    let confirmation = '';

    if (action === 'approved') {
      confirmation =
        'Approve this property and make it live for guests?';
    }

    if (action === 'changes_requested') {
      confirmation =
        'Return this property to the Host for the requested changes?';
    }

    if (action === 'declined') {
      confirmation =
        'Decline this property? It will remain offline.';
    }

    if (!window.confirm(confirmation)) return;

    setWorking(true);

    try {
      const now = new Date().toISOString();

      let payload;

      if (action === 'approved') {
        payload = {
          moderation_status: 'approved',
          moderation_notes: null,
          is_active: true,
          reviewed_at: now,
          reviewed_by: session.user.id,
          updated_at: now,
        };
      } else if (action === 'changes_requested') {
        payload = {
          moderation_status: 'changes_requested',
          moderation_notes: note,
          is_active: false,
          reviewed_at: now,
          reviewed_by: session.user.id,
          updated_at: now,
        };
      } else {
        payload = {
          moderation_status: 'declined',
          moderation_notes: note,
          is_active: false,
          reviewed_at: now,
          reviewed_by: session.user.id,
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

      if (updateError) throw updateError;

      const updated = {
        ...selected,
        ...data,
      };

      setSelected(updated);
      setReviewNote(data.moderation_notes || '');

      setSuccess(
        action === 'approved'
          ? 'Property approved and made live successfully.'
          : action === 'changes_requested'
            ? 'Changes requested successfully. The Host can now edit and resubmit the property.'
            : 'Property declined successfully.'
      );

      await loadProperties();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Unable to update property moderation.');
    } finally {
      setWorking(false);
    }
  }

  async function setLiveState(makeLive) {
    if (!selected?.id) return;

    if (selected.moderation_status !== 'approved') {
      setError('Only an approved property can be made live.');
      return;
    }

    const message = makeLive
      ? 'Make this approved property live?'
      : 'Take this property offline?';

    if (!window.confirm(message)) return;

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
          updated_at: new Date().toISOString(),
        })
        .eq('id', selected.id)
        .select('*')
        .single();

      if (updateError) throw updateError;

      setSelected((previous) => ({
        ...previous,
        ...data,
      }));

      setSuccess(
        makeLive
          ? 'Property is now live.'
          : 'Property has been taken offline.'
      );

      await loadProperties();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Unable to update property visibility.');
    } finally {
      setWorking(false);
    }
  }

  const counts = useMemo(() => {
    return {
      all: properties.length,

      pending_review: properties.filter(
        (property) => property.moderation_status === 'pending_review'
      ).length,

      live: properties.filter(
        (property) =>
          property.moderation_status === 'approved' &&
          property.is_active === true
      ).length,

      changes_requested: properties.filter(
        (property) =>
          property.moderation_status === 'changes_requested'
      ).length,

      draft: properties.filter(
        (property) => property.moderation_status === 'draft'
      ).length,

      declined: properties.filter(
        (property) => property.moderation_status === 'declined'
      ).length,
    };
  }, [properties]);

  const filteredProperties = useMemo(() => {
    if (filter === 'all') return properties;

    if (filter === 'live') {
      return properties.filter(
        (property) =>
          property.moderation_status === 'approved' &&
          property.is_active === true
      );
    }

    return properties.filter(
      (property) => property.moderation_status === filter
    );
  }, [properties, filter]);

  if (checking) {
    return (
      <>
        <main className="nosapPage">
          <div className="nosapLoading">
            Loading Super Admin Property Management...
          </div>
        </main>

        <Styles />
      </>
    );
  }

  if (!admin) {
    return (
      <>
        <main className="nosapPage">
          <div className="nosapLoading">
            <h2>Access Denied</h2>
            <p>{error || 'Super Admin access is required.'}</p>

            <a href="/login" className="nosapPrimary">
              Go to Login
            </a>
          </div>
        </main>

        <Styles />
      </>
    );
  }

  if (selected) {
    return (
      <>
        <main className="nosapPage">
          <div className="nosapContainer">
            <button
              type="button"
              className="nosapBack"
              onClick={closeProperty}
            >
              ← Back to Properties
            </button>

            <div className="nosapPropertyHeader">
              <div>
                <div className="nosapEyebrow">
                  SUPER ADMIN PROPERTY MANAGEMENT
                </div>

                <h1>{selected.name}</h1>

                <p>
                  {selected.area || selected.location_name || 'Location'}
                  {selected.city ? `, ${selected.city}` : ''}
                </p>
              </div>

              <div className="nosapHeaderBadges">
                <span
                  className={`nosapBadge ${statusClass(
                    selected.moderation_status
                  )}`}
                >
                  {statusLabel(selected.moderation_status)}
                </span>

                <span
                  className={
                    selected.is_active
                      ? 'nosapLiveBadge'
                      : 'nosapOfflineBadge'
                  }
                >
                  {selected.is_active ? 'LIVE' : 'OFFLINE'}
                </span>
              </div>
            </div>

            <div className="nosapSummaryGrid">
              <Summary
                label="Host"
                value={hostName(selected)}
                sub={
                  selected._host?.phone ||
                  selected._host?.email ||
                  ''
                }
              />

              <Summary
                label="Nightly Rate"
                value={`₹${money(selected.base_price)}`}
              />

              <Summary
                label="Submitted"
                value={formatDate(
                  selected.submitted_for_review_at
                )}
              />

              <Summary
                label="Reviewed"
                value={formatDate(selected.reviewed_at)}
              />
            </div>

            {error && <div className="nosapError">{error}</div>}
            {success && <div className="nosapSuccess">{success}</div>}

            {selected.moderation_status === 'pending_review' && (
              <section className="nosapReviewPanel">
                <div>
                  <div className="nosapEyebrow">PROPERTY REVIEW</div>
                  <h2>Review Host Submission</h2>

                  <p>
                    Check the property information and photos before
                    approving the listing.
                  </p>
                </div>

                <label className="nosapNoteField">
                  <span>Notes to Host</span>

                  <textarea
                    rows="4"
                    value={reviewNote}
                    onChange={(event) =>
                      setReviewNote(event.target.value)
                    }
                    placeholder="Required when requesting changes or declining."
                  />
                </label>

                <div className="nosapReviewActions">
                  <button
                    type="button"
                    className="nosapApprove"
                    disabled={working}
                    onClick={() => updateModeration('approved')}
                  >
                    {working
                      ? 'Processing...'
                      : 'Approve & Make Live'}
                  </button>

                  <button
                    type="button"
                    className="nosapChanges"
                    disabled={working}
                    onClick={() =>
                      updateModeration('changes_requested')
                    }
                  >
                    Request Changes
                  </button>

                  <button
                    type="button"
                    className="nosapDecline"
                    disabled={working}
                    onClick={() => updateModeration('declined')}
                  >
                    Decline Property
                  </button>
                </div>
              </section>
            )}

            {selected.moderation_status === 'changes_requested' && (
              <section className="nosapMessage nosapMessageChanges">
                <strong>Changes Requested</strong>

                <p>
                  {selected.moderation_notes ||
                    'No moderation note available.'}
                </p>

                <small>
                  The Host can edit this property and submit it again
                  for review.
                </small>
              </section>
            )}

            {selected.moderation_status === 'declined' && (
              <section className="nosapMessage nosapMessageDeclined">
                <strong>Property Declined</strong>

                <p>
                  {selected.moderation_notes ||
                    'No decline reason available.'}
                </p>
              </section>
            )}

            {selected.moderation_status === 'approved' && (
              <section className="nosapMessage nosapMessageApproved">
                <div>
                  <strong>Property Approved</strong>

                  <p>
                    {selected.is_active
                      ? 'This property is approved and visible to guests.'
                      : 'This property is approved but currently offline.'}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={working}
                  className={
                    selected.is_active
                      ? 'nosapSecondary'
                      : 'nosapApprove'
                  }
                  onClick={() => setLiveState(!selected.is_active)}
                >
                  {selected.is_active
                    ? 'Take Property Offline'
                    : 'Make Property Live'}
                </button>
              </section>
            )}

            <nav className="nosapTabs">
              <button
                type="button"
                className={tab === 'review' ? 'active' : ''}
                onClick={() => setTab('review')}
              >
                Property Details
              </button>

              <button
                type="button"
                className={tab === 'photos' ? 'active' : ''}
                onClick={() => setTab('photos')}
              >
                Photos
              </button>

              <button
                type="button"
                className={tab === 'offers' ? 'active' : ''}
                onClick={() => setTab('offers')}
              >
                Pricing & Offers
              </button>

              <button
                type="button"
                className={tab === 'calendar' ? 'active' : ''}
                onClick={() => setTab('calendar')}
              >
                Calendar
              </button>
            </nav>

            {tab === 'review' && (
              <PropertyDetails property={selected} />
            )}

            {tab === 'photos' && (
              <section className="nosapManager">
                <div className="nosapManagerHeading">
                  <h2>Property Photos</h2>
                  <p>Review and manage the property photos.</p>
                </div>

                <PropertyPhotoManager
                  propertyId={selected.id}
                  propertyName={selected.name}
                />
              </section>
            )}

            {tab === 'offers' && (
              <section className="nosapManager">
                <div className="nosapManagerHeading">
                  <h2>Pricing & Offers</h2>
                  <p>
                    Manage pricing and offers for this property.
                  </p>
                </div>

                <PropertyDiscountManager
                  propertyId={selected.id}
                  propertyName={selected.name}
                />
              </section>
            )}

            {tab === 'calendar' && (
              <section className="nosapManager">
                <div className="nosapManagerHeading">
                  <h2>Property Calendar</h2>
                  <p>
                    Manage availability and date-wise pricing.
                  </p>
                </div>

                <PropertyCalendarManager
                  propertyId={selected.id}
                  propertyName={selected.name}
                />
              </section>
            )}
          </div>
        </main>

        <Styles />
      </>
    );
  }

  return (
    <>
      <main className="nosapPage">
        <div className="nosapContainer">
          <div className="nosapTitleRow">
            <div>
              <div className="nosapEyebrow">
                SUPER ADMIN
              </div>

              <h1>Property Management</h1>

              <p>
                Review Host properties and control which listings
                become live on NightOutStays.
              </p>
            </div>

            <button
              type="button"
              className="nosapSecondary"
              onClick={loadProperties}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {error && <div className="nosapError">{error}</div>}

          <div className="nosapStats">
            {FILTERS.map((item) => (
              <button
                type="button"
                key={item.key}
                className={
                  filter === item.key
                    ? 'nosapStat nosapStatActive'
                    : 'nosapStat'
                }
                onClick={() => setFilter(item.key)}
              >
                <span>{item.label}</span>
                <strong>{counts[item.key]}</strong>
              </button>
            ))}
          </div>

          <div className="nosapListHeading">
            <div>
              <h2>
                {FILTERS.find((item) => item.key === filter)?.label}
              </h2>

              <p>
                {filteredProperties.length}{' '}
                {filteredProperties.length === 1
                  ? 'property'
                  : 'properties'}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="nosapLoading">
              Loading properties...
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="nosapEmpty">
              <h3>No properties found</h3>
              <p>There are no properties in this category.</p>
            </div>
          ) : (
            <div className="nosapGrid">
              {filteredProperties.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  onOpen={openProperty}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <Styles />
    </>
  );
}

function Summary({ label, value, sub }) {
  return (
    <div className="nosapSummary">
      <span>{label}</span>
      <strong>{value || '—'}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

function PropertyCard({ property, onOpen }) {
  return (
    <article className="nosapCard">
      <div className="nosapCardTop">
        <div>
          <h3>{property.name}</h3>

          <p>
            {property.area ||
              property.location_name ||
              'Location not added'}
            {property.city ? `, ${property.city}` : ''}
          </p>
        </div>

        <div className="nosapCardBadges">
          <span
            className={`nosapBadge ${statusClass(
              property.moderation_status
            )}`}
          >
            {statusLabel(property.moderation_status)}
          </span>

          <span
            className={
              property.is_active
                ? 'nosapLiveBadge'
                : 'nosapOfflineBadge'
            }
          >
            {property.is_active ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      <div className="nosapHost">
        <span>HOST</span>
        <strong>{hostName(property)}</strong>

        {property._host?.city && (
          <small>
            {property._host.city}
            {property._host.state
              ? `, ${property._host.state}`
              : ''}
          </small>
        )}
      </div>

      <div className="nosapPrice">
        ₹{money(property.base_price)}
        <small>/ night</small>
      </div>

      <div className="nosapMiniGrid">
        <div>
          <strong>{property.bedrooms || 0}</strong>
          <span>Bedrooms</span>
        </div>

        <div>
          <strong>{property.bathrooms || 0}</strong>
          <span>Bathrooms</span>
        </div>

        <div>
          <strong>{property.max_guests || 0}</strong>
          <span>Guests</span>
        </div>
      </div>

      <div className="nosapCardMeta">
        <div>
          <span>Property Type</span>
          <strong>{property.property_type || '—'}</strong>
        </div>

        <div>
          <span>Submitted</span>
          <strong>
            {formatDate(property.submitted_for_review_at)}
          </strong>
        </div>
      </div>

      {property.moderation_status === 'pending_review' && (
        <div className="nosapPendingNotice">
          Awaiting Super Admin Review
        </div>
      )}

      {property.moderation_status === 'changes_requested' &&
        property.moderation_notes && (
          <div className="nosapSmallNote">
            <strong>Changes requested</strong>
            <span>{property.moderation_notes}</span>
          </div>
        )}

      <div className="nosapCardActions">
        <button
          type="button"
          className={
            property.moderation_status === 'pending_review'
              ? 'nosapReviewButton'
              : 'nosapPrimary'
          }
          onClick={() => onOpen(property, 'review')}
        >
          {property.moderation_status === 'pending_review'
            ? 'Review Property'
            : 'Manage Property'}
        </button>

        <button
          type="button"
          className="nosapSecondary"
          onClick={() => onOpen(property, 'photos')}
        >
          Photos
        </button>

        <button
          type="button"
          className="nosapSecondary"
          onClick={() => onOpen(property, 'offers')}
        >
          Offers
        </button>

        <button
          type="button"
          className="nosapSecondary"
          onClick={() => onOpen(property, 'calendar')}
        >
          Calendar
        </button>
      </div>
    </article>
  );
}

function PropertyDetails({ property }) {
  const houseRules = Array.isArray(property.house_rules)
    ? property.house_rules
    : [];

  const amenities = Array.isArray(property.amenities)
    ? property.amenities
    : [];

  const kitchen = Array.isArray(property.kitchen_features)
    ? property.kitchen_features
    : [];

  return (
    <div className="nosapDetails">
      <DetailSection title="Property Information">
        <Detail label="Property Name" value={property.name} />
        <Detail
          label="Property Type"
          value={property.property_type}
        />
        <Detail label="City" value={property.city} />
        <Detail label="Area" value={property.area} />
        <Detail
          label="Display Location"
          value={property.location_name}
        />
        <Detail
          label="Nightly Rate"
          value={`₹${money(property.base_price)}`}
        />
      </DetailSection>

      <DetailSection title="Description">
        <DetailWide
          label="Short Description"
          value={property.short_description}
        />

        <DetailWide
          label="Full Description"
          value={property.description}
        />
      </DetailSection>

      <DetailSection title="Address & Location">
        <DetailWide label="Address" value={property.address} />

        <DetailWide
          label="Google Maps"
          value={property.google_maps_url}
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
        <Detail label="Bedrooms" value={property.bedrooms} />
        <Detail label="Bathrooms" value={property.bathrooms} />
        <Detail
          label="Minimum Guests"
          value={property.min_guests}
        />
        <Detail
          label="Guests Included"
          value={property.included_guests}
        />
        <Detail
          label="Maximum Guests"
          value={property.max_guests}
        />
        <Detail
          label="Queen Beds"
          value={property.queen_bed_count}
        />
        <Detail
          label="Single Beds"
          value={property.single_bed_count}
        />
        <Detail
          label="Sofa Cum Beds"
          value={property.sofa_cum_bed_count}
        />
      </DetailSection>

      <DetailSection title="Pricing">
        <Detail
          label="Base Rate"
          value={`₹${money(property.base_price)}`}
        />

        <Detail
          label="Extra Guest Fee"
          value={`₹${money(property.extra_guest_fee)}`}
        />

        <Detail
          label="Cleaning Fee"
          value={`₹${money(property.cleaning_fee)}`}
        />

        <Detail
          label="Security Deposit"
          value={`₹${money(property.security_deposit)}`}
        />

        <Detail
          label="Minimum Nights"
          value={property.min_stay_nights}
        />

        <Detail
          label="Maximum Nights"
          value={property.max_stay_nights}
        />

        <Detail
          label="Late Checkout / Hour"
          value={`₹${money(property.late_checkout_hourly_fee)}`}
        />
      </DetailSection>

      <DetailSection title="Check-in & Check-out">
        <Detail
          label="Check-in"
          value={property.check_in_time}
        />

        <Detail
          label="Check-out"
          value={property.check_out_time}
        />
      </DetailSection>

      <DetailSection title="Facilities">
        <BooleanDetail label="Wi-Fi" value={property.wifi_available} />
        <BooleanDetail label="TV" value={property.tv_available} />
        <BooleanDetail
          label="Fridge"
          value={property.fridge_available}
        />
        <BooleanDetail
          label="Washing Machine"
          value={property.washing_machine_available}
        />
        <BooleanDetail label="AC" value={property.ac_available} />
        <Detail label="AC Count" value={property.ac_count} />
        <Detail
          label="Water Heaters"
          value={property.water_heater_count}
        />
      </DetailSection>

      <DetailSection title="Guest Policies">
        <BooleanDetail
          label="Pets Allowed"
          value={property.pets_allowed}
        />
        <BooleanDetail
          label="Parties Allowed"
          value={property.parties_allowed}
        />
        <BooleanDetail
          label="Couples Allowed"
          value={property.couples_allowed}
        />
        <BooleanDetail
          label="Alcohol Allowed"
          value={property.alcohol_allowed}
        />
        <BooleanDetail
          label="Smoking Allowed"
          value={property.smoking_allowed}
        />
        <BooleanDetail
          label="Quiet Hours"
          value={property.quiet_hours_enabled}
        />
      </DetailSection>

      {amenities.length > 0 && (
        <TagSection title="Amenities" items={amenities} />
      )}

      {kitchen.length > 0 && (
        <TagSection title="Kitchen Features" items={kitchen} />
      )}

      {houseRules.length > 0 && (
        <TagSection title="House Rules" items={houseRules} />
      )}

      <DetailSection title="Directions">
        <DetailWide
          label="Direction Instructions"
          value={property.direction_instructions}
        />
      </DetailSection>

      <DetailSection title="Dynamic Pricing">
        <BooleanDetail
          label="Dynamic Pricing"
          value={property.dynamic_pricing_enabled}
        />

        <Detail
          label="Weekend Markup"
          value={`${Number(
            property.weekend_markup_percent || 0
          )}%`}
        />

        <Detail
          label="Long Weekend"
          value={`${Number(
            property.long_weekend_markup_percent || 0
          )}%`}
        />

        <Detail
          label="Festival"
          value={`${Number(
            property.festival_markup_percent || 0
          )}%`}
        />

        <Detail
          label="Season"
          value={`${Number(
            property.season_markup_percent || 0
          )}%`}
        />
      </DetailSection>
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <section className="nosapDetailSection">
      <h2>{title}</h2>
      <div className="nosapDetailGrid">{children}</div>
    </section>
  );
}

function Detail({ label, value }) {
  return (
    <div className="nosapDetail">
      <span>{label}</span>
      <strong>
        {value === null || value === undefined || value === ''
          ? '—'
          : String(value)}
      </strong>
    </div>
  );
}

function DetailWide({ label, value, link = false }) {
  return (
    <div className="nosapDetail nosapDetailWide">
      <span>{label}</span>

      {link && value ? (
        <a href={value} target="_blank" rel="noreferrer">
          Open Google Maps
        </a>
      ) : (
        <strong>
          {value === null || value === undefined || value === ''
            ? '—'
            : String(value)}
        </strong>
      )}
    </div>
  );
}

function BooleanDetail({ label, value }) {
  return (
    <Detail
      label={label}
      value={value ? 'Yes' : 'No'}
    />
  );
}

function TagSection({ title, items }) {
  return (
    <section className="nosapDetailSection">
      <h2>{title}</h2>

      <div className="nosapTags">
        {items.map((item, index) => (
          <span key={`${item}-${index}`}>{item}</span>
        ))}
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
      }

      .nosapPage {
        min-height: 100vh;
        background: #f5f6f8;
        color: #111827;
      }

      .nosapContainer {
        width: min(1500px, calc(100% - 48px));
        margin: 0 auto;
        padding: 34px 0 70px;
      }

      .nosapTitleRow {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 24px;
      }

      .nosapTitleRow h1,
      .nosapPropertyHeader h1 {
        margin: 4px 0 7px;
        font-size: 31px;
        line-height: 1.15;
        letter-spacing: -0.5px;
      }

      .nosapTitleRow p,
      .nosapPropertyHeader p {
        margin: 0;
        color: #6b7280;
        line-height: 1.55;
      }

      .nosapEyebrow {
        font-size: 10px;
        letter-spacing: 0.9px;
        font-weight: 900;
        color: #6b7280;
      }

      .nosapStats {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 24px;
      }

      .nosapStat {
        appearance: none;
        border: 1px solid #e5e7eb;
        background: #ffffff;
        border-radius: 14px;
        padding: 17px;
        text-align: left;
        cursor: pointer;
        transition: 0.15s ease;
      }

      .nosapStat:hover {
        border-color: #9ca3af;
        transform: translateY(-1px);
      }

      .nosapStat span {
        display: block;
        font-size: 11px;
        font-weight: 800;
        color: #6b7280;
        line-height: 1.3;
      }

      .nosapStat strong {
        display: block;
        margin-top: 7px;
        font-size: 27px;
        color: #111827;
      }

      .nosapStatActive {
        border-color: #111827;
        background: #111827;
      }

      .nosapStatActive span,
      .nosapStatActive strong {
        color: #ffffff;
      }

      .nosapListHeading {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 20px;
        margin-bottom: 15px;
      }

      .nosapListHeading h2 {
        margin: 0 0 4px;
        font-size: 20px;
      }

      .nosapListHeading p {
        margin: 0;
        color: #6b7280;
        font-size: 13px;
      }

      .nosapGrid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 17px;
      }

      .nosapCard {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 17px;
        padding: 20px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
      }

      .nosapCardTop {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 18px;
      }

      .nosapCardTop h3 {
        margin: 0 0 5px;
        font-size: 18px;
        line-height: 1.3;
      }

      .nosapCardTop p {
        margin: 0;
        color: #6b7280;
        font-size: 13px;
      }

      .nosapCardBadges,
      .nosapHeaderBadges {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
        flex-shrink: 0;
      }

      .nosapBadge,
      .nosapLiveBadge,
      .nosapOfflineBadge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 10px;
        line-height: 1;
        font-weight: 900;
        white-space: nowrap;
      }

      .nosapBadgeDraft {
        background: #f3f4f6;
        color: #4b5563;
      }

      .nosapBadgePending {
        background: #fef3c7;
        color: #92400e;
      }

      .nosapBadgeChanges {
        background: #ffedd5;
        color: #9a3412;
      }

      .nosapBadgeApproved {
        background: #dcfce7;
        color: #166534;
      }

      .nosapBadgeDeclined {
        background: #fee2e2;
        color: #991b1b;
      }

      .nosapLiveBadge {
        background: #dcfce7;
        color: #166534;
      }

      .nosapOfflineBadge {
        background: #f3f4f6;
        color: #6b7280;
      }

      .nosapHost {
        display: flex;
        flex-direction: column;
        gap: 3px;
        margin-top: 15px;
        padding: 12px 13px;
        border: 1px solid #f0f1f3;
        border-radius: 11px;
        background: #f9fafb;
      }

      .nosapHost span,
      .nosapSummary span,
      .nosapDetail span,
      .nosapNoteField > span {
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.6px;
        color: #6b7280;
        text-transform: uppercase;
      }

      .nosapHost strong {
        font-size: 14px;
      }

      .nosapHost small {
        color: #6b7280;
        font-size: 11px;
      }

      .nosapPrice {
        margin-top: 16px;
        font-size: 25px;
        font-weight: 900;
      }

      .nosapPrice small {
        margin-left: 5px;
        color: #6b7280;
        font-size: 11px;
        font-weight: 600;
      }

      .nosapMiniGrid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin-top: 14px;
      }

      .nosapMiniGrid > div {
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .nosapMiniGrid strong {
        font-size: 16px;
      }

      .nosapMiniGrid span {
        color: #6b7280;
        font-size: 10px;
      }

      .nosapCardMeta {
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid #f0f0f0;
        display: grid;
        gap: 8px;
      }

      .nosapCardMeta > div {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 15px;
        font-size: 12px;
      }

      .nosapCardMeta span {
        color: #6b7280;
      }

      .nosapCardMeta strong {
        text-align: right;
        font-weight: 700;
      }

      .nosapPendingNotice {
        margin-top: 14px;
        border: 1px solid #f59e0b;
        background: #fffbeb;
        color: #92400e;
        border-radius: 10px;
        padding: 10px 12px;
        font-size: 12px;
        font-weight: 900;
      }

      .nosapSmallNote {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-top: 14px;
        border: 1px solid #fed7aa;
        background: #fff7ed;
        color: #9a3412;
        border-radius: 10px;
        padding: 11px 12px;
        font-size: 12px;
      }

      .nosapCardActions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 17px;
      }

      .nosapPrimary,
      .nosapSecondary,
      .nosapReviewButton,
      .nosapApprove,
      .nosapChanges,
      .nosapDecline {
        appearance: none;
        border-radius: 9px;
        padding: 10px 13px;
        font: inherit;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
        text-decoration: none;
      }

      .nosapPrimary {
        border: 1px solid #111827;
        background: #111827;
        color: #ffffff;
      }

      .nosapSecondary {
        border: 1px solid #d1d5db;
        background: #ffffff;
        color: #374151;
      }

      .nosapReviewButton {
        border: 1px solid #d97706;
        background: #d97706;
        color: #ffffff;
      }

      .nosapApprove {
        border: 1px solid #15803d;
        background: #15803d;
        color: #ffffff;
      }

      .nosapChanges {
        border: 1px solid #d97706;
        background: #d97706;
        color: #ffffff;
      }

      .nosapDecline {
        border: 1px solid #b91c1c;
        background: #b91c1c;
        color: #ffffff;
      }

      .nosapPrimary:disabled,
      .nosapSecondary:disabled,
      .nosapReviewButton:disabled,
      .nosapApprove:disabled,
      .nosapChanges:disabled,
      .nosapDecline:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .nosapLoading,
      .nosapEmpty {
        width: 100%;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 16px;
        padding: 40px 25px;
        text-align: center;
      }

      .nosapLoading {
        width: min(900px, calc(100% - 40px));
        margin: 60px auto;
      }

      .nosapLoading h2,
      .nosapEmpty h3 {
        margin: 0 0 7px;
      }

      .nosapLoading p,
      .nosapEmpty p {
        margin: 0 0 15px;
        color: #6b7280;
      }

      .nosapBack {
        appearance: none;
        border: 0;
        background: transparent;
        color: #4b5563;
        padding: 0;
        margin-bottom: 19px;
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
      }

      .nosapPropertyHeader {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 18px;
      }

      .nosapSummaryGrid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 18px;
      }

      .nosapSummary {
        display: flex;
        flex-direction: column;
        gap: 5px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 14px;
        min-width: 0;
      }

      .nosapSummary strong {
        font-size: 13px;
        overflow-wrap: anywhere;
      }

      .nosapSummary small {
        color: #6b7280;
        font-size: 11px;
        overflow-wrap: anywhere;
      }

      .nosapError,
      .nosapSuccess {
        border-radius: 11px;
        padding: 12px 14px;
        margin-bottom: 16px;
        font-size: 13px;
        font-weight: 700;
      }

      .nosapError {
        border: 1px solid #fecaca;
        background: #fef2f2;
        color: #991b1b;
      }

      .nosapSuccess {
        border: 1px solid #bbf7d0;
        background: #f0fdf4;
        color: #166534;
      }

      .nosapReviewPanel {
        margin-bottom: 18px;
        border: 2px solid #f59e0b;
        border-radius: 16px;
        background: #fffbeb;
        padding: 21px;
      }

      .nosapReviewPanel h2 {
        margin: 5px 0 5px;
        font-size: 21px;
      }

      .nosapReviewPanel p {
        margin: 0;
        color: #6b7280;
        line-height: 1.5;
      }

      .nosapNoteField {
        display: flex;
        flex-direction: column;
        gap: 7px;
        margin-top: 17px;
      }

      .nosapNoteField textarea {
        width: 100%;
        resize: vertical;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        background: #ffffff;
        color: #111827;
        padding: 12px;
        font: inherit;
        outline: none;
      }

      .nosapNoteField textarea:focus {
        border-color: #111827;
        box-shadow: 0 0 0 2px rgba(17, 24, 39, 0.07);
      }

      .nosapReviewActions {
        display: flex;
        flex-wrap: wrap;
        gap: 9px;
        margin-top: 14px;
      }

      .nosapMessage {
        margin-bottom: 18px;
        border-radius: 14px;
        padding: 16px;
      }

      .nosapMessage strong {
        display: block;
        margin-bottom: 5px;
      }

      .nosapMessage p {
        margin: 0 0 5px;
        line-height: 1.5;
      }

      .nosapMessage small {
        font-size: 12px;
      }

      .nosapMessageChanges {
        border: 1px solid #fdba74;
        background: #fff7ed;
        color: #9a3412;
      }

      .nosapMessageDeclined {
        border: 1px solid #fca5a5;
        background: #fef2f2;
        color: #991b1b;
      }

      .nosapMessageApproved {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 15px;
        border: 1px solid #86efac;
        background: #f0fdf4;
        color: #166534;
      }

      .nosapTabs {
        display: flex;
        gap: 4px;
        overflow-x: auto;
        margin-bottom: 18px;
        border-bottom: 1px solid #e5e7eb;
      }

      .nosapTabs button {
        appearance: none;
        border: 0;
        border-bottom: 3px solid transparent;
        background: transparent;
        color: #6b7280;
        padding: 12px 14px;
        font: inherit;
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
        white-space: nowrap;
      }

      .nosapTabs button.active {
        color: #111827;
        border-bottom-color: #111827;
      }

      .nosapManager,
      .nosapDetailSection {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 16px;
        padding: 21px;
        margin-bottom: 16px;
      }

      .nosapManagerHeading {
        margin-bottom: 18px;
      }

      .nosapManagerHeading h2,
      .nosapDetailSection h2 {
        margin: 0 0 5px;
        font-size: 18px;
      }

      .nosapManagerHeading p {
        margin: 0;
        color: #6b7280;
      }

      .nosapDetails {
        display: flex;
        flex-direction: column;
        gap: 0;
      }

      .nosapDetailGrid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 15px;
      }

      .nosapDetail {
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        background: #f9fafb;
        padding: 12px;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      .nosapDetail strong,
      .nosapDetail a {
        color: #111827;
        font-size: 13px;
        font-weight: 700;
        line-height: 1.45;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }

      .nosapDetail a {
        color: #1d4ed8;
      }

      .nosapDetailWide {
        grid-column: 1 / -1;
      }

      .nosapTags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 15px;
      }

      .nosapTags span {
        border: 1px solid #d1d5db;
        background: #f9fafb;
        border-radius: 999px;
        padding: 7px 10px;
        font-size: 12px;
        font-weight: 700;
      }

      @media (max-width: 1200px) {
        .nosapStats {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .nosapDetailGrid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 950px) {
        .nosapGrid {
          grid-template-columns: 1fr;
        }

        .nosapSummaryGrid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 700px) {
        .nosapContainer {
          width: min(100% - 24px, 1500px);
          padding: 24px 0 50px;
        }

        .nosapTitleRow,
        .nosapPropertyHeader {
          flex-direction: column;
        }

        .nosapHeaderBadges,
        .nosapCardBadges {
          flex-direction: row;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .nosapStats {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .nosapSummaryGrid,
        .nosapDetailGrid {
          grid-template-columns: 1fr;
        }

        .nosapDetailWide {
          grid-column: auto;
        }

        .nosapMessageApproved {
          flex-direction: column;
          align-items: flex-start;
        }

        .nosapReviewActions button {
          width: 100%;
        }

        .nosapTitleRow h1,
        .nosapPropertyHeader h1 {
          font-size: 26px;
        }
      }

      @media (max-width: 450px) {
        .nosapStats {
          grid-template-columns: 1fr;
        }

        .nosapMiniGrid {
          grid-template-columns: 1fr 1fr;
        }

        .nosapCardTop {
          flex-direction: column;
        }
      }
    `}</style>
  );
}