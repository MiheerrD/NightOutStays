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
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function parseDate(value) {
  return new Date(`${value}T12:00:00`);
}

function formatMonth(date) {
  return date.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

function formatDate(value) {
  if (!value) return '—';

  return parseDate(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function guestInitials(name) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return 'G';

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (
    words[0][0] +
    words[words.length - 1][0]
  ).toUpperCase();
}

function guestShortName(name) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return 'Guest';

  if (words.length === 1) {
    return words[0];
  }

  return `${words[0]} ${words[1][0]}.`;
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

function sourceLabel(source) {
  const value = String(source || '').toLowerCase();

  if (value === 'airbnb') {
    return 'Airbnb';
  }

  if (
    value === 'booking_com' ||
    value === 'booking.com'
  ) {
    return 'Booking.com';
  }

  if (value === 'manual') {
    return 'Host Blocked';
  }

  if (value === 'nightoutstays') {
    return 'NightOutStays';
  }

  return source || 'Other Portal';
}

function getInterestStage(booking) {
  if (
    booking.booking_status === 'confirmed' &&
    booking.payment_status === 'paid'
  ) {
    return 'paid';
  }

  if (
    booking.offer_status === 'host_offered'
  ) {
    return 'Special Offer Sent';
  }

  if (
    booking.offer_status === 'accepted' &&
    booking.payment_status !== 'paid'
  ) {
    return 'Payment Pending';
  }

  if (
    booking.host_decision === 'approved' &&
    booking.payment_status !== 'paid'
  ) {
    return 'Host Approved';
  }

  if (
    booking.guest_discount_requested
  ) {
    return 'Asked for Extra Discount';
  }

  if (
    booking.booking_status === 'pending'
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
    if (!selectedPropertyId) {
      return;
    }

    loadCalendarData(
      selectedPropertyId
    );
  }, [
    selectedPropertyId,
  ]);

  useEffect(() => {
    if (!selectedPropertyId) {
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
            table: 'blocked_dates',
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
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        window.location.href =
          '/login';

        return;
      }

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
              ascending: true,
            }
          );

      if (propertyError) {
        throw propertyError;
      }

      const rows =
        propertyRows || [];

      setProperties(
        rows
      );

      if (rows.length) {
        setSelectedPropertyId(
          rows[0].id
        );
      }
    } catch (initError) {
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
    setError('');

    try {
      const [
        bookingResult,
        blockedResult,
      ] =
        await Promise.all([
          supabase
            .from('bookings')
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
                ascending: true,
              }
            ),

          supabase
            .from('blocked_dates')
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
                ascending: true,
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
        bookingResult.data || []
      );

      setBlockedDates(
        blockedResult.data || []
      );
    } catch (loadError) {
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
          (property) =>
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
        index < startOffset;
        index++
      ) {
        days.push(null);
      }

      for (
        let day = 1;
        day <= last.getDate();
        day++
      ) {
        days.push(
          new Date(
            currentMonth.getFullYear(),
            currentMonth.getMonth(),
            day
          )
        );
      }

      while (
        days.length % 7 !== 0
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
        (booking) =>
          dateInStay(
            dateString,
            booking.check_in,
            booking.check_out
          )
      );

    const paidBooking =
      dayBookings.find(
        (booking) =>
          booking.booking_status ===
            'confirmed' &&
          booking.payment_status ===
            'paid'
      );

    const unpaidInterests =
      dayBookings.filter(
        (booking) =>
          !(
            booking.booking_status ===
              'confirmed' &&
            booking.payment_status ===
              'paid'
          )
      );

    const dayBlocks =
      blockedDates.filter(
        (block) =>
          dateInBlock(
            dateString,
            block.start_date,
            block.end_date
          )
      );

    const externalBlock =
      dayBlocks.find(
        (block) =>
          String(
            block.source ||
              ''
          ).toLowerCase() !==
          'manual'
      );

    const manualBlock =
      dayBlocks.find(
        (block) =>
          String(
            block.source ||
              ''
          ).toLowerCase() ===
          'manual'
      );

    if (paidBooking) {
      return {
        type: 'booked',
        paidBooking,
        interestCount:
          unpaidInterests.length,
      };
    }

    if (externalBlock) {
      return {
        type: 'external',
        externalBlock,
        interestCount:
          unpaidInterests.length,
      };
    }

    if (manualBlock) {
      return {
        type: 'manual',
        manualBlock,
        interestCount:
          unpaidInterests.length,
      };
    }

    if (
      unpaidInterests.length > 0
    ) {
      return {
        type: 'interest',
        interestCount:
          unpaidInterests.length,
      };
    }

    return {
      type: 'available',
      interestCount: 0,
    };
  }

  const selectedDayDetails =
    useMemo(() => {
      if (!selectedDate) {
        return {
          paidBookings: [],
          interests: [],
          blocks: [],
        };
      }

      const dayBookings =
        bookings.filter(
          (booking) =>
            dateInStay(
              selectedDate,
              booking.check_in,
              booking.check_out
            )
        );

      const paidBookings =
        dayBookings.filter(
          (booking) =>
            booking.booking_status ===
              'confirmed' &&
            booking.payment_status ===
              'paid'
        );

      const interests =
        dayBookings.filter(
          (booking) =>
            !(
              booking.booking_status ===
                'confirmed' &&
              booking.payment_status ===
                'paid'
            )
        );

      const blocks =
        blockedDates.filter(
          (block) =>
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
        currentMonth.getFullYear(),
        currentMonth.getMonth() - 1,
        1
      )
    );

    setSelectedDate('');
  }

  function nextMonth() {
    setCurrentMonth(
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        1
      )
    );

    setSelectedDate('');
  }

  function goToday() {
    const today =
      new Date();

    setCurrentMonth(
      monthStart(today)
    );

    setSelectedDate(
      toDateString(today)
    );
  }

  if (loading) {
    return (
      <main
        style={
          styles.loading
        }
      >
        Loading host calendar...
      </main>
    );
  }

  return (
    <main
      style={
        styles.page
      }
    >
      <header
        style={
          styles.header
        }
      >
        <div>
          <div
            style={
              styles.brand
            }
          >
            NightOutStays
          </div>

          <div
            style={
              styles.subBrand
            }
          >
            Host Calendar
          </div>
        </div>

        <nav
          style={
            styles.nav
          }
        >
          <a
            href="/admin/bookings"
            style={
              styles.navLink
            }
          >
            Bookings
          </a>

          <a
            href="/admin/properties"
            style={
              styles.navLink
            }
          >
            Properties
          </a>

          <a
            href="/admin/calendar"
            style={
              styles.activeNavLink
            }
          >
            Calendar
          </a>

          <a
            href="/admin/messages"
            style={
              styles.navLink
            }
          >
            Messages
          </a>

          <a
            href="/admin/notifications"
            style={
              styles.navLink
            }
          >
            Notifications
          </a>

          <a
            href="/admin/reports"
            style={
              styles.navLink
            }
          >
            Reports
          </a>
        </nav>
      </header>

      <section
        style={
          styles.container
        }
      >
        <div
          style={
            styles.headingRow
          }
        >
          <div>
            <h1
              style={
                styles.heading
              }
            >
              Property Calendar
            </h1>

            <p
              style={
                styles.subheading
              }
            >
              Paid bookings block dates. Unpaid booking activity is shown only as guest interest.
            </p>
          </div>

          <div
            style={
              styles.actions
            }
          >
            <button
              type="button"
              onClick={
                goToday
              }
              style={
                styles.secondaryButton
              }
            >
              Today
            </button>

            <button
              type="button"
              onClick={() =>
                loadCalendarData(
                  selectedPropertyId
                )
              }
              style={
                styles.primaryButton
              }
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div
            style={
              styles.errorBox
            }
          >
            {error}
          </div>
        )}

        <div
          style={
            styles.propertyBar
          }
        >
          <label
            style={
              styles.label
            }
          >
            PROPERTY

            <select
              value={
                selectedPropertyId
              }
              onChange={(event) => {
                setSelectedPropertyId(
                  event.target.value
                );

                setSelectedDate('');
              }}
              style={
                styles.select
              }
            >
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
                    {property.name}
                    {property.location_name
                      ? ` — ${property.location_name}`
                      : ''}
                  </option>
                )
              )}
            </select>
          </label>

          <div
            style={
              styles.propertyInfo
            }
          >
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

        <div
          style={
            styles.legend
          }
        >
          <Legend
            type="booked"
            label="Property Booked"
          />

          <Legend
            type="interest"
            label="Guests Interested"
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

        <div
          style={
            styles.layout
          }
        >
          <section
            style={
              styles.calendarCard
            }
          >
            <div
              style={
                styles.calendarHeader
              }
            >
              <button
                type="button"
                onClick={
                  previousMonth
                }
                style={
                  styles.monthButton
                }
              >
                ‹
              </button>

              <h2
                style={
                  styles.monthTitle
                }
              >
                {formatMonth(
                  currentMonth
                )}
              </h2>

              <button
                type="button"
                onClick={
                  nextMonth
                }
                style={
                  styles.monthButton
                }
              >
                ›
              </button>
            </div>

            <div
              style={
                styles.weekHeader
              }
            >
              {[
                'Sun',
                'Mon',
                'Tue',
                'Wed',
                'Thu',
                'Fri',
                'Sat',
              ].map((day) => (
                <div
                  key={
                    day
                  }
                  style={
                    styles.weekDay
                  }
                >
                  {day}
                </div>
              ))}
            </div>

            <div
              style={
                styles.calendarGrid
              }
            >
              {calendarDays.map(
                (date, index) => {
                  if (!date) {
                    return (
                      <div
                        key={`empty-${index}`}
                        style={
                          styles.emptyDay
                        }
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

                  const isSelected =
                    selectedDate ===
                    dateString;

                  const isPast =
                    dateString <
                    toDateString(
                      new Date()
                    );

                  return (
                    <button
                      key={
                        dateString
                      }
                      type="button"
                      onClick={() =>
                        setSelectedDate(
                          dateString
                        )
                      }
                      style={{
                        ...styles.dayCell,

                        ...(isSelected
                          ? styles.selectedDay
                          : {}),

                        ...(info.type ===
                        'booked'
                          ? styles.bookedDay
                          : {}),

                        ...(info.type ===
                        'interest'
                          ? styles.interestDay
                          : {}),

                        ...(info.type ===
                        'external'
                          ? styles.externalDay
                          : {}),

                        ...(info.type ===
                        'manual'
                          ? styles.manualDay
                          : {}),
                      }}
                    >
                      <div
                        style={
                          styles.dayTop
                        }
                      >
                        <span
                          style={
                            styles.dayNumber
                          }
                        >
                          {date.getDate()}
                        </span>

                        {info.type ===
                          'booked' && (
                          <span
                            style={
                              styles.initialBadge
                            }
                          >
                            {guestInitials(
                              info.paidBooking
                                ?.guests
                                ?.full_name
                            )}
                          </span>
                        )}
                      </div>

                      {info.type ===
                        'booked' && (
                        <div
                          style={
                            styles.bookedLine
                          }
                        >
                          {guestShortName(
                            info.paidBooking
                              ?.guests
                              ?.full_name
                          )}
                        </div>
                      )}

                      {info.type ===
                        'external' && (
                        <div
                          style={
                            styles.externalLine
                          }
                        >
                          {sourceLabel(
                            info.externalBlock
                              ?.source
                          )}
                        </div>
                      )}

                      {info.type ===
                        'manual' && (
                        <div
                          style={
                            styles.manualLine
                          }
                        >
                          Host Blocked
                        </div>
                      )}

                      {info.interestCount >
                        0 && (
                        <div
                          style={
                            styles.interestLine
                          }
                        >
                          {info.interestCount}{' '}
                          {info.interestCount ===
                          1
                            ? 'Interested'
                            : 'Interested'}
                        </div>
                      )}

                      {isPast &&
                        info.type ===
                          'available' &&
                        info.interestCount ===
                          0 && (
                          <div
                            style={
                              styles.pastEmpty
                            }
                          >
                            &nbsp;
                          </div>
                        )}
                    </button>
                  );
                }
              )}
            </div>
          </section>
          <aside
            style={
              styles.sideColumn
            }
          >
            <section
              style={
                styles.detailsCard
              }
            >
              <h3
                style={
                  styles.detailsTitle
                }
              >
                Date Details
              </h3>

              {!selectedDate ? (
                <div
                  style={
                    styles.emptyMessage
                  }
                >
                  Select a date to view booking and interest details.
                </div>
              ) : (
                <>
                  <div
                    style={
                      styles.selectedDateTitle
                    }
                  >
                    {formatDate(
                      selectedDate
                    )}
                  </div>

                  {selectedDayDetails.paidBookings.length ===
                    0 &&
                    selectedDayDetails.interests.length ===
                      0 &&
                    selectedDayDetails.blocks.length ===
                      0 && (
                      <div
                        style={
                          styles.availableBox
                        }
                      >
                        Available
                      </div>
                    )}

                  {selectedDayDetails.paidBookings.length >
                    0 && (
                    <div
                      style={
                        styles.sectionBlock
                      }
                    >
                      <div
                        style={
                          styles.sectionTitle
                        }
                      >
                        Confirmed Booking
                      </div>

                      {selectedDayDetails.paidBookings.map(
                        (
                          booking
                        ) => (
                          <div
                            key={
                              booking.id
                            }
                            style={
                              styles.bookingCard
                            }
                          >
                            <div
                              style={
                                styles.paidStatus
                              }
                            >
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
                              value={formatDate(
                                booking.check_in
                              )}
                            />

                            <DetailRow
                              label="Check-out"
                              value={formatDate(
                                booking.check_out
                              )}
                            />

                            <DetailRow
                              label="Payment"
                              value="Paid"
                            />

                            <DetailRow
                              label="Source"
                              value="NightOutStays"
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
                        )
                      )}
                    </div>
                  )}

                  {selectedDayDetails.interests.length >
                    0 && (
                    <div
                      style={
                        styles.sectionBlock
                      }
                    >
                      <div
                        style={
                          styles.sectionTitle
                        }
                      >
                        Interested Guests
                      </div>

                      <div
                        style={
                          styles.interestSummary
                        }
                      >
                        {
                          selectedDayDetails
                            .interests
                            .length
                        }{' '}
                        {selectedDayDetails
                          .interests
                          .length ===
                        1
                          ? 'guest interested'
                          : 'guests interested'}
                      </div>

                      {selectedDayDetails.interests.map(
                        (
                          booking
                        ) => {
                          const stage =
                            getInterestStage(
                              booking
                            );

                          let deadline =
                            null;

                          if (
                            booking.host_decision ===
                              'approved' &&
                            booking.host_decided_at &&
                            booking.payment_status !==
                              'paid'
                          ) {
                            const approvedAt =
                              new Date(
                                booking.host_decided_at
                              );

                            deadline =
                              new Date(
                                approvedAt.getTime() +
                                  24 *
                                    60 *
                                    60 *
                                    1000
                              );
                          }

                          return (
                            <div
                              key={
                                booking.id
                              }
                              style={
                                styles.interestCard
                              }
                            >
                              <div
                                style={
                                  styles.interestStage
                                }
                              >
                                {
                                  stage
                                }
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
                                value={formatDate(
                                  booking.check_in
                                )}
                              />

                              <DetailRow
                                label="Check-out"
                                value={formatDate(
                                  booking.check_out
                                )}
                              />

                              <DetailRow
                                label="Payment"
                                value={
                                  booking.payment_status ||
                                  'unpaid'
                                }
                              />

                              {deadline && (
                                <DetailRow
                                  label="Approval Deadline"
                                  value={deadline.toLocaleString(
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
                                  )}
                                />
                              )}

                              {booking
                                .host_offer_final_amount && (
                                <DetailRow
                                  label="Special Offer"
                                  value={`₹${Number(
                                    booking.host_offer_final_amount
                                  ).toLocaleString(
                                    'en-IN'
                                  )}`}
                                />
                              )}

                              <div
                                style={
                                  styles.interestNote
                                }
                              >
                                This guest has not blocked the property yet.
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}

                  {selectedDayDetails.blocks.length >
                    0 && (
                    <div
                      style={
                        styles.sectionBlock
                      }
                    >
                      <div
                        style={
                          styles.sectionTitle
                        }
                      >
                        Calendar Blocks
                      </div>

                      {selectedDayDetails.blocks.map(
                        (
                          block
                        ) => {
                          const isManual =
                            String(
                              block.source ||
                                ''
                            ).toLowerCase() ===
                            'manual';

                          return (
                            <div
                              key={
                                block.id
                              }
                              style={
                                styles.blockCard
                              }
                            >
                              <div
                                style={
                                  styles.blockStatus
                                }
                              >
                                {isManual
                                  ? 'Host Blocked'
                                  : 'Booked by Other Portal'}
                              </div>

                              <DetailRow
                                label="Source"
                                value={sourceLabel(
                                  block.source
                                )}
                              />

                              <DetailRow
                                label="From"
                                value={formatDate(
                                  block.start_date
                                )}
                              />

                              <DetailRow
                                label="To"
                                value={formatDate(
                                  block.end_date
                                )}
                              />

                              <DetailRow
                                label="Remark"
                                value={
                                  block.reason ||
                                  (isManual
                                    ? 'Blocked by host'
                                    : 'Booked by other portal')
                                }
                              />

                              {block.external_uid && (
                                <DetailRow
                                  label="Reference"
                                  value={
                                    block.external_uid
                                  }
                                />
                              )}
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}
                </>
              )}
            </section>

            <section
              style={
                styles.syncCard
              }
            >
              <h3
                style={
                  styles.detailsTitle
                }
              >
                Calendar Sync
              </h3>

              <p
                style={
                  styles.syncHelp
                }
              >
                Import dates from Airbnb or other portals and export this property calendar to external websites.
              </p>

              <div
                style={
                  styles.syncProperty
                }
              >
                <span>
                  Selected Property
                </span>

                <strong>
                  {selectedProperty
                    ?.name ||
                    'No property selected'}
                </strong>
              </div>

              <div
                style={
                  styles.syncSection
                }
              >
                <div
                  style={
                    styles.syncTitle
                  }
                >
                  Export NightOutStays Calendar
                </div>

                <p
                  style={
                    styles.syncText
                  }
                >
                  This property will have its own iCal link for Airbnb, Booking.com and other compatible portals.
                </p>

                {selectedPropertyId && (
                  <div
                    style={
                      styles.exportRow
                    }
                  >
                    <input
                      readOnly
                      value={
                        typeof window !==
                        'undefined'
                          ? `${window.location.origin}/api/calendar/${selectedPropertyId}.ics`
                          : `/api/calendar/${selectedPropertyId}.ics`
                      }
                      style={
                        styles.exportInput
                      }
                    />

                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const url =
                            `${window.location.origin}/api/calendar/${selectedPropertyId}.ics`;

                          await navigator.clipboard.writeText(
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
                      }}
                      style={
                        styles.copyButton
                      }
                    >
                      Copy
                    </button>
                  </div>
                )}

                <div
                  style={
                    styles.noticeBox
                  }
                >
                  Do not add this link to Airbnb yet. We will create the live iCal export endpoint next.
                </div>
              </div>

              <div
                style={
                  styles.divider
                }
              />

              <div
                style={
                  styles.syncSection
                }
              >
                <div
                  style={
                    styles.syncTitle
                  }
                >
                  Import External Calendar
                </div>

                <p
                  style={
                    styles.syncText
                  }
                >
                  Airbnb and other portal iCal links will be connected here after the internal calendar is tested.
                </p>

                <select
                  disabled
                  style={
                    styles.disabledInput
                  }
                >
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
                  style={
                    styles.disabledInput
                  }
                />

                <button
                  type="button"
                  disabled
                  style={
                    styles.disabledButton
                  }
                >
                  Add Calendar
                </button>
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}

function DetailRow({
  label,
  value,
}) {
  return (
    <div
      style={
        styles.detailRow
      }
    >
      <span
        style={
          styles.detailLabel
        }
      >
        {label}
      </span>

      <strong
        style={
          styles.detailValue
        }
      >
        {value || '—'}
      </strong>
    </div>
  );
}

function Legend({
  type,
  label,
}) {
  const map = {
    booked: {
      background:
        '#e4f5e9',
      border:
        '#68a979',
    },

    interest: {
      background:
        '#fff5d9',
      border:
        '#d9af47',
    },

    external: {
      background:
        '#f0e8ff',
      border:
        '#9471cc',
    },

    manual: {
      background:
        '#fde9e9',
      border:
        '#d98686',
    },

    available: {
      background:
        '#ffffff',
      border:
        '#ccd3dc',
    },
  };

  const current =
    map[type] ||
    map.available;

  return (
    <div
      style={
        styles.legendItem
      }
    >
      <span
        style={{
          ...styles.legendDot,

          background:
            current.background,

          borderColor:
            current.border,
        }}
      />

      {label}
    </div>
  );
}

const styles = {
  page: {
    minHeight:
      '100vh',
    background:
      '#f5f7fa',
    color:
      '#102a43',
    fontFamily:
      'Arial, sans-serif',
  },

  loading: {
    minHeight:
      '100vh',
    display:
      'flex',
    alignItems:
      'center',
    justifyContent:
      'center',
    background:
      '#f5f7fa',
    color:
      '#174f91',
    fontWeight:
      700,
    fontFamily:
      'Arial, sans-serif',
  },

  header: {
    minHeight:
      70,
    padding:
      '10px 4%',
    background:
      '#ffffff',
    borderBottom:
      '1px solid #e3e7ec',
    display:
      'flex',
    alignItems:
      'center',
    justifyContent:
      'space-between',
    gap:
      20,
    position:
      'sticky',
    top:
      0,
    zIndex:
      50,
  },

  brand: {
    fontSize:
      21,
    fontWeight:
      800,
    color:
      '#174f91',
  },

  subBrand: {
    marginTop:
      3,
    color:
      '#667085',
    fontSize:
      10,
  },

  nav: {
    display:
      'flex',
    gap:
      7,
    flexWrap:
      'wrap',
    alignItems:
      'center',
  },

  navLink: {
    textDecoration:
      'none',
    color:
      '#174f91',
    padding:
      '8px 10px',
    borderRadius:
      7,
    fontSize:
      11,
    fontWeight:
      700,
  },

  activeNavLink: {
    textDecoration:
      'none',
    color:
      '#ffffff',
    background:
      '#174f91',
    padding:
      '8px 11px',
    borderRadius:
      7,
    fontSize:
      11,
    fontWeight:
      800,
  },

  container: {
    width:
      '94%',
    maxWidth:
      1450,
    margin:
      '0 auto',
    padding:
      '28px 0 70px',
  },

  headingRow: {
    display:
      'flex',
    alignItems:
      'flex-end',
    justifyContent:
      'space-between',
    gap:
      20,
    flexWrap:
      'wrap',
  },

  heading: {
    margin:
      0,
    fontSize:
      27,
  },

  subheading: {
    margin:
      '7px 0 0',
    color:
      '#667085',
    fontSize:
      12,
  },

  actions: {
    display:
      'flex',
    gap:
      8,
  },

  primaryButton: {
    border:
      0,
    background:
      '#174f91',
    color:
      '#ffffff',
    padding:
      '9px 14px',
    borderRadius:
      8,
    cursor:
      'pointer',
    fontWeight:
      700,
  },

  secondaryButton: {
    border:
      '1px solid #ccd4dd',
    background:
      '#ffffff',
    color:
      '#174f91',
    padding:
      '9px 14px',
    borderRadius:
      8,
    cursor:
      'pointer',
    fontWeight:
      700,
  },

  errorBox: {
    marginTop:
      15,
    padding:
      11,
    background:
      '#fdeaea',
    color:
      '#a02a2a',
    borderRadius:
      8,
    fontSize:
      11,
  },

  propertyBar: {
    marginTop:
      20,
    background:
      '#ffffff',
    border:
      '1px solid #dfe4ea',
    borderRadius:
      12,
    padding:
      14,
    display:
      'grid',
    gridTemplateColumns:
      'minmax(260px, 430px) 1fr',
    gap:
      20,
    alignItems:
      'end',
  },

  label: {
    display:
      'grid',
    gap:
      6,
    fontSize:
      9,
    fontWeight:
      800,
    color:
      '#475467',
  },

  select: {
    width:
      '100%',
    padding:
      '10px 11px',
    border:
      '1px solid #ccd4dd',
    borderRadius:
      8,
    background:
      '#ffffff',
  },

  propertyInfo: {
    display:
      'grid',
    gap:
      3,
    fontSize:
      12,
  },

  legend: {
    display:
      'flex',
    gap:
      14,
    flexWrap:
      'wrap',
    alignItems:
      'center',
    margin:
      '14px 0',
    fontSize:
      10,
    color:
      '#475467',
  },

  legendItem: {
    display:
      'flex',
    alignItems:
      'center',
    gap:
      5,
  },

  legendDot: {
    width:
      12,
    height:
      12,
    borderRadius:
      3,
    border:
      '1px solid',
  },

  layout: {
    display:
      'grid',
    gridTemplateColumns:
      'minmax(0, 1fr) 350px',
    gap:
      18,
    alignItems:
      'start',
  },

  calendarCard: {
    background:
      '#ffffff',
    border:
      '1px solid #dfe4ea',
    borderRadius:
      14,
    overflow:
      'hidden',
  },

  calendarHeader: {
    minHeight:
      60,
    display:
      'grid',
    gridTemplateColumns:
      '50px 1fr 50px',
    alignItems:
      'center',
    borderBottom:
      '1px solid #e4e7ec',
  },

  monthButton: {
    border:
      0,
    background:
      'transparent',
    color:
      '#174f91',
    fontSize:
      30,
    cursor:
      'pointer',
  },

  monthTitle: {
    margin:
      0,
    textAlign:
      'center',
    fontSize:
      20,
  },

  weekHeader: {
    display:
      'grid',
    gridTemplateColumns:
      'repeat(7, minmax(0, 1fr))',
    background:
      '#f8fafc',
    borderBottom:
      '1px solid #e4e7ec',
  },

  weekDay: {
    padding:
      '10px 5px',
    textAlign:
      'center',
    fontSize:
      10,
    fontWeight:
      800,
    color:
      '#667085',
  },

  calendarGrid: {
    display:
      'grid',
    gridTemplateColumns:
      'repeat(7, minmax(0, 1fr))',
  },

  emptyDay: {
    minHeight:
      108,
    background:
      '#fafbfc',
    borderRight:
      '1px solid #edf0f3',
    borderBottom:
      '1px solid #edf0f3',
  },

  dayCell: {
    minHeight:
      108,
    padding:
      8,
    background:
      '#ffffff',
    border:
      0,
    borderRight:
      '1px solid #edf0f3',
    borderBottom:
      '1px solid #edf0f3',
    textAlign:
      'left',
    cursor:
      'pointer',
  },

  selectedDay: {
    outline:
      '2px solid #174f91',
    outlineOffset:
      '-2px',
  },

  bookedDay: {
    background:
      '#e7f6eb',
  },

  interestDay: {
    background:
      '#fff8e5',
  },

  externalDay: {
    background:
      '#f4eeff',
  },

  manualDay: {
    background:
      '#fdeeee',
  },

  dayTop: {
    display:
      'flex',
    justifyContent:
      'space-between',
    alignItems:
      'center',
    gap:
      5,
  },

  dayNumber: {
    fontSize:
      12,
    fontWeight:
      800,
    color:
      '#344054',
  },

  initialBadge: {
    background:
      '#24723a',
    color:
      '#ffffff',
    borderRadius:
      20,
    padding:
      '3px 6px',
    fontSize:
      8,
    fontWeight:
      800,
  },

  bookedLine: {
    marginTop:
      12,
    paddingLeft:
      6,
    borderLeft:
      '3px solid #24723a',
    fontSize:
      9,
    fontWeight:
      800,
  },

  interestLine: {
    marginTop:
      7,
    paddingLeft:
      6,
    borderLeft:
      '3px solid #d7a628',
    fontSize:
      9,
    fontWeight:
      800,
    color:
      '#8a6507',
  },

  externalLine: {
    marginTop:
      12,
    paddingLeft:
      6,
    borderLeft:
      '3px solid #7d58b5',
    fontSize:
      9,
    fontWeight:
      800,
  },

  manualLine: {
    marginTop:
      12,
    paddingLeft:
      6,
    borderLeft:
      '3px solid #c95d5d',
    fontSize:
      9,
    fontWeight:
      800,
  },

  pastEmpty: {
    minHeight:
      25,
  },

  sideColumn: {
    display:
      'grid',
    gap:
      15,
  },

  detailsCard: {
    background:
      '#ffffff',
    border:
      '1px solid #dfe4ea',
    borderRadius:
      14,
    padding:
      15,
  },

  syncCard: {
    background:
      '#ffffff',
    border:
      '1px solid #dfe4ea',
    borderRadius:
      14,
    padding:
      15,
  },

  detailsTitle: {
    margin:
      0,
    fontSize:
      16,
  },

  emptyMessage: {
    marginTop:
      12,
    color:
      '#667085',
    fontSize:
      10,
    lineHeight:
      1.5,
  },

  selectedDateTitle: {
    marginTop:
      12,
    paddingBottom:
      9,
    borderBottom:
      '1px solid #edf0f3',
    fontWeight:
      800,
  },

  availableBox: {
    marginTop:
      12,
    background:
      '#edf8f0',
    color:
      '#24723a',
    borderRadius:
      8,
    padding:
      10,
    fontWeight:
      800,
    fontSize:
      11,
  },

  sectionBlock: {
    marginTop:
      14,
  },

  sectionTitle: {
    fontSize:
      11,
    fontWeight:
      800,
    color:
      '#344054',
    marginBottom:
      7,
  },

  interestSummary: {
    background:
      '#fff8e5',
    color:
      '#886207',
    padding:
      8,
    borderRadius:
      7,
    fontSize:
      10,
    fontWeight:
      800,
    marginBottom:
      8,
  },

  bookingCard: {
    background:
      '#f3faf5',
    border:
      '1px solid #cfe6d5',
    borderRadius:
      9,
    padding:
      11,
    display:
      'grid',
    gap:
      7,
    marginTop:
      8,
  },

  interestCard: {
    background:
      '#fffbef',
    border:
      '1px solid #ebdca8',
    borderRadius:
      9,
    padding:
      11,
    display:
      'grid',
    gap:
      7,
    marginTop:
      8,
  },

  blockCard: {
    background:
      '#faf7ff',
    border:
      '1px solid #ddd0f1',
    borderRadius:
      9,
    padding:
      11,
    display:
      'grid',
    gap:
      7,
    marginTop:
      8,
  },

  paidStatus: {
    color:
      '#24723a',
    fontSize:
      11,
    fontWeight:
      800,
  },

  interestStage: {
    color:
      '#8a6507',
    fontSize:
      11,
    fontWeight:
      800,
  },

  interestNote: {
    marginTop:
      3,
    padding:
      6,
    borderRadius:
      6,
    background:
      '#fff4cf',
    color:
      '#7b5b0c',
    fontSize:
      8,
    lineHeight:
      1.4,
  },

  blockStatus: {
    color:
      '#7047a6',
    fontSize:
      11,
    fontWeight:
      800,
  },

  detailRow: {
    display:
      'flex',
    justifyContent:
      'space-between',
    gap:
      10,
    fontSize:
      10,
  },

  detailLabel: {
    color:
      '#667085',
  },

  detailValue: {
    textAlign:
      'right',
    wordBreak:
      'break-word',
  },

  syncHelp: {
    margin:
      '7px 0 0',
    color:
      '#667085',
    fontSize:
      9,
    lineHeight:
      1.45,
  },

  syncProperty: {
    marginTop:
      12,
    background:
      '#f7f9fc',
    padding:
      9,
    borderRadius:
      7,
    display:
      'grid',
    gap:
      3,
    fontSize:
      9,
  },

  syncSection: {
    marginTop:
      14,
    display:
      'grid',
    gap:
      7,
  },

  syncTitle: {
    fontSize:
      11,
    fontWeight:
      800,
  },

  syncText: {
    margin:
      0,
    color:
      '#667085',
    fontSize:
      9,
    lineHeight:
      1.4,
  },

  exportRow: {
    display:
      'grid',
    gridTemplateColumns:
      '1fr auto',
    gap:
      6,
  },

  exportInput: {
    minWidth:
      0,
    border:
      '1px solid #d2d8df',
    borderRadius:
      7,
    padding:
      8,
    fontSize:
      8,
    background:
      '#fafafa',
  },

  copyButton: {
    border:
      0,
    background:
      '#174f91',
    color:
      '#ffffff',
    borderRadius:
      7,
    padding:
      '8px 10px',
    cursor:
      'pointer',
    fontSize:
      9,
    fontWeight:
      700,
  },

  noticeBox: {
    background:
      '#fff8e7',
    color:
      '#896a1f',
    padding:
      7,
    borderRadius:
      6,
    fontSize:
      8,
    lineHeight:
      1.4,
  },

  divider: {
    height:
      1,
    background:
      '#edf0f3',
    margin:
      '16px 0',
  },

  disabledInput: {
    width:
      '100%',
    boxSizing:
      'border-box',
    border:
      '1px solid #d6dce3',
    borderRadius:
      7,
    padding:
      8,
    background:
      '#f4f5f7',
    color:
      '#98a2b3',
    fontSize:
      9,
  },

  disabledButton: {
    border:
      0,
    borderRadius:
      7,
    padding:
      8,
    background:
      '#d0d5dd',
    color:
      '#ffffff',
    fontSize:
      9,
  },
};