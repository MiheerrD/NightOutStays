'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  createClient,
} from '@supabase/supabase-js';

import {
  calculateBookingPrice,
} from '../../lib/pricing';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

function formatDateTime(value) {
  if (!value) return '';

  return new Date(value).toLocaleString(
    'en-IN',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    }
  );
}

function money(value) {
  return `₹${Number(
    value || 0
  ).toLocaleString(
    'en-IN',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

function roundMoney(value) {
  return (
    Math.round(
      Number(value || 0) *
        100
    ) / 100
  );
}

function getStayDates(
  checkIn,
  checkOut
) {
  if (
    !checkIn ||
    !checkOut
  ) {
    return [];
  }

  const result = [];

  let current =
    new Date(
      `${checkIn}T12:00:00`
    );

  const end =
    new Date(
      `${checkOut}T12:00:00`
    );

  while (
    current < end
  ) {
    result.push(
      [
        current.getFullYear(),
        String(
          current.getMonth() +
            1
        ).padStart(
          2,
          '0'
        ),
        String(
          current.getDate()
        ).padStart(
          2,
          '0'
        ),
      ].join('-')
    );

    current.setDate(
      current.getDate() +
        1
    );
  }

  return result;
}

/*
  GLOBAL GST RULE

  Effective accommodation rate
  PER NIGHT:

  <= 6999  = 5%
  >= 7000  = 18%

  GST is calculated night by night.
*/

function calculateNightlyGST(
  nightlyAmounts
) {
  let gstAmount = 0;

  const breakdown =
    nightlyAmounts.map(
      (item) => {
        const rate =
          roundMoney(
            item.rate
          );

        const gstRate =
          rate < 7000
            ? 5
            : 18;

        const gst =
          roundMoney(
            rate *
              gstRate /
              100
          );

        gstAmount += gst;

        return {
          date:
            item.date,

          rate,

          gstRate,

          gst,
        };
      }
    );

  return {
    gstAmount:
      roundMoney(
        gstAmount
      ),

    breakdown,
  };
}

/*
  Host enters the FINAL
  accommodation offer BEFORE GST.

  We distribute that amount
  proportionately across the
  original nightly rates.

  This means different calendar
  nightly rates keep their proper
  relationship and GST is decided
  per night.
*/

function buildHostOfferPricing({
  offeredAccommodation,
  originalNightlyRates,
  nights,
}) {
  const offeredTotal =
    roundMoney(
      offeredAccommodation
    );

  if (
    offeredTotal <= 0
  ) {
    throw new Error(
      'Offer amount must be greater than ₹0.'
    );
  }

  let nightlyRates =
    Array.isArray(
      originalNightlyRates
    )
      ? originalNightlyRates.filter(
          (item) =>
            Number(
              item.rate
            ) >= 0
        )
      : [];

  if (
    !nightlyRates.length
  ) {
    const count =
      Math.max(
        Number(
          nights || 1
        ),
        1
      );

    const average =
      offeredTotal /
      count;

    nightlyRates =
      Array.from(
        {
          length:
            count,
        },
        (
          _,
          index
        ) => ({
          date:
            `Night ${
              index + 1
            }`,

          rate:
            average,
        })
      );
  }

  const originalTotal =
    nightlyRates.reduce(
      (
        sum,
        item
      ) =>
        sum +
        Number(
          item.rate || 0
        ),
      0
    );

  let distributed = [];

  if (
    originalTotal >
    0
  ) {
    let allocated =
      0;

    nightlyRates.forEach(
      (
        item,
        index
      ) => {
        let offeredRate;

        if (
          index ===
          nightlyRates.length -
            1
        ) {
          offeredRate =
            roundMoney(
              offeredTotal -
                allocated
            );
        } else {
          offeredRate =
            roundMoney(
              offeredTotal *
                (
                  Number(
                    item.rate ||
                      0
                  ) /
                  originalTotal
                )
            );

          allocated +=
            offeredRate;
        }

        distributed.push({
          date:
            item.date,

          rate:
            Math.max(
              0,
              offeredRate
            ),
        });
      }
    );
  } else {
    const average =
      offeredTotal /
      nightlyRates.length;

    let allocated =
      0;

    distributed =
      nightlyRates.map(
        (
          item,
          index
        ) => {
          const value =
            index ===
            nightlyRates.length -
              1
              ? roundMoney(
                  offeredTotal -
                    allocated
                )
              : roundMoney(
                  average
                );

          allocated +=
            index ===
            nightlyRates.length -
              1
              ? 0
              : value;

          return {
            date:
              item.date,

            rate:
              value,
          };
        }
      );
  }

  const gstResult =
    calculateNightlyGST(
      distributed
    );

  const finalPayable =
    roundMoney(
      offeredTotal +
        gstResult.gstAmount
    );

  return {
    accommodationAmount:
      offeredTotal,

    gstAmount:
      gstResult.gstAmount,

    finalPayable,

    nightlyBreakdown:
      gstResult.breakdown,
  };
}

export default function AdminMessagesPage() {
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
    bookings,
    setBookings,
  ] = useState([]);

  const [
    messages,
    setMessages,
  ] = useState([]);

  const [
    selectedBookingId,
    setSelectedBookingId,
  ] = useState('');

  const [
    reply,
    setReply,
  ] = useState('');

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const [
    showOfferBox,
    setShowOfferBox,
  ] = useState(false);

  const [
    offerAmount,
    setOfferAmount,
  ] = useState('');

  const [
    offerNote,
    setOfferNote,
  ] = useState('');

  const [
    offerSending,
    setOfferSending,
  ] = useState(false);

  const [
    offerPreview,
    setOfferPreview,
  ] = useState(null);

  useEffect(
    () => {
      initialize();
    },
    []
  );

  /*
    REALTIME ADMIN INBOX

    Any new booking message
    automatically refreshes
    the inbox.

    No manual Refresh needed.
  */

  useEffect(
    () => {
      if (
        !session ||
        !adminProfile
      ) {
        return;
      }

      const channel =
        supabase
          .channel(
            'admin-booking-messages-realtime'
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema:
                'public',
              table:
                'booking_messages',
            },
            async (
              payload
            ) => {
              const affectedBookingId =
                payload.new
                  ?.booking_id ||
                payload.old
                  ?.booking_id ||
                '';

              try {
                await loadInbox(
                  selectedBookingId ||
                    affectedBookingId
                );
              } catch (
                realtimeError
              ) {
                console.error(
                  'Realtime refresh failed:',
                  realtimeError
                );
              }
            }
          )
          .subscribe();

      return () => {
        supabase.removeChannel(
          channel
        );
      };
    },
    [
      session,
      adminProfile,
      selectedBookingId,
    ]
  );

  /*
    Also refresh if a booking
    itself changes, e.g. guest
    discount request or offer
    status.
  */

  useEffect(
    () => {
      if (
        !session ||
        !adminProfile
      ) {
        return;
      }

      const channel =
        supabase
          .channel(
            'admin-bookings-realtime'
          )
          .on(
            'postgres_changes',
            {
              event:
                'UPDATE',

              schema:
                'public',

              table:
                'bookings',
            },
            async (
              payload
            ) => {
              const bookingId =
                payload.new?.id ||
                '';

              if (
                !bookingId
              ) {
                return;
              }

              try {
                await loadInbox(
                  selectedBookingId ||
                    bookingId
                );
              } catch (
                realtimeError
              ) {
                console.error(
                  realtimeError
                );
              }
            }
          )
          .subscribe();

      return () => {
        supabase.removeChannel(
          channel
        );
      };
    },
    [
      session,
      adminProfile,
      selectedBookingId,
    ]
  );

  async function initialize() {
    setLoading(true);
    setErrorMessage('');

    try {
      const {
        data: {
          session,
        },
        error:
          sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError
      ) {
        throw sessionError;
      }

      setSession(
        session
      );

      if (
        !session
      ) {
        return;
      }

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
            session.user.id
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

      let requestedBookingId =
        '';

      if (
        typeof window !==
        'undefined'
      ) {
        const params =
          new URLSearchParams(
            window.location.search
          );

        requestedBookingId =
          params.get(
            'booking'
          ) || '';
      }

      await loadInbox(
        requestedBookingId
      );
    } catch (
      error
    ) {
      console.error(
        error
      );

      setErrorMessage(
        error.message ||
          'Unable to load messages.'
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  async function loadInbox(
    requestedBookingId = ''
  ) {
    const {
      data:
        bookingRows,
      error:
        bookingError,
    } =
      await supabase
        .from(
          'bookings'
        )
        .select('*')
        .order(
          'created_at',
          {
            ascending:
              false,
          }
        );

    if (
      bookingError
    ) {
      throw bookingError;
    }

    const rows =
      bookingRows ||
      [];

    if (
      !rows.length
    ) {
      setBookings([]);
      setMessages([]);
      setSelectedBookingId(
        ''
      );

      return;
    }

    const propertyIds =
      [
        ...new Set(
          rows
            .map(
              (
                booking
              ) =>
                booking.property_id
            )
            .filter(
              Boolean
            )
        ),
      ];

    const guestIds =
      [
        ...new Set(
          rows
            .map(
              (
                booking
              ) =>
                booking.guest_id
            )
            .filter(
              Boolean
            )
        ),
      ];

    const bookingIds =
      rows.map(
        (
          booking
        ) =>
          booking.id
      );

    const [
      propertiesResult,
      guestsResult,
      messagesResult,
      pricingRulesResult,
      rateOverridesResult,
    ] =
      await Promise.all([
        propertyIds.length
          ? supabase
              .from(
                'properties'
              )
              .select('*')
              .in(
                'id',
                propertyIds
              )

          : Promise.resolve({
              data: [],
              error: null,
            }),

        guestIds.length
          ? supabase
              .from(
                'guests'
              )
              .select(
                'id, full_name, phone, email'
              )
              .in(
                'id',
                guestIds
              )

          : Promise.resolve({
              data: [],
              error: null,
            }),

        bookingIds.length
          ? supabase
              .from(
                'booking_messages'
              )
              .select('*')
              .in(
                'booking_id',
                bookingIds
              )
              .order(
                'created_at',
                {
                  ascending:
                    true,
                }
              )

          : Promise.resolve({
              data: [],
              error: null,
            }),

        propertyIds.length
          ? supabase
              .from(
                'pricing_rules'
              )
              .select('*')
              .in(
                'property_id',
                propertyIds
              )
              .eq(
                'is_active',
                true
              )

          : Promise.resolve({
              data: [],
              error: null,
            }),

        propertyIds.length
          ? supabase
              .from(
                'property_rate_overrides'
              )
              .select('*')
              .in(
                'property_id',
                propertyIds
              )
              .eq(
                'is_active',
                true
              )

          : Promise.resolve({
              data: [],
              error: null,
            }),
      ]);

    if (
      propertiesResult.error
    ) {
      throw propertiesResult.error;
    }

    if (
      guestsResult.error
    ) {
      throw guestsResult.error;
    }

    if (
      messagesResult.error
    ) {
      throw messagesResult.error;
    }

    if (
      pricingRulesResult.error
    ) {
      throw pricingRulesResult.error;
    }

    if (
      rateOverridesResult.error
    ) {
      throw rateOverridesResult.error;
    }

    const propertyMap =
      {};

    (
      propertiesResult.data ||
      []
    ).forEach(
      (
        property
      ) => {
        propertyMap[
          property.id
        ] =
          property;
      }
    );

    const guestMap =
      {};

    (
      guestsResult.data ||
      []
    ).forEach(
      (
        guest
      ) => {
        guestMap[
          guest.id
        ] =
          guest;
      }
    );

    const pricingRulesByProperty =
      {};

    (
      pricingRulesResult.data ||
      []
    ).forEach(
      (
        rule
      ) => {
        if (
          !pricingRulesByProperty[
            rule.property_id
          ]
        ) {
          pricingRulesByProperty[
            rule.property_id
          ] = [];
        }

        pricingRulesByProperty[
          rule.property_id
        ].push({
          ...rule,

          type:
            rule.rule_type,

          percent:
            rule.adjustment_type ===
            'percent'
              ? Number(
                  rule.adjustment_value ||
                    0
                )
              : undefined,

          value:
            Number(
              rule.adjustment_value ||
                0
            ),

          label:
            rule.name,

          adjustmentType:
            rule.adjustment_type,
        });
      }
    );

    const rateOverridesByProperty =
      {};

    (
      rateOverridesResult.data ||
      []
    ).forEach(
      (
        override
      ) => {
        if (
          !rateOverridesByProperty[
            override.property_id
          ]
        ) {
          rateOverridesByProperty[
            override.property_id
          ] = [];
        }

        rateOverridesByProperty[
          override.property_id
        ].push(
          override
        );
      }
    );

    const enrichedBookings =
      rows.map(
        (
          booking
        ) => ({
          ...booking,

          property:
            propertyMap[
              booking.property_id
            ] ||
            null,

          guest:
            guestMap[
              booking.guest_id
            ] ||
            null,

          pricingRules:
            pricingRulesByProperty[
              booking.property_id
            ] ||
            [],

          rateOverrides:
            rateOverridesByProperty[
              booking.property_id
            ] ||
            [],
        })
      );

    setBookings(
      enrichedBookings
    );

    setMessages(
      messagesResult.data ||
        []
    );

    const requestedExists =
      requestedBookingId &&
      enrichedBookings.some(
        (
          booking
        ) =>
          booking.id ===
          requestedBookingId
      );

    if (
      requestedExists
    ) {
      setSelectedBookingId(
        requestedBookingId
      );

      await markThreadReadOnly(
        requestedBookingId
      );

      return;
    }

    setSelectedBookingId(
      (
        previous
      ) => {
        const previousExists =
          previous &&
          enrichedBookings.some(
            (
              booking
            ) =>
              booking.id ===
              previous
          );

        if (
          previousExists
        ) {
          return previous;
        }

        return (
          enrichedBookings[
            0
          ]?.id ||
          ''
        );
      }
    );
  }

  const threads =
    useMemo(
      () => {
        return bookings
          .map(
            (
              booking
            ) => {
              const bookingMessages =
                messages.filter(
                  (
                    item
                  ) =>
                    item.booking_id ===
                    booking.id
                );

              const lastMessage =
                bookingMessages.length
                  ? bookingMessages[
                      bookingMessages.length -
                        1
                    ]
                  : null;

              const unread =
                bookingMessages.filter(
                  (
                    item
                  ) =>
                    item.sender_type ===
                      'guest' &&
                    !item.is_read
                ).length;

              return {
                booking,

                messages:
                  bookingMessages,

                lastMessage,

                unread,

                displayTime:
                  lastMessage
                    ?.created_at ||
                  booking.created_at,
              };
            }
          )
          .sort(
            (
              a,
              b
            ) =>
              new Date(
                b.displayTime ||
                  0
              ) -
              new Date(
                a.displayTime ||
                  0
              )
          );
      },
      [
        bookings,
        messages,
      ]
    );

  const selectedThread =
    useMemo(
      () => {
        return threads.find(
          (
            thread
          ) =>
            thread.booking.id ===
            selectedBookingId
        );
      },
      [
        threads,
        selectedBookingId,
      ]
    );

  const selectedBooking =
    selectedThread
      ?.booking ||
    null;

  const originalNightlyRates =
    useMemo(
      () => {
        if (
          !selectedBooking ||
          !selectedBooking.property
        ) {
          return [];
        }

        try {
          const result =
            calculateBookingPrice({
              property:
                selectedBooking.property,

              guestCount:
                Number(
                  selectedBooking.guests_count ||
                    1
                ),

              checkIn:
                selectedBooking.check_in,

              checkOut:
                selectedBooking.check_out,

              pricingRules:
                selectedBooking.pricingRules ||
                [],

              rateOverrides:
                selectedBooking.rateOverrides ||
                [],

              gstRate:
                0,
            });

          if (
            Array.isArray(
              result?.nightlyBreakdown
            ) &&
            result.nightlyBreakdown.length
          ) {
            return result.nightlyBreakdown.map(
              (
                item
              ) => ({
                date:
                  item.date,

                rate:
                  Number(
                    item.rate ||
                      0
                  ),
              })
            );
          }
        } catch (
          error
        ) {
          console.warn(
            'Unable to rebuild nightly pricing:',
            error
          );
        }

        const dates =
          getStayDates(
            selectedBooking.check_in,
            selectedBooking.check_out
          );

        const fallbackRate =
          Number(
            selectedBooking.nightly_rate ||
              0
          );

        return dates.map(
          (
            date
          ) => ({
            date,

            rate:
              fallbackRate,
          })
        );
      },
      [
        selectedBooking,
      ]
    );

  useEffect(
    () => {
      if (
        !showOfferBox ||
        !offerAmount ||
        !selectedBooking
      ) {
        setOfferPreview(
          null
        );

        return;
      }

      try {
        const preview =
          buildHostOfferPricing({
            offeredAccommodation:
              Number(
                offerAmount
              ),

            originalNightlyRates,

            nights:
              selectedBooking.nights,
          });

        setOfferPreview(
          preview
        );
      } catch {
        setOfferPreview(
          null
        );
      }
    },
    [
      showOfferBox,
      offerAmount,
      selectedBooking,
      originalNightlyRates,
    ]
  );

  async function markThreadReadOnly(
    bookingId
  ) {
    const {
      error,
    } =
      await supabase
        .from(
          'booking_messages'
        )
        .update({
          is_read:
            true,
        })
        .eq(
          'booking_id',
          bookingId
        )
        .eq(
          'sender_type',
          'guest'
        )
        .eq(
          'is_read',
          false
        );

    if (
      error
    ) {
      console.error(
        error
      );
    }
  }

  async function openThread(
    bookingId
  ) {
    setSelectedBookingId(
      bookingId
    );

    setReply('');

    setShowOfferBox(
      false
    );

    setOfferAmount(
      ''
    );

    setOfferNote(
      ''
    );

    setOfferPreview(
      null
    );

    await markThreadReadOnly(
      bookingId
    );

    setMessages(
      (
        previous
      ) =>
        previous.map(
          (
            item
          ) =>
            item.booking_id ===
              bookingId &&
            item.sender_type ===
              'guest'
              ? {
                  ...item,
                  is_read:
                    true,
                }
              : item
        )
    );

    if (
      typeof window !==
      'undefined'
    ) {
      const url =
        new URL(
          window.location.href
        );

      url.searchParams.set(
        'booking',
        bookingId
      );

      window.history.replaceState(
        {},
        '',
        url
      );
    }
  }

  async function sendReply() {
    const text =
      reply.trim();

    if (
      !text ||
      !selectedThread
    ) {
      return;
    }

    setSending(
      true
    );

    setErrorMessage(
      ''
    );

    try {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            'booking_messages'
          )
          .insert({
            booking_id:
              selectedThread.booking.id,

            sender_type:
              'host',

            sender_name:
              adminProfile?.full_name ||
              'Host',

            message:
              text,

            message_type:
              'message',

            is_read:
              false,
          })
          .select('*')
          .single();

      if (
        error
      ) {
        throw error;
      }

      setReply(
        ''
      );

      setMessages(
        (
          previous
        ) => {
          const exists =
            previous.some(
              (
                item
              ) =>
                item.id ===
                data.id
            );

          return exists
            ? previous
            : [
                ...previous,
                data,
              ];
        }
      );
    } catch (
      error
    ) {
      console.error(
        error
      );

      setErrorMessage(
        `Unable to send message: ${
          error.message ||
          'Unknown error'
        }`
      );
    } finally {
      setSending(
        false
      );
    }
  }

  async function sendSpecialOffer() {
    if (
      !selectedBooking
    ) {
      return;
    }

    const offeredAccommodation =
      Number(
        offerAmount
      );

    if (
      !Number.isFinite(
        offeredAccommodation
      ) ||
      offeredAccommodation <=
        0
    ) {
      setErrorMessage(
        'Enter a valid accommodation offer amount.'
      );

      return;
    }

    const currentAccommodation =
      Number(
        selectedBooking.taxable_amount ??
        selectedBooking.base_amount ??
        selectedBooking.total_amount ??
        0
      );

    if (
      currentAccommodation >
        0 &&
      offeredAccommodation >
        currentAccommodation
    ) {
      setErrorMessage(
        'Special offer amount cannot be higher than the current accommodation amount.'
      );

      return;
    }

    setOfferSending(
      true
    );

    setErrorMessage(
      ''
    );

    try {
      const pricing =
        buildHostOfferPricing({
          offeredAccommodation,

          originalNightlyRates,

          nights:
            selectedBooking.nights,
        });

      const originalBeforeHostDiscount =
        Number(
          selectedBooking.taxable_amount ??
          selectedBooking.base_amount ??
          selectedBooking.total_amount ??
          0
        );

      const hostDiscountAmount =
        Math.max(
          0,
          roundMoney(
            originalBeforeHostDiscount -
              pricing.accommodationAmount
          )
        );

      /*
        Existing property/automatic
        discounts are now frozen.

        Host offer becomes the final
        accommodation price before GST.

        No further discount may be
        applied at payment.
      */

      const {
        error:
          bookingUpdateError,
      } =
        await supabase
          .from(
            'bookings'
          )
          .update({
            host_discount_amount:
              hostDiscountAmount,

            taxable_amount:
              pricing.accommodationAmount,

            gst_amount:
              pricing.gstAmount,

            /*
              gst_rate cannot represent
              mixed-night GST slabs.
              Keep it only as a summary.

              If every night has the
              same rate use that rate;
              otherwise 0 indicates
              mixed GST slabs.
            */

            gst_rate:
              pricing.nightlyBreakdown.every(
                (
                  item
                ) =>
                  item.gstRate ===
                  pricing.nightlyBreakdown[
                    0
                  ]?.gstRate
              )
                ? pricing.nightlyBreakdown[
                    0
                  ]?.gstRate ||
                  0
                : 0,

            amount_including_gst:
              pricing.finalPayable,

            final_payable_amount:
              pricing.finalPayable,

            offer_note:
              offerNote.trim() ||
              null,

            offer_status:
              'host_offered',

            offer_created_by:
              session.user.id,

            offer_created_at:
              new Date().toISOString(),

            guest_discount_requested:
              false,
          })
          .eq(
            'id',
            selectedBooking.id
          );

      if (
        bookingUpdateError
      ) {
        throw bookingUpdateError;
      }

      const nightlySummary =
        pricing.nightlyBreakdown
          .map(
            (
              item
            ) =>
              `${item.date}: ${money(
                item.rate
              )} + ${item.gstRate}% GST`
          )
          .join('\n');

      const message =
        [
          'SPECIAL OFFER',
          '',
          `Accommodation: ${money(
            pricing.accommodationAmount
          )}`,
          `GST: ${money(
            pricing.gstAmount
          )}`,
          `Final Payable: ${money(
            pricing.finalPayable
          )}`,
          '',
          offerNote.trim()
            ? `Host Note: ${offerNote.trim()}`
            : '',
          '',
          'Night-wise tax:',
          nightlySummary,
          '',
          'This is the final offered rate. No additional discount will be applied at payment.',
        ]
          .filter(
            (
              line
            ) =>
              line !==
              ''
          )
          .join('\n');

      const {
        data:
          specialOfferMessage,

        error:
          messageError,
      } =
        await supabase
          .from(
            'booking_messages'
          )
          .insert({
            booking_id:
              selectedBooking.id,

            sender_type:
              'host',

            sender_name:
              adminProfile?.full_name ||
              'Host',

            message,

            message_type:
              'special_offer',

            is_read:
              false,
          })
          .select('*')
          .single();

      if (
        messageError
      ) {
        throw messageError;
      }

      setMessages(
        (
          previous
        ) => {
          const exists =
            previous.some(
              (
                item
              ) =>
                item.id ===
                specialOfferMessage.id
            );

          return exists
            ? previous
            : [
                ...previous,
                specialOfferMessage,
              ];
        }
      );

      setShowOfferBox(
        false
      );

      setOfferAmount(
        ''
      );

      setOfferNote(
        ''
      );

      setOfferPreview(
        null
      );

      await loadInbox(
        selectedBooking.id
      );
    } catch (
      error
    ) {
      console.error(
        error
      );

      setErrorMessage(
        `Unable to send special offer: ${
          error.message ||
          'Unknown error'
        }`
      );
    } finally {
      setOfferSending(
        false
      );
    }
  }

  async function refreshInbox() {
    try {
      setErrorMessage(
        ''
      );

      await loadInbox(
        selectedBookingId
      );
    } catch (
      error
    ) {
      console.error(
        error
      );

      setErrorMessage(
        `Unable to refresh messages: ${
          error.message ||
          'Unknown error'
        }`
      );
    }
  }

  async function logout() {
    await supabase.auth.signOut();

    window.location.href =
      '/admin/bookings';
  }

  if (
    loading
  ) {
    return (
      <main
        style={
          styles.loading
        }
      >
        Loading messages...
      </main>
    );
  }

  if (
    !session ||
    !adminProfile
  ) {
    return (
      <main
        style={
          styles.loading
        }
      >
        <h2>
          Admin login required
        </h2>

        <p>
          Please login through the admin area.
        </p>

        <a
          href="/admin/bookings"
          style={
            styles.adminLink
          }
        >
          Go to Admin
        </a>
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
            Guest Messages
          </div>
        </div>

        <div
          style={
            styles.headerRight
          }
        >
          <div>
            <strong>
              {adminProfile.full_name ||
                'Administrator'}
            </strong>

            <div
              style={
                styles.role
              }
            >
              {adminProfile.role ||
                'admin'}
            </div>
          </div>

          <button
            type="button"
            onClick={
              logout
            }
            style={
              styles.logout
            }
          >
            Logout
          </button>
        </div>
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
              Messages
            </h1>

            <p
              style={
                styles.muted
              }
            >
              All booking-linked guest conversations in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={
              refreshInbox
            }
            style={
              styles.refreshButton
            }
          >
            Refresh
          </button>
        </div>

        {errorMessage && (
          <div
            style={
              styles.error
            }
          >
            {
              errorMessage
            }
          </div>
        )}

        <div
          style={
            styles.messagingLayout
          }
        >
          <aside
            style={
              styles.threadList
            }
          >
            <div
              style={
                styles.inboxTitle
              }
            >
              Conversations

              <span
                style={
                  styles.inboxCount
                }
              >
                {
                  threads.length
                }
              </span>
            </div>

            {threads.length ===
            0 ? (
              <div
                style={
                  styles.empty
                }
              >
                No conversations yet.
              </div>
            ) : (
              threads.map(
                (
                  thread
                ) => {
                  const {
                    booking,
                    lastMessage,
                    displayTime,
                    unread,
                  } =
                    thread;

                  const selected =
                    booking.id ===
                    selectedBookingId;

                  return (
                    <button
                      key={
                        booking.id
                      }
                      type="button"
                      onClick={() =>
                        openThread(
                          booking.id
                        )
                      }
                      style={{
                        ...styles.threadButton,

                        ...(selected
                          ? styles.selectedThread
                          : {}),
                      }}
                    >
                      <div
                        style={
                          styles.threadTop
                        }
                      >
                        <strong>
                          {booking.guest
                            ?.full_name ||
                            'Guest'}
                        </strong>

                        {unread >
                          0 && (
                          <span
                            style={
                              styles.unreadBadge
                            }
                          >
                            {
                              unread
                            }
                          </span>
                        )}
                      </div>

                      <div
                        style={
                          styles.bookingCode
                        }
                      >
                        {
                          booking.booking_code
                        }
                      </div>

                      <div
                        style={
                          styles.propertyName
                        }
                      >
                        {booking.property
                          ?.name ||
                          'Property'}
                      </div>

                      <div
                        style={
                          styles.messagePreview
                        }
                      >
                        {lastMessage
                          ? lastMessage.message
                          : booking.notes ||
                            'Booking request received'}
                      </div>

                      <div
                        style={
                          styles.threadTime
                        }
                      >
                        {formatDateTime(
                          displayTime
                        )}
                      </div>
                    </button>
                  );
                }
              )
            )}
          </aside>

          <section
            style={
              styles.conversation
            }
          >
            {!selectedThread ? (
              <div
                style={
                  styles.noSelection
                }
              >
                Select a conversation to view messages.
              </div>
            ) : (
              <>
                <div
                  style={
                    styles.conversationHeader
                  }
                >
                  <div>
                    <h2
                      style={
                        styles.guestName
                      }
                    >
                      {selectedThread.booking
                        .guest
                        ?.full_name ||
                        'Guest'}
                    </h2>

                    <div
                      style={
                        styles.bookingInfo
                      }
                    >
                      {
                        selectedThread.booking
                          .booking_code
                      }

                      {' · '}

                      {selectedThread.booking
                        .property
                        ?.name ||
                        'Property'}
                    </div>

                    <div
                      style={
                        styles.contactInfo
                      }
                    >
                      {selectedThread.booking
                        .guest?.phone ||
                        ''}

                      {selectedThread.booking
                        .guest?.email
                        ? ` · ${selectedThread.booking.guest.email}`
                        : ''}
                    </div>
                  </div>

                  <div
                    style={
                      styles.headerActions
                    }
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setShowOfferBox(
                          (
                            current
                          ) =>
                            !current
                        );

                        setErrorMessage(
                          ''
                        );

                        setOfferAmount(
                          ''
                        );

                        setOfferNote(
                          ''
                        );

                        setOfferPreview(
                          null
                        );
                      }}
                      style={
                        styles.offerToggle
                      }
                    >
                      {showOfferBox
                        ? 'Close Offer'
                        : 'Send Special Offer'}
                    </button>

                    <a
                      href="/admin/bookings"
                      style={
                        styles.bookingLink
                      }
                    >
                      View Bookings
                    </a>
                  </div>
                </div>

                <div
                  style={
                    styles.bookingSummary
                  }
                >
                  <SummaryItem
                    label="Current Amount"
                    value={money(
                      selectedBooking
                        ?.amount_including_gst ??
                        selectedBooking
                          ?.final_payable_amount ??
                        selectedBooking
                          ?.total_amount ??
                        0
                    )}
                  />

                  <SummaryItem
                    label="Nights"
                    value={
                      selectedBooking
                        ?.nights ||
                      1
                    }
                  />

                  <SummaryItem
                    label="Booking"
                    value={
                      selectedBooking
                        ?.booking_status ||
                      'pending'
                    }
                  />

                  <SummaryItem
                    label="Payment"
                    value={
                      selectedBooking
                        ?.payment_status ||
                      'unpaid'
                    }
                  />

                  {Number(
                    selectedBooking
                      ?.host_discount_amount ||
                      0
                  ) > 0 && (
                    <SummaryItem
                      label="Host Discount"
                      value={`-${money(
                        selectedBooking
                          .host_discount_amount
                      )}`}
                    />
                  )}

                  <SummaryItem
                    label="Offer Status"
                    value={
                      selectedBooking
                        ?.offer_status ||
                      'none'
                    }
                  />
                </div>

                {showOfferBox && (
                  <div
                    style={
                      styles.specialOfferPanel
                    }
                  >
                    <div
                      style={
                        styles.offerPanelHeader
                      }
                    >
                      <div>
                        <h3
                          style={
                            styles.offerHeading
                          }
                        >
                          Send Special Offer
                        </h3>

                        <p
                          style={
                            styles.offerHelp
                          }
                        >
                          Enter the final accommodation amount before GST. No other discount will be applied again after this offer.
                        </p>
                      </div>
                    </div>

                    <div
                      style={
                        styles.offerGrid
                      }
                    >
                      <label
                        style={
                          styles.offerLabel
                        }
                      >
                        OFFERED ACCOMMODATION AMOUNT

                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={
                            offerAmount
                          }
                          onChange={(
                            event
                          ) => {
                            setOfferAmount(
                              event.target.value
                            );

                            setErrorMessage(
                              ''
                            );
                          }}
                          placeholder="Example: 4500"
                          style={
                            styles.offerInput
                          }
                        />
                      </label>

                      <label
                        style={
                          styles.offerLabel
                        }
                      >
                        NOTE TO GUEST

                        <input
                          type="text"
                          value={
                            offerNote
                          }
                          onChange={(
                            event
                          ) =>
                            setOfferNote(
                              event.target.value
                            )
                          }
                          placeholder="Optional note"
                          style={
                            styles.offerInput
                          }
                        />
                      </label>
                    </div>

                    {offerPreview && (
                      <div
                        style={
                          styles.offerPreview
                        }
                      >
                        <div
                          style={
                            styles.previewTitle
                          }
                        >
                          Offer Preview
                        </div>

                        <div
                          style={
                            styles.previewGrid
                          }
                        >
                          <PreviewItem
                            label="Accommodation"
                            value={money(
                              offerPreview
                                .accommodationAmount
                            )}
                          />

                          <PreviewItem
                            label="GST"
                            value={money(
                              offerPreview
                                .gstAmount
                            )}
                          />

                          <PreviewItem
                            label="Final Payable"
                            value={money(
                              offerPreview
                                .finalPayable
                            )}
                            strong
                          />
                        </div>

                        <div
                          style={
                            styles.taxBreakdown
                          }
                        >
                          <strong>
                            Night-wise GST
                          </strong>

                          {offerPreview.nightlyBreakdown.map(
                            (
                              item,
                              index
                            ) => (
                              <div
                                key={`${item.date}-${index}`}
                                style={
                                  styles.taxRow
                                }
                              >
                                <span>
                                  {
                                    item.date
                                  }
                                </span>

                                <span>
                                  {money(
                                    item.rate
                                  )}
                                  {' + '}
                                  {
                                    item.gstRate
                                  }
                                  % GST
                                </span>
                              </div>
                            )
                          )}
                        </div>

                        <div
                          style={
                            styles.taxRuleNote
                          }
                        >
                          GST rule: effective nightly rate below ₹7,000 = 5%; ₹7,000 and above = 18%.
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={
                        sendSpecialOffer
                      }
                      disabled={
                        offerSending ||
                        !offerAmount ||
                        !offerPreview
                      }
                      style={{
                        ...styles.offerSendButton,

                        opacity:
                          offerSending ||
                          !offerAmount ||
                          !offerPreview
                            ? 0.55
                            : 1,
                      }}
                    >
                      {offerSending
                        ? 'Sending Offer...'
                        : 'Send Special Offer'}
                    </button>
                  </div>
                )}

                <div
                  style={
                    styles.messagesArea
                  }
                >
                  {selectedThread.booking
                    .notes &&
                    selectedThread.messages
                      .length ===
                      0 && (
                      <MessageBubble
                        senderType="guest"
                        senderName={
                          selectedThread
                            .booking
                            .guest
                            ?.full_name ||
                          'Guest'
                        }
                        message={
                          selectedThread
                            .booking
                            .notes
                        }
                        messageType="booking_request"
                        time="Original booking message"
                      />
                    )}

                  {selectedThread.messages
                    .length ===
                    0 &&
                    !selectedThread.booking
                      .notes && (
                      <div
                        style={
                          styles.emptyConversation
                        }
                      >
                        No messages yet.
                      </div>
                    )}

                  {selectedThread.messages.map(
                    (
                      item
                    ) => (
                      <MessageBubble
                        key={
                          item.id
                        }
                        senderType={
                          item.sender_type
                        }
                        senderName={
                          item.sender_name
                        }
                        message={
                          item.message
                        }
                        messageType={
                          item.message_type
                        }
                        time={
                          formatDateTime(
                            item.created_at
                          )
                        }
                      />
                    )
                  )}
                </div>

                <div
                  style={
                    styles.replyArea
                  }
                >
                  <div
                    style={
                      styles.replyBox
                    }
                  >
                    <textarea
                      value={
                        reply
                      }
                      onChange={(
                        event
                      ) =>
                        setReply(
                          event.target.value
                        )
                      }
                      placeholder="Type your reply to the guest..."
                      style={
                        styles.textarea
                      }
                    />

                    <button
                      type="button"
                      onClick={
                        sendReply
                      }
                      disabled={
                        sending ||
                        !reply.trim()
                      }
                      style={{
                        ...styles.sendButton,

                        opacity:
                          sending ||
                          !reply.trim()
                            ? 0.55
                            : 1,
                      }}
                    >
                      {sending
                        ? 'Sending...'
                        : 'Send Reply'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowOfferBox(
                        true
                      );

                      setOfferAmount(
                        ''
                      );

                      setOfferNote(
                        ''
                      );

                      setOfferPreview(
                        null
                      );
                    }}
                    style={
                      styles.smallOfferLink
                    }
                  >
                    Send special offer
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function SummaryItem({
  label,
  value,
}) {
  return (
    <div>
      <div
        style={
          styles.summaryLabel
        }
      >
        {label}
      </div>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function PreviewItem({
  label,
  value,
  strong = false,
}) {
  return (
    <div>
      <div
        style={
          styles.summaryLabel
        }
      >
        {label}
      </div>

      <div
        style={{
          fontWeight:
            strong
              ? 900
              : 700,

          fontSize:
            strong
              ? 18
              : 14,

          color:
            strong
              ? '#17457f'
              : '#11213c',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function MessageBubble({
  senderType,
  senderName,
  message,
  messageType,
  time,
}) {
  if (
    senderType ===
      'system' ||
    messageType ===
      'system'
  ) {
    return (
      <div
        style={
          styles.systemBubble
        }
      >
        <div>
          {message}
        </div>

        <div
          style={
            styles.messageTime
          }
        >
          {time}
        </div>
      </div>
    );
  }

  const host =
    senderType ===
    'host';

  const specialOffer =
    messageType ===
    'special_offer';

  const discountRequest =
    String(
      message || ''
    ).startsWith(
      'DISCOUNT REQUEST:'
    );

  if (
    specialOffer
  ) {
    return (
      <div
        style={
          styles.hostOfferBubble
        }
      >
        <div
          style={
            styles.offerMessageBadge
          }
        >
          SPECIAL OFFER
        </div>

        <div
          style={
            styles.senderName
          }
        >
          {senderName ||
            'Host'}
        </div>

        <div
          style={
            styles.messageText
          }
        >
          {message}
        </div>

        <div
          style={
            styles.messageTime
          }
        >
          {time}
        </div>
      </div>
    );
  }

  return (
    <div
      style={
        host
          ? styles.hostBubble
          : discountRequest
          ? styles.discountRequestBubble
          : styles.guestBubble
      }
    >
      {discountRequest && (
        <div
          style={
            styles.discountRequestBadge
          }
        >
          Better Rate Request
        </div>
      )}

      <div
        style={
          styles.senderName
        }
      >
        {senderName ||
          (host
            ? 'Host'
            : 'Guest')}
      </div>

      <div
        style={
          styles.messageText
        }
      >
        {discountRequest
          ? String(
              message
            ).replace(
              /^DISCOUNT REQUEST:\s*/,
              ''
            )
          : message}
      </div>

      <div
        style={
          styles.messageTime
        }
      >
        {time}
      </div>
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
      '#11213c',

    fontFamily:
      'Arial, sans-serif',
  },

  loading: {
    padding:
      40,

    fontFamily:
      'Arial, sans-serif',
  },

  header: {
    background:
      '#ffffff',

    borderBottom:
      '1px solid #e1e5ea',

    padding:
      '17px 3vw',

    display:
      'flex',

    justifyContent:
      'space-between',

    alignItems:
      'center',

    gap:
      20,
  },

  brand: {
    fontSize:
      25,

    fontWeight:
      900,

    color:
      '#17457f',
  },

  subBrand: {
    marginTop:
      2,

    color:
      '#687080',
  },

  headerRight: {
    display:
      'flex',

    alignItems:
      'center',

    gap:
      18,
  },

  role: {
    color:
      '#687080',

    fontSize:
      11,

    textTransform:
      'capitalize',
  },

  logout: {
    border:
      '1px solid #d6dae0',

    background:
      '#ffffff',

    padding:
      '9px 14px',

    borderRadius:
      20,

    cursor:
      'pointer',
  },

  container: {
    maxWidth:
      1500,

    margin:
      '0 auto',

    padding:
      '32px 3vw 70px',
  },

  headingRow: {
    display:
      'flex',

    justifyContent:
      'space-between',

    alignItems:
      'center',

    gap:
      20,

    flexWrap:
      'wrap',

    marginBottom:
      20,
  },

  heading: {
    margin:
      0,

    fontSize:
      34,
  },

  muted: {
    color:
      '#687080',

    marginTop:
      5,
  },

  refreshButton: {
    border:
      0,

    background:
      '#17457f',

    color:
      '#ffffff',

    borderRadius:
      9,

    padding:
      '11px 18px',

    fontWeight:
      800,

    cursor:
      'pointer',
  },

  error: {
    padding:
      12,

    marginBottom:
      15,

    background:
      '#ffeaea',

    color:
      '#8c2020',

    borderRadius:
      9,

    fontWeight:
      700,
  },

  messagingLayout: {
    display:
      'grid',

    gridTemplateColumns:
      '360px minmax(0, 1fr)',

    minHeight:
      '72vh',

    background:
      '#ffffff',

    border:
      '1px solid #dde2e7',

    borderRadius:
      16,

    overflow:
      'hidden',
  },

  threadList: {
    borderRight:
      '1px solid #e2e5e8',

    overflowY:
      'auto',

    maxHeight:
      '78vh',
  },

  inboxTitle: {
    position:
      'sticky',

    top:
      0,

    zIndex:
      2,

    background:
      '#ffffff',

    borderBottom:
      '1px solid #e5e7eb',

    padding:
      16,

    fontWeight:
      900,

    display:
      'flex',

    justifyContent:
      'space-between',

    alignItems:
      'center',
  },

  inboxCount: {
    display:
      'inline-flex',

    minWidth:
      25,

    height:
      25,

    justifyContent:
      'center',

    alignItems:
      'center',

    borderRadius:
      20,

    background:
      '#edf3fb',

    color:
      '#17457f',

    fontSize:
      11,
  },

  threadButton: {
    width:
      '100%',

    textAlign:
      'left',

    border:
      0,

    borderBottom:
      '1px solid #e8eaed',

    background:
      '#ffffff',

    padding:
      16,

    cursor:
      'pointer',
  },

  selectedThread: {
    background:
      '#edf4ff',

    borderLeft:
      '4px solid #17457f',
  },

  threadTop: {
    display:
      'flex',

    justifyContent:
      'space-between',

    gap:
      10,
  },

  unreadBadge: {
    background:
      '#17457f',

    color:
      '#ffffff',

    minWidth:
      20,

    height:
      20,

    borderRadius:
      20,

    display:
      'inline-flex',

    justifyContent:
      'center',

    alignItems:
      'center',

    fontSize:
      11,

    fontWeight:
      900,
  },

  bookingCode: {
    marginTop:
      5,

    color:
      '#17457f',

    fontSize:
      12,

    fontWeight:
      800,
  },

  propertyName: {
    marginTop:
      4,

    fontSize:
      13,

    fontWeight:
      700,
  },

  messagePreview: {
    marginTop:
      8,

    color:
      '#687080',

    fontSize:
      12,

    whiteSpace:
      'nowrap',

    overflow:
      'hidden',

    textOverflow:
      'ellipsis',
  },

  threadTime: {
    marginTop:
      7,

    color:
      '#9aa1aa',

    fontSize:
      10,
  },

  conversation: {
    minWidth:
      0,

    display:
      'flex',

    flexDirection:
      'column',
  },

  conversationHeader: {
    background:
      '#ffffff',

    borderBottom:
      '1px solid #e2e5e8',

    padding:
      18,

    display:
      'flex',

    justifyContent:
      'space-between',

    alignItems:
      'center',

    gap:
      15,
  },

  guestName: {
    margin:
      0,
  },

  bookingInfo: {
    marginTop:
      5,

    color:
      '#17457f',

    fontWeight:
      700,

    fontSize:
      13,
  },

  contactInfo: {
    marginTop:
      4,

    color:
      '#687080',

    fontSize:
      12,
  },

  headerActions: {
    display:
      'flex',

    alignItems:
      'center',

    gap:
      12,

    flexWrap:
      'wrap',
  },

  bookingLink: {
    color:
      '#17457f',

    fontWeight:
      800,

    textDecoration:
      'none',
  },

  offerToggle: {
    border:
      '1px solid #b8c2ce',

    background:
      '#ffffff',

    color:
      '#17457f',

    borderRadius:
      8,

    padding:
      '8px 11px',

    fontWeight:
      800,

    fontSize:
      12,

    cursor:
      'pointer',
  },

  bookingSummary: {
    padding:
      '12px 18px',

    display:
      'grid',

    gridTemplateColumns:
      'repeat(auto-fit, minmax(110px, 1fr))',

    gap:
      12,

    background:
      '#f8fafc',

    borderBottom:
      '1px solid #e2e5e8',
  },

  summaryLabel: {
    fontSize:
      9,

    color:
      '#687080',

    textTransform:
      'uppercase',

    fontWeight:
      800,

    marginBottom:
      4,
  },

  specialOfferPanel: {
    margin:
      14,

    padding:
      15,

    border:
      '1px solid #cfd8e3',

    borderRadius:
      12,

    background:
      '#fbfcfe',
  },

  offerPanelHeader: {
    display:
      'flex',

    justifyContent:
      'space-between',

    gap:
      15,
  },

  offerHeading: {
    margin:
      0,

    fontSize:
      16,
  },

  offerHelp: {
    margin:
      '5px 0 0',

    color:
      '#687080',

    fontSize:
      11,

    lineHeight:
      1.5,
  },

  offerGrid: {
    marginTop:
      12,

    display:
      'grid',

    gridTemplateColumns:
      '1fr 1fr',

    gap:
      10,
  },

  offerLabel: {
    display:
      'grid',

    gap:
      6,

    fontSize:
      10,

    fontWeight:
      800,

    color:
      '#344054',
  },

  offerInput: {
    width:
      '100%',

    boxSizing:
      'border-box',

    padding:
      10,

    border:
      '1px solid #c9d0d8',

    borderRadius:
      8,

    fontSize:
      13,

    background:
      '#ffffff',
  },

  offerPreview: {
    marginTop:
      12,

    padding:
      12,

    border:
      '1px solid #dce3ea',

    borderRadius:
      10,

    background:
      '#ffffff',
  },

  previewTitle: {
    fontWeight:
      900,

    fontSize:
      13,

    marginBottom:
      10,
  },

  previewGrid: {
    display:
      'grid',

    gridTemplateColumns:
      'repeat(3, 1fr)',

    gap:
      10,
  },

  taxBreakdown: {
    marginTop:
      12,

    paddingTop:
      10,

    borderTop:
      '1px solid #edf0f3',

    display:
      'grid',

    gap:
      6,

    fontSize:
      11,
  },

  taxRow: {
    display:
      'flex',

    justifyContent:
      'space-between',

    gap:
      12,

    color:
      '#586273',
  },

  taxRuleNote: {
    marginTop:
      9,

    fontSize:
      10,

    color:
      '#687080',
  },

  offerSendButton: {
    marginTop:
      12,

    border:
      0,

    background:
      '#17457f',

    color:
      '#ffffff',

    borderRadius:
      8,

    padding:
      '10px 14px',

    fontWeight:
      900,

    cursor:
      'pointer',
  },

  messagesArea: {
    flex:
      1,

    overflowY:
      'auto',

    padding:
      20,

    background:
      '#f8fafc',

    maxHeight:
      '60vh',
  },

  guestBubble: {
    width:
      'fit-content',

    maxWidth:
      '75%',

    background:
      '#ffffff',

    border:
      '1px solid #dfe4e9',

    borderRadius:
      '14px 14px 14px 4px',

    padding:
      12,

    marginBottom:
      12,
  },

  discountRequestBubble: {
    width:
      'fit-content',

    maxWidth:
      '75%',

    background:
      '#fffdf7',

    border:
      '1px solid #e6ddc3',

    borderRadius:
      '14px 14px 14px 4px',

    padding:
      12,

    marginBottom:
      12,
  },

  hostBubble: {
    width:
      'fit-content',

    maxWidth:
      '75%',

    marginLeft:
      'auto',

    background:
      '#e8f1ff',

    border:
      '1px solid #c7daf5',

    borderRadius:
      '14px 14px 4px 14px',

    padding:
      12,

    marginBottom:
      12,
  },

  hostOfferBubble: {
    width:
      'fit-content',

    maxWidth:
      '80%',

    marginLeft:
      'auto',

    background:
      '#f3faf6',

    border:
      '1px solid #bcdcc8',

    borderRadius:
      '14px 14px 4px 14px',

    padding:
      14,

    marginBottom:
      12,
  },

  offerMessageBadge: {
    display:
      'inline-block',

    fontSize:
      9,

    fontWeight:
      900,

    color:
      '#27643a',

    background:
      '#e4f4e9',

    padding:
      '4px 7px',

    borderRadius:
      20,

    marginBottom:
      6,
  },

  discountRequestBadge: {
    display:
      'inline-block',

    fontSize:
      9,

    color:
      '#776735',

    background:
      '#f6f1df',

    padding:
      '3px 6px',

    borderRadius:
      20,

    marginBottom:
      5,
  },

  systemBubble: {
    maxWidth:
      '80%',

    margin:
      '10px auto',

    textAlign:
      'center',

    background:
      '#fff6dd',

    color:
      '#66501b',

    borderRadius:
      10,

    padding:
      10,

    fontSize:
      12,
  },

  senderName: {
    fontSize:
      11,

    color:
      '#17457f',

    fontWeight:
      900,

    marginBottom:
      5,
  },

  messageText: {
    whiteSpace:
      'pre-wrap',

    lineHeight:
      1.45,
  },

  messageTime: {
    marginTop:
      6,

    color:
      '#929aa4',

    fontSize:
      10,
  },

  replyArea: {
    position:
      'relative',

    background:
      '#ffffff',

    borderTop:
      '1px solid #e2e5e8',

    paddingBottom:
      8,
  },

  replyBox: {
    display:
      'grid',

    gridTemplateColumns:
      '1fr auto',

    gap:
      10,

    padding:
      15,
  },

  textarea: {
    width:
      '100%',

    boxSizing:
      'border-box',

    minHeight:
      70,

    resize:
      'vertical',

    padding:
      11,

    border:
      '1px solid #ccd1d8',

    borderRadius:
      9,
  },

  sendButton: {
    alignSelf:
      'end',

    border:
      0,

    background:
      '#17457f',

    color:
      '#ffffff',

    borderRadius:
      9,

    padding:
      '13px 20px',

    fontWeight:
      900,

    cursor:
      'pointer',
  },

  smallOfferLink: {
    display:
      'block',

    margin:
      '-5px 15px 0 auto',

    border:
      0,

    background:
      'transparent',

    color:
      '#687080',

    fontSize:
      10,

    textDecoration:
      'underline',

    cursor:
      'pointer',
  },

  noSelection: {
    padding:
      40,

    color:
      '#687080',
  },

  emptyConversation: {
    textAlign:
      'center',

    color:
      '#687080',

    padding:
      30,
  },

  empty: {
    padding:
      25,

    color:
      '#687080',
  },

  adminLink: {
    display:
      'inline-block',

    marginTop:
      12,

    background:
      '#17457f',

    color:
      '#ffffff',

    textDecoration:
      'none',

    padding:
      '10px 15px',

    borderRadius:
      8,
  },
};