'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  useParams,
  useSearchParams,
} from 'next/navigation';

import {
  createClient,
} from '@supabase/supabase-js';


const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);


export default function HostGuestReviewPage() {

  const params = useParams();
  const searchParams = useSearchParams();

  const bookingId =
    params?.bookingId;

  const openReportInitially =
    searchParams?.get('report') === '1';


  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [reportSaving, setReportSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  const [reportSuccess, setReportSuccess] =
    useState('');

  const [host, setHost] =
    useState(null);

  const [booking, setBooking] =
    useState(null);

  const [property, setProperty] =
    useState(null);

  const [guest, setGuest] =
    useState(null);

  const [review, setReview] =
    useState(null);

  const [privateNote, setPrivateNote] =
    useState('');

  const [reportOpen, setReportOpen] =
    useState(openReportInitially);

  const [existingReports, setExistingReports] =
    useState([]);


  // ==========================================================
  // REVIEW FORM
  // ==========================================================

  const [rating, setRating] =
    useState(0);

  const [
    keptPropertyClean,
    setKeptPropertyClean,
  ] = useState(null);

  const [
    nuisanceCreated,
    setNuisanceCreated,
  ] = useState(null);

  const [
    leftPropertyOnTime,
    setLeftPropertyOnTime,
  ] = useState(null);

  const [
    recommendToHosts,
    setRecommendToHosts,
  ] = useState(null);

  const [
    publicReview,
    setPublicReview,
  ] = useState('');

  const [
    adminRemark,
    setAdminRemark,
  ] = useState('');


  // ==========================================================
  // MISCONDUCT FORM
  // ==========================================================

  const [
    misconductCategory,
    setMisconductCategory,
  ] = useState('');

  const [
    misconductDescription,
    setMisconductDescription,
  ] = useState('');


  useEffect(() => {

    if (bookingId) {
      loadPage();
    }

  }, [bookingId]);


  // ==========================================================
  // LOAD PAGE
  // ==========================================================

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
          `/login?redirect=/host/reviews/${bookingId}`
        );

        return;
      }


      // ======================================================
      // ROLE
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
      // HOST
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
      // BOOKING
      // ======================================================

      const {
        data: bookingData,
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
            cleaning_fee,
            security_deposit,
            total_amount,
            booking_status,
            payment_status,
            final_payable_amount,
            amount_including_gst,
            paid_at,
            verification_status,
            host_decision,
            created_at
          `)
          .eq(
            'id',
            bookingId
          )
          .maybeSingle();


      if (bookingError) {
        throw bookingError;
      }


      if (!bookingData) {

        throw new Error(
          'Booking could not be found.'
        );
      }


      // ======================================================
      // PROPERTY
      // ======================================================

      const {
        data: propertyData,
        error: propertyError,
      } =
        await supabase
          .from('properties')
          .select(`
            id,
            host_id,
            name,
            slug,
            area,
            city,
            location_name,
            address,
            property_type
          `)
          .eq(
            'id',
            bookingData.property_id
          )
          .maybeSingle();


      if (propertyError) {
        throw propertyError;
      }


      if (!propertyData) {

        throw new Error(
          'Property could not be found.'
        );
      }


      if (
        propertyData.host_id !==
        hostData.id
      ) {

        throw new Error(
          'You do not have access to this booking.'
        );
      }


      setBooking(
        bookingData
      );

      setProperty(
        propertyData
      );


      // ======================================================
      // GUEST
      // ======================================================

      const {
        data: guestData,
        error: guestError,
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
          .eq(
            'id',
            bookingData.guest_id
          )
          .maybeSingle();


      if (guestError) {
        throw guestError;
      }


      setGuest(
        guestData || null
      );


      // ======================================================
      // EXISTING REVIEW
      // ======================================================

      const {
        data: reviewData,
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
            'booking_id',
            bookingData.id
          )
          .eq(
            'host_id',
            hostData.id
          )
          .maybeSingle();


      if (reviewError) {
        throw reviewError;
      }


      if (reviewData) {

        setReview(
          reviewData
        );

        setRating(
          reviewData.rating || 0
        );

        setKeptPropertyClean(
          reviewData.kept_property_clean
        );

        setNuisanceCreated(
          reviewData.nuisance_created
        );

        setLeftPropertyOnTime(
          reviewData.left_property_on_time
        );

        setRecommendToHosts(
          reviewData.recommend_to_hosts
        );

        setPublicReview(
          reviewData.public_review || ''
        );


        // ----------------------------------------------------
        // Host intentionally cannot read private Admin notes.
        // ----------------------------------------------------

        setPrivateNote('');

      }


      // ======================================================
      // EXISTING MISCONDUCT REPORTS
      // ======================================================

      const {
        data: reportRows,
        error: reportError,
      } =
        await supabase
          .from('misconduct_reports')
          .select(`
            id,
            booking_id,
            property_id,
            reporter_type,
            reporter_host_id,
            reported_type,
            reported_guest_id,
            category,
            description,
            status,
            created_at,
            updated_at
          `)
          .eq(
            'booking_id',
            bookingData.id
          )
          .eq(
            'reporter_type',
            'host'
          )
          .eq(
            'reporter_host_id',
            hostData.id
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          );


      if (reportError) {
        throw reportError;
      }


      setExistingReports(
        reportRows || []
      );

    } catch (err) {

      console.error(err);

      setError(
        err?.message ||
          'Unable to load Guest Review.'
      );

    } finally {

      setLoading(false);

    }
  }


  // ==========================================================
  // REVIEW ELIGIBILITY
  // ==========================================================

  function bookingHasEnded() {

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


  function validBooking() {

    if (!booking) {
      return false;
    }


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


  const reviewEligible =
    bookingHasEnded() &&
    validBooking();


  // ==========================================================
  // SUBMIT REVIEW
  // ==========================================================

  async function submitReview(
    event
  ) {

    event.preventDefault();


    if (review) {

      setError(
        'A review has already been submitted for this stay.'
      );

      return;
    }


    if (!reviewEligible) {

      setError(
        'This booking is not yet eligible for review.'
      );

      return;
    }


    if (
      !rating ||
      rating < 1 ||
      rating > 5
    ) {

      setError(
        'Please select a rating from 1 to 5.'
      );

      return;
    }


    if (
      keptPropertyClean === null ||
      nuisanceCreated === null ||
      leftPropertyOnTime === null ||
      recommendToHosts === null
    ) {

      setError(
        'Please answer all Guest behaviour questions.'
      );

      return;
    }


    try {

      setSaving(true);
      setError('');
      setSuccess('');


      // ======================================================
      // INSERT PUBLIC/STRUCTURED REVIEW
      // ======================================================

      const {
        data: insertedReview,
        error: insertError,
      } =
        await supabase
          .from('guest_reviews')
          .insert({
            booking_id:
              booking.id,

            property_id:
              property.id,

            guest_id:
              guest.id,

            host_id:
              host.id,

            rating:
              rating,

            kept_property_clean:
              keptPropertyClean,

            nuisance_created:
              nuisanceCreated,

            left_property_on_time:
              leftPropertyOnTime,

            recommend_to_hosts:
              recommendToHosts,

            public_review:
              publicReview.trim() ||
              null,
          })
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
          .single();


      if (insertError) {
        throw insertError;
      }


      // ======================================================
      // PRIVATE ADMIN REMARK
      //
      // IMPORTANT:
      // Host cannot directly insert into the Admin-only
      // private table because RLS intentionally blocks it.
      //
      // The secure RPC for this private remark is added in
      // the next database step.
      //
      // Until that RPC exists, we do not silently expose or
      // store this remark in guest_reviews.
      // ======================================================

      if (
        adminRemark.trim()
      ) {

        const {
          error: privateError,
        } =
          await supabase.rpc(
            'host_submit_guest_review_private_note',
            {
              p_guest_review_id:
                insertedReview.id,

              p_booking_id:
                booking.id,

              p_guest_id:
                guest.id,

              p_host_id:
                host.id,

              p_private_note:
                adminRemark.trim(),
            }
          );


        if (privateError) {

          console.error(
            'Private Admin remark error:',
            privateError
          );

          setReview(
            insertedReview
          );

          setSuccess(
            'Guest review was submitted, but the private Admin remark could not be saved.'
          );

          return;
        }
      }


      setReview(
        insertedReview
      );

      setPrivateNote(
        adminRemark.trim()
      );

      setSuccess(
        'Guest review submitted successfully.'
      );


    } catch (err) {

      console.error(err);

      let message =
        err?.message ||
        'Unable to submit Guest review.';


      if (
        String(message)
          .toLowerCase()
          .includes(
            'duplicate'
          )
      ) {

        message =
          'A review has already been submitted for this booking.';
      }


      setError(
        message
      );

    } finally {

      setSaving(false);

    }
  }


  // ==========================================================
  // SUBMIT MISCONDUCT REPORT
  // ==========================================================

  async function submitMisconductReport(
    event
  ) {

    event.preventDefault();


    if (
      !misconductCategory
    ) {

      setError(
        'Please select a misconduct category.'
      );

      return;
    }


    if (
      misconductDescription
        .trim()
        .length < 10
    ) {

      setError(
        'Please describe the issue in at least 10 characters.'
      );

      return;
    }


    try {

      setReportSaving(true);

      setError('');

      setReportSuccess('');


      const {
        data: insertedReport,
        error: insertError,
      } =
        await supabase
          .from(
            'misconduct_reports'
          )
          .insert({
            booking_id:
              booking.id,

            property_id:
              property.id,

            reporter_type:
              'host',

            reporter_host_id:
              host.id,

            reporter_guest_id:
              null,

            reported_type:
              'guest',

            reported_guest_id:
              guest.id,

            reported_host_id:
              null,

            category:
              misconductCategory,

            description:
              misconductDescription.trim(),

            status:
              'open',
          })
          .select(`
            id,
            booking_id,
            property_id,
            reporter_type,
            reporter_host_id,
            reported_type,
            reported_guest_id,
            category,
            description,
            status,
            created_at,
            updated_at
          `)
          .single();


      if (insertError) {
        throw insertError;
      }


      setExistingReports(
        (current) => [
          insertedReport,
          ...current,
        ]
      );


      setMisconductCategory('');

      setMisconductDescription('');

      setReportSuccess(
        'Misconduct report submitted to NightOutStays Admin.'
      );


    } catch (err) {

      console.error(err);

      setError(
        err?.message ||
          'Unable to submit misconduct report.'
      );

    } finally {

      setReportSaving(false);

    }
  }


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

        Loading Guest Review...

        <Styles />

      </main>
    );
  }


  // ==========================================================
  // ERROR PAGE
  // ==========================================================

  if (
    error &&
    !booking
  ) {

    return (
      <main className="loadingPage">

        <div className="errorBox">

          <strong>
            Unable to load Guest Review
          </strong>

          <span>
            {error}
          </span>

          <a href="/host/reviews">
            Back to Reviews
          </a>

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
          HEADER
      ====================================================== */}
      {/* ======================================================
          CONTENT
      ====================================================== */}

      <section className="content">

        <div className="backRow">

          <a href="/host/reviews">
            ← Back to Guest Reviews
          </a>

        </div>


        <div className="pageHeading">

          <div>

            <p className="eyebrow">
              HOST REVIEW
            </p>

            <h1>
              Review Guest
            </h1>

            <p className="subtitle">
              Share feedback about this
              completed stay.
            </p>

          </div>


          {review ? (

            <span className="reviewedBadge">
              Review Submitted
            </span>

          ) : reviewEligible ? (

            <span className="eligibleBadge">
              Ready To Review
            </span>

          ) : (

            <span className="notEligibleBadge">
              Not Yet Eligible
            </span>

          )}

        </div>


        {/* ====================================================
            BOOKING DETAILS
        ==================================================== */}

        <section className="bookingCard">

          <div className="bookingTop">

            <div className="guestAvatar">

              {(guest?.full_name ||
                guest?.email ||
                'G')
                .charAt(0)
                .toUpperCase()}

            </div>


            <div>

              <span className="bookingCode">
                {booking?.booking_code ||
                  'BOOKING'}
              </span>

              <h2>
                {guest?.full_name ||
                  'Guest'}
              </h2>

              <p>
                {guest?.email ||
                  guest?.phone ||
                  'Guest contact unavailable'}
              </p>

            </div>

          </div>


          <div className="propertyBox">

            <span>
              Property
            </span>

            <strong>
              {property?.name ||
                'Property'}
            </strong>

            <small>
              {[
                property?.area,
                property?.city,
              ]
                .filter(Boolean)
                .join(', ') ||
                property?.location_name ||
                'Location not available'}
            </small>

          </div>


          <div className="bookingGrid">

            <Info
              label="Check-in"
              value={
                formatDate(
                  booking?.check_in
                )
              }
            />

            <Info
              label="Check-out"
              value={
                formatDate(
                  booking?.check_out
                )
              }
            />

            <Info
              label="Guests"
              value={
                booking?.guests_count ??
                '—'
              }
            />

            <Info
              label="Nights"
              value={
                booking?.nights ??
                '—'
              }
            />

            <Info
              label="Booking Status"
              value={
                prettyStatus(
                  booking?.booking_status
                )
              }
            />

            <Info
              label="Payment"
              value={
                prettyStatus(
                  booking?.payment_status
                )
              }
            />

          </div>

        </section>


        {/* ====================================================
            MESSAGE
        ==================================================== */}

        {error && (

          <div className="message errorMessage">
            {error}
          </div>

        )}


        {success && (

          <div className="message successMessage">
            {success}
          </div>

        )}


        {/* ====================================================
            REVIEW
        ==================================================== */}

        <section className="formCard">

          <div className="sectionHeading">

            <div>

              <h2>
                Guest Review
              </h2>

              <p>
                Your feedback helps
                NightOutStays maintain
                responsible Guest
                behaviour.
              </p>

            </div>

          </div>


          {review ? (

            <div className="submittedReview">

              <ReviewResult
                label="Rating"
                value={`★ ${review.rating || '—'} / 5`}
              />

              <ReviewResult
                label="Kept Property Clean"
                value={
                  yesNo(
                    review.kept_property_clean
                  )
                }
              />

              <ReviewResult
                label="Nuisance Created"
                value={
                  yesNo(
                    review.nuisance_created
                  )
                }
              />

              <ReviewResult
                label="Left Property On Time"
                value={
                  yesNo(
                    review.left_property_on_time
                  )
                }
              />

              <ReviewResult
                label="Recommend To Other Hosts"
                value={
                  yesNo(
                    review.recommend_to_hosts
                  )
                }
              />


              <div className="reviewTextBox">

                <span>
                  Public Review
                </span>

                <p>
                  {review.public_review ||
                    'No public review added.'}
                </p>

              </div>


              <div className="privateInfo">

                <strong>
                  Private Admin Remark
                </strong>

                <p>
                  Private remarks are
                  stored separately and
                  are visible only to the
                  NightOutStays Admin
                  team. Hosts and Guests
                  cannot retrieve Admin
                  private-note records.
                </p>

              </div>

            </div>

          ) : !reviewEligible ? (

            <div className="notEligibleBox">

              <strong>
                Review is not available yet
              </strong>

              <p>
                Reviews become available
                only after checkout for a
                valid confirmed or paid
                booking.
              </p>

            </div>

          ) : (

            <form
              onSubmit={
                submitReview
              }
            >

              {/* RATING */}

              <div className="fieldBlock">

                <label>
                  Overall Guest Rating
                </label>

                <div className="ratingButtons">

                  {[1, 2, 3, 4, 5].map(
                    (value) => (

                      <button
                        key={value}
                        type="button"
                        className={
                          rating >= value
                            ? 'starButton selected'
                            : 'starButton'
                        }
                        onClick={() =>
                          setRating(
                            value
                          )
                        }
                      >
                        ★
                      </button>

                    )
                  )}

                  <strong>
                    {rating
                      ? `${rating} / 5`
                      : 'Select rating'}
                  </strong>

                </div>

              </div>


              <Question
                label="Did the Guest keep the property clean?"
                value={
                  keptPropertyClean
                }
                onChange={
                  setKeptPropertyClean
                }
              />


              <Question
                label="Did the Guest create any nuisance?"
                value={
                  nuisanceCreated
                }
                onChange={
                  setNuisanceCreated
                }
              />


              <Question
                label="Did the Guest leave the property on time?"
                value={
                  leftPropertyOnTime
                }
                onChange={
                  setLeftPropertyOnTime
                }
              />


              <Question
                label="Would you recommend this Guest to other Hosts?"
                value={
                  recommendToHosts
                }
                onChange={
                  setRecommendToHosts
                }
              />


              <div className="fieldBlock">

                <label>
                  Public Review
                </label>

                <p className="fieldHelp">
                  This feedback may be
                  visible to the Guest
                  and may later be used
                  in the Guest review
                  profile.
                </p>

                <textarea
                  value={
                    publicReview
                  }
                  onChange={(event) =>
                    setPublicReview(
                      event.target.value
                    )
                  }
                  maxLength={1500}
                  placeholder="Write your review about the Guest..."
                />

                <small>
                  {publicReview.length}
                  /1500
                </small>

              </div>


              <div className="fieldBlock privateField">

                <label>
                  Private Remark To Admin
                </label>

                <p className="fieldHelp">
                  This remark will not
                  be shown to the Guest.
                  It is intended only
                  for the NightOutStays
                  Admin team.
                </p>

                <textarea
                  value={
                    adminRemark
                  }
                  onChange={(event) =>
                    setAdminRemark(
                      event.target.value
                    )
                  }
                  maxLength={2000}
                  placeholder="Optional private information for Admin..."
                />

                <small>
                  {adminRemark.length}
                  /2000
                </small>

              </div>


              <div className="submitRow">

                <button
                  type="submit"
                  className="submitButton"
                  disabled={saving}
                >
                  {saving
                    ? 'Submitting...'
                    : 'Submit Guest Review'}
                </button>

              </div>

            </form>

          )}

        </section>


        {/* ====================================================
            MISCONDUCT
        ==================================================== */}

        <section className="misconductCard">

          <div className="misconductHeading">

            <div>

              <h2>
                Report Guest Misconduct
              </h2>

              <p>
                Use this only for a
                genuine issue related
                to this booking.
              </p>

            </div>


            <button
              type="button"
              className="reportToggle"
              onClick={() =>
                setReportOpen(
                  !reportOpen
                )
              }
            >
              {reportOpen
                ? 'Close'
                : 'Report Misconduct'}
            </button>

          </div>


          {reportOpen && (

            <div className="reportContent">

              {reportSuccess && (

                <div className="message successMessage">
                  {reportSuccess}
                </div>

              )}


              <form
                onSubmit={
                  submitMisconductReport
                }
              >

                <div className="fieldBlock">

                  <label>
                    Category
                  </label>

                  <select
                    value={
                      misconductCategory
                    }
                    onChange={(event) =>
                      setMisconductCategory(
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Select category
                    </option>

                    <option value="property_damage">
                      Property Damage
                    </option>

                    <option value="excessive_noise">
                      Excessive Noise / Nuisance
                    </option>

                    <option value="unauthorised_guests">
                      Unauthorised Guests
                    </option>

                    <option value="house_rules_violation">
                      House Rules Violation
                    </option>

                    <option value="late_checkout">
                      Late Checkout
                    </option>

                    <option value="cleanliness">
                      Serious Cleanliness Issue
                    </option>

                    <option value="safety">
                      Safety Concern
                    </option>

                    <option value="fraud">
                      Fraud / False Information
                    </option>

                    <option value="other">
                      Other
                    </option>

                  </select>

                </div>


                <div className="fieldBlock">

                  <label>
                    Describe The Issue
                  </label>

                  <textarea
                    value={
                      misconductDescription
                    }
                    onChange={(event) =>
                      setMisconductDescription(
                        event.target.value
                      )
                    }
                    maxLength={3000}
                    placeholder="Explain what happened..."
                  />

                  <small>
                    {misconductDescription.length}
                    /3000
                  </small>

                </div>


                <div className="evidenceInfo">

                  <strong>
                    Evidence Upload
                  </strong>

                  <p>
                    Photo/document evidence
                    will be added after the
                    private evidence storage
                    bucket is secured. Do not
                    send sensitive evidence
                    through public review text.
                  </p>

                </div>


                <button
                  type="submit"
                  className="dangerButton"
                  disabled={
                    reportSaving
                  }
                >
                  {reportSaving
                    ? 'Submitting Report...'
                    : 'Submit Misconduct Report'}
                </button>

              </form>

            </div>

          )}


          {existingReports.length > 0 && (

            <div className="existingReports">

              <h3>
                Your Reports For This Stay
              </h3>


              {existingReports.map(
                (report) => (

                  <div
                    key={report.id}
                    className="reportItem"
                  >

                    <div>

                      <strong>
                        {prettyStatus(
                          report.category
                        )}
                      </strong>

                      <span>
                        {formatDateTime(
                          report.created_at
                        )}
                      </span>

                    </div>


                    <p>
                      {report.description}
                    </p>


                    <span className="reportStatus">
                      {prettyStatus(
                        report.status
                      )}
                    </span>

                  </div>

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
// COMPONENTS
// ============================================================

function Question({
  label,
  value,
  onChange,
}) {

  return (

    <div className="fieldBlock">

      <label>
        {label}
      </label>


      <div className="choiceButtons">

        <button
          type="button"
          className={
            value === true
              ? 'choiceButton selected'
              : 'choiceButton'
          }
          onClick={() =>
            onChange(true)
          }
        >
          Yes
        </button>


        <button
          type="button"
          className={
            value === false
              ? 'choiceButton selected'
              : 'choiceButton'
          }
          onClick={() =>
            onChange(false)
          }
        >
          No
        </button>

      </div>

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


function ReviewResult({
  label,
  value,
}) {

  return (

    <div className="reviewResult">

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
// HELPERS
// ============================================================

function yesNo(value) {

  if (value === true) {
    return 'Yes';
  }

  if (value === false) {
    return 'No';
  }

  return '—';
}


function prettyStatus(value) {

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


function formatDate(value) {

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


function formatDateTime(value) {

  if (!value) {
    return '—';
  }


  try {

    return new Date(
      value
    ).toLocaleString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
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
      }

      .errorBox a {
        min-height: 42px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        background: #111827;
        color: white;
        text-decoration: none;
        font-weight: 800;
      }

      .hostHeader {
        position: sticky;
        top: 0;
        z-index: 100;
        border-bottom: 1px solid #e5e7eb;
        background: #ffffff;
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

      .content {
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
        padding: 32px;
      }

      .backRow {
        margin-bottom: 18px;
      }

      .backRow a {
        color: #f00078;
        font-size: 12px;
        font-weight: 800;
        text-decoration: none;
      }

      .pageHeading {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
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

      .pageHeading h1 {
        margin: 0;
        font-size: 34px;
      }

      .subtitle {
        margin: 8px 0 0;
        color: #6b7280;
        font-size: 15px;
      }

      .eligibleBadge,
      .reviewedBadge,
      .notEligibleBadge {
        min-height: 30px;
        display: inline-flex;
        align-items: center;
        padding: 0 11px;
        border-radius: 999px;
        font-size: 10px;
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

      .notEligibleBadge {
        background: #f3f4f6;
        color: #6b7280;
      }

      .bookingCard,
      .formCard,
      .misconductCard {
        margin-bottom: 20px;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        background: white;
      }

      .bookingCard {
        padding: 20px;
      }

      .bookingTop {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .guestAvatar {
        width: 54px;
        height: 54px;
        flex: 0 0 54px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 13px;
        background: #e8f0f9;
        color: #f00078;
        font-size: 20px;
        font-weight: 900;
      }

      .bookingCode {
        display: block;
        margin-bottom: 4px;
        color: #6b7280;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: .8px;
      }

      .bookingTop h2 {
        margin: 0;
        font-size: 19px;
      }

      .bookingTop p {
        margin: 4px 0 0;
        color: #6b7280;
        font-size: 11px;
      }

      .propertyBox {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 13px 15px;
        margin-top: 18px;
        border-radius: 9px;
        background: #f8fafc;
      }

      .propertyBox span {
        color: #6b7280;
        font-size: 9px;
        font-weight: 800;
        text-transform: uppercase;
      }

      .propertyBox strong {
        font-size: 13px;
      }

      .propertyBox small {
        color: #6b7280;
        font-size: 10px;
      }

      .bookingGrid {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 8px;
        margin-top: 12px;
      }

      .info {
        min-height: 63px;
        padding: 10px;
        border: 1px solid #eef0f2;
        border-radius: 8px;
      }

      .info span,
      .reviewResult span {
        display: block;
        margin-bottom: 6px;
        color: #6b7280;
        font-size: 9px;
        font-weight: 800;
        text-transform: uppercase;
      }

      .info strong,
      .reviewResult strong {
        font-size: 11px;
      }

      .message {
        padding: 13px 15px;
        margin-bottom: 16px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 700;
      }

      .errorMessage {
        border: 1px solid #fecaca;
        background: #fff1f2;
        color: #b42318;
      }

      .successMessage {
        border: 1px solid #bbf7d0;
        background: #f0fdf4;
        color: #166534;
      }

      .sectionHeading,
      .misconductHeading {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 20px;
        padding: 20px;
        border-bottom: 1px solid #eef0f2;
      }

      .sectionHeading h2,
      .misconductHeading h2 {
        margin: 0;
        font-size: 18px;
      }

      .sectionHeading p,
      .misconductHeading p {
        margin: 6px 0 0;
        color: #6b7280;
        font-size: 12px;
      }

      .formCard form,
      .submittedReview {
        padding: 20px;
      }

      .fieldBlock {
        padding: 18px 0;
        border-bottom: 1px solid #eef0f2;
      }

      .fieldBlock:first-child {
        padding-top: 0;
      }

      .fieldBlock label {
        display: block;
        margin-bottom: 8px;
        font-size: 13px;
        font-weight: 900;
      }

      .fieldHelp {
        margin: -2px 0 10px;
        color: #6b7280;
        font-size: 11px;
        line-height: 1.5;
      }

      .choiceButtons,
      .ratingButtons {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }

      .choiceButton {
        min-width: 78px;
        min-height: 39px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        background: white;
        color: #374151;
        font-weight: 800;
        cursor: pointer;
      }

      .choiceButton.selected {
        border-color: #111827;
        background: #111827;
        color: white;
      }

      .starButton {
        padding: 0;
        border: 0;
        background: transparent;
        color: #d1d5db;
        font-size: 29px;
        cursor: pointer;
      }

      .starButton.selected {
        color: #d99000;
      }

      .ratingButtons strong {
        margin-left: 8px;
        font-size: 12px;
      }

      textarea,
      select {
        width: 100%;
        border: 1px solid #d1d5db;
        border-radius: 9px;
        background: white;
        color: #111827;
        font-family: Arial, sans-serif;
        font-size: 12px;
        outline: none;
      }

      textarea {
        min-height: 120px;
        resize: vertical;
        padding: 12px;
      }

      select {
        min-height: 43px;
        padding: 0 11px;
      }

      textarea:focus,
      select:focus {
        border-color: #f00078;
      }

      .fieldBlock small {
        display: block;
        margin-top: 6px;
        color: #9ca3af;
        font-size: 9px;
        text-align: right;
      }

      .privateField {
        padding: 18px;
        margin-top: 18px;
        border: 1px solid #ffd9eb;
        border-radius: 10px;
        background: #fff4f9;
      }

      .submitRow {
        padding-top: 20px;
      }

      .submitButton,
      .dangerButton,
      .reportToggle {
        min-height: 42px;
        padding: 0 16px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 900;
        cursor: pointer;
      }

      .submitButton {
        border: 0;
        background: #111827;
        color: white;
      }

      .submitButton:disabled,
      .dangerButton:disabled {
        opacity: .6;
        cursor: not-allowed;
      }

      .submittedReview {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .reviewResult,
      .reviewTextBox,
      .privateInfo {
        padding: 14px;
        border: 1px solid #eef0f2;
        border-radius: 9px;
      }

      .reviewTextBox,
      .privateInfo {
        grid-column: 1 / -1;
      }

      .reviewTextBox span {
        display: block;
        margin-bottom: 7px;
        color: #6b7280;
        font-size: 9px;
        font-weight: 800;
        text-transform: uppercase;
      }

      .reviewTextBox p,
      .privateInfo p {
        margin: 0;
        color: #4b5563;
        font-size: 12px;
        line-height: 1.6;
      }

      .privateInfo {
        border-color: #ffd9eb;
        background: #fff4f9;
      }

      .privateInfo strong {
        display: block;
        margin-bottom: 6px;
        color: #f00078;
        font-size: 12px;
      }

      .notEligibleBox {
        padding: 30px 20px;
      }

      .notEligibleBox strong {
        display: block;
        margin-bottom: 7px;
      }

      .notEligibleBox p {
        margin: 0;
        color: #6b7280;
        font-size: 12px;
      }

      .reportToggle {
        border: 1px solid #fecaca;
        background: #fff7f7;
        color: #b42318;
      }

      .reportContent {
        padding: 20px;
      }

      .reportContent .fieldBlock:first-of-type {
        padding-top: 0;
      }

      .dangerButton {
        margin-top: 18px;
        border: 0;
        background: #b42318;
        color: white;
      }

      .evidenceInfo {
        padding: 14px;
        margin-top: 18px;
        border: 1px solid #e5e7eb;
        border-radius: 9px;
        background: #f9fafb;
      }

      .evidenceInfo strong {
        display: block;
        margin-bottom: 5px;
        font-size: 12px;
      }

      .evidenceInfo p {
        margin: 0;
        color: #6b7280;
        font-size: 11px;
        line-height: 1.5;
      }

      .existingReports {
        padding: 20px;
        border-top: 1px solid #eef0f2;
      }

      .existingReports h3 {
        margin: 0 0 14px;
        font-size: 14px;
      }

      .reportItem {
        position: relative;
        padding: 14px;
        margin-bottom: 10px;
        border: 1px solid #e5e7eb;
        border-radius: 9px;
      }

      .reportItem > div {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .reportItem strong {
        font-size: 12px;
      }

      .reportItem span {
        color: #6b7280;
        font-size: 9px;
      }

      .reportItem p {
        margin: 9px 0;
        color: #4b5563;
        font-size: 11px;
        line-height: 1.5;
      }

      .reportStatus {
        display: inline-flex;
        padding: 5px 8px;
        border-radius: 999px;
        background: #f3f4f6;
        color: #374151 !important;
        font-weight: 800;
      }

      @media (max-width: 1000px) {
        .bookingGrid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
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

        .pageHeading,
        .misconductHeading {
          flex-direction: column;
        }

        .pageHeading h1 {
          font-size: 28px;
        }

        .bookingGrid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .submittedReview {
          grid-template-columns: 1fr;
        }

        .reviewTextBox,
        .privateInfo {
          grid-column: auto;
        }

        .submitButton,
        .dangerButton,
        .reportToggle {
          width: 100%;
        }
      }

    `}</style>
  );
}