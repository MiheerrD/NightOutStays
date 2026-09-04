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


export default function HostReviewsPage() {

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [host, setHost] =
    useState(null);

  const [bookings, setBookings] =
    useState([]);

  const [properties, setProperties] =
    useState([]);

  const [guests, setGuests] =
    useState([]);

  const [reviews, setReviews] =
    useState([]);

  const [filter, setFilter] =
    useState('eligible');

  const [search, setSearch] =
    useState('');


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
          '/login?redirect=/host/reviews'
        );

        return;
      }


      // ======================================================
      // PLATFORM ROLE
      // ======================================================

      const {
        data: roles,
        error: rolesError,
      } =
        await supabase.rpc(
          'get_my_platform_roles'
        );


      if (rolesError) {
        throw rolesError;
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
            email,
            phone,
            status
          `)
          .eq(
            'user_id',
            session.user.id
          )
          .maybeSingle();


      if (hostError) {
        throw hostError;
      }


      if (!hostData) {

        throw new Error(
          'Host profile could not be found.'
        );
      }


      if (
        hostData.status !== 'active'
      ) {

        throw new Error(
          'Your Host account is not active.'
        );
      }


      setHost(hostData);


      // ======================================================
      // HOST PROPERTIES
      // ======================================================

      const {
        data: propertyRows,
        error: propertyError,
      } =
        await supabase
          .from('properties')
          .select(`
            id,
            name,
            slug,
            area,
            city,
            location_name,
            property_type,
            host_id,
            is_active,
            moderation_status
          `)
          .eq(
            'host_id',
            hostData.id
          );


      if (propertyError) {
        throw propertyError;
      }


      const safeProperties =
        propertyRows || [];


      setProperties(
        safeProperties
      );


      const propertyIds =
        safeProperties.map(
          (item) => item.id
        );


      if (
        propertyIds.length === 0
      ) {

        setBookings([]);
        setGuests([]);
        setReviews([]);

        return;
      }


      // ======================================================
      // BOOKINGS FOR HOST PROPERTIES
      // ======================================================

      const {
        data: bookingRows,
        error: bookingError,
      } =
        await supabase
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
            total_amount,
            booking_status,
            payment_status,
            host_decision,
            host_decision_at,
            final_payable_amount,
            amount_including_gst,
            paid_at,
            verification_status,
            created_at,
            updated_at
          `)
          .in(
            'property_id',
            propertyIds
          )
          .order(
            'check_out',
            {
              ascending: false,
            }
          );


      if (bookingError) {
        throw bookingError;
      }


      const safeBookings =
        bookingRows || [];


      setBookings(
        safeBookings
      );


      // ======================================================
      // GUESTS
      // ======================================================

      const guestIds = [
        ...new Set(
          safeBookings
            .map(
              (item) =>
                item.guest_id
            )
            .filter(Boolean)
        ),
      ];


      let guestRows = [];


      if (
        guestIds.length > 0
      ) {

        const {
          data,
          error,
        } =
          await supabase
            .from('guests')
            .select(`
              id,
              full_name,
              phone,
              email,
              status
            `)
            .in(
              'id',
              guestIds
            );


        if (error) {
          throw error;
        }


        guestRows =
          data || [];
      }


      setGuests(
        guestRows
      );


      // ======================================================
      // EXISTING HOST REVIEWS
      // ======================================================

      const {
        data: reviewRows,
        error: reviewError,
      } =
        await supabase
          .from('guest_reviews')
          .select(`
            id,
            booking_id,
            property_id,
            guest_id,
            host_id,
            rating,
            kept_property_clean,
            nuisance_created,
            left_property_on_time,
            recommend_to_hosts,
            public_review,
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


      if (reviewError) {
        throw reviewError;
      }


      setReviews(
        reviewRows || []
      );

    } catch (err) {

      console.error(err);

      setError(
        err?.message ||
          'Unable to load Host Reviews.'
      );

    } finally {

      setLoading(false);

    }
  }


  // ==========================================================
  // LOOKUPS
  // ==========================================================

  function propertyById(id) {

    return properties.find(
      (item) =>
        item.id === id
    );
  }


  function guestById(id) {

    return guests.find(
      (item) =>
        item.id === id
    );
  }


  function reviewByBookingId(
    bookingId
  ) {

    return reviews.find(
      (item) =>
        item.booking_id ===
        bookingId
    );
  }


  // ==========================================================
  // COMPLETED / ELIGIBLE
  // ==========================================================

  function bookingHasEnded(
    booking
  ) {

    if (!booking?.check_out) {
      return false;
    }


    const checkout =
      new Date(
        `${booking.check_out}T00:00:00`
      );


    const today =
      new Date();


    today.setHours(
      0,
      0,
      0,
      0
    );


    return checkout <= today;
  }


  function validBooking(
    booking
  ) {

    const bookingStatus =
      String(
        booking.booking_status ||
          ''
      ).toLowerCase();


    const paymentStatus =
      String(
        booking.payment_status ||
          ''
      ).toLowerCase();


    const hostDecision =
      String(
        booking.host_decision ||
          ''
      ).toLowerCase();


    const invalidText =
      [
        bookingStatus,
        hostDecision,
      ].join(' ');


    if (
      invalidText.includes(
        'cancel'
      ) ||
      invalidText.includes(
        'declin'
      ) ||
      invalidText.includes(
        'reject'
      ) ||
      invalidText.includes(
        'expired'
      )
    ) {

      return false;
    }


    return (
      paymentStatus === 'paid' ||
      bookingStatus ===
        'confirmed' ||
      bookingStatus ===
        'booked' ||
      bookingStatus ===
        'completed'
    );
  }


  function eligibleForReview(
    booking
  ) {

    return (
      bookingHasEnded(
        booking
      ) &&
      validBooking(
        booking
      )
    );
  }


  // ==========================================================
  // COUNTS
  // ==========================================================

  const completedBookings =
    useMemo(() => {

      return bookings.filter(
        (booking) =>
          bookingHasEnded(
            booking
          ) &&
          validBooking(
            booking
          )
      );

    }, [bookings]);


  const eligibleBookings =
    useMemo(() => {

      return completedBookings.filter(
        (booking) =>
          !reviewByBookingId(
            booking.id
          )
      );

    }, [
      completedBookings,
      reviews,
    ]);


  const reviewedBookings =
    useMemo(() => {

      return completedBookings.filter(
        (booking) =>
          Boolean(
            reviewByBookingId(
              booking.id
            )
          )
      );

    }, [
      completedBookings,
      reviews,
    ]);


  // ==========================================================
  // FILTERED LIST
  // ==========================================================

  const visibleBookings =
    useMemo(() => {

      let list =
        completedBookings;


      if (
        filter === 'eligible'
      ) {

        list =
          eligibleBookings;
      }


      if (
        filter === 'reviewed'
      ) {

        list =
          reviewedBookings;
      }


      const query =
        search
          .trim()
          .toLowerCase();


      if (!query) {
        return list;
      }


      return list.filter(
        (booking) => {

          const property =
            properties.find(
              (item) =>
                item.id ===
                booking.property_id
            );


          const guest =
            guests.find(
              (item) =>
                item.id ===
                booking.guest_id
            );


          const haystack = [
            booking.booking_code,
            property?.name,
            property?.area,
            property?.city,
            guest?.full_name,
            guest?.phone,
            guest?.email,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();


          return haystack.includes(
            query
          );
        }
      );

    }, [
      filter,
      search,
      completedBookings,
      eligibleBookings,
      reviewedBookings,
      properties,
      guests,
    ]);


  // ==========================================================
  // LOGOUT
  // ==========================================================

  async function logout() {

    await supabase.auth.signOut();

    window.location.replace(
      '/login'
    );
  }


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {

    return (
      <main className="loadingPage">
        Loading Host Reviews...

        <Styles />
      </main>
    );
  }


  // ==========================================================
  // ERROR
  // ==========================================================

  if (error) {

    return (
      <main className="loadingPage">

        <div className="errorBox">

          <strong>
            Unable to load Host Reviews
          </strong>

          <span>
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
          >
            Try Again
          </button>

        </div>

        <Styles />

      </main>
    );
  }


  // ==========================================================
  // PAGE
  // ==========================================================

  return (
    <main className="page">

      {/* ======================================================
          HOST HEADER
      ====================================================== */}
      {/* ======================================================
          CONTENT
      ====================================================== */}

      <section className="content">

        <div className="pageHeading">

          <div>

            <p className="eyebrow">
              HOST REVIEWS
            </p>

            <h1>
              Guest Reviews
            </h1>

            <p className="subtitle">
              Review guests after their
              completed stays and view
              your previous feedback.
            </p>

          </div>


          <div className="hostName">

            <span>
              Host
            </span>

            <strong>
              {host?.business_name ||
                host?.full_name ||
                'Host'}
            </strong>

          </div>

        </div>


        {/* ====================================================
            SUMMARY
        ==================================================== */}

        <section className="summaryGrid">

          <SummaryCard
            label="Completed Stays"
            value={
              completedBookings.length
            }
          />

          <SummaryCard
            label="Eligible To Review"
            value={
              eligibleBookings.length
            }
            highlight
          />

          <SummaryCard
            label="Reviewed"
            value={
              reviewedBookings.length
            }
          />

          <SummaryCard
            label="Properties"
            value={
              properties.length
            }
          />

        </section>


        {/* ====================================================
            FILTERS
        ==================================================== */}

        <section className="filterPanel">

          <div className="filterButtons">

            <button
              type="button"
              onClick={() =>
                setFilter(
                  'eligible'
                )
              }
              className={
                filter === 'eligible'
                  ? 'filterButton active'
                  : 'filterButton'
              }
            >
              Eligible To Review

              <span>
                {eligibleBookings.length}
              </span>
            </button>


            <button
              type="button"
              onClick={() =>
                setFilter(
                  'reviewed'
                )
              }
              className={
                filter === 'reviewed'
                  ? 'filterButton active'
                  : 'filterButton'
              }
            >
              Reviewed

              <span>
                {reviewedBookings.length}
              </span>
            </button>


            <button
              type="button"
              onClick={() =>
                setFilter(
                  'all'
                )
              }
              className={
                filter === 'all'
                  ? 'filterButton active'
                  : 'filterButton'
              }
            >
              All Completed Stays

              <span>
                {completedBookings.length}
              </span>
            </button>

          </div>


          <div className="searchWrap">

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search guest, property or booking code"
            />

          </div>

        </section>


        {/* ====================================================
            BOOKING LIST
        ==================================================== */}

        <section className="reviewPanel">

          <div className="panelHeading">

            <div>

              <h2>
                {filter === 'eligible'
                  ? 'Guests Waiting For Review'
                  : filter ===
                      'reviewed'
                  ? 'Reviewed Guests'
                  : 'Completed Stays'}
              </h2>

              <p>
                Reviews are available
                only after a valid
                completed stay.
              </p>

            </div>

          </div>


          {visibleBookings.length ===
          0 ? (

            <div className="emptyState">

              <div className="emptyIcon">
                ✓
              </div>

              <h3>
                {filter === 'eligible'
                  ? 'No reviews pending'
                  : filter ===
                      'reviewed'
                  ? 'No reviewed stays yet'
                  : 'No completed stays yet'}
              </h3>

              <p>
                {filter === 'eligible'
                  ? 'All eligible completed stays have been reviewed.'
                  : 'Completed guest stays will appear here automatically.'}
              </p>

            </div>

          ) : (

            <div className="bookingList">

              {visibleBookings.map(
                (booking) => {

                  const property =
                    propertyById(
                      booking.property_id
                    );


                  const guest =
                    guestById(
                      booking.guest_id
                    );


                  const review =
                    reviewByBookingId(
                      booking.id
                    );


                  return (

                    <article
                      key={booking.id}
                      className="bookingCard"
                    >

                      <div className="bookingMain">

                        <div className="guestAvatar">

                          {(guest?.full_name ||
                            guest?.email ||
                            'G')
                            .charAt(0)
                            .toUpperCase()}

                        </div>


                        <div className="bookingDetails">

                          <div className="bookingTitleRow">

                            <div>

                              <span className="bookingCode">
                                {booking.booking_code ||
                                  'BOOKING'}
                              </span>

                              <h3>
                                {guest?.full_name ||
                                  'Guest'}
                              </h3>

                              <p>
                                {guest?.email ||
                                  guest?.phone ||
                                  'Guest contact not available'}
                              </p>

                            </div>


                            {review ? (

                              <span className="reviewedBadge">
                                Reviewed
                              </span>

                            ) : (

                              <span className="eligibleBadge">
                                Ready To Review
                              </span>

                            )}

                          </div>


                          <div className="propertyBox">

                            <strong>
                              {property?.name ||
                                'Property'}
                            </strong>

                            <span>
                              {[
                                property?.area,
                                property?.city,
                              ]
                                .filter(
                                  Boolean
                                )
                                .join(', ') ||
                                property?.location_name ||
                                'Location not available'}
                            </span>

                          </div>


                          <div className="bookingInfoGrid">

                            <Info
                              label="Check-in"
                              value={
                                formatDate(
                                  booking.check_in
                                )
                              }
                            />

                            <Info
                              label="Check-out"
                              value={
                                formatDate(
                                  booking.check_out
                                )
                              }
                            />

                            <Info
                              label="Guests"
                              value={
                                booking.guests_count ??
                                '—'
                              }
                            />

                            <Info
                              label="Nights"
                              value={
                                booking.nights ??
                                '—'
                              }
                            />

                            <Info
                              label="Payment"
                              value={
                                prettyStatus(
                                  booking.payment_status
                                )
                              }
                            />

                            <Info
                              label="Booking Value"
                              value={`₹${Number(
                                booking.amount_including_gst ??
                                  booking.final_payable_amount ??
                                  booking.total_amount ??
                                  0
                              ).toLocaleString(
                                'en-IN'
                              )}`}
                            />

                          </div>


                          {review && (

                            <div className="existingReview">

                              <div>

                                <span>
                                  Your Rating
                                </span>

                                <strong>
                                  ★{' '}
                                  {review.rating ??
                                    '—'}{' '}
                                  / 5
                                </strong>

                              </div>


                              {review.public_review && (

                                <p>
                                  {review.public_review}
                                </p>

                              )}

                            </div>

                          )}

                        </div>

                      </div>


                      <div className="bookingActions">

                        <a
                          href={`/host/reviews/${booking.id}`}
                          className={
                            review
                              ? 'secondaryAction'
                              : 'primaryAction'
                          }
                        >
                          {review
                            ? 'View Review'
                            : 'Review Guest'}
                        </a>

                        <a
                          href={`/host/reviews/${booking.id}?report=1`}
                          className="reportAction"
                        >
                          Report Misconduct
                        </a>

                      </div>

                    </article>
                  );
                }
              )}

            </div>

          )}

        </section>


        {/* ====================================================
            INFORMATION
        ==================================================== */}

        <section className="informationBox">

          <div className="informationIcon">
            i
          </div>

          <div>

            <strong>
              About Guest Reviews
            </strong>

            <p>
              Reviews become available
              after checkout for valid
              confirmed or paid stays.
              Public feedback may be
              visible to the guest.
              Private remarks sent to
              NightOutStays are visible
              only to the Admin team.
            </p>

          </div>

        </section>

      </section>


      <Styles />

    </main>
  );
}


// ============================================================
// COMPONENTS
// ============================================================

function SummaryCard({
  label,
  value,
  highlight = false,
}) {

  return (
    <div
      className={
        highlight
          ? 'summaryCard highlight'
          : 'summaryCard'
      }
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}


function Info({
  label,
  value,
}) {

  return (
    <div className="info">

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  );
}


function prettyStatus(
  value
) {

  if (!value) {
    return '—';
  }


  return String(value)
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


function formatDate(
  value
) {

  if (!value) {
    return '—';
  }


  try {

    return new Date(
      `${value}T00:00:00`
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


// ============================================================
// STYLES
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


      .errorBox {

        width: 100%;

        max-width: 480px;

        display: flex;

        flex-direction: column;

        gap: 12px;

        padding: 25px;

        border: 1px solid #fecaca;

        border-radius: 14px;

        background: white;
      }


      .errorBox strong {

        color: #b91c1c;

        font-size: 18px;
      }


      .errorBox span {

        color: #6b7280;

        font-size: 13px;
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


      /* ======================================================
         HEADER
      ====================================================== */


      .hostHeader {

        position: sticky;

        top: 0;

        z-index: 100;

        border-bottom:
          1px solid #e5e7eb;

        background: #ffffff;
      }


      .topRow {

        min-height: 72px;

        display: flex;

        align-items: center;

        justify-content:
          space-between;

        gap: 20px;

        padding: 0 32px;

        border-bottom:
          1px solid #eef0f2;
      }


      .topRow > div:first-child {

        display: flex;

        align-items: center;

        gap: 12px;
      }


      .brand {

        color: #f00078;

        font-size: 25px;

        font-weight: 900;

        text-decoration: none;
      }


      .hostBadge {

        min-height: 27px;

        display: inline-flex;

        align-items: center;

        padding: 0 11px;

        border-radius: 999px;

        background: #111827;

        color: white;

        font-size: 10px;

        font-weight: 900;

        letter-spacing: .8px;
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

        border:
          1px solid #d1d5db;

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

        min-height: 38px;

        display: inline-flex;

        align-items: center;

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


      /* ======================================================
         CONTENT
      ====================================================== */


      .content {

        width: 100%;

        max-width: 1500px;

        margin: 0 auto;

        padding: 32px;
      }


      .pageHeading {

        display: flex;

        align-items: flex-start;

        justify-content:
          space-between;

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


      .pageHeading h1 {

        margin: 0;

        color: #111827;

        font-size: 34px;
      }


      .subtitle {

        margin: 8px 0 0;

        color: #6b7280;

        font-size: 15px;
      }


      .hostName {

        min-width: 220px;

        padding: 14px 17px;

        border:
          1px solid #e5e7eb;

        border-radius: 12px;

        background: white;
      }


      .hostName span {

        display: block;

        margin-bottom: 5px;

        color: #6b7280;

        font-size: 10px;

        font-weight: 800;

        text-transform: uppercase;
      }


      .hostName strong {

        color: #111827;

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

        min-height: 105px;

        padding: 20px;

        border:
          1px solid #e5e7eb;

        border-radius: 14px;

        background: white;
      }


      .summaryCard.highlight {

        border-color: #ffc3df;

        background: #fff4f9;
      }


      .summaryCard span {

        display: block;

        margin-bottom: 10px;

        color: #6b7280;

        font-size: 12px;

        font-weight: 800;
      }


      .summaryCard strong {

        color: #111827;

        font-size: 30px;
      }


      .summaryCard.highlight strong {

        color: #f00078;
      }


      /* ======================================================
         FILTER
      ====================================================== */


      .filterPanel {

        display: flex;

        align-items: center;

        justify-content:
          space-between;

        gap: 18px;

        padding: 16px;

        margin-bottom: 20px;

        border:
          1px solid #e5e7eb;

        border-radius: 14px;

        background: white;
      }


      .filterButtons {

        display: flex;

        flex-wrap: wrap;

        gap: 8px;
      }


      .filterButton {

        min-height: 39px;

        display: inline-flex;

        align-items: center;

        gap: 8px;

        padding: 0 13px;

        border:
          1px solid #d1d5db;

        border-radius: 8px;

        background: white;

        color: #4b5563;

        font-size: 11px;

        font-weight: 800;

        cursor: pointer;
      }


      .filterButton span {

        min-width: 21px;

        height: 21px;

        display: inline-flex;

        align-items: center;

        justify-content: center;

        padding: 0 5px;

        border-radius: 999px;

        background: #f3f4f6;

        font-size: 9px;
      }


      .filterButton.active {

        border-color: #111827;

        background: #111827;

        color: white;
      }


      .filterButton.active span {

        background:
          rgba(
            255,
            255,
            255,
            .18
          );

        color: white;
      }


      .searchWrap {

        width: 100%;

        max-width: 370px;
      }


      .searchWrap input {

        width: 100%;

        min-height: 41px;

        padding: 0 13px;

        border:
          1px solid #d1d5db;

        border-radius: 8px;

        outline: none;

        font-size: 12px;
      }


      .searchWrap input:focus {

        border-color: #f00078;
      }


      /* ======================================================
         PANEL
      ====================================================== */


      .reviewPanel {

        overflow: hidden;

        margin-bottom: 20px;

        border:
          1px solid #e5e7eb;

        border-radius: 14px;

        background: white;
      }


      .panelHeading {

        padding: 20px;

        border-bottom:
          1px solid #eef0f2;
      }


      .panelHeading h2 {

        margin: 0;

        font-size: 18px;
      }


      .panelHeading p {

        margin: 6px 0 0;

        color: #6b7280;

        font-size: 12px;
      }


      .bookingList {

        padding: 16px;
      }


      .bookingCard {

        padding: 18px;

        margin-bottom: 14px;

        border:
          1px solid #e5e7eb;

        border-radius: 13px;

        background: #ffffff;
      }


      .bookingCard:last-child {

        margin-bottom: 0;
      }


      .bookingMain {

        display: flex;

        align-items:
          flex-start;

        gap: 15px;
      }


      .guestAvatar {

        width: 52px;

        height: 52px;

        flex: 0 0 52px;

        display: flex;

        align-items: center;

        justify-content: center;

        border-radius: 13px;

        background: #e8f0f9;

        color: #f00078;

        font-size: 20px;

        font-weight: 900;
      }


      .bookingDetails {

        width: 100%;
      }


      .bookingTitleRow {

        display: flex;

        align-items:
          flex-start;

        justify-content:
          space-between;

        gap: 15px;
      }


      .bookingCode {

        display: block;

        margin-bottom: 4px;

        color: #6b7280;

        font-size: 9px;

        font-weight: 900;

        letter-spacing: .8px;
      }


      .bookingTitleRow h3 {

        margin: 0;

        font-size: 18px;
      }


      .bookingTitleRow p {

        margin: 4px 0 0;

        color: #6b7280;

        font-size: 11px;
      }


      .eligibleBadge,
      .reviewedBadge {

        min-height: 28px;

        display: inline-flex;

        align-items: center;

        padding: 0 10px;

        border-radius: 999px;

        font-size: 9px;

        font-weight: 900;

        white-space: nowrap;
      }


      .eligibleBadge {

        background: #fff3da;

        color: #946100;
      }


      .reviewedBadge {

        background: #e5f7eb;

        color: #14743b;
      }


      .propertyBox {

        display: flex;

        flex-direction: column;

        gap: 4px;

        padding: 12px 14px;

        margin-top: 14px;

        border-radius: 9px;

        background: #f8fafc;
      }


      .propertyBox strong {

        color: #111827;

        font-size: 12px;
      }


      .propertyBox span {

        color: #6b7280;

        font-size: 10px;
      }


      .bookingInfoGrid {

        display: grid;

        grid-template-columns:
          repeat(
            6,
            minmax(0, 1fr)
          );

        gap: 8px;

        margin-top: 12px;
      }


      .info {

        min-height: 62px;

        padding: 10px;

        border:
          1px solid #eef0f2;

        border-radius: 8px;

        background: #ffffff;
      }


      .info span {

        display: block;

        margin-bottom: 6px;

        color: #6b7280;

        font-size: 9px;

        font-weight: 800;

        text-transform: uppercase;
      }


      .info strong {

        color: #111827;

        font-size: 11px;
      }


      .existingReview {

        display: flex;

        align-items:
          flex-start;

        gap: 20px;

        padding: 13px;

        margin-top: 12px;

        border:
          1px solid #bbf7d0;

        border-radius: 9px;

        background: #f0fdf4;
      }


      .existingReview span {

        display: block;

        margin-bottom: 4px;

        color: #6b7280;

        font-size: 9px;

        font-weight: 800;

        text-transform: uppercase;
      }


      .existingReview strong {

        color: #166534;

        font-size: 12px;
      }


      .existingReview p {

        margin: 0;

        color: #4b5563;

        font-size: 11px;

        line-height: 1.5;
      }


      .bookingActions {

        display: flex;

        flex-wrap: wrap;

        gap: 8px;

        padding-top: 14px;

        margin-top: 14px;

        border-top:
          1px solid #eef0f2;
      }


      .primaryAction,
      .secondaryAction,
      .reportAction {

        min-height: 39px;

        display: inline-flex;

        align-items: center;

        justify-content: center;

        padding: 0 15px;

        border-radius: 8px;

        text-decoration: none;

        font-size: 11px;

        font-weight: 900;
      }


      .primaryAction {

        background: #111827;

        color: white;
      }


      .secondaryAction {

        border:
          1px solid #d1d5db;

        background: white;

        color: #111827;
      }


      .reportAction {

        border:
          1px solid #fecaca;

        background: #fff7f7;

        color: #b42318;
      }


      /* ======================================================
         EMPTY
      ====================================================== */


      .emptyState {

        min-height: 290px;

        display: flex;

        flex-direction: column;

        align-items: center;

        justify-content: center;

        padding: 35px;

        text-align: center;
      }


      .emptyIcon {

        width: 52px;

        height: 52px;

        display: flex;

        align-items: center;

        justify-content: center;

        margin-bottom: 14px;

        border-radius: 50%;

        background: #f3f4f6;

        color: #374151;

        font-size: 20px;

        font-weight: 900;
      }


      .emptyState h3 {

        margin: 0 0 8px;

        font-size: 18px;
      }


      .emptyState p {

        max-width: 430px;

        margin: 0;

        color: #6b7280;

        font-size: 13px;

        line-height: 1.6;
      }


      /* ======================================================
         INFO
      ====================================================== */


      .informationBox {

        display: flex;

        gap: 15px;

        padding: 18px;

        border:
          1px solid #ffd9eb;

        border-radius: 14px;

        background: #fff4f9;
      }


      .informationIcon {

        width: 34px;

        height: 34px;

        flex: 0 0 34px;

        display: flex;

        align-items: center;

        justify-content: center;

        border-radius: 50%;

        background: #f00078;

        color: white;

        font-weight: 900;
      }


      .informationBox strong {

        display: block;

        margin-bottom: 5px;
      }


      .informationBox p {

        margin: 0;

        color: #4b5563;

        font-size: 13px;

        line-height: 1.6;
      }


      /* ======================================================
         RESPONSIVE
      ====================================================== */


      @media (
        max-width: 1100px
      ) {

        .bookingInfoGrid {

          grid-template-columns:
            repeat(
              3,
              minmax(0, 1fr)
            );
        }

      }


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


        .filterPanel {

          align-items: stretch;

          flex-direction: column;
        }


        .searchWrap {

          max-width: none;
        }

      }


      @media (
        max-width: 650px
      ) {

        .topRow {

          min-height: 64px;

          padding: 0 14px;
        }


        .brand {

          font-size: 20px;
        }


        .hostBadge {

          padding: 0 8px;

          font-size: 9px;
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


        .pageHeading {

          flex-direction: column;
        }


        .hostName {

          width: 100%;

          min-width: 0;
        }


        .pageHeading h1 {

          font-size: 28px;
        }


        .summaryGrid {

          grid-template-columns:
            1fr;
        }


        .bookingMain {

          flex-direction: column;
        }


        .bookingTitleRow {

          width: 100%;
        }


        .bookingInfoGrid {

          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
        }


        .existingReview {

          flex-direction: column;

          gap: 10px;
        }


        .primaryAction,
        .secondaryAction,
        .reportAction {

          width: 100%;
        }

      }

    `}</style>
  );
}