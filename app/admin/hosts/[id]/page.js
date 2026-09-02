'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

const PROPERTY_FILTERS = [
  { key: 'all', label: 'All Properties' },
  { key: 'live', label: 'Live' },
  { key: 'pending_review', label: 'Pending Review' },
  { key: 'draft', label: 'Draft' },
  { key: 'changes_requested', label: 'Changes Requested' },
  { key: 'declined', label: 'Declined' },
];

const BOOKING_FILTERS = [
  { key: 'all', label: 'All Bookings' },
  { key: 'requests', label: 'Booking Requests' },
  { key: 'payment_pending', label: 'Approved / Payment Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'cancelled', label: 'Cancelled / Declined' },
  { key: 'discount', label: 'Discount Requests' },
  { key: 'offers', label: 'Special Offers' },
];

export default function AdminHostDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const hostId =
    typeof params?.id === 'string'
      ? params.id
      : '';

  const [host, setHost] = useState(null);
  const [properties, setProperties] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);

  const [adminProfile, setAdminProfile] = useState(null);
  const [hostPermission, setHostPermission] = useState(null);

  const [propertyFilter, setPropertyFilter] = useState('all');
  const [propertySearch, setPropertySearch] = useState('');

  const [bookingPropertyId, setBookingPropertyId] = useState('all');
  const [bookingFilter, setBookingFilter] = useState('all');
  const [bookingSearch, setBookingSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusError, setStatusError] = useState('');

  const [error, setError] = useState('');

  useEffect(() => {
    if (hostId) {
      loadHostPage();
    }
  }, [hostId]);

  async function loadHostPage(refresh = false) {
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
        router.replace('/admin/login');
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
              item.role === 'super_admin' ||
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
        data: adminRow,
        error: adminError,
      } = await supabase
        .from('admin_profiles')
        .select(`
          user_id,
          role,
          full_access,
          is_active
        `)
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (adminError) {
        throw adminError;
      }

      if (
        !adminRow ||
        adminRow.is_active !== true
      ) {
        throw new Error(
          'Active Admin account required.'
        );
      }

      let permissionRow = null;

      if (
        adminRow.role !== 'super_admin' &&
        adminRow.full_access !== true
      ) {
        const {
          data,
          error: permissionError,
        } = await supabase
          .from('admin_permissions')
          .select(`
            module,
            can_view,
            can_add,
            can_edit,
            can_approve,
            can_delete,
            can_block,
            can_export
          `)
          .eq('admin_user_id', session.user.id)
          .eq('module', 'hosts')
          .maybeSingle();

        if (permissionError) {
          throw permissionError;
        }

        permissionRow = data;
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
          cancelled_cheque_path,
          suspension_reason,
          blocked_at,
          blocked_by
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

      const safeProperties =
        propertyRows || [];

      const propertyIds =
        safeProperties.map(
          (property) =>
            property.id
        );

      let bookingRows = [];

      if (propertyIds.length > 0) {
        const {
          data,
          error: bookingError,
        } = await supabase
          .from('bookings')
          .select(`
            id,
            booking_code,
            property_id,
            guest_id,
            check_in,
            check_out,
            guests_count,
            nights,
            nightly_rate,
            cleaning_fee,
            security_deposit,
            total_amount,
            booking_status,
            payment_status,
            notes,
            created_at,
            updated_at,
            paid_at,
            base_amount,
            auto_discount_amount,
            host_discount_amount,
            final_payable_amount,
            offer_note,
            offer_status,
            offer_created_at,
            host_decision,
            host_decision_at,
            guest_discount_requested,
            guest_discount_message,
            payment_due_at,
            taxable_amount,
            gst_rate,
            gst_amount,
            amount_including_gst,
            property_offer_id
          `)
          .in(
            'property_id',
            propertyIds
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          );

        if (bookingError) {
          throw bookingError;
        }

        bookingRows =
          data || [];
      }

      const guestIds = [
        ...new Set(
          bookingRows
            .map(
              (booking) =>
                booking.guest_id
            )
            .filter(Boolean)
        ),
      ];

      let guestRows = [];

      if (guestIds.length > 0) {
        const {
          data,
          error: guestError,
        } = await supabase
          .from('guests')
          .select(`
            id,
            full_name,
            phone,
            email
          `)
          .in(
            'id',
            guestIds
          );

        if (guestError) {
          throw guestError;
        }

        guestRows =
          data || [];
      }

      setAdminProfile(adminRow);
      setHostPermission(permissionRow);

      setHost(hostRow);
      setProperties(safeProperties);
      setBookings(bookingRows);
      setGuests(guestRows);

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

  const hasFullHostAccess =
    adminProfile?.role ===
      'super_admin' ||
    adminProfile?.full_access ===
      true;

  const canEditHost =
    hasFullHostAccess ||
    hostPermission?.can_edit ===
      true;

  const canBlockHost =
    hasFullHostAccess ||
    hostPermission?.can_block ===
      true;

  async function updateHostStatus(
    newStatus
  ) {
    if (!host) {
      return;
    }

    setStatusMessage('');
    setStatusError('');

    let reason = null;

    if (
      newStatus === 'suspended'
    ) {
      const enteredReason =
        window.prompt(
          'Reason for suspending this Host?\n\nThis is optional.'
        );

      if (
        enteredReason === null
      ) {
        return;
      }

      reason =
        enteredReason.trim() ||
        null;
    }

    let confirmationText = '';

    if (
      newStatus === 'active'
    ) {
      confirmationText =
        'Activate this Host account?';
    }

    if (
      newStatus === 'suspended'
    ) {
      confirmationText =
        'Suspend this Host account?';
    }

    if (
      newStatus === 'blocked'
    ) {
      confirmationText =
        'Block this Host account?\n\nThis is a stronger restriction than suspension.';
    }

    const confirmed =
      window.confirm(
        confirmationText
      );

    if (!confirmed) {
      return;
    }

    setUpdatingStatus(true);

    try {
      const {
        error: rpcError,
      } = await supabase.rpc(
        'admin_update_host_status',
        {
          p_host_id:
            host.id,
          p_status:
            newStatus,
          p_reason:
            reason,
        }
      );

      if (rpcError) {
        throw rpcError;
      }

      setHost(
        (current) => ({
          ...current,
          status:
            newStatus,

          suspension_reason:
            newStatus ===
            'suspended'
              ? reason
              : null,

          blocked_at:
            newStatus ===
            'blocked'
              ? new Date().toISOString()
              : null,
        })
      );

      if (
        newStatus === 'active'
      ) {
        setStatusMessage(
          'Host account activated successfully.'
        );
      }

      if (
        newStatus === 'suspended'
      ) {
        setStatusMessage(
          'Host account suspended successfully.'
        );
      }

      if (
        newStatus === 'blocked'
      ) {
        setStatusMessage(
          'Host account blocked successfully.'
        );
      }

    } catch (err) {
      console.error(
        'Host status update error:',
        err
      );

      let message =
        err?.message ||
        'Unable to update Host status.';

      if (
        message.includes(
          'HOST_EDIT_PERMISSION_REQUIRED'
        )
      ) {
        message =
          'You do not have permission to activate or suspend Hosts.';
      }

      if (
        message.includes(
          'HOST_BLOCK_PERMISSION_REQUIRED'
        )
      ) {
        message =
          'You do not have permission to block Hosts.';
      }

      if (
        message.includes(
          'ADMIN_ACCESS_REQUIRED'
        )
      ) {
        message =
          'Active Admin access is required.';
      }

      setStatusError(
        message
      );

    } finally {
      setUpdatingStatus(false);
    }
  }

  const propertyCounts =
    useMemo(() => ({
      total:
        properties.length,

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

    }), [properties]);

  const propertyScopedBookings =
    useMemo(() => {
      if (
        bookingPropertyId ===
        'all'
      ) {
        return bookings;
      }

      return bookings.filter(
        (booking) =>
          booking.property_id ===
          bookingPropertyId
      );
    }, [
      bookings,
      bookingPropertyId,
    ]);

  const bookingCounts =
    useMemo(() => ({
      all:
        propertyScopedBookings.length,

      requests:
        propertyScopedBookings.filter(
          isBookingRequest
        ).length,

      paymentPending:
        propertyScopedBookings.filter(
          isPaymentPending
        ).length,

      confirmed:
        propertyScopedBookings.filter(
          isConfirmed
        ).length,

      cancelled:
        propertyScopedBookings.filter(
          isCancelled
        ).length,

      discount:
        propertyScopedBookings.filter(
          (booking) =>
            booking.guest_discount_requested ===
              true
        ).length,

      offers:
        propertyScopedBookings.filter(
          (booking) =>
            Boolean(
              booking.offer_status ||
              booking.offer_note ||
              Number(
                booking.host_discount_amount ||
                  0
              ) > 0
            )
        ).length,

    }), [propertyScopedBookings]);

  const totalBookingValue =
    useMemo(
      () =>
        propertyScopedBookings.reduce(
          (total, booking) =>
            total +
            Number(
              booking.amount_including_gst ??
              booking.final_payable_amount ??
              booking.total_amount ??
              0
            ),
          0
        ),
      [propertyScopedBookings]
    );

  const filteredProperties =
    useMemo(() => {
      const cleanSearch =
        propertySearch
          .trim()
          .toLowerCase();

      return properties.filter(
        (property) => {
          let matchesFilter = true;

          if (
            propertyFilter === 'live'
          ) {
            matchesFilter =
              property.is_active ===
                true &&
              property.moderation_status ===
                'approved';

          } else if (
            propertyFilter !== 'all'
          ) {
            matchesFilter =
              property.moderation_status ===
              propertyFilter;
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
      propertyFilter,
      propertySearch,
    ]);

  const filteredBookings =
    useMemo(() => {
      const cleanSearch =
        bookingSearch
          .trim()
          .toLowerCase();

      return propertyScopedBookings.filter(
        (booking) => {
          let matchesFilter = true;

          if (
            bookingFilter ===
            'requests'
          ) {
            matchesFilter =
              isBookingRequest(
                booking
              );
          }

          if (
            bookingFilter ===
            'payment_pending'
          ) {
            matchesFilter =
              isPaymentPending(
                booking
              );
          }

          if (
            bookingFilter ===
            'confirmed'
          ) {
            matchesFilter =
              isConfirmed(
                booking
              );
          }

          if (
            bookingFilter ===
            'cancelled'
          ) {
            matchesFilter =
              isCancelled(
                booking
              );
          }

          if (
            bookingFilter ===
            'discount'
          ) {
            matchesFilter =
              booking.guest_discount_requested ===
              true;
          }

          if (
            bookingFilter ===
            'offers'
          ) {
            matchesFilter =
              Boolean(
                booking.offer_status ||
                booking.offer_note ||
                Number(
                  booking.host_discount_amount ||
                    0
                ) > 0
              );
          }

          if (!matchesFilter) {
            return false;
          }

          if (!cleanSearch) {
            return true;
          }

          const property =
            getProperty(
              booking.property_id
            );

          const guest =
            getGuest(
              booking.guest_id
            );

          const searchable = [
            booking.booking_code,
            booking.booking_status,
            booking.payment_status,
            booking.host_decision,
            booking.offer_status,
            property?.name,
            guest?.full_name,
            guest?.phone,
            guest?.email,
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
      propertyScopedBookings,
      bookingFilter,
      bookingSearch,
      properties,
      guests,
    ]);

  function getProperty(
    propertyId
  ) {
    return properties.find(
      (property) =>
        property.id ===
        propertyId
    );
  }

  function getGuest(
    guestId
  ) {
    return guests.find(
      (guest) =>
        guest.id ===
        guestId
    );
  }

  function bankDetailsComplete() {
    return Boolean(
      host?.bank_account_name &&
      host?.bank_name &&
      host?.bank_account_number &&
      host?.bank_ifsc &&
      host?.bank_account_type
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

  const selectedBookingProperty =
    bookingPropertyId === 'all'
      ? null
      : properties.find(
          (property) =>
            property.id ===
            bookingPropertyId
        );

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
              disabled={
                refreshing ||
                updatingStatus
              }
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


          {statusMessage && (
            <div className="nosStatusSuccess">
              {statusMessage}
            </div>
          )}


          {statusError && (
            <div className="nosHostError">
              {statusError}
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

                <p>
                  {host.email || ''}
                </p>

              </div>

              <HostStatus
                status={
                  host.status
                }
              />

            </div>


            <div className="nosHostInformationGrid">

              <InfoCard
                label="Phone"
                value={
                  host.phone ||
                  '—'
                }
              />

              <InfoCard
                label="Email"
                value={
                  host.email ||
                  '—'
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
                    .join(', ') ||
                  '—'
                }
              />

              <InfoCard
                label="Pincode"
                value={
                  host.pincode ||
                  '—'
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
                  host.gstin ||
                  'Not Added'
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
                value={
                  formatDate(
                    host.created_at
                  )
                }
              />

            </div>


            <div className="nosHostControlArea">

              <div className="nosHostControlInfo">

                <span className="nosEyebrow">
                  HOST ACCOUNT CONTROL
                </span>

                <strong>
                  Current Status:{' '}
                  {prettyStatus(
                    host.status
                  )}
                </strong>

                <p>
                  Suspend temporarily, block the Host, or reactivate the account according to your Admin permissions.
                </p>

              </div>


              <div className="nosHostControlButtons">

                {host.status !==
                  'active' &&
                  canEditHost && (
                    <button
                      type="button"
                      className="nosActivateButton"
                      disabled={
                        updatingStatus
                      }
                      onClick={() =>
                        updateHostStatus(
                          'active'
                        )
                      }
                    >
                      {updatingStatus
                        ? 'Updating...'
                        : 'Activate Host'}
                    </button>
                  )}


                {host.status !==
                  'suspended' &&
                  canEditHost && (
                    <button
                      type="button"
                      className="nosSuspendButton"
                      disabled={
                        updatingStatus
                      }
                      onClick={() =>
                        updateHostStatus(
                          'suspended'
                        )
                      }
                    >
                      {updatingStatus
                        ? 'Updating...'
                        : 'Suspend Host'}
                    </button>
                  )}


                {host.status !==
                  'blocked' &&
                  canBlockHost && (
                    <button
                      type="button"
                      className="nosBlockButton"
                      disabled={
                        updatingStatus
                      }
                      onClick={() =>
                        updateHostStatus(
                          'blocked'
                        )
                      }
                    >
                      {updatingStatus
                        ? 'Updating...'
                        : 'Block Host'}
                    </button>
                  )}


                {!canEditHost &&
                  !canBlockHost && (
                    <div className="nosNoPermission">
                      View only. You do not have permission to change Host status.
                    </div>
                  )}

              </div>

            </div>


            {host.status ===
              'suspended' &&
              host.suspension_reason && (
                <div className="nosSuspensionReason">

                  <strong>
                    Suspension Reason
                  </strong>

                  <p>
                    {
                      host.suspension_reason
                    }
                  </p>

                </div>
              )}


            {host.status ===
              'blocked' &&
              host.blocked_at && (
                <div className="nosBlockedInfo">

                  <strong>
                    Host Blocked
                  </strong>

                  <p>
                    Blocked on{' '}
                    {formatDateTime(
                      host.blocked_at
                    )}
                  </p>

                </div>
              )}

          </section>


          <section className="nosHostPropertiesSection">

            <div className="nosSectionHeading">

              <span className="nosEyebrow">
                HOST INVENTORY
              </span>

              <h2>
                Properties by {displayName}
              </h2>

              <p>
                All properties uploaded by this Host and their current moderation status.
              </p>

            </div>


            <div className="nosHostPropertyStats">

              <FilterCard
                label="All Properties"
                value={
                  propertyCounts.total
                }
                active={
                  propertyFilter ===
                  'all'
                }
                onClick={() =>
                  setPropertyFilter(
                    'all'
                  )
                }
              />

              <FilterCard
                label="Live"
                value={
                  propertyCounts.live
                }
                active={
                  propertyFilter ===
                  'live'
                }
                onClick={() =>
                  setPropertyFilter(
                    'live'
                  )
                }
              />

              <FilterCard
                label="Pending Review"
                value={
                  propertyCounts.pending
                }
                active={
                  propertyFilter ===
                  'pending_review'
                }
                onClick={() =>
                  setPropertyFilter(
                    'pending_review'
                  )
                }
              />

              <FilterCard
                label="Draft"
                value={
                  propertyCounts.draft
                }
                active={
                  propertyFilter ===
                  'draft'
                }
                onClick={() =>
                  setPropertyFilter(
                    'draft'
                  )
                }
              />

              <FilterCard
                label="Changes Requested"
                value={
                  propertyCounts.changes
                }
                active={
                  propertyFilter ===
                  'changes_requested'
                }
                onClick={() =>
                  setPropertyFilter(
                    'changes_requested'
                  )
                }
              />

              <FilterCard
                label="Declined"
                value={
                  propertyCounts.declined
                }
                active={
                  propertyFilter ===
                  'declined'
                }
                onClick={() =>
                  setPropertyFilter(
                    'declined'
                  )
                }
              />

            </div>


            <div className="nosToolRow">

              <div>

                <h3>
                  {propertyFilterHeading(
                    propertyFilter
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
                value={
                  propertySearch
                }
                onChange={(event) =>
                  setPropertySearch(
                    event.target.value
                  )
                }
                placeholder="Search property, location or type..."
                className="nosSearch"
              />

            </div>


            {filteredProperties.length ===
            0 ? (
              <div className="nosEmpty">
                No properties found in this category.
              </div>
            ) : (
              <div className="nosHostPropertiesGrid">

                {filteredProperties.map(
                  (property) => (
                    <PropertyCard
                      key={
                        property.id
                      }
                      property={
                        property
                      }
                    />
                  )
                )}

              </div>
            )}

          </section>


          <section className="nosBookingOperations">

            <div className="nosSectionHeading">

              <span className="nosEyebrow">
                HOST OPERATIONS
              </span>

              <h2>
                Bookings, Requests & Discounts
              </h2>

              <p>
                View booking activity for all properties together or select one specific property.
              </p>

            </div>


            <div className="nosPropertyBookingSelector">

              <div className="nosSelectorText">

                <span className="nosEyebrow">
                  PROPERTY-WISE BOOKING VIEW
                </span>

                <strong>
                  Viewing Bookings For
                </strong>

                <p>
                  Select one property to see only its bookings, requests, discounts and offers.
                </p>

              </div>


              <div className="nosBookingPropertySelectWrap">

                <select
                  value={
                    bookingPropertyId
                  }
                  onChange={(event) => {
                    setBookingPropertyId(
                      event.target.value
                    );

                    setBookingFilter(
                      'all'
                    );

                    setBookingSearch(
                      ''
                    );
                  }}
                  className="nosBookingPropertySelect"
                >
                  <option value="all">
                    All Properties
                  </option>

                  {properties.map(
                    (property) => (
                      <option
                        key={
                          property.id
                        }
                        value={
                          property.id
                        }
                      >
                        {property.name ||
                          'Unnamed Property'}
                        {property.area
                          ? ` - ${property.area}`
                          : ''}
                      </option>
                    )
                  )}

                </select>

              </div>

            </div>


            <div className="nosSelectedPropertyLine">

              <span>
                Current View
              </span>

              <strong>
                {selectedBookingProperty
                  ? selectedBookingProperty.name
                  : 'All Properties'}
              </strong>

              <small>
                {
                  propertyScopedBookings.length
                }{' '}
                booking records
              </small>

            </div>


            <div className="nosBookingSummaryTop">

              <div>
                <span>
                  Total Booking Value
                </span>

                <strong>
                  ₹
                  {Number(
                    totalBookingValue
                  ).toLocaleString(
                    'en-IN'
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Total Booking Records
                </span>

                <strong>
                  {
                    bookingCounts.all
                  }
                </strong>
              </div>

              <div>
                <span>
                  Discount Requests
                </span>

                <strong>
                  {
                    bookingCounts.discount
                  }
                </strong>
              </div>

              <div>
                <span>
                  Confirmed
                </span>

                <strong className="green">
                  {
                    bookingCounts.confirmed
                  }
                </strong>
              </div>

            </div>


            <div className="nosBookingFilters">

              <BookingFilter
                label="All Bookings"
                value={
                  bookingCounts.all
                }
                active={
                  bookingFilter ===
                  'all'
                }
                onClick={() =>
                  setBookingFilter(
                    'all'
                  )
                }
              />

              <BookingFilter
                label="Booking Requests"
                value={
                  bookingCounts.requests
                }
                active={
                  bookingFilter ===
                  'requests'
                }
                onClick={() =>
                  setBookingFilter(
                    'requests'
                  )
                }
              />

              <BookingFilter
                label="Approved / Payment Pending"
                value={
                  bookingCounts.paymentPending
                }
                active={
                  bookingFilter ===
                  'payment_pending'
                }
                onClick={() =>
                  setBookingFilter(
                    'payment_pending'
                  )
                }
              />

              <BookingFilter
                label="Confirmed"
                value={
                  bookingCounts.confirmed
                }
                active={
                  bookingFilter ===
                  'confirmed'
                }
                onClick={() =>
                  setBookingFilter(
                    'confirmed'
                  )
                }
              />

              <BookingFilter
                label="Cancelled / Declined"
                value={
                  bookingCounts.cancelled
                }
                active={
                  bookingFilter ===
                  'cancelled'
                }
                onClick={() =>
                  setBookingFilter(
                    'cancelled'
                  )
                }
              />

              <BookingFilter
                label="Discount Requests"
                value={
                  bookingCounts.discount
                }
                active={
                  bookingFilter ===
                  'discount'
                }
                onClick={() =>
                  setBookingFilter(
                    'discount'
                  )
                }
              />

              <BookingFilter
                label="Special Offers"
                value={
                  bookingCounts.offers
                }
                active={
                  bookingFilter ===
                  'offers'
                }
                onClick={() =>
                  setBookingFilter(
                    'offers'
                  )
                }
              />

            </div>


            <div className="nosToolRow">

              <div>

                <h3>
                  {bookingFilterHeading(
                    bookingFilter
                  )}
                </h3>

                <p>
                  {selectedBookingProperty
                    ? selectedBookingProperty.name
                    : 'All Properties'}

                  {' · '}

                  {
                    filteredBookings.length
                  }{' '}

                  {filteredBookings.length ===
                  1
                    ? 'record'
                    : 'records'}
                </p>

              </div>

              <input
                type="search"
                value={
                  bookingSearch
                }
                onChange={(event) =>
                  setBookingSearch(
                    event.target.value
                  )
                }
                placeholder="Search booking, guest, property or status..."
                className="nosSearch"
              />

            </div>


            {filteredBookings.length ===
            0 ? (
              <div className="nosEmpty">
                No booking records found for this selection.
              </div>
            ) : (
              <div className="nosBookingsGrid">

                {filteredBookings.map(
                  (booking) => (
                    <BookingCard
                      key={
                        booking.id
                      }
                      booking={
                        booking
                      }
                      property={
                        getProperty(
                          booking.property_id
                        )
                      }
                      guest={
                        getGuest(
                          booking.guest_id
                        )
                      }
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


function BookingCard({
  booking,
  property,
  guest,
}) {
  const payableAmount =
    booking.amount_including_gst ??
    booking.final_payable_amount ??
    booking.total_amount ??
    0;

  const hasDiscount =
    booking.guest_discount_requested ===
      true ||
    Number(
      booking.host_discount_amount ||
      0
    ) > 0 ||
    Number(
      booking.auto_discount_amount ||
      0
    ) > 0;

  return (
    <article className="nosBookingCard">

      <div className="nosBookingCardHeader">

        <div>

          <span className="nosEyebrow">
            BOOKING
          </span>

          <h3>
            {booking.booking_code ||
              shortId(
                booking.id
              )}
          </h3>

          <p>
            {property?.name ||
              'Property'}
          </p>

        </div>


        <div className="nosBookingBadges">

          <BookingStatusBadge
            value={
              booking.booking_status ||
              'requested'
            }
          />

          <PaymentStatusBadge
            value={
              booking.payment_status ||
              'pending'
            }
          />

        </div>

      </div>


      <div className="nosBookingGuest">

        <span>
          GUEST
        </span>

        <strong>
          {guest?.full_name ||
            'Guest'}
        </strong>

        <p>
          {[
            guest?.phone,
            guest?.email,
          ]
            .filter(Boolean)
            .join(' · ') ||
            '—'}
        </p>

      </div>


      <div className="nosBookingDates">

        <div>
          <span>
            Check-in
          </span>

          <strong>
            {formatDate(
              booking.check_in
            )}
          </strong>
        </div>

        <div>
          <span>
            Check-out
          </span>

          <strong>
            {formatDate(
              booking.check_out
            )}
          </strong>
        </div>

        <div>
          <span>
            Nights
          </span>

          <strong>
            {booking.nights ??
              '—'}
          </strong>
        </div>

        <div>
          <span>
            Guests
          </span>

          <strong>
            {booking.guests_count ??
              '—'}
          </strong>
        </div>

      </div>


      <div className="nosBookingFinancials">

        <FinancialItem
          label="Base Amount"
          value={
            booking.base_amount ??
            booking.total_amount
          }
        />

        <FinancialItem
          label="Auto Discount"
          value={
            booking.auto_discount_amount
          }
          minus
        />

        <FinancialItem
          label="Host Discount"
          value={
            booking.host_discount_amount
          }
          minus
        />

        <FinancialItem
          label="GST"
          value={
            booking.gst_amount
          }
        />

      </div>


      <div className="nosBookingPayable">

        <span>
          Final Payable
        </span>

        <strong>
          ₹
          {Number(
            payableAmount ||
            0
          ).toLocaleString(
            'en-IN'
          )}
        </strong>

      </div>


      <div className="nosBookingDecisionGrid">

        <div>

          <span>
            Host Decision
          </span>

          <strong>
            {prettyStatus(
              booking.host_decision ||
              'pending'
            )}
          </strong>

        </div>

        <div>

          <span>
            Offer Status
          </span>

          <strong>
            {booking.offer_status
              ? prettyStatus(
                  booking.offer_status
                )
              : '—'}
          </strong>

        </div>

        <div>

          <span>
            Payment Due
          </span>

          <strong>
            {formatDateTime(
              booking.payment_due_at
            )}
          </strong>

        </div>

      </div>


      {hasDiscount && (
        <div className="nosDiscountBox">

          <strong>
            Discount / Offer
          </strong>

          {booking.guest_discount_requested && (
            <p>
              Guest requested discount
              {booking.guest_discount_message
                ? `: ${booking.guest_discount_message}`
                : '.'}
            </p>
          )}

          {Number(
            booking.host_discount_amount ||
            0
          ) > 0 && (
            <p>
              Host discount: ₹
              {Number(
                booking.host_discount_amount
              ).toLocaleString(
                'en-IN'
              )}
            </p>
          )}

          {booking.offer_note && (
            <p>
              Offer note:{' '}
              {
                booking.offer_note
              }
            </p>
          )}

        </div>
      )}


      <div className="nosBookingCardFooter">

        <span>
          Requested{' '}
          {formatDateTime(
            booking.created_at
          )}
        </span>

        <Link
          href="/admin/bookings"
          className="nosOpenBookings"
        >
          Open Bookings
        </Link>

      </div>

    </article>
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
              .join(', ') ||
              'Location not added'}
          </p>

        </div>


        <div className="nosPropertyBadges">

          <span
            className={`nosModerationBadge ${status}`}
          >
            {prettyStatus(
              status
            )}
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
          property.base_price ||
          0
        ).toLocaleString(
          'en-IN'
        )}

        <span>
          / night
        </span>

      </div>


      <div className="nosPropertyNumbers">

        <PropertyInfo
          label="Bedrooms"
          value={
            property.bedrooms ??
            '—'
          }
        />

        <PropertyInfo
          label="Bathrooms"
          value={
            property.bathrooms ??
            '—'
          }
        />

        <PropertyInfo
          label="Guests"
          value={
            property.max_guests ??
            '—'
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


      {property.moderation_notes && (
        <div className="nosPropertyNote">

          <strong>
            Moderation Note
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


function FinancialItem({
  label,
  value,
  minus = false,
}) {
  const amount =
    Number(
      value ||
      0
    );

  return (
    <div className="nosFinancialItem">

      <span>
        {label}
      </span>

      <strong>
        {minus &&
        amount > 0
          ? '- '
          : ''}
        ₹
        {amount.toLocaleString(
          'en-IN'
        )}
      </strong>

    </div>
  );
}


function BookingFilter({
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
          ? 'nosBookingFilter active'
          : 'nosBookingFilter'
      }
      onClick={
        onClick
      }
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
      onClick={
        onClick
      }
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


function HostStatus({
  status,
}) {
  const value =
    status ||
    'active';

  return (
    <span
      className={`nosHostStatusBadge ${value}`}
    >
      {prettyStatus(
        value
      )}
    </span>
  );
}


function BookingStatusBadge({
  value,
}) {
  return (
    <span className="nosBookingStatus">
      {prettyStatus(
        value
      )}
    </span>
  );
}


function PaymentStatusBadge({
  value,
}) {
  const clean =
    String(
      value ||
      'pending'
    ).toLowerCase();

  return (
    <span
      className={`nosPaymentStatus ${
        clean === 'paid'
          ? 'paid'
          : clean === 'failed'
          ? 'failed'
          : 'pending'
      }`}
    >
      {prettyStatus(
        value
      )}
    </span>
  );
}


function isBookingRequest(
  booking
) {
  const status =
    String(
      booking.booking_status ||
      ''
    ).toLowerCase();

  const decision =
    String(
      booking.host_decision ||
      ''
    ).toLowerCase();

  return (
    status.includes(
      'request'
    ) ||
    status.includes(
      'pending'
    ) ||
    !decision ||
    decision ===
      'pending'
  );
}


function isPaymentPending(
  booking
) {
  const decision =
    String(
      booking.host_decision ||
      ''
    ).toLowerCase();

  const payment =
    String(
      booking.payment_status ||
      ''
    ).toLowerCase();

  return (
    [
      'approved',
      'accepted',
      'accept',
    ].includes(
      decision
    ) &&
    payment !==
      'paid'
  );
}


function isConfirmed(
  booking
) {
  const bookingStatus =
    String(
      booking.booking_status ||
      ''
    ).toLowerCase();

  const payment =
    String(
      booking.payment_status ||
      ''
    ).toLowerCase();

  return (
    payment ===
      'paid' ||
    bookingStatus.includes(
      'confirm'
    ) ||
    bookingStatus.includes(
      'booked'
    )
  );
}


function isCancelled(
  booking
) {
  const values = [
    booking.booking_status,
    booking.host_decision,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    values.includes(
      'cancel'
    ) ||
    values.includes(
      'declin'
    ) ||
    values.includes(
      'reject'
    ) ||
    values.includes(
      'expired'
    )
  );
}


function prettyStatus(
  value
) {
  if (!value) {
    return '—';
  }

  return String(
    value
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


function propertyFilterHeading(
  value
) {
  return (
    PROPERTY_FILTERS.find(
      (item) =>
        item.key ===
        value
    )?.label ||
    'Properties'
  );
}


function bookingFilterHeading(
  value
) {
  return (
    BOOKING_FILTERS.find(
      (item) =>
        item.key ===
        value
    )?.label ||
    'Bookings'
  );
}


function shortId(
  value
) {
  if (!value) {
    return 'Booking';
  }

  return value
    .slice(0, 8)
    .toUpperCase();
}


function formatDate(
  value
) {
  if (!value) {
    return '—';
  }

  try {
    return new Date(
      value
    ).toLocaleDateString(
      'en-IN',
      {
        day:
          '2-digit',
        month:
          'short',
        year:
          'numeric',
      }
    );
  } catch {
    return '—';
  }
}


function formatDateTime(
  value
) {
  if (!value) {
    return '—';
  }

  try {
    return new Date(
      value
    ).toLocaleString(
      'en-IN',
      {
        day:
          '2-digit',
        month:
          'short',
        year:
          'numeric',
        hour:
          '2-digit',
        minute:
          '2-digit',
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

      .nosHostTopActions,
      .nosToolRow {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
      }

      .nosHostTopActions {
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

      .nosHostProfileCard,
      .nosHostPropertyCard,
      .nosBookingCard {
        border: 1px solid #d9e2ec;
        background: #ffffff;
      }

      .nosHostProfileCard {
        border-radius: 16px;
        padding: 23px;
        margin-bottom: 28px;
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

      .nosHostProfileTitle h1,
      .nosSectionHeading h2 {
        margin: 0;
        color: #071d38;
      }

      .nosHostProfileTitle h1 {
        font-size: 29px;
      }

      .nosHostProfileTitle p,
      .nosSectionHeading p {
        color: #667085;
      }

      .nosHostInformationGrid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
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

      .nosHostInfoCard span,
      .nosFinancialItem span,
      .nosBookingDates span,
      .nosBookingDecisionGrid span,
      .nosBookingSummaryTop span {
        color: #728095;
        font-size: 9px;
        font-weight: 900;
      }

      .nosHostInfoCard strong {
        display: block;
        margin-top: 6px;
        font-size: 11px;
      }

      .nosHostInfoCard strong.success {
        color: #14743b;
      }

      .nosHostControlArea {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 20px;
        margin-top: 22px;
        padding: 18px;
        border: 1px solid #d6e0ea;
        border-radius: 12px;
        background: #f8fafc;
      }

      .nosHostControlInfo {
        flex: 1;
      }

      .nosHostControlInfo strong {
        display: block;
        color: #071d38;
        font-size: 14px;
      }

      .nosHostControlInfo p {
        margin: 5px 0 0;
        color: #667085;
        font-size: 10px;
        line-height: 1.5;
      }

      .nosHostControlButtons {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .nosActivateButton,
      .nosSuspendButton,
      .nosBlockButton {
        min-height: 40px;
        padding: 0 15px;
        border: 0;
        border-radius: 8px;
        font-size: 10px;
        font-weight: 900;
        cursor: pointer;
      }

      .nosActivateButton {
        background: #15733d;
        color: #ffffff;
      }

      .nosSuspendButton {
        background: #f2a900;
        color: #17212b;
      }

      .nosBlockButton {
        background: #b42318;
        color: #ffffff;
      }

      .nosNoPermission {
        padding: 10px 13px;
        border-radius: 8px;
        background: #eef2f6;
        color: #667085;
        font-size: 10px;
        font-weight: 700;
      }

      .nosSuspensionReason,
      .nosBlockedInfo {
        margin-top: 12px;
        padding: 12px;
        border-radius: 9px;
      }

      .nosSuspensionReason {
        background: #fff7e6;
        color: #8b5e00;
      }

      .nosBlockedInfo {
        background: #fff0ef;
        color: #a42018;
      }

      .nosSuspensionReason strong,
      .nosBlockedInfo strong {
        font-size: 10px;
      }

      .nosSuspensionReason p,
      .nosBlockedInfo p {
        margin: 4px 0 0;
        font-size: 10px;
      }

      .nosStatusSuccess {
        margin-bottom: 17px;
        padding: 11px 13px;
        border: 1px solid #a7dfba;
        border-radius: 8px;
        background: #ecf9f0;
        color: #14743b;
        font-size: 11px;
        font-weight: 800;
      }

      .nosHostStatusBadge,
      .nosModerationBadge,
      .nosLiveBadge,
      .nosBookingStatus,
      .nosPaymentStatus {
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
      .nosLiveBadge,
      .nosPaymentStatus.paid {
        background: #e5f7eb;
        color: #14743b;
      }

      .nosHostStatusBadge.suspended,
      .nosModerationBadge.pending_review,
      .nosPaymentStatus.pending {
        background: #fff3da;
        color: #976400;
      }

      .nosHostStatusBadge.blocked,
      .nosModerationBadge.declined,
      .nosPaymentStatus.failed {
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

      .nosBookingStatus {
        background: #e9f1fa;
        color: #185d9f;
      }

      .nosSectionHeading {
        margin-bottom: 18px;
      }

      .nosSectionHeading h2 {
        font-size: 27px;
      }

      .nosSectionHeading p {
        margin: 6px 0 0;
        font-size: 12px;
        line-height: 1.55;
      }

      .nosBookingOperations {
        margin-top: 45px;
        padding-top: 34px;
        border-top: 2px solid #dfe6ee;
      }

      .nosHostPropertyStats,
      .nosBookingFilters {
        display: grid;
        gap: 10px;
      }

      .nosHostPropertyStats {
        grid-template-columns: repeat(6, minmax(0, 1fr));
        margin-bottom: 24px;
      }

      .nosBookingFilters {
        grid-template-columns: repeat(7, minmax(0, 1fr));
        margin: 18px 0 24px;
      }

      .nosHostFilterCard,
      .nosBookingFilter {
        min-height: 90px;
        padding: 14px;
        border: 1px solid #d8e1eb;
        border-radius: 12px;
        background: #ffffff;
        color: #101828;
        text-align: left;
        cursor: pointer;
      }

      .nosHostFilterCard.active,
      .nosBookingFilter.active {
        border-color: #082f5a;
        background: #082f5a;
        color: #ffffff;
      }

      .nosHostFilterCard span,
      .nosBookingFilter span {
        display: block;
        font-size: 9px;
        font-weight: 900;
        color: #53647a;
        line-height: 1.35;
      }

      .nosHostFilterCard.active span,
      .nosBookingFilter.active span {
        color: #ffffff;
      }

      .nosHostFilterCard strong,
      .nosBookingFilter strong {
        display: block;
        margin-top: 8px;
        font-size: 23px;
      }

      .nosPropertyBookingSelector {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        padding: 18px 20px;
        margin-bottom: 12px;
        border: 1px solid #cfdbe7;
        border-radius: 14px;
        background: #ffffff;
      }

      .nosSelectorText {
        flex: 1;
      }

      .nosSelectorText strong {
        display: block;
        color: #071d38;
        font-size: 16px;
      }

      .nosSelectorText p {
        margin: 4px 0 0;
        color: #667085;
        font-size: 10px;
      }

      .nosBookingPropertySelectWrap {
        width: min(430px, 100%);
      }

      .nosBookingPropertySelect {
        width: 100%;
        min-height: 46px;
        padding: 0 14px;
        border: 1px solid #bcc9d7;
        border-radius: 9px;
        background: #ffffff;
        color: #102a44;
        font-size: 12px;
        font-weight: 800;
        outline: none;
        cursor: pointer;
      }

      .nosBookingPropertySelect:focus {
        border-color: #07569f;
      }

      .nosSelectedPropertyLine {
        display: flex;
        align-items: center;
        gap: 9px;
        margin-bottom: 18px;
        padding: 9px 12px;
        border-radius: 8px;
        background: #eaf2fb;
      }

      .nosSelectedPropertyLine span {
        color: #68778c;
        font-size: 9px;
        font-weight: 900;
      }

      .nosSelectedPropertyLine strong {
        color: #07569f;
        font-size: 11px;
      }

      .nosSelectedPropertyLine small {
        margin-left: auto;
        color: #667085;
        font-size: 9px;
      }

      .nosBookingSummaryTop {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }

      .nosBookingSummaryTop > div {
        padding: 16px;
        border: 1px solid #d8e1eb;
        border-radius: 12px;
        background: #ffffff;
      }

      .nosBookingSummaryTop strong {
        display: block;
        margin-top: 7px;
        font-size: 23px;
      }

      .nosBookingSummaryTop strong.green {
        color: #14743b;
      }

      .nosToolRow {
        margin-bottom: 13px;
        align-items: flex-end;
      }

      .nosToolRow h3 {
        margin: 0;
        font-size: 20px;
      }

      .nosToolRow p {
        margin: 3px 0 0;
        color: #667085;
        font-size: 10px;
      }

      .nosSearch {
        width: min(420px, 100%);
        min-height: 41px;
        padding: 0 13px;
        border: 1px solid #ccd6e1;
        border-radius: 8px;
        background: #ffffff;
      }

      .nosHostPropertiesGrid,
      .nosBookingsGrid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }

      .nosHostPropertyCard,
      .nosBookingCard {
        border-radius: 15px;
        padding: 20px;
      }

      .nosPropertyCardTop,
      .nosBookingCardHeader {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 15px;
      }

      .nosPropertyCardTop h3,
      .nosBookingCardHeader h3 {
        margin: 0;
        color: #071d38;
        font-size: 18px;
      }

      .nosPropertyCardTop p,
      .nosBookingCardHeader p {
        margin: 5px 0 0;
        color: #68778c;
        font-size: 11px;
      }

      .nosPropertyBadges,
      .nosBookingBadges {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .nosPropertyPrice {
        margin-top: 18px;
        font-size: 24px;
        font-weight: 900;
      }

      .nosPropertyPrice span {
        color: #667085;
        font-size: 9px;
        font-weight: 600;
      }

      .nosPropertyNumbers,
      .nosBookingDates,
      .nosBookingFinancials,
      .nosBookingDecisionGrid {
        display: grid;
        gap: 8px;
        margin-top: 14px;
      }

      .nosPropertyNumbers {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .nosBookingDates,
      .nosBookingFinancials {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .nosBookingDecisionGrid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .nosPropertyInfo,
      .nosBookingDates > div,
      .nosFinancialItem,
      .nosBookingDecisionGrid > div {
        min-height: 58px;
        padding: 10px;
        border: 1px solid #dce4ed;
        border-radius: 8px;
      }

      .nosPropertyInfo strong,
      .nosBookingDates strong,
      .nosFinancialItem strong,
      .nosBookingDecisionGrid strong {
        display: block;
        margin-top: 4px;
        font-size: 11px;
      }

      .nosPropertyInfo span {
        display: block;
        margin-top: 3px;
        color: #6b7a8e;
        font-size: 8px;
      }

      .nosBookingGuest {
        margin-top: 15px;
        padding: 12px;
        border-radius: 9px;
        background: #f7f9fc;
      }

      .nosBookingGuest span {
        font-size: 8px;
        font-weight: 900;
        color: #728095;
      }

      .nosBookingGuest strong {
        display: block;
        margin-top: 4px;
        font-size: 13px;
      }

      .nosBookingGuest p {
        margin: 3px 0 0;
        color: #667085;
        font-size: 10px;
      }

      .nosBookingPayable {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 14px;
        padding: 13px;
        border-radius: 9px;
        background: #082f5a;
        color: #ffffff;
      }

      .nosBookingPayable span {
        font-size: 10px;
        font-weight: 900;
      }

      .nosBookingPayable strong {
        font-size: 20px;
      }

      .nosDiscountBox,
      .nosPropertyNote {
        margin-top: 13px;
        padding: 11px;
        border-radius: 8px;
        background: #edf5ff;
        color: #175fa7;
      }

      .nosDiscountBox strong,
      .nosPropertyNote strong {
        font-size: 10px;
      }

      .nosDiscountBox p,
      .nosPropertyNote p {
        margin: 4px 0 0;
        font-size: 10px;
        line-height: 1.45;
      }

      .nosBookingCardFooter,
      .nosPropertyActions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-top: 16px;
      }

      .nosBookingCardFooter {
        padding-top: 13px;
        border-top: 1px solid #e3e8ee;
      }

      .nosBookingCardFooter span {
        color: #77869a;
        font-size: 9px;
      }

      .nosOpenBookings,
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

      .nosOpenBookings,
      .nosManageProperty {
        background: #082f5a;
        color: #ffffff;
      }

      .nosViewLiveProperty {
        border: 1px solid #ccd6e1;
        color: #07569f;
      }

      .nosEmpty,
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

      @media (max-width: 1100px) {

        .nosHostInformationGrid,
        .nosBookingSummaryTop {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .nosHostPropertyStats {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .nosBookingFilters {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .nosHostPropertiesGrid,
        .nosBookingsGrid {
          grid-template-columns: 1fr;
        }

      }

      @media (max-width: 800px) {

        .nosHostControlArea {
          flex-direction: column;
          align-items: stretch;
        }

        .nosHostControlButtons {
          justify-content: flex-start;
        }

      }

      @media (max-width: 700px) {

        .nosHostDetailContainer {
          width: calc(100% - 24px);
        }

        .nosToolRow,
        .nosPropertyBookingSelector {
          flex-direction: column;
          align-items: stretch;
        }

        .nosBookingPropertySelectWrap,
        .nosSearch {
          width: 100%;
        }

        .nosHostPropertyStats,
        .nosBookingFilters {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .nosBookingDates,
        .nosBookingFinancials,
        .nosBookingDecisionGrid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

      }

      @media (max-width: 480px) {

        .nosHostInformationGrid,
        .nosBookingSummaryTop {
          grid-template-columns: 1fr;
        }

        .nosHostProfileTop,
        .nosPropertyCardTop,
        .nosBookingCardHeader {
          flex-wrap: wrap;
        }

        .nosBookingCardFooter,
        .nosPropertyActions,
        .nosHostControlButtons {
          flex-direction: column;
          align-items: stretch;
        }

        .nosSelectedPropertyLine {
          align-items: flex-start;
          flex-direction: column;
        }

        .nosSelectedPropertyLine small {
          margin-left: 0;
        }

      }

    `}</style>
  );
}