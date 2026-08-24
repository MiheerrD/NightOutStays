'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  calculateCalendarDateRate,
} from '../../lib/pricing';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function todayString() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function firstDayOfMonth(monthDate) {
  return new Date(
    monthDate.getFullYear(),
    monthDate.getMonth(),
    1
  );
}

function lastDayOfMonth(monthDate) {
  return new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0
  );
}

function dateToString(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function addDays(dateString, days) {
  const date = new Date(
    `${dateString}T12:00:00`
  );

  date.setDate(
    date.getDate() + days
  );

  return dateToString(date);
}

function isDateBetween(
  date,
  startDate,
  endDate
) {
  if (!startDate || !endDate) {
    return false;
  }

  return (
    date >= startDate &&
    date <= endDate
  );
}

function isBookingBlocking(booking) {
  const paymentStatus =
    String(
      booking.payment_status || ''
    ).toLowerCase();

  const bookingStatus =
    String(
      booking.booking_status || ''
    ).toLowerCase();

  const paid =
    paymentStatus === 'paid' ||
    paymentStatus === 'captured' ||
    paymentStatus === 'success' ||
    paymentStatus === 'completed';

  const activeBooking =
    bookingStatus === 'confirmed' ||
    bookingStatus === 'completed';

  return paid && activeBooking;
}

function isPendingRequest(booking) {
  const paymentStatus =
    String(
      booking.payment_status || ''
    ).toLowerCase();

  const bookingStatus =
    String(
      booking.booking_status || ''
    ).toLowerCase();

  const hostDecision =
    String(
      booking.host_decision || ''
    ).toLowerCase();

  const notPaid =
    paymentStatus !== 'paid' &&
    paymentStatus !== 'captured' &&
    paymentStatus !== 'success' &&
    paymentStatus !== 'completed';

  const stillOpen =
    bookingStatus === 'pending' ||
    hostDecision === 'pending' ||
    hostDecision === 'approved';

  return notPaid && stillOpen;
}

export default function PropertyCalendarManager({
  propertyId,
  propertyName,
}) {
  const [property, setProperty] =
    useState(null);

  const [pricingRules, setPricingRules] =
    useState([]);

  const [rateOverrides, setRateOverrides] =
    useState([]);

  const [blockedDates, setBlockedDates] =
    useState([]);

  const [bookings, setBookings] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState('');

  const [errorMessage, setErrorMessage] =
    useState('');

  const [monthDate, setMonthDate] =
    useState(
      new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      )
    );

  const [selectedStartDate, setSelectedStartDate] =
    useState('');

  const [selectedEndDate, setSelectedEndDate] =
    useState('');

  const [manualRate, setManualRate] =
    useState('');

  const [rateNote, setRateNote] =
    useState('');

  const [blockNote, setBlockNote] =
    useState('');

  const [selectedMode, setSelectedMode] =
    useState('rate');

  const [editingOverrideId, setEditingOverrideId] =
    useState('');

  useEffect(() => {
    if (propertyId) {
      loadCalendarData();
    }
  }, [propertyId]);

  async function loadCalendarData() {
    setLoading(true);
    setErrorMessage('');

    try {
      const [
        propertyResult,
        pricingResult,
        overrideResult,
        blockedResult,
        bookingResult,
      ] =
        await Promise.all([
          supabase
            .from('properties')
            .select('*')
            .eq(
              'id',
              propertyId
            )
            .single(),

          supabase
            .from('pricing_rules')
            .select('*')
            .eq(
              'property_id',
              propertyId
            )
            .eq(
              'is_active',
              true
            ),

          supabase
            .from(
              'property_rate_overrides'
            )
            .select('*')
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

          supabase
            .from('blocked_dates')
            .select('*')
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

          supabase
            .from('bookings')
            .select(
              'id, booking_code, check_in, check_out, booking_status, host_decision, payment_status'
            )
            .eq(
              'property_id',
              propertyId
            )
            .order(
              'created_at',
              {
                ascending: false,
              }
            ),
        ]);

      if (
        propertyResult.error
      ) {
        throw propertyResult.error;
      }

      if (
        pricingResult.error
      ) {
        throw pricingResult.error;
      }

      if (
        overrideResult.error
      ) {
        throw overrideResult.error;
      }

      if (
        blockedResult.error
      ) {
        throw blockedResult.error;
      }

      if (
        bookingResult.error
      ) {
        throw bookingResult.error;
      }

      setProperty(
        propertyResult.data
      );

      setPricingRules(
        pricingResult.data || []
      );

      setRateOverrides(
        overrideResult.data || []
      );

      setBlockedDates(
        blockedResult.data || []
      );

      setBookings(
        bookingResult.data || []
      );
    } catch (error) {
      console.error(error);

      setErrorMessage(
        `Unable to load calendar: ${
          error.message ||
          'Unknown error'
        }`
      );
    } finally {
      setLoading(false);
    }
  }

  const calendarDays =
    useMemo(() => {
      if (!property) {
        return [];
      }

      const first =
        firstDayOfMonth(
          monthDate
        );

      const last =
        lastDayOfMonth(
          monthDate
        );

      const firstWeekDay =
        first.getDay();

      const totalDays =
        last.getDate();

      const rows = [];

      for (
        let i = 0;
        i < firstWeekDay;
        i += 1
      ) {
        rows.push(null);
      }

      for (
        let day = 1;
        day <= totalDays;
        day += 1
      ) {
        const date =
          new Date(
            monthDate.getFullYear(),
            monthDate.getMonth(),
            day
          );

        const dateString =
          dateToString(date);

        const rateInfo =
          calculateCalendarDateRate({
            property,

            date:
              dateString,

            guestCount:
              property.included_guests,

            pricingRules,

            rateOverrides,
          });

        const blocked =
          blockedDates.some(
            (block) =>
              isDateBetween(
                dateString,
                block.start_date,
                block.end_date
              )
          );

        const confirmedBooking =
          bookings.find(
            (booking) =>
              isBookingBlocking(
                booking
              ) &&
              dateString >=
                booking.check_in &&
              dateString <
                booking.check_out
          );

        const pendingRequests =
          bookings.filter(
            (booking) =>
              isPendingRequest(
                booking
              ) &&
              dateString >=
                booking.check_in &&
              dateString <
                booking.check_out
          );

        const override =
          rateOverrides.find(
            (item) =>
              item.is_active !==
                false &&
              dateString >=
                item.start_date &&
              dateString <=
                item.end_date
          );

        rows.push({
          date:
            dateString,

          day,

          rateInfo,

          blocked,

          confirmedBooking,

          pendingRequests,

          override,
        });
      }

      return rows;
    }, [
      property,
      monthDate,
      pricingRules,
      rateOverrides,
      blockedDates,
      bookings,
    ]);

  function moveMonth(offset) {
    setMonthDate(
      new Date(
        monthDate.getFullYear(),
        monthDate.getMonth() +
          offset,
        1
      )
    );
  }

  function selectDate(date) {
    setMessage('');
    setErrorMessage('');

    if (
      !selectedStartDate ||
      (
        selectedStartDate &&
        selectedEndDate
      )
    ) {
      setSelectedStartDate(
        date
      );

      setSelectedEndDate(
        date
      );

      return;
    }

    if (
      date <
      selectedStartDate
    ) {
      setSelectedStartDate(
        date
      );

      setSelectedEndDate(
        date
      );

      return;
    }

    setSelectedEndDate(
      date
    );
  }

  function clearSelection() {
    setSelectedStartDate('');
    setSelectedEndDate('');
    setManualRate('');
    setRateNote('');
    setBlockNote('');
    setEditingOverrideId('');
  }

  async function saveRateOverride() {
    setMessage('');
    setErrorMessage('');

    if (
      !selectedStartDate ||
      !selectedEndDate
    ) {
      setErrorMessage(
        'Select a date or date range first.'
      );

      return;
    }

    const value =
      Number(
        manualRate
      );

    if (
      !value ||
      value <= 0
    ) {
      setErrorMessage(
        'Enter a valid nightly rate.'
      );

      return;
    }

    setSaving(true);

    try {
      const payload = {
        property_id:
          propertyId,

        start_date:
          selectedStartDate,

        end_date:
          selectedEndDate,

        nightly_rate:
          value,

        note:
          rateNote.trim() ||
          null,

        is_active:
          true,

        updated_at:
          new Date().toISOString(),
      };

      let result;

      if (
        editingOverrideId
      ) {
        result =
          await supabase
            .from(
              'property_rate_overrides'
            )
            .update(
              payload
            )
            .eq(
              'id',
              editingOverrideId
            );
      } else {
        result =
          await supabase
            .from(
              'property_rate_overrides'
            )
            .insert(
              payload
            );
      }

      if (
        result.error
      ) {
        throw result.error;
      }

      setMessage(
        editingOverrideId
          ? 'Calendar rate updated successfully.'
          : 'Calendar rate added successfully.'
      );

      clearSelection();

      await loadCalendarData();
    } catch (error) {
      setErrorMessage(
        `Unable to save calendar rate: ${
          error.message ||
          'Unknown error'
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function blockSelectedDates() {
    setMessage('');
    setErrorMessage('');

    if (
      !selectedStartDate ||
      !selectedEndDate
    ) {
      setErrorMessage(
        'Select a date or date range first.'
      );

      return;
    }

    setSaving(true);

    try {
      const {
        error,
      } =
        await supabase
          .from(
            'blocked_dates'
          )
          .insert({
            property_id:
              propertyId,

            start_date:
              selectedStartDate,

            end_date:
              selectedEndDate,

            reason:
              blockNote.trim() ||
              'Host blocked',
          });

      if (error) {
        throw error;
      }

      setMessage(
        'Selected dates blocked successfully.'
      );

      clearSelection();

      await loadCalendarData();
    } catch (error) {
      setErrorMessage(
        `Unable to block dates: ${
          error.message ||
          'Unknown error'
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteOverride(
    override
  ) {
    const confirmed =
      window.confirm(
        `Delete manual rate ${money(
          override.nightly_rate
        )} for ${override.start_date} to ${override.end_date}?`
      );

    if (!confirmed) {
      return;
    }

    const {
      error,
    } =
      await supabase
        .from(
          'property_rate_overrides'
        )
        .delete()
        .eq(
          'id',
          override.id
        );

    if (error) {
      setErrorMessage(
        `Unable to delete rate: ${error.message}`
      );

      return;
    }

    setMessage(
      'Manual rate deleted.'
    );

    await loadCalendarData();
  }

  async function unblockDates(
    block
  ) {
    const confirmed =
      window.confirm(
        `Unblock ${block.start_date} to ${block.end_date}?`
      );

    if (!confirmed) {
      return;
    }

    const {
      error,
    } =
      await supabase
        .from(
          'blocked_dates'
        )
        .delete()
        .eq(
          'id',
          block.id
        );

    if (error) {
      setErrorMessage(
        `Unable to unblock dates: ${error.message}`
      );

      return;
    }

    setMessage(
      'Dates unblocked successfully.'
    );

    await loadCalendarData();
  }

  function editOverride(
    override
  ) {
    setSelectedMode(
      'rate'
    );

    setEditingOverrideId(
      override.id
    );

    setSelectedStartDate(
      override.start_date
    );

    setSelectedEndDate(
      override.end_date
    );

    setManualRate(
      String(
        override.nightly_rate
      )
    );

    setRateNote(
      override.note || ''
    );

    window.scrollTo({
      top:
        document.body.scrollHeight,
      behavior:
        'smooth',
    });
  }

  if (loading) {
    return (
      <section style={styles.section}>
        Loading property calendar...
      </section>
    );
  }

  if (!property) {
    return null;
  }

  const monthTitle =
    monthDate.toLocaleString(
      'en-IN',
      {
        month: 'long',
        year: 'numeric',
      }
    );

  return (
    <section style={styles.section}>
      <div style={styles.headingRow}>
        <div>
          <h2 style={styles.heading}>
            Availability & Rate Calendar
          </h2>

          <p style={styles.help}>
            Manage daily pricing, manual rate overrides and blocked dates for {propertyName}.
          </p>
        </div>

        <div style={styles.legend}>
          <Legend
            text="Available"
          />

          <Legend
            text="Pending Request"
          />

          <Legend
            text="Paid / Booked"
          />

          <Legend
            text="Host Blocked"
          />
        </div>
      </div>

      <div style={styles.calendarHeader}>
        <button
          type="button"
          onClick={() =>
            moveMonth(-1)
          }
          style={styles.monthButton}
        >
          ‹
        </button>

        <strong style={styles.monthTitle}>
          {monthTitle}
        </strong>

        <button
          type="button"
          onClick={() =>
            moveMonth(1)
          }
          style={styles.monthButton}
        >
          ›
        </button>
      </div>

      <div style={styles.weekDays}>
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
              style={styles.weekDay}
            >
              {day}
            </div>
          )
        )}
      </div>

      <div style={styles.calendarGrid}>
        {calendarDays.map(
          (
            item,
            index
          ) => {
            if (!item) {
              return (
                <div
                  key={`empty-${index}`}
                  style={styles.emptyDay}
                />
              );
            }

            const selected =
              selectedStartDate &&
              selectedEndDate &&
              item.date >=
                selectedStartDate &&
              item.date <=
                selectedEndDate;

            let status =
              'available';

            if (
              item.blocked
            ) {
              status =
                'blocked';
            } else if (
              item.confirmedBooking
            ) {
              status =
                'booked';
            } else if (
              item.pendingRequests
                .length > 0
            ) {
              status =
                'pending';
            }

            return (
              <button
                key={
                  item.date
                }
                type="button"
                onClick={() =>
                  selectDate(
                    item.date
                  )
                }
                style={{
                  ...styles.dayCell,

                  ...(selected
                    ? styles.selectedDay
                    : {}),

                  ...(status ===
                  'blocked'
                    ? styles.blockedDay
                    : {}),

                  ...(status ===
                  'booked'
                    ? styles.bookedDay
                    : {}),

                  ...(status ===
                  'pending'
                    ? styles.pendingDay
                    : {}),
                }}
              >
                <div style={styles.dayNumber}>
                  {item.day}
                </div>

                <div style={styles.dayRate}>
                  {money(
                    item.rateInfo
                      ?.nightlyRate ||
                      0
                  )}
                </div>

                <div style={styles.rateSource}>
                  {item.rateInfo
                    ?.rateSourceLabel ||
                    'Base Rate'}
                </div>

                {item.pendingRequests
                  .length > 0 && (
                  <div style={styles.pendingText}>
                    {
                      item.pendingRequests
                        .length
                    }{' '}
                    request
                    {item.pendingRequests
                      .length === 1
                      ? ''
                      : 's'}
                  </div>
                )}

                {item.confirmedBooking && (
                  <div style={styles.bookedText}>
                    Paid
                  </div>
                )}

                {item.blocked && (
                  <div style={styles.blockedText}>
                    Blocked
                  </div>
                )}
              </button>
            );
          }
        )}
      </div>

      <div style={styles.selectionBox}>
        <div style={styles.selectionTitle}>
          Selected Dates
        </div>

        <div>
          {selectedStartDate
            ? selectedStartDate
            : 'No date selected'}

          {selectedStartDate &&
            selectedEndDate &&
            selectedStartDate !==
              selectedEndDate &&
            ` → ${selectedEndDate}`}
        </div>

        <div style={styles.modeButtons}>
          <button
            type="button"
            onClick={() =>
              setSelectedMode(
                'rate'
              )
            }
            style={{
              ...styles.modeButton,

              ...(selectedMode ===
              'rate'
                ? styles.activeMode
                : {}),
            }}
          >
            Set Rate
          </button>

          <button
            type="button"
            onClick={() =>
              setSelectedMode(
                'block'
              )
            }
            style={{
              ...styles.modeButton,

              ...(selectedMode ===
              'block'
                ? styles.activeMode
                : {}),
            }}
          >
            Block Dates
          </button>
        </div>

        {selectedMode ===
        'rate' ? (
          <div style={styles.formGrid}>
            <div>
              <label style={styles.label}>
                NIGHTLY RATE ₹
              </label>

              <input
                type="number"
                min="1"
                value={
                  manualRate
                }
                onChange={(
                  event
                ) =>
                  setManualRate(
                    event.target.value
                  )
                }
                placeholder="5000"
                style={styles.input}
              />
            </div>

            <div>
              <label style={styles.label}>
                NOTE
              </label>

              <input
                value={
                  rateNote
                }
                onChange={(
                  event
                ) =>
                  setRateNote(
                    event.target.value
                  )
                }
                placeholder="15 August special rate"
                style={styles.input}
              />
            </div>

            <button
              type="button"
              onClick={
                saveRateOverride
              }
              disabled={
                saving
              }
              style={styles.saveButton}
            >
              {saving
                ? 'Saving...'
                : editingOverrideId
                ? 'Update Rate'
                : 'Save Rate'}
            </button>
          </div>
        ) : (
          <div style={styles.formGrid}>
            <div>
              <label style={styles.label}>
                BLOCK REASON
              </label>

              <input
                value={
                  blockNote
                }
                onChange={(
                  event
                ) =>
                  setBlockNote(
                    event.target.value
                  )
                }
                placeholder="Owner use / Maintenance"
                style={styles.input}
              />
            </div>

            <button
              type="button"
              onClick={
                blockSelectedDates
              }
              disabled={
                saving
              }
              style={styles.blockButton}
            >
              {saving
                ? 'Saving...'
                : 'Block Selected Dates'}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={
            clearSelection
          }
          style={styles.clearButton}
        >
          Clear Selection
        </button>
      </div>

      {errorMessage && (
        <div style={styles.error}>
          {errorMessage}
        </div>
      )}

      {message && (
        <div style={styles.success}>
          {message}
        </div>
      )}

      <div style={styles.listGrid}>
        <div>
          <h3>
            Manual Rate Overrides
          </h3>

          {rateOverrides.length ===
          0 ? (
            <div style={styles.emptyList}>
              No manual rates set.
            </div>
          ) : (
            rateOverrides.map(
              (override) => (
                <div
                  key={
                    override.id
                  }
                  style={styles.listItem}
                >
                  <div>
                    <strong>
                      {money(
                        override.nightly_rate
                      )}
                    </strong>

                    <div style={styles.smallText}>
                      {override.start_date}
                      {' → '}
                      {override.end_date}
                    </div>

                    {override.note && (
                      <div style={styles.smallText}>
                        {override.note}
                      </div>
                    )}
                  </div>

                  <div style={styles.itemActions}>
                    <button
                      type="button"
                      onClick={() =>
                        editOverride(
                          override
                        )
                      }
                      style={styles.editButton}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        deleteOverride(
                          override
                        )
                      }
                      style={styles.deleteButton}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            )
          )}
        </div>

        <div>
          <h3>
            Host Blocked Dates
          </h3>

          {blockedDates.length ===
          0 ? (
            <div style={styles.emptyList}>
              No blocked dates.
            </div>
          ) : (
            blockedDates.map(
              (block) => (
                <div
                  key={
                    block.id
                  }
                  style={styles.listItem}
                >
                  <div>
                    <strong>
                      {block.start_date}
                      {' → '}
                      {block.end_date}
                    </strong>

                    {block.reason && (
                      <div style={styles.smallText}>
                        {block.reason}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      unblockDates(
                        block
                      )
                    }
                    style={styles.deleteButton}
                  >
                    Unblock
                  </button>
                </div>
              )
            )
          )}
        </div>
      </div>
    </section>
  );
}

function Legend({
  text,
}) {
  return (
    <div style={styles.legendItem}>
      {text}
    </div>
  );
}

const styles = {
  section: {
    marginTop: 22,
    background: '#ffffff',
    border:
      '1px solid #e2e5e8',
    borderRadius: 16,
    padding: 24,
  },

  headingRow: {
    display: 'flex',
    justifyContent:
      'space-between',
    gap: 20,
    flexWrap: 'wrap',
  },

  heading: {
    marginTop: 0,
  },

  help: {
    color: '#687080',
  },

  legend: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },

  legendItem: {
    padding: '7px 10px',
    borderRadius: 20,
    background: '#f4f6f8',
    fontSize: 11,
    fontWeight: 700,
  },

  calendarHeader: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginTop: 25,
    marginBottom: 12,
  },

  monthButton: {
    width: 38,
    height: 38,
    border:
      '1px solid #ccd1d8',
    background: '#ffffff',
    borderRadius: 9,
    fontSize: 24,
    cursor: 'pointer',
  },

  monthTitle: {
    minWidth: 180,
    textAlign: 'center',
    fontSize: 19,
  },

  weekDays: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(7, 1fr)',
    gap: 5,
  },

  weekDay: {
    padding: 8,
    textAlign: 'center',
    fontWeight: 800,
    fontSize: 11,
  },

  calendarGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(7, 1fr)',
    gap: 5,
  },

  emptyDay: {
    minHeight: 105,
  },

  dayCell: {
    minHeight: 105,
    border:
      '1px solid #dfe3e8',
    borderRadius: 10,
    background: '#ffffff',
    padding: 8,
    textAlign: 'left',
    cursor: 'pointer',
  },

  selectedDay: {
    outline:
      '3px solid #17457f',
  },

  pendingDay: {
    background: '#fff8df',
  },

  bookedDay: {
    background: '#e9f7ed',
  },

  blockedDay: {
    background: '#f1f1f1',
  },

  dayNumber: {
    fontWeight: 900,
  },

  dayRate: {
    marginTop: 10,
    color: '#17457f',
    fontWeight: 900,
    fontSize: 14,
  },

  rateSource: {
    fontSize: 9,
    color: '#687080',
    marginTop: 2,
  },

  pendingText: {
    marginTop: 7,
    fontSize: 9,
    color: '#8a6a00',
    fontWeight: 800,
  },

  bookedText: {
    marginTop: 7,
    fontSize: 9,
    color: '#26733d',
    fontWeight: 800,
  },

  blockedText: {
    marginTop: 7,
    fontSize: 9,
    color: '#666',
    fontWeight: 800,
  },

  selectionBox: {
    marginTop: 25,
    padding: 18,
    borderRadius: 12,
    background: '#f7f8fa',
  },

  selectionTitle: {
    fontWeight: 900,
    marginBottom: 5,
  },

  modeButtons: {
    display: 'flex',
    gap: 8,
    marginTop: 15,
  },

  modeButton: {
    border:
      '1px solid #17457f',
    background: '#ffffff',
    color: '#17457f',
    padding: '9px 13px',
    borderRadius: 8,
    fontWeight: 800,
    cursor: 'pointer',
  },

  activeMode: {
    background: '#17457f',
    color: '#ffffff',
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 12,
    marginTop: 15,
    alignItems: 'end',
  },

  label: {
    display: 'block',
    fontSize: 10,
    fontWeight: 900,
    marginBottom: 6,
  },

  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: 11,
    border:
      '1px solid #ccd1d8',
    borderRadius: 9,
  },

  saveButton: {
    border: 0,
    background: '#17457f',
    color: '#ffffff',
    padding: 12,
    borderRadius: 9,
    fontWeight: 800,
    cursor: 'pointer',
  },

  blockButton: {
    border: 0,
    background: '#8f2d2d',
    color: '#ffffff',
    padding: 12,
    borderRadius: 9,
    fontWeight: 800,
    cursor: 'pointer',
  },

  clearButton: {
    marginTop: 12,
    border:
      '1px solid #ccd1d8',
    background: '#ffffff',
    padding: '9px 13px',
    borderRadius: 8,
    cursor: 'pointer',
  },

  error: {
    marginTop: 15,
    padding: 12,
    background: '#ffeaea',
    color: '#8b2020',
    borderRadius: 9,
    fontWeight: 700,
  },

  success: {
    marginTop: 15,
    padding: 12,
    background: '#eaf8ee',
    color: '#25663a',
    borderRadius: 9,
    fontWeight: 700,
  },

  listGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 20,
    marginTop: 25,
  },

  listItem: {
    display: 'flex',
    justifyContent:
      'space-between',
    gap: 10,
    alignItems: 'center',
    border:
      '1px solid #e2e5e8',
    borderRadius: 10,
    padding: 12,
    marginBottom: 9,
  },

  smallText: {
    color: '#687080',
    fontSize: 11,
    marginTop: 4,
  },

  itemActions: {
    display: 'flex',
    gap: 6,
  },

  editButton: {
    border: 0,
    background: '#17457f',
    color: '#ffffff',
    borderRadius: 7,
    padding: '7px 9px',
    cursor: 'pointer',
  },

  deleteButton: {
    border: 0,
    background: '#ffe7e7',
    color: '#922b2b',
    borderRadius: 7,
    padding: '7px 9px',
    cursor: 'pointer',
  },

  emptyList: {
    padding: 14,
    background: '#f7f8fa',
    borderRadius: 9,
    color: '#687080',
  },
};