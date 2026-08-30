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

function addDays(
  value,
  count
) {
  const date =
    typeof value === 'string'
      ? parseDate(value)
      : new Date(value);

  date.setDate(
    date.getDate() +
      Number(count || 0)
  );

  return date;
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
  if (!value) return '';

  try {
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
  } catch {
    return value;
  }
}

function guestInitials(name) {
  const words =
    String(
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
  const words =
    String(
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
    dateString >=
      startDate &&
    dateString <=
      endDate
  );
}

function sourceLabel(
  source
) {
  const value =
    String(
      source || ''
    ).toLowerCase();

  if (
    value ===
    'airbnb'
  ) {
    return 'Airbnb';
  }

  if (
    value ===
      'booking_com' ||
    value ===
      'booking.com'
  ) {
    return 'Booking.com';
  }

  if (
    value ===
    'manual'
  ) {
    return 'Host Blocked';
  }

  if (
    value ===
    'nightoutstays'
  ) {
    return 'NightOutStays';
  }

  return source
    ? source
    : 'Other Portal';
}

export default function AdminCalendarPage() {
  const [
    session,
    setSession,
  ] = useState(null);

  const [
    adminProfile,
    setAdminProfile,
  ] = useState(null);

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
    monthStart(
      new Date()
    )
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
      selectedPropertyId
    ) {
      loadCalendarData(
        selectedPropertyId
      );
    }
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
          `host-calendar-bookings-${selectedPropertyId}`
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
          `host-calendar-blocks-${selectedPropertyId}`
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
          session:
            currentSession,
        },
        error:
          sessionError,
      } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!currentSession) {
        window.location.href =
          '/admin/bookings';

        return;
      }

      setSession(
        currentSession
      );

      const {
        data:
          profile,
        error:
          profileError,
      } =
        await supabase
          .from(
            'admin_profiles'
          )
          .select(
            'user_id, full_name, role, is_active'
          )
          .eq(
            'user_id',
            currentSession.user.id
          )
          .eq(
            'is_active',
            true
          )
          .single();

      if (
        profileError ||
        !profile
      ) {
        throw new Error(
          'Admin access not available.'
        );
      }

      setAdminProfile(
        profile
      );

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
          .select(
            'id, name, slug, location_name, is_active'
          )
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
          'Unable to open calendar.'
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
              booking_status,
              payment_status,
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
          'Unable to load calendar.'
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
    useMemo(
      () => {
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
              currentMonth.getFullYear(),
              currentMonth.getMonth(),
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
      },
      [
        currentMonth,
      ]
    );

  const selectedDayDetails =
    useMemo(
      () => {
        if (
          !selectedDate
        ) {
          return {
            bookings: [],
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

        const dayBlocks =
          blockedDates.filter(
            (block) =>
              dateInBlock(
                selectedDate,
                block.start_date,
                block.end_date
              )
          );

        return {
          bookings:
            dayBookings,
          blocks:
            dayBlocks,
        };
      },
      [
        selectedDate,
        bookings,
        blockedDates,
      ]
    );

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

    const confirmedPaid =
      dayBookings.find(
        (booking) =>
          booking.booking_status ===
            'confirmed' &&
          booking.payment_status ===
            'paid'
      );

    const confirmedUnpaid =
      dayBookings.find(
        (booking) =>
          booking.booking_status ===
            'confirmed' &&
          booking.payment_status !==
            'paid'
      );

    const pending =
      dayBookings.find(
        (booking) =>
          booking.booking_status ===
          'pending'
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

    if (confirmedPaid) {
      return {
        type:
          'booked',

        booking:
          confirmedPaid,

        label:
          guestShortName(
            confirmedPaid
              .guests
              ?.full_name
          ),

        initials:
          guestInitials(
            confirmedPaid
              .guests
              ?.full_name
          ),
      };
    }

    if (externalBlock) {
      return {
        type:
          'external',

        block:
          externalBlock,

        label:
          externalBlock.reason ||
          'Booked by other portal',

        source:
          sourceLabel(
            externalBlock.source
          ),
      };
    }

    if (manualBlock) {
      return {
        type:
          'manual',

        block:
          manualBlock,

        label:
          manualBlock.reason ||
          'Host Blocked',
      };
    }

    if (confirmedUnpaid) {
      return {
        type:
          'accepted',

        booking:
          confirmedUnpaid,

        label:
          guestShortName(
            confirmedUnpaid
              .guests
              ?.full_name
          ),
      };
    }

    if (pending) {
      return {
        type:
          'pending',

        booking:
          pending,

        label:
          guestShortName(
            pending.guests
              ?.full_name
          ),
      };
    }

    return {
      type:
        'available',
    };
  }

  function previousMonth() {
    setCurrentMonth(
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() -
          1,
        1
      )
    );

    setSelectedDate('');
  }

  function nextMonth() {
    setCurrentMonth(
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() +
          1,
        1
      )
    );

    setSelectedDate('');
  }

  function goToday() {
    setCurrentMonth(
      monthStart(
        new Date()
      )
    );

    setSelectedDate(
      toDateString(
        new Date()
      )
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

        <div
          style={
            styles.headerRight
          }
        >
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

          <div
            style={
              styles.adminIdentity
            }
          >
            <strong>
              {adminProfile
                ?.full_name ||
                'Admin'}
            </strong>

            <div
              style={
                styles.adminRole
              }
            >
              {adminProfile
                ?.role ||
                'admin'}
            </div>
          </div>
        </div>
      </header>

      <section
        style={
          styles.container
        }
      >
        <div
          style={
            styles.pageHeadingRow
          }
        >
          <div>
            <h1
              style={
                styles.pageHeading
              }
            >
              Property Calendar
            </h1>

            <p
              style={
                styles.pageSubheading
              }
            >
              View NightOutStays bookings, host-blocked dates and bookings imported from other portals.
            </p>
          </div>

          <div
            style={
              styles.topActions
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
            styles.propertyToolbar
          }
        >
          <label
            style={
              styles.fieldLabel
            }
          >
            PROPERTY

            <select
              value={
                selectedPropertyId
              }
              onChange={(
                event
              ) => {
                setSelectedPropertyId(
                  event.target.value
                );

                setSelectedDate(
                  ''
                );
              }}
              style={
                styles.select
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

          <div
            style={
              styles.selectedPropertyInfo
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
            label="Property Booked"
            type="booked"
          />

          <Legend
            label="Booking Accepted"
            type="accepted"
          />

          <Legend
            label="Booking Requested"
            type="pending"
          />

          <Legend
            label="Booked by Other Portal"
            type="external"
          />

          <Legend
            label="Host Blocked"
            type="manual"
          />

          <Legend
            label="Available"
            type="available"
          />
        </div>

        <div
          style={
            styles.calendarLayout
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
              ].map(
                (
                  day
                ) => (
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
                )
              )}
            </div>

            <div
              style={
                styles.calendarGrid
              }
            >
              {calendarDays.map(
                (
                  date,
                  index
                ) => {
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

                  const isPast =
                    dateString <
                    toDateString(
                      new Date()
                    );

                  const isSelected =
                    selectedDate ===
                    dateString;

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
                        'accepted'
                          ? styles.acceptedDay
                          : {}),

                        ...(info.type ===
                        'pending'
                          ? styles.pendingDay
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
                          {
                            date.getDate()
                          }
                        </span>

                        {info.type ===
                          'booked' && (
                          <span
                            style={
                              styles.initialBadge
                            }
                          >
                            {
                              info.initials
                            }
                          </span>
                        )}
                      </div>

                      {info.type !==
                        'available' && (
                        <div
                          style={
                            styles.dayBookingLine
                          }
                        >
                          {info.type ===
                          'external'
                            ? info.source
                            : info.label}
                        </div>
                      )}

                      {isPast &&
                        info.type ===
                          'available' && (
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
              styles.detailsColumn
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
                    styles.detailsEmpty
                  }
                >
                  Select any date on the calendar to view booking details.
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

                  {selectedDayDetails.bookings.length ===
                    0 &&
                    selectedDayDetails.blocks.length ===
                      0 && (
                      <div
                        style={
                          styles.availableDetails
                        }
                      >
                        Available
                      </div>
                    )}

                  {selectedDayDetails.bookings.map(
                    (booking) => {
                      const guestName =
                        booking.guests
                          ?.full_name ||
                        'Guest';

                      const isPaid =
                        booking.payment_status ===
                        'paid';

                      const isConfirmed =
                        booking.booking_status ===
                        'confirmed';

                      let displayStatus =
                        'Booking Requested';

                      if (
                        isConfirmed &&
                        isPaid
                      ) {
                        displayStatus =
                          'Property Booked';
                      } else if (
                        isConfirmed
                      ) {
                        displayStatus =
                          'Booking Accepted';
                      }

                      return (
                        <div
                          key={
                            booking.id
                          }
                          style={
                            styles.bookingDetailCard
                          }
                        >
                          <div
                            style={
                              styles.detailStatus
                            }
                          >
                            {
                              displayStatus
                            }
                          </div>

                          <DetailRow
                            label="Guest"
                            value={
                              guestName
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
                              'pending'
                            }
                          />

                          <DetailRow
                            label="Source"
                            value="NightOutStays"
                          />

                          {booking.guests
                            ?.phone && (
                            <DetailRow
                              label="Phone"
                              value={
                                booking.guests.phone
                              }
                            />
                          )}
                        </div>
                      );
                    }
                  )}

                  {selectedDayDetails.blocks.map(
                    (block) => (
                      <div
                        key={
                          block.id
                        }
                        style={
                          styles.blockDetailCard
                        }
                      >
                        <div
                          style={
                            styles.blockStatus
                          }
                        >
                          {String(
                            block.source ||
                              ''
                          ).toLowerCase() ===
                          'manual'
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
                            (String(
                              block.source ||
                                ''
                            ).toLowerCase() ===
                            'manual'
                              ? 'Blocked by host'
                              : 'Booked by other portal')
                          }
                        />

                        {block.external_uid && (
                          <DetailRow
                            label="External Reference"
                            value={
                              block.external_uid
                            }
                          />
                        )}
                      </div>
                    )
                  )}
                </>
              )}
            </section>

            <section
              style={
                styles.syncCard
              }
            >
              <div
                style={
                  styles.syncHeader
                }
              >
                <div>
                  <h3
                    style={
                      styles.detailsTitle
                    }
                  >
                    Calendar Sync
                  </h3>

                  <div
                    style={
                      styles.syncDescription
                    }
                  >
                    Connect this property calendar with Airbnb, Booking.com and other portals.
                  </div>
                </div>
              </div>

              <div
                style={
                  styles.syncProperty
                }
              >
                <span>
                  Property
                </span>

                <strong>
                  {selectedProperty
                    ?.name ||
                    'Select property'}
                </strong>
              </div>

              <div
                style={
                  styles.syncSection
                }
              >
                <div
                  style={
                    styles.syncSectionTitle
                  }
                >
                  NightOutStays Export Calendar
                </div>

                <p
                  style={
                    styles.syncHelp
                  }
                >
                  This will be the calendar link you can add to Airbnb, Booking.com or another website.
                </p>

                {selectedPropertyId ? (
                  <div
                    style={
                      styles.exportBox
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
                      Copy Link
                    </button>
                  </div>
                ) : (
                  <div
                    style={
                      styles.syncDisabled
                    }
                  >
                    Select a property first.
                  </div>
                )}

                <div
                  style={
                    styles.syncNote
                  }
                >
                  We will activate this export link in the next step. Do not add it to Airbnb yet.
                </div>
              </div>

              <div
                style={
                  styles.syncDivider
                }
              />

              <div
                style={
                  styles.syncSection
                }
              >
                <div
                  style={
                    styles.syncSectionTitle
                  }
                >
                  Import External Calendar
                </div>

                <p
                  style={
                    styles.syncHelp
                  }
                >
                  Airbnb or another portal's iCal URL will be added here so externally booked dates automatically appear on this calendar.
                </p>

                <div
                  style={
                    styles.importPreview
                  }
                >
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

                <div
                  style={
                    styles.syncNote
                  }
                >
                  External calendar import will be activated after the internal calendar is tested.
                </div>
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
  label,
  type,
}) {
  const typeStyles = {
    booked: {
      background:
        '#dff4e5',
      border:
        '#76b68a',
    },

    accepted: {
      background:
        '#e8f1ff',
      border:
        '#7da7df',
    },

    pending: {
      background:
        '#fff4d9',
      border:
        '#d5ad4c',
    },

    external: {
      background:
        '#f0e9ff',
      border:
        '#9d7bd1',
    },

    manual: {
      background:
        '#fbe7e7',
      border:
        '#d98d8d',
    },

    available: {
      background:
        '#ffffff',
      border:
        '#d7dce2',
    },
  };

  const current =
    typeStyles[type] ||
    typeStyles.available;

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

      <span>
        {label}
      </span>
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

    fontFamily:
      'Arial, sans-serif',

    fontWeight:
      700,
  },

  header: {
    minHeight:
      72,

    background:
      '#ffffff',

    borderBottom:
      '1px solid #e4e7ec',

    padding:
      '10px 4%',

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
    color:
      '#174f91',

    fontWeight:
      800,

    fontSize:
      21,
  },

  subBrand: {
    color:
      '#667085',

    fontSize:
      10,

    marginTop:
      2,
  },

  headerRight: {
    display:
      'flex',

    alignItems:
      'center',

    gap:
      20,
  },

  nav: {
    display:
      'flex',

    alignItems:
      'center',

    gap:
      8,

    flexWrap:
      'wrap',
  },

  navLink: {
    color:
      '#174f91',

    textDecoration:
      'none',

    fontSize:
      12,

    fontWeight:
      700,

    padding:
      '8px 10px',

    borderRadius:
      7,
  },

  activeNavLink: {
    color:
      '#ffffff',

    background:
      '#174f91',

    textDecoration:
      'none',

    fontSize:
      12,

    fontWeight:
      800,

    padding:
      '8px 12px',

    borderRadius:
      7,
  },

  adminIdentity: {
    textAlign:
      'right',

    fontSize:
      11,
  },

  adminRole: {
    color:
      '#667085',

    fontSize:
      9,

    marginTop:
      2,

    textTransform:
      'uppercase',
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

  pageHeadingRow: {
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

  pageHeading: {
    margin:
      0,

    fontSize:
      27,
  },

  pageSubheading: {
    margin:
      '7px 0 0',

    color:
      '#667085',

    fontSize:
      12,
  },

  topActions: {
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

    fontWeight:
      700,

    cursor:
      'pointer',
  },

  secondaryButton: {
    border:
      '1px solid #cfd6df',

    background:
      '#ffffff',

    color:
      '#174f91',

    padding:
      '9px 14px',

    borderRadius:
      8,

    fontWeight:
      700,

    cursor:
      'pointer',
  },

  errorBox: {
    marginTop:
      15,

    background:
      '#fdeaea',

    color:
      '#a12828',

    padding:
      11,

    borderRadius:
      8,

    fontSize:
      12,
  },

  propertyToolbar: {
    marginTop:
      22,

    background:
      '#ffffff',

    border:
      '1px solid #e0e5eb',

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

  fieldLabel: {
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
      '1px solid #cfd6df',

    borderRadius:
      8,

    background:
      '#ffffff',

    color:
      '#102a43',
  },

  selectedPropertyInfo: {
    display:
      'grid',

    gap:
      3,

    fontSize:
      13,
  },

  legend: {
    margin:
      '14px 0',

    display:
      'flex',

    gap:
      14,

    alignItems:
      'center',

    flexWrap:
      'wrap',

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

  calendarLayout: {
    display:
      'grid',

    gridTemplateColumns:
      'minmax(0, 1fr) 340px',

    gap:
      18,

    alignItems:
      'start',
  },

  calendarCard: {
    background:
      '#ffffff',

    border:
      '1px solid #e0e5eb',

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
      '1px solid #e5e7eb',
  },

  monthTitle: {
    textAlign:
      'center',

    margin:
      0,

    fontSize:
      20,
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

  weekHeader: {
    display:
      'grid',

    gridTemplateColumns:
      'repeat(7, minmax(0, 1fr))',

    background:
      '#f8fafc',

    borderBottom:
      '1px solid #e5e7eb',
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
      105,

    background:
      '#fafbfc',

    borderRight:
      '1px solid #edf0f3',

    borderBottom:
      '1px solid #edf0f3',
  },

  dayCell: {
    minHeight:
      105,

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

    overflow:
      'hidden',
  },

  selectedDay: {
    outline:
      '2px solid #174f91',

    outlineOffset:
      '-2px',
  },

  bookedDay: {
    background:
      '#e5f6ea',
  },

  acceptedDay: {
    background:
      '#eaf2ff',
  },

  pendingDay: {
    background:
      '#fff6dd',
  },

  externalDay: {
    background:
      '#f3edff',
  },

  manualDay: {
    background:
      '#fdecec',
  },

  dayTop: {
    display:
      'flex',

    justifyContent:
      'space-between',

    alignItems:
      'center',

    gap:
      4,
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

  dayBookingLine: {
    marginTop:
      14,

    borderLeft:
      '3px solid #174f91',

    paddingLeft:
      6,

    fontSize:
      9,

    fontWeight:
      700,

    lineHeight:
      1.35,

    overflow:
      'hidden',

    textOverflow:
      'ellipsis',
  },

  pastEmpty: {
    minHeight:
      25,
  },

  detailsColumn: {
    display:
      'grid',

    gap:
      15,
  },

  detailsCard: {
    background:
      '#ffffff',

    border:
      '1px solid #e0e5eb',

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

  detailsEmpty: {
    marginTop:
      14,

    color:
      '#667085',

    fontSize:
      11,

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

  availableDetails: {
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

  bookingDetailCard: {
    marginTop:
      12,

    background:
      '#f8fafc',

    border:
      '1px solid #e1e6eb',

    borderRadius:
      9,

    padding:
      11,

    display:
      'grid',

    gap:
      7,
  },

  blockDetailCard: {
    marginTop:
      12,

    background:
      '#faf7ff',

    border:
      '1px solid #ded2f1',

    borderRadius:
      9,

    padding:
      11,

    display:
      'grid',

    gap:
      7,
  },

  detailStatus: {
    color:
      '#174f91',

    fontSize:
      11,

    fontWeight:
      800,

    marginBottom:
      3,
  },

  blockStatus: {
    color:
      '#7047a6',

    fontSize:
      11,

    fontWeight:
      800,

    marginBottom:
      3,
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

  syncCard: {
    background:
      '#ffffff',

    border:
      '1px solid #e0e5eb',

    borderRadius:
      14,

    padding:
      15,
  },

  syncHeader: {
    display:
      'flex',

    justifyContent:
      'space-between',

    gap:
      10,
  },

  syncDescription: {
    color:
      '#667085',

    fontSize:
      10,

    marginTop:
      5,

    lineHeight:
      1.45,
  },

  syncProperty: {
    marginTop:
      13,

    display:
      'grid',

    gap:
      3,

    background:
      '#f7f9fc',

    padding:
      9,

    borderRadius:
      7,

    fontSize:
      10,
  },

  syncSection: {
    marginTop:
      15,
  },

  syncSectionTitle: {
    fontSize:
      11,

    fontWeight:
      800,
  },

  syncHelp: {
    fontSize:
      9,

    lineHeight:
      1.45,

    color:
      '#667085',
  },

  exportBox: {
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
      '1px solid #d5dae1',

    borderRadius:
      7,

    padding:
      8,

    fontSize:
      9,

    color:
      '#475467',

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

    fontSize:
      9,

    fontWeight:
      700,

    cursor:
      'pointer',
  },

  syncNote: {
    marginTop:
      7,

    color:
      '#8a6d1f',

    background:
      '#fff8e7',

    padding:
      7,

    borderRadius:
      6,

    fontSize:
      8,

    lineHeight:
      1.4,
  },

  syncDivider: {
    height:
      1,

    background:
      '#edf0f3',

    margin:
      '16px 0',
  },

  importPreview: {
    display:
      'grid',

    gap:
      6,
  },

  disabledInput: {
    border:
      '1px solid #d8dde4',

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

    background:
      '#d0d5dd',

    color:
      '#ffffff',

    borderRadius:
      7,

    padding:
      8,

    fontSize:
      9,
  },

  syncDisabled: {
    color:
      '#98a2b3',

    fontSize:
      9,
  },
};