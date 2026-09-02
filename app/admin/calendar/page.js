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

function monthStart(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );
}

function monthEnd(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0
  );
}

function toDateString(date) {
  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1
    ).padStart(2, '0'),
    String(
      date.getDate()
    ).padStart(2, '0'),
  ].join('-');
}

function parseDate(value) {
  return new Date(
    `${value}T12:00:00`
  );
}

function formatMonth(date) {
  return date.toLocaleDateString(
    'en-IN',
    {
      month: 'long',
      year: 'numeric',
    }
  );
}

function formatDate(value) {
  if (!value) {
    return '—';
  }

  return parseDate(
    value
  ).toLocaleDateString(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }
  );
}

function dateInStay(
  dateString,
  checkIn,
  checkOut
) {
  return (
    dateString >= checkIn &&
    dateString < checkOut
  );
}

function dateInBlock(
  dateString,
  startDate,
  endDate
) {
  return (
    dateString >= startDate &&
    dateString <= endDate
  );
}

function guestInitials(name) {
  const words = String(
    name || ''
  )
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return 'G';
  }

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    words[0][0] +
    words[
      words.length - 1
    ][0]
  ).toUpperCase();
}

function guestShortName(name) {
  const words = String(
    name || ''
  )
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return 'Guest';
  }

  if (words.length === 1) {
    return words[0];
  }

  return `${words[0]} ${words[1][0]}.`;
}

function sourceLabel(source) {
  const value = String(
    source || ''
  ).toLowerCase();

  if (value === 'airbnb') {
    return 'Airbnb';
  }

  if (
    value === 'booking.com' ||
    value === 'booking_com'
  ) {
    return 'Booking.com';
  }

  if (value === 'manual') {
    return 'Host Blocked';
  }

  if (
    value === 'nightoutstays'
  ) {
    return 'NightOutStays';
  }

  return source || 'Other Portal';
}

function getInterestStage(
  booking
) {
  if (
    booking.booking_status ===
      'confirmed' &&
    booking.payment_status ===
      'paid'
  ) {
    return 'Property Booked';
  }

  if (
    booking.offer_status ===
    'host_offered'
  ) {
    return 'Special Offer Sent';
  }

  if (
    booking.offer_status ===
      'accepted' &&
    booking.payment_status !==
      'paid'
  ) {
    return 'Payment Pending';
  }

  if (
    booking.host_decision ===
      'approved' &&
    booking.payment_status !==
      'paid'
  ) {
    return 'Host Approved';
  }

  if (
    booking.guest_discount_requested
  ) {
    return 'Asked for Extra Discount';
  }

  if (
    booking.booking_status ===
    'pending'
  ) {
    return 'Booking Requested';
  }

  return 'Booking Interest';
}

export default function AdminCalendarPage() {
  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState('');

  const [
    properties,
    setProperties,
  ] = useState([]);

  const [
    selectedPropertyId,
    setSelectedPropertyId,
  ] = useState('');

  const [
    bookings,
    setBookings,
  ] = useState([]);

  const [
    blockedDates,
    setBlockedDates,
  ] = useState([]);

  const [
    currentMonth,
    setCurrentMonth,
  ] = useState(
    monthStart(new Date())
  );

  const [
    selectedDate,
    setSelectedDate,
  ] = useState('');

  useEffect(() => {
    initialise();
  }, []);

  useEffect(() => {
    if (
      !selectedPropertyId
    ) {
      return;
    }

    loadCalendarData(
      selectedPropertyId
    );
  }, [
    selectedPropertyId,
  ]);

  useEffect(() => {
    if (
      !selectedPropertyId
    ) {
      return;
    }

    const bookingChannel =
      supabase
        .channel(
          `calendar-bookings-${selectedPropertyId}`
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bookings',
            filter:
              `property_id=eq.${selectedPropertyId}`,
          },
          () => {
            loadCalendarData(
              selectedPropertyId
            );
          }
        )
        .subscribe();

    const blockedChannel =
      supabase
        .channel(
          `calendar-blocked-${selectedPropertyId}`
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table:
              'blocked_dates',
            filter:
              `property_id=eq.${selectedPropertyId}`,
          },
          () => {
            loadCalendarData(
              selectedPropertyId
            );
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        bookingChannel
      );

      supabase.removeChannel(
        blockedChannel
      );
    };
  }, [
    selectedPropertyId,
  ]);

  async function initialise() {
    setLoading(true);
    setError('');

    try {
      const {
        data: {
          session,
        },
        error:
          sessionError,
      } =
        await supabase.auth
          .getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (
        !session?.user
      ) {
        window.location.href =
          '/admin/bookings';

        return;
      }

      /*
        Verify that this user
        exists in admin_profiles.

        This is more reliable than
        relying only on user metadata.
      */

      const {
        data:
          adminProfile,
        error:
          adminError,
      } =
        await supabase
          .from(
            'admin_profiles'
          )
          .select(
            'user_id, role, is_active'
          )
          .eq(
            'user_id',
            session.user.id
          )
          .eq(
            'is_active',
            true
          )
          .maybeSingle();

      if (
        adminError
      ) {
        throw adminError;
      }

      if (
        !adminProfile
      ) {
        setError(
          'Admin access not available for this login.'
        );

        setLoading(false);
        return;
      }

      const {
        data:
          propertyRows,
        error:
          propertyError,
      } =
        await supabase
          .from(
            'properties'
          )
          .select(`
            id,
            name,
            slug,
            location_name,
            is_active
          `)
          .eq(
            'is_active',
            true
          )
          .order(
            'name',
            {
              ascending:
                true,
            }
          );

      if (
        propertyError
      ) {
        throw propertyError;
      }

      const rows =
        propertyRows || [];

      setProperties(
        rows
      );

      if (
        rows.length
      ) {
        setSelectedPropertyId(
          rows[0].id
        );
      }
    } catch (
      initError
    ) {
      console.error(
        initError
      );

      setError(
        initError.message ||
          'Unable to load host calendar.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadCalendarData(
    propertyId
  ) {
    if (!propertyId) {
      return;
    }

    setError('');

    try {
      const [
        bookingResult,
        blockedResult,
      ] =
        await Promise.all([
          supabase
            .from(
              'bookings'
            )
            .select(`
              id,
              booking_code,
              property_id,
              guest_id,
              check_in,
              check_out,
              guests_count,
              booking_status,
              payment_status,
              host_decision,
              host_decided_at,
              guest_discount_requested,
              offer_status,
              host_offer_final_amount,
              final_payable_amount,
              total_amount,
              created_at,
              guests (
                id,
                full_name,
                phone,
                email
              )
            `)
            .eq(
              'property_id',
              propertyId
            )
            .not(
              'booking_status',
              'eq',
              'cancelled'
            )
            .not(
              'booking_status',
              'eq',
              'declined'
            )
            .order(
              'check_in',
              {
                ascending:
                  true,
              }
            ),

          supabase
            .from(
              'blocked_dates'
            )
            .select(`
              id,
              property_id,
              start_date,
              end_date,
              reason,
              source,
              external_uid,
              created_at
            `)
            .eq(
              'property_id',
              propertyId
            )
            .order(
              'start_date',
              {
                ascending:
                  true,
              }
            ),
        ]);

      if (
        bookingResult.error
      ) {
        throw bookingResult.error;
      }

      if (
        blockedResult.error
      ) {
        throw blockedResult.error;
      }

      setBookings(
        bookingResult.data ||
          []
      );

      setBlockedDates(
        blockedResult.data ||
          []
      );
    } catch (
      loadError
    ) {
      console.error(
        loadError
      );

      setError(
        loadError.message ||
          'Unable to load calendar data.'
      );
    }
  }

  const selectedProperty =
    useMemo(
      () =>
        properties.find(
          (
            property
          ) =>
            property.id ===
            selectedPropertyId
        ) || null,
      [
        properties,
        selectedPropertyId,
      ]
    );

  const calendarDays =
    useMemo(() => {
      const first =
        monthStart(
          currentMonth
        );

      const last =
        monthEnd(
          currentMonth
        );

      const startOffset =
        first.getDay();

      const days = [];

      for (
        let index = 0;
        index <
        startOffset;
        index++
      ) {
        days.push(null);
      }

      for (
        let day = 1;
        day <=
        last.getDate();
        day++
      ) {
        days.push(
          new Date(
            currentMonth
              .getFullYear(),
            currentMonth
              .getMonth(),
            day
          )
        );
      }

      while (
        days.length %
          7 !==
        0
      ) {
        days.push(null);
      }

      return days;
    }, [
      currentMonth,
    ]);

  function getDayInfo(
    dateString
  ) {
    const dayBookings =
      bookings.filter(
        (
          booking
        ) =>
          dateInStay(
            dateString,
            booking.check_in,
            booking.check_out
          )
      );

    const paidBooking =
      dayBookings.find(
        (
          booking
        ) =>
          booking.booking_status ===
            'confirmed' &&
          booking.payment_status ===
            'paid'
      );

    const unpaidInterests =
      dayBookings.filter(
        (
          booking
        ) =>
          !(
            booking.booking_status ===
              'confirmed' &&
            booking.payment_status ===
              'paid'
          )
      );

    const dayBlocks =
      blockedDates.filter(
        (
          block
        ) =>
          dateInBlock(
            dateString,
            block.start_date,
            block.end_date
          )
      );

    const externalBlock =
      dayBlocks.find(
        (
          block
        ) =>
          String(
            block.source ||
              ''
          ).toLowerCase() !==
          'manual'
      );

    const manualBlock =
      dayBlocks.find(
        (
          block
        ) =>
          String(
            block.source ||
              ''
          ).toLowerCase() ===
          'manual'
      );

    if (
      paidBooking
    ) {
      return {
        type:
          'booked',

        paidBooking,

        interestCount:
          unpaidInterests.length,
      };
    }

    if (
      externalBlock
    ) {
      return {
        type:
          'external',

        externalBlock,

        interestCount:
          unpaidInterests.length,
      };
    }

    if (
      manualBlock
    ) {
      return {
        type:
          'manual',

        manualBlock,

        interestCount:
          unpaidInterests.length,
      };
    }

    if (
      unpaidInterests.length >
      0
    ) {
      return {
        type:
          'interest',

        interestCount:
          unpaidInterests.length,
      };
    }

    return {
      type:
        'available',

      interestCount: 0,
    };
  }

  const selectedDayDetails =
    useMemo(() => {
      if (
        !selectedDate
      ) {
        return {
          paidBookings:
            [],
          interests:
            [],
          blocks:
            [],
        };
      }

      const dayBookings =
        bookings.filter(
          (
            booking
          ) =>
            dateInStay(
              selectedDate,
              booking.check_in,
              booking.check_out
            )
        );

      const paidBookings =
        dayBookings.filter(
          (
            booking
          ) =>
            booking.booking_status ===
              'confirmed' &&
            booking.payment_status ===
              'paid'
        );

      const interests =
        dayBookings.filter(
          (
            booking
          ) =>
            !(
              booking.booking_status ===
                'confirmed' &&
              booking.payment_status ===
                'paid'
            )
        );

      const blocks =
        blockedDates.filter(
          (
            block
          ) =>
            dateInBlock(
              selectedDate,
              block.start_date,
              block.end_date
            )
        );

      return {
        paidBookings,
        interests,
        blocks,
      };
    }, [
      selectedDate,
      bookings,
      blockedDates,
    ]);

  function previousMonth() {
    setCurrentMonth(
      new Date(
        currentMonth
          .getFullYear(),
        currentMonth
          .getMonth() -
          1,
        1
      )
    );

    setSelectedDate('');
  }

  function nextMonth() {
    setCurrentMonth(
      new Date(
        currentMonth
          .getFullYear(),
        currentMonth
          .getMonth() +
          1,
        1
      )
    );

    setSelectedDate('');
  }

  function goToday() {
    const today =
      new Date();

    setCurrentMonth(
      monthStart(
        today
      )
    );

    setSelectedDate(
      toDateString(
        today
      )
    );
  }

  if (loading) {
    return (
      <main className="calendar-loading">
        Loading host calendar...
      </main>
    );
  }

  return (
    <main className="calendar-page">

      <section className="calendar-container">

        <div className="calendar-title-row">

          <div>
            <h1>
              Property Calendar
            </h1>

            <p>
              View NightOutStays bookings, booking interest, host-blocked dates and bookings from other portals.
            </p>
          </div>

          <div className="calendar-actions">

            <button
              type="button"
              className="secondary-button"
              onClick={
                goToday
              }
            >
              Today
            </button>

            <button
              type="button"
              className="primary-button"
              disabled={
                !selectedPropertyId
              }
              onClick={() =>
                loadCalendarData(
                  selectedPropertyId
                )
              }
            >
              Refresh
            </button>

          </div>
        </div>

        {error && (
          <div className="calendar-error">
            {error}
          </div>
        )}

        <div className="property-selector">

          <label>
            <span>
              PROPERTY
            </span>

            <select
              value={
                selectedPropertyId
              }
              onChange={
                (
                  event
                ) => {
                  setSelectedPropertyId(
                    event
                      .target
                      .value
                  );

                  setSelectedDate(
                    ''
                  );
                }
              }
            >
              {properties.map(
                (
                  property
                ) => (
                  <option
                    key={
                      property.id
                    }
                    value={
                      property.id
                    }
                  >
                    {
                      property.name
                    }

                    {property.location_name
                      ? ` — ${property.location_name}`
                      : ''}
                  </option>
                )
              )}
            </select>
          </label>

          <div className="selected-property">

            <strong>
              {selectedProperty
                ?.name ||
                'No property selected'}
            </strong>

            <span>
              {selectedProperty
                ?.location_name ||
                ''}
            </span>

          </div>
        </div>

        <div className="calendar-legend">

          <Legend
            type="booked"
            label="Property Booked"
          />

          <Legend
            type="interest"
            label="Booking Requested"
          />

          <Legend
            type="approved"
            label="Booking Accepted"
          />

          <Legend
            type="external"
            label="Booked by Other Portal"
          />

          <Legend
            type="manual"
            label="Host Blocked"
          />

          <Legend
            type="available"
            label="Available"
          />

        </div>

        <div className="calendar-layout">

          <section className="calendar-card">

            <div className="month-header">

              <button
                type="button"
                onClick={
                  previousMonth
                }
              >
                ‹
              </button>

              <h2>
                {formatMonth(
                  currentMonth
                )}
              </h2>

              <button
                type="button"
                onClick={
                  nextMonth
                }
              >
                ›
              </button>

            </div>

            <div className="week-header">

              {[
                'Sun',
                'Mon',
                'Tue',
                'Wed',
                'Thu',
                'Fri',
                'Sat',
              ].map(
                (
                  day
                ) => (
                  <div
                    key={
                      day
                    }
                  >
                    {day}
                  </div>
                )
              )}

            </div>

            <div className="calendar-grid">

              {calendarDays.map(
                (
                  date,
                  index
                ) => {

                  if (
                    !date
                  ) {
                    return (
                      <div
                        key={
                          `empty-${index}`
                        }
                        className="empty-day"
                      />
                    );
                  }

                  const dateString =
                    toDateString(
                      date
                    );

                  const info =
                    getDayInfo(
                      dateString
                    );

                  const selected =
                    selectedDate ===
                    dateString;

                  return (
                    <button
                      key={
                        dateString
                      }
                      type="button"
                      className={[
                        'calendar-day',
                        info.type,
                        selected
                          ? 'selected'
                          : '',
                      ]
                        .filter(
                          Boolean
                        )
                        .join(
                          ' '
                        )}
                      onClick={() =>
                        setSelectedDate(
                          dateString
                        )
                      }
                    >
                      <div className="day-top">

                        <span className="day-number">
                          {date.getDate()}
                        </span>

                        {info.type ===
                          'booked' && (
                          <span className="guest-initials">
                            {guestInitials(
                              info
                                .paidBooking
                                ?.guests
                                ?.full_name
                            )}
                          </span>
                        )}

                      </div>

                      {info.type ===
                        'booked' && (
                        <div className="booking-name">
                          {guestShortName(
                            info
                              .paidBooking
                              ?.guests
                              ?.full_name
                          )}
                        </div>
                      )}

                      {info.type ===
                        'external' && (
                        <div className="external-label">
                          {sourceLabel(
                            info
                              .externalBlock
                              ?.source
                          )}
                        </div>
                      )}

                      {info.type ===
                        'manual' && (
                        <div className="manual-label">
                          Host Blocked
                        </div>
                      )}

                      {info.interestCount >
                        0 && (
                        <div className="interest-label">
                          {
                            info.interestCount
                          }{' '}
                          Interested
                        </div>
                      )}

                    </button>
                  );
                }
              )}

            </div>

          </section>

          <aside className="calendar-side">

            <section className="side-card">

              <h3>
                Date Details
              </h3>

              {!selectedDate ? (
                <p className="empty-detail">
                  Select any date on the calendar to view booking details.
                </p>
              ) : (
                <>
                  <div className="selected-date">
                    {formatDate(
                      selectedDate
                    )}
                  </div>

                  {selectedDayDetails
                    .paidBookings
                    .length ===
                    0 &&
                    selectedDayDetails
                      .interests
                      .length ===
                      0 &&
                    selectedDayDetails
                      .blocks
                      .length ===
                      0 && (
                      <div className="available-box">
                        Available
                      </div>
                    )}

                  {selectedDayDetails
                    .paidBookings
                    .length >
                    0 && (
                    <DetailSection
                      title="Confirmed Booking"
                    >
                      {selectedDayDetails
                        .paidBookings
                        .map(
                          (
                            booking
                          ) => (
                            <BookingDetail
                              key={
                                booking.id
                              }
                              booking={
                                booking
                              }
                              paid
                            />
                          )
                        )}
                    </DetailSection>
                  )}

                  {selectedDayDetails
                    .interests
                    .length >
                    0 && (
                    <DetailSection
                      title="Interested Guests"
                    >
                      {selectedDayDetails
                        .interests
                        .map(
                          (
                            booking
                          ) => (
                            <InterestDetail
                              key={
                                booking.id
                              }
                              booking={
                                booking
                              }
                            />
                          )
                        )}
                    </DetailSection>
                  )}

                  {selectedDayDetails
                    .blocks
                    .length >
                    0 && (
                    <DetailSection
                      title="Calendar Blocks"
                    >
                      {selectedDayDetails
                        .blocks
                        .map(
                          (
                            block
                          ) => (
                            <BlockDetail
                              key={
                                block.id
                              }
                              block={
                                block
                              }
                            />
                          )
                        )}
                    </DetailSection>
                  )}

                </>
              )}

            </section>

            <section className="side-card">

              <h3>
                Calendar Sync
              </h3>

              <p className="sync-description">
                Connect this property calendar with Airbnb, Booking.com and other portals.
              </p>

              <div className="sync-property-box">

                <span>
                  Property
                </span>

                <strong>
                  {selectedProperty
                    ?.name ||
                    'Select property'}
                </strong>

              </div>

              <div className="sync-section">

                <h4>
                  NightOutStays Export Calendar
                </h4>

                <p>
                  This calendar link can later be added to Airbnb, Booking.com or another compatible website.
                </p>

                {selectedPropertyId ? (
                  <div className="ical-row">

                    <input
                      readOnly
                      value={
                        typeof window !==
                        'undefined'
                          ? `${window.location.origin}/api/calendar/${selectedPropertyId}.ics`
                          : ''
                      }
                    />

                    <button
                      type="button"
                      onClick={
                        async () => {
                          try {
                            const url =
                              `${window.location.origin}/api/calendar/${selectedPropertyId}.ics`;

                            await navigator
                              .clipboard
                              .writeText(
                                url
                              );

                            alert(
                              'Calendar link copied.'
                            );
                          } catch (
                            copyError
                          ) {
                            console.error(
                              copyError
                            );

                            alert(
                              'Unable to copy calendar link.'
                            );
                          }
                        }
                      }
                    >
                      Copy
                    </button>

                  </div>
                ) : (
                  <p>
                    Select a property first.
                  </p>
                )}

              </div>

              <div className="sync-divider" />

              <div className="sync-section">

                <h4>
                  Import External Calendar
                </h4>

                <p>
                  Airbnb or another portal&apos;s iCal URL will be added here so externally booked dates can automatically appear on this calendar.
                </p>

                <select disabled>
                  <option>
                    Airbnb
                  </option>

                  <option>
                    Booking.com
                  </option>

                  <option>
                    Other Portal
                  </option>
                </select>

                <input
                  disabled
                  placeholder="Paste external iCal URL"
                />

                <button
                  disabled
                  type="button"
                  className="disabled-button"
                >
                  Add Calendar
                </button>

              </div>

            </section>

          </aside>

        </div>

      </section>

      <style jsx global>{`

        .calendar-page {
          min-height: 100vh;
          background: #f5f7fa;
          color: #102a43;
          font-family: Arial, sans-serif;
        }

        .calendar-loading {
          min-height: 70vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #174f91;
          font-weight: 700;
          font-family: Arial, sans-serif;
        }

        .calendar-container {
          width: 94%;
          max-width: 1450px;
          margin: 0 auto;
          padding: 32px 0 70px;
        }

        .calendar-title-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 20px;
          flex-wrap: wrap;
        }

        .calendar-title-row h1 {
          margin: 0;
          font-size: 30px;
        }

        .calendar-title-row p {
          margin: 7px 0 0;
          color: #667085;
          font-size: 14px;
          max-width: 700px;
        }

        .calendar-actions {
          display: flex;
          gap: 10px;
        }

        .primary-button,
        .secondary-button {
          padding: 11px 18px;
          border-radius: 9px;
          font-weight: 800;
          cursor: pointer;
        }

        .primary-button {
          border: 0;
          background: #174f91;
          color: white;
        }

        .secondary-button {
          border: 1px solid #ccd4dd;
          background: white;
          color: #174f91;
        }

        .calendar-error {
          margin-top: 18px;
          padding: 14px;
          border-radius: 10px;
          background: #fdeaea;
          color: #9c2d2d;
          font-weight: 700;
        }

        .property-selector {
          margin-top: 22px;
          background: white;
          border: 1px solid #dfe4ea;
          border-radius: 15px;
          padding: 18px;

          display: grid;
          grid-template-columns:
            minmax(280px, 480px)
            1fr;

          gap: 25px;
          align-items: end;
        }

        .property-selector label {
          display: grid;
          gap: 8px;
        }

        .property-selector label span {
          font-size: 11px;
          font-weight: 800;
          color: #475467;
        }

        .property-selector select {
          width: 100%;
          padding: 13px;
          border: 1px solid #ccd4dd;
          border-radius: 10px;
          background: white;
          font-size: 14px;
        }

        .selected-property {
          display: grid;
          gap: 4px;
        }

        .selected-property span {
          color: #667085;
          font-size: 13px;
        }

        .calendar-legend {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 17px;
          margin: 16px 0;
          color: #475467;
          font-size: 12px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .legend-dot {
          width: 15px;
          height: 15px;
          border-radius: 4px;
          border: 1px solid;
        }

        .calendar-layout {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            380px;

          gap: 20px;
          align-items: start;
        }

        .calendar-card {
          background: white;
          border: 1px solid #dfe4ea;
          border-radius: 16px;
          overflow: hidden;
          min-width: 0;
        }

        .month-header {
          min-height: 68px;

          display: grid;
          grid-template-columns:
            60px 1fr 60px;

          align-items: center;

          border-bottom:
            1px solid #e4e7ec;
        }

        .month-header h2 {
          margin: 0;
          text-align: center;
          font-size: 21px;
        }

        .month-header button {
          border: 0;
          background: transparent;
          color: #174f91;
          font-size: 32px;
          cursor: pointer;
        }

        .week-header {
          display: grid;
          grid-template-columns:
            repeat(
              7,
              minmax(
                0,
                1fr
              )
            );

          background: #f8fafc;
        }

        .week-header div {
          padding: 12px 4px;
          text-align: center;
          color: #667085;
          font-size: 11px;
          font-weight: 800;
        }

        .calendar-grid {
          display: grid;

          grid-template-columns:
            repeat(
              7,
              minmax(
                0,
                1fr
              )
            );
        }

        .calendar-day,
        .empty-day {
          min-height: 108px;
          border: 0;
          border-top:
            1px solid #edf0f3;
          border-right:
            1px solid #edf0f3;
        }

        .empty-day {
          background: #fafbfc;
        }

        .calendar-day {
          padding: 8px;
          background: white;
          text-align: left;
          cursor: pointer;
          color: #102a43;
        }

        .calendar-day.selected {
          outline:
            3px solid #174f91;
          outline-offset:
            -3px;
        }

        .calendar-day.booked {
          background: #e7f6eb;
        }

        .calendar-day.interest {
          background: #fff8e5;
        }

        .calendar-day.external {
          background: #f4eeff;
        }

        .calendar-day.manual {
          background: #fdeeee;
        }

        .day-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 5px;
        }

        .day-number {
          font-size: 14px;
          font-weight: 800;
        }

        .guest-initials {
          background: #24723a;
          color: white;
          padding: 4px 7px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 800;
        }

        .booking-name,
        .interest-label,
        .external-label,
        .manual-label {
          margin-top: 10px;
          padding-left: 6px;
          font-size: 10px;
          font-weight: 800;
        }

        .booking-name {
          border-left:
            3px solid #24723a;
        }

        .interest-label {
          border-left:
            3px solid #d7a628;
          color: #886207;
        }

        .external-label {
          border-left:
            3px solid #7d58b5;
        }

        .manual-label {
          border-left:
            3px solid #c95d5d;
        }

        .calendar-side {
          display: grid;
          gap: 18px;
        }

        .side-card {
          background: white;
          border: 1px solid #dfe4ea;
          border-radius: 16px;
          padding: 20px;
        }

        .side-card h3 {
          margin: 0;
          font-size: 20px;
        }

        .empty-detail {
          color: #667085;
          line-height: 1.5;
        }

        .selected-date {
          margin-top: 15px;
          padding-bottom: 12px;
          border-bottom:
            1px solid #edf0f3;
          font-weight: 800;
        }

        .available-box {
          margin-top: 15px;
          padding: 12px;
          border-radius: 9px;
          background: #edf8f0;
          color: #24723a;
          font-weight: 800;
        }

        .detail-section {
          margin-top: 18px;
        }

        .detail-section-title {
          font-weight: 800;
          margin-bottom: 10px;
        }

        .booking-detail,
        .interest-detail,
        .block-detail {
          margin-top: 10px;
          padding: 13px;
          border-radius: 10px;
          display: grid;
          gap: 8px;
        }

        .booking-detail {
          background: #f3faf5;
          border: 1px solid #cfe6d5;
        }

        .interest-detail {
          background: #fffbef;
          border: 1px solid #ebdca8;
        }

        .block-detail {
          background: #faf7ff;
          border: 1px solid #ddd0f1;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          font-size: 12px;
        }

        .detail-row span {
          color: #667085;
        }

        .detail-row strong {
          text-align: right;
          word-break: break-word;
        }

        .status-green {
          color: #24723a;
          font-weight: 800;
        }

        .status-yellow {
          color: #886207;
          font-weight: 800;
        }

        .status-purple {
          color: #7047a6;
          font-weight: 800;
        }

        .sync-description {
          color: #667085;
          line-height: 1.5;
        }

        .sync-property-box {
          margin-top: 16px;
          padding: 13px;
          background: #f7f9fc;
          border-radius: 10px;
          display: grid;
          gap: 4px;
        }

        .sync-property-box span {
          color: #667085;
          font-size: 12px;
        }

        .sync-section {
          margin-top: 22px;
        }

        .sync-section h4 {
          margin-bottom: 6px;
        }

        .sync-section p {
          color: #667085;
          font-size: 13px;
          line-height: 1.5;
        }

        .ical-row {
          display: flex;
          gap: 8px;
        }

        .ical-row input,
        .sync-section select,
        .sync-section > input {
          width: 100%;
          padding: 11px;
          border: 1px solid #ccd4dd;
          border-radius: 9px;
          box-sizing: border-box;
        }

        .ical-row button {
          border: 0;
          background: #174f91;
          color: white;
          padding: 0 15px;
          border-radius: 9px;
          font-weight: 800;
          cursor: pointer;
        }

        .sync-divider {
          height: 1px;
          background: #e4e7ec;
          margin: 24px 0;
        }

        .sync-section select,
        .sync-section > input {
          margin-top: 8px;
        }

        .disabled-button {
          width: 100%;
          margin-top: 9px;
          padding: 11px;
          border: 0;
          border-radius: 9px;
          background: #d0d5dd;
          color: white;
        }

        @media (
          max-width: 900px
        ) {

          .calendar-layout {
            grid-template-columns:
              1fr;
          }

          .property-selector {
            grid-template-columns:
              1fr;
          }

          .calendar-side {
            grid-template-columns:
              1fr;
          }

        }

        @media (
          max-width: 650px
        ) {

          .calendar-container {
            width: 94%;
            padding-top: 24px;
          }

          .calendar-title-row {
            align-items:
              stretch;
          }

          .calendar-title-row h1 {
            font-size: 26px;
          }

          .calendar-actions {
            width: 100%;
          }

          .calendar-actions button {
            flex: 1;
          }

          .calendar-card {
            overflow-x: auto;
          }

          .month-header,
          .week-header,
          .calendar-grid {
            min-width: 650px;
          }

          .calendar-day,
          .empty-day {
            min-height: 92px;
          }

          .calendar-side {
            width: 100%;
          }

          .ical-row {
            display: grid;
            grid-template-columns:
              1fr;
          }

          .ical-row button {
            padding: 11px;
          }

        }

      `}</style>

    </main>
  );
}

function Legend({
  type,
  label,
}) {
  const colors = {
    booked: [
      '#e4f5e9',
      '#68a979',
    ],

    interest: [
      '#fff5d9',
      '#d9af47',
    ],

    approved: [
      '#e6f1ff',
      '#7fa8d8',
    ],

    external: [
      '#f0e8ff',
      '#9471cc',
    ],

    manual: [
      '#fde9e9',
      '#d98686',
    ],

    available: [
      '#ffffff',
      '#ccd3dc',
    ],
  };

  const color =
    colors[type] ||
    colors.available;

  return (
    <div className="legend-item">

      <span
        className="legend-dot"
        style={{
          background:
            color[0],
          borderColor:
            color[1],
        }}
      />

      {label}

    </div>
  );
}

function DetailSection({
  title,
  children,
}) {
  return (
    <div className="detail-section">

      <div className="detail-section-title">
        {title}
      </div>

      {children}

    </div>
  );
}

function DetailRow({
  label,
  value,
}) {
  return (
    <div className="detail-row">

      <span>
        {label}
      </span>

      <strong>
        {value || '—'}
      </strong>

    </div>
  );
}

function BookingDetail({
  booking,
}) {
  return (
    <div className="booking-detail">

      <div className="status-green">
        Property Booked
      </div>

      <DetailRow
        label="Guest"
        value={
          booking
            .guests
            ?.full_name ||
          'Guest'
        }
      />

      <DetailRow
        label="Guests"
        value={
          booking.guests_count ||
          1
        }
      />

      <DetailRow
        label="Booking ID"
        value={
          booking.booking_code
        }
      />

      <DetailRow
        label="Check-in"
        value={
          formatDate(
            booking.check_in
          )
        }
      />

      <DetailRow
        label="Check-out"
        value={
          formatDate(
            booking.check_out
          )
        }
      />

      <DetailRow
        label="Payment"
        value="Paid"
      />

      {booking
        .guests
        ?.phone && (
        <DetailRow
          label="Phone"
          value={
            booking
              .guests
              .phone
          }
        />
      )}

    </div>
  );
}

function InterestDetail({
  booking,
}) {
  const stage =
    getInterestStage(
      booking
    );

  const amount =
    booking
      .host_offer_final_amount ||
    booking
      .final_payable_amount ||
    booking.total_amount;

  return (
    <div className="interest-detail">

      <div className="status-yellow">
        {stage}
      </div>

      <DetailRow
        label="Guest"
        value={
          booking
            .guests
            ?.full_name ||
          'Guest'
        }
      />

      <DetailRow
        label="Guests"
        value={
          booking.guests_count ||
          1
        }
      />

      <DetailRow
        label="Booking ID"
        value={
          booking.booking_code
        }
      />

      <DetailRow
        label="Check-in"
        value={
          formatDate(
            booking.check_in
          )
        }
      />

      <DetailRow
        label="Check-out"
        value={
          formatDate(
            booking.check_out
          )
        }
      />

      <DetailRow
        label="Payment"
        value={
          booking.payment_status ||
          'unpaid'
        }
      />

      {amount && (
        <DetailRow
          label="Current Amount"
          value={`₹${Number(
            amount
          ).toLocaleString(
            'en-IN'
          )}`}
        />
      )}

    </div>
  );
}

function BlockDetail({
  block,
}) {
  const manual =
    String(
      block.source ||
        ''
    ).toLowerCase() ===
    'manual';

  return (
    <div className="block-detail">

      <div className="status-purple">
        {manual
          ? 'Host Blocked'
          : 'Booked by Other Portal'}
      </div>

      <DetailRow
        label="Source"
        value={
          sourceLabel(
            block.source
          )
        }
      />

      <DetailRow
        label="From"
        value={
          formatDate(
            block.start_date
          )
        }
      />

      <DetailRow
        label="To"
        value={
          formatDate(
            block.end_date
          )
        }
      />

      <DetailRow
        label="Remark"
        value={
          block.reason ||
          (manual
            ? 'Blocked by host'
            : 'External booking')
        }
      />

    </div>
  );
}