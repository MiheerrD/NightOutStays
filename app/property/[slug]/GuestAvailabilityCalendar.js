'use client';

import { useMemo, useState } from 'react';
import { calculateCalendarDateRate } from '../../lib/pricing';

function dateString(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function todayString() {
  return dateString(new Date());
}

function addDays(value, days) {
  const date = new Date(`${value}T12:00:00`);

  date.setDate(
    date.getDate() + days
  );

  return dateString(date);
}

function money(value) {
  return `₹${Math.round(
    Number(value || 0)
  ).toLocaleString('en-IN')}`;
}

function isDateInsideBlock(
  date,
  block
) {
  if (
    !block?.start_date ||
    !block?.end_date
  ) {
    return false;
  }

  return (
    date >= block.start_date &&
    date <= block.end_date
  );
}

function isDateInsideBooking(
  date,
  booking
) {
  if (
    !booking?.check_in ||
    !booking?.check_out
  ) {
    return false;
  }

  /*
    Checkout date remains available because
    the previous guest leaves on that date.

    Example:
    booking 10 Aug → 12 Aug

    10 and 11 are occupied.
    12 Aug can be another guest's check-in.
  */

  return (
    date >= booking.check_in &&
    date < booking.check_out
  );
}

export default function GuestAvailabilityCalendar({
  property,
  pricingRules = [],
  rateOverrides = [],
  blockedDates = [],
  existingBookings = [],
  guestCount = 1,
  checkIn = '',
  checkOut = '',
  onCheckInChange,
  onCheckOutChange,
}) {
  const initialDate =
    checkIn
      ? new Date(
          `${checkIn}T12:00:00`
        )
      : new Date();

  const [
    visibleMonth,
    setVisibleMonth,
  ] = useState(
    new Date(
      initialDate.getFullYear(),
      initialDate.getMonth(),
      1
    )
  );

  const [
    selectionMode,
    setSelectionMode,
  ] = useState(
    checkIn && !checkOut
      ? 'checkout'
      : 'checkin'
  );

  const monthLabel =
    visibleMonth.toLocaleDateString(
      'en-IN',
      {
        month: 'long',
        year: 'numeric',
      }
    );

  const calendarDays =
    useMemo(() => {
      const year =
        visibleMonth.getFullYear();

      const month =
        visibleMonth.getMonth();

      const firstDay =
        new Date(
          year,
          month,
          1
        );

      const lastDay =
        new Date(
          year,
          month + 1,
          0
        );

      const days = [];

      /*
        Empty cells before first date of month.
        Sunday = 0.
      */

      for (
        let i = 0;
        i < firstDay.getDay();
        i++
      ) {
        days.push(null);
      }

      for (
        let day = 1;
        day <= lastDay.getDate();
        day++
      ) {
        days.push(
          new Date(
            year,
            month,
            day
          )
        );
      }

      return days;
    }, [visibleMonth]);

  function getDateStatus(
    date
  ) {
    const value =
      dateString(date);

    if (
      value < todayString()
    ) {
      return 'past';
    }

    const manualBlock =
      blockedDates.some(
        (block) =>
          isDateInsideBlock(
            value,
            block
          )
      );

    if (manualBlock) {
      return 'blocked';
    }

    /*
      Defensive filtering.

      The parent page should already provide
      only confirmed + paid bookings, but we
      enforce the rule again here.
    */

    const paidBooking =
      existingBookings.some(
        (booking) =>
          booking.booking_status ===
            'confirmed' &&
          booking.payment_status ===
            'paid' &&
          isDateInsideBooking(
            value,
            booking
          )
      );

    if (paidBooking) {
      return 'booked';
    }

    return 'available';
  }

  function getRate(date) {
    if (!property) {
      return 0;
    }

    const value =
      dateString(date);

    try {
      const result =
        calculateCalendarDateRate({
          property,

          date:
            value,

          guestCount:
            Number(
              guestCount || 1
            ),

          pricingRules,

          rateOverrides,
        });

      /*
        pricing.js may return either the
        number itself or an object depending
        on the current implementation.
      */

      if (
        typeof result ===
        'number'
      ) {
        return result;
      }

      return Number(
        result?.rate ??
          result?.nightlyRate ??
          result?.finalRate ??
          result?.amount ??
          property.base_price ??
          0
      );
    } catch (error) {
      console.error(
        'Calendar rate calculation failed:',
        error
      );

      return Number(
        property.base_price ||
          0
      );
    }
  }

  function rangeContainsDate(
    value
  ) {
    if (
      !checkIn ||
      !checkOut
    ) {
      return false;
    }

    return (
      value >= checkIn &&
      value < checkOut
    );
  }

  function rangeHasUnavailableDate(
    start,
    end
  ) {
    if (
      !start ||
      !end ||
      end <= start
    ) {
      return true;
    }

    let current =
      start;

    while (
      current < end
    ) {
      const currentDate =
        new Date(
          `${current}T12:00:00`
        );

      if (
        getDateStatus(
          currentDate
        ) !== 'available'
      ) {
        return true;
      }

      current =
        addDays(
          current,
          1
        );
    }

    return false;
  }

  function selectDate(date) {
    const value =
      dateString(date);

    const status =
      getDateStatus(date);

    if (
      status !== 'available'
    ) {
      return;
    }

    /*
      Start a new selection when:
      - no check-in exists
      - both dates already exist
      - user is explicitly selecting check-in
    */

    if (
      !checkIn ||
      checkOut ||
      selectionMode ===
        'checkin'
    ) {
      onCheckInChange?.(
        value
      );

      onCheckOutChange?.(
        ''
      );

      setSelectionMode(
        'checkout'
      );

      return;
    }

    /*
      User clicked a date before/equal
      to current check-in: restart selection.
    */

    if (
      value <= checkIn
    ) {
      onCheckInChange?.(
        value
      );

      onCheckOutChange?.(
        ''
      );

      setSelectionMode(
        'checkout'
      );

      return;
    }

    /*
      Don't allow a guest to select a range
      containing a booked/blocked night.
    */

    if (
      rangeHasUnavailableDate(
        checkIn,
        value
      )
    ) {
      onCheckInChange?.(
        value
      );

      onCheckOutChange?.(
        ''
      );

      setSelectionMode(
        'checkout'
      );

      return;
    }

    onCheckOutChange?.(
      value
    );

    setSelectionMode(
      'checkin'
    );
  }

  function previousMonth() {
    setVisibleMonth(
      new Date(
        visibleMonth.getFullYear(),
        visibleMonth.getMonth() -
          1,
        1
      )
    );
  }

  function nextMonth() {
    setVisibleMonth(
      new Date(
        visibleMonth.getFullYear(),
        visibleMonth.getMonth() +
          1,
        1
      )
    );
  }

  const currentMonth =
    new Date();

  const previousDisabled =
    visibleMonth.getFullYear() ===
      currentMonth.getFullYear() &&
    visibleMonth.getMonth() ===
      currentMonth.getMonth();

  return (
    <div style={styles.wrapper}>
      <div
        style={
          styles.header
        }
      >
        <button
          type="button"
          onClick={
            previousMonth
          }
          disabled={
            previousDisabled
          }
          style={{
            ...styles.navButton,

            ...(previousDisabled
              ? styles.disabledNav
              : {}),
          }}
        >
          ‹
        </button>

        <div
          style={
            styles.monthTitle
          }
        >
          {monthLabel}
        </div>

        <button
          type="button"
          onClick={
            nextMonth
          }
          style={
            styles.navButton
          }
        >
          ›
        </button>
      </div>

      <div
        style={
          styles.selectionInfo
        }
      >
        {!checkIn && (
          <span>
            Select your check-in date
          </span>
        )}

        {checkIn &&
          !checkOut && (
            <span>
              Check-in:{' '}
              <strong>
                {checkIn}
              </strong>
              {' — '}
              now select check-out
            </span>
          )}

        {checkIn &&
          checkOut && (
            <span>
              <strong>
                {checkIn}
              </strong>
              {' → '}
              <strong>
                {checkOut}
              </strong>
            </span>
          )}
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
          (day) => (
            <div
              key={day}
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
                  key={`blank-${index}`}
                  style={
                    styles.blankDay
                  }
                />
              );
            }

            const value =
              dateString(
                date
              );

            const status =
              getDateStatus(
                date
              );

            const rate =
              status ===
              'available'
                ? getRate(
                    date
                  )
                : 0;

            const selectedCheckIn =
              value ===
              checkIn;

            const selectedCheckOut =
              value ===
              checkOut;

            const insideRange =
              rangeContainsDate(
                value
              );

            let dayStyle = {
              ...styles.day,
            };

            if (
              status ===
              'past'
            ) {
              dayStyle = {
                ...dayStyle,
                ...styles.pastDay,
              };
            }

            if (
              status ===
              'blocked'
            ) {
              dayStyle = {
                ...dayStyle,
                ...styles.blockedDay,
              };
            }

            if (
              status ===
              'booked'
            ) {
              dayStyle = {
                ...dayStyle,
                ...styles.bookedDay,
              };
            }

            if (
              insideRange
            ) {
              dayStyle = {
                ...dayStyle,
                ...styles.rangeDay,
              };
            }

            if (
              selectedCheckIn ||
              selectedCheckOut
            ) {
              dayStyle = {
                ...dayStyle,
                ...styles.selectedDay,
              };
            }

            return (
              <button
                type="button"
                key={
                  value
                }
                onClick={() =>
                  selectDate(
                    date
                  )
                }
                disabled={
                  status !==
                  'available'
                }
                style={
                  dayStyle
                }
              >
                <div
                  style={
                    styles.dayNumber
                  }
                >
                  {
                    date.getDate()
                  }
                </div>

                {status ===
                  'available' && (
                  <div
                    style={
                      styles.rate
                    }
                  >
                    {money(
                      rate
                    )}
                  </div>
                )}

                {status ===
                  'booked' && (
                  <div
                    style={
                      styles.statusText
                    }
                  >
                    Booked
                  </div>
                )}

                {status ===
                  'blocked' && (
                  <div
                    style={
                      styles.statusText
                    }
                  >
                    Blocked
                  </div>
                )}

                {status ===
                  'past' && (
                  <div
                    style={
                      styles.pastText
                    }
                  >
                    —
                  </div>
                )}
              </button>
            );
          }
        )}
      </div>

      <div
        style={
          styles.legend
        }
      >
        <span
          style={
            styles.availableLegend
          }
        >
          Available + Rate
        </span>

        <span
          style={
            styles.selectedLegend
          }
        >
          Selected
        </span>

        <span
          style={
            styles.bookedLegend
          }
        >
          Booked
        </span>

        <span
          style={
            styles.blockedLegend
          }
        >
          Host Blocked
        </span>
      </div>

      <div
        style={
          styles.note
        }
      >
        Rates shown are nightly rates. Final booking price may also include extra guest charges, applicable discounts, GST and other property charges.
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    width: '100%',
    marginTop: 18,
    padding: 18,
    boxSizing:
      'border-box',
    border:
      '1px solid #e2e5e8',
    borderRadius: 14,
    background:
      '#ffffff',
  },

  header: {
    display: 'grid',
    gridTemplateColumns:
      '44px 1fr 44px',
    alignItems:
      'center',
    gap: 10,
    marginBottom: 14,
  },

  monthTitle: {
    textAlign:
      'center',
    fontSize: 19,
    fontWeight: 900,
    color: '#11213c',
  },

  navButton: {
    width: 40,
    height: 40,
    borderRadius: 9,
    border:
      '1px solid #d7dce2',
    background:
      '#ffffff',
    color: '#17457f',
    fontSize: 25,
    cursor: 'pointer',
    fontWeight: 800,
  },

  disabledNav: {
    opacity: 0.35,
    cursor:
      'not-allowed',
  },

  selectionInfo: {
    marginBottom: 14,
    padding:
      '10px 12px',
    borderRadius: 9,
    background:
      '#eef4fb',
    color: '#17457f',
    fontSize: 12,
    textAlign:
      'center',
  },

  weekHeader: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(7, minmax(0, 1fr))',
    gap: 5,
    marginBottom: 5,
  },

  weekDay: {
    padding:
      '7px 2px',
    textAlign:
      'center',
    fontSize: 10,
    fontWeight: 900,
    color: '#687080',
  },

  calendarGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(7, minmax(0, 1fr))',
    gap: 5,
  },

  blankDay: {
    minHeight: 75,
  },

  day: {
    minWidth: 0,
    minHeight: 75,
    padding:
      '8px 3px',
    border:
      '1px solid #dfe3e8',
    borderRadius: 9,
    background:
      '#ffffff',
    cursor: 'pointer',
    textAlign:
      'center',
    color: '#11213c',
  },

  dayNumber: {
    fontSize: 13,
    fontWeight: 900,
  },

  rate: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: 800,
    color: '#26733d',
    whiteSpace:
      'nowrap',
  },

  statusText: {
    marginTop: 8,
    fontSize: 9,
    fontWeight: 900,
  },

  pastText: {
    marginTop: 8,
    fontSize: 11,
    color: '#9aa1aa',
  },

  pastDay: {
    background:
      '#f3f4f6',
    color: '#a2a8b0',
    cursor:
      'not-allowed',
    border:
      '1px solid #eceef0',
  },

  bookedDay: {
    background:
      '#ffeaea',
    color: '#8b2020',
    cursor:
      'not-allowed',
    border:
      '1px solid #efbcbc',
  },

  blockedDay: {
    background:
      '#f1f1f1',
    color: '#666666',
    cursor:
      'not-allowed',
    border:
      '1px solid #cccccc',
  },

  rangeDay: {
    background:
      '#edf4ff',
    border:
      '1px solid #9bbce6',
  },

  selectedDay: {
    background:
      '#17457f',
    color: '#ffffff',
    border:
      '1px solid #17457f',
  },

  legend: {
    display: 'flex',
    gap: 7,
    flexWrap: 'wrap',
    marginTop: 14,
  },

  availableLegend: {
    padding:
      '6px 9px',
    borderRadius: 20,
    background:
      '#eaf8ee',
    color: '#25663a',
    fontSize: 10,
    fontWeight: 800,
  },

  selectedLegend: {
    padding:
      '6px 9px',
    borderRadius: 20,
    background:
      '#17457f',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 800,
  },

  bookedLegend: {
    padding:
      '6px 9px',
    borderRadius: 20,
    background:
      '#ffeaea',
    color: '#8b2020',
    fontSize: 10,
    fontWeight: 800,
  },

  blockedLegend: {
    padding:
      '6px 9px',
    borderRadius: 20,
    background:
      '#eeeeee',
    color: '#555555',
    fontSize: 10,
    fontWeight: 800,
  },

  note: {
    marginTop: 12,
    color: '#687080',
    fontSize: 10,
    lineHeight: 1.5,
  },
};