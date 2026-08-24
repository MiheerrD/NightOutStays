export function roundCurrency(value) {
  return (
    Math.round(
      Number(value || 0) * 100
    ) / 100
  );
}

/*
  ---------------------------------------------------------
  MANUAL DATE RATE OVERRIDES
  ---------------------------------------------------------

  Host can set:

  15 Aug = ₹5,000

  OR

  24 Dec to 01 Jan = ₹7,500/night

  This NEVER changes property.base_price.

  Priority:
  Manual Date Override
  → otherwise normal Base + Dynamic Pricing
*/

export function findRateOverrideForDate(
  date,
  overrides = []
) {
  const matches =
    overrides.filter(
      (override) => {
        if (
          override.is_active ===
          false
        ) {
          return false;
        }

        if (
          !override.start_date ||
          !override.end_date
        ) {
          return false;
        }

        if (
          date <
          override.start_date
        ) {
          return false;
        }

        if (
          date >
          override.end_date
        ) {
          return false;
        }

        return true;
      }
    );

  if (!matches.length) {
    return null;
  }

  /*
    If somehow two overrides overlap,
    the most recently created/updated
    override gets priority.
  */

  const sorted =
    [...matches].sort(
      (a, b) => {
        const aTime =
          new Date(
            a.updated_at ||
              a.created_at ||
              0
          ).getTime();

        const bTime =
          new Date(
            b.updated_at ||
              b.created_at ||
              0
          ).getTime();

        return (
          bTime - aTime
        );
      }
    );

  return sorted[0];
}

export function calculateNightlyRate({
  basePrice,

  guestCount,

  includedGuests,

  extraGuestFee,

  date,

  dynamicPricingEnabled,

  weekendMarkupPercent,

  longWeekendMarkupPercent,

  festivalMarkupPercent,

  seasonMarkupPercent,

  specialRule,

  rateOverride = null,
}) {
  /*
    Extra guest fee remains applicable
    even when the host manually overrides
    the accommodation rate.

    Example:
    Manual rate = ₹5,000
    Extra guest fee = ₹500
    1 extra guest

    Night total = ₹5,500
  */

  const guests =
    Number(
      guestCount || 0
    );

  const included =
    Number(
      includedGuests || 0
    );

  const extraFee =
    Number(
      extraGuestFee || 0
    );

  let extraGuestAmount = 0;

  if (
    guests >
    included
  ) {
    extraGuestAmount =
      (
        guests -
        included
      ) *
      extraFee;
  }

  /*
    MANUAL OVERRIDE HAS FIRST PRIORITY.

    Dynamic pricing is NOT applied
    on top of a manual override.
  */

  if (rateOverride) {
    const manualRate =
      Number(
        rateOverride.nightly_rate ||
          0
      );

    const finalRate =
      manualRate +
      extraGuestAmount;

    return {
      nightlyRate:
        roundCurrency(
          finalRate
        ),

      accommodationRate:
        roundCurrency(
          manualRate
        ),

      extraGuestAmount:
        roundCurrency(
          extraGuestAmount
        ),

      rateSource:
        'manual_override',

      rateSourceLabel:
        'Manual Rate',

      rateOverrideId:
        rateOverride.id ||
        null,

      rateOverrideNote:
        rateOverride.note ||
        null,

      adjustments: [
        {
          type:
            'manual_override',

          label:
            rateOverride.note ||
            'Host manual rate',

          amount:
            roundCurrency(
              manualRate
            ),
        },

        ...(extraGuestAmount >
        0
          ? [
              {
                type:
                  'extra_guest',

                label:
                  'Extra guest fee',

                amount:
                  roundCurrency(
                    extraGuestAmount
                  ),
              },
            ]
          : []),
      ],
    };
  }

  /*
    No manual override:
    calculate normal property pricing.
  */

  let nightlyRate =
    Number(
      basePrice || 0
    );

  nightlyRate +=
    extraGuestAmount;

  const adjustments = [];

  if (
    extraGuestAmount >
    0
  ) {
    adjustments.push({
      type:
        'extra_guest',

      label:
        'Extra guest fee',

      amount:
        roundCurrency(
          extraGuestAmount
        ),
    });
  }

  let dynamicPricingApplied =
    false;

  if (
    dynamicPricingEnabled
  ) {
    const day =
      new Date(
        `${date}T12:00:00`
      ).getDay();

    const isWeekend =
      day === 5 ||
      day === 6;

    if (isWeekend) {
      const percent =
        Number(
          weekendMarkupPercent ||
            0
        );

      if (
        percent !== 0
      ) {
        const amount =
          nightlyRate *
          (percent / 100);

        nightlyRate +=
          amount;

        dynamicPricingApplied =
          true;

        adjustments.push({
          type:
            'weekend',

          label:
            'Weekend markup',

          percent,

          amount:
            roundCurrency(
              amount
            ),
        });
      }
    }

    if (
      specialRule?.type ===
      'long_weekend'
    ) {
      const percent =
        Number(
          specialRule.percent ??
            longWeekendMarkupPercent ??
            0
        );

      const amount =
        nightlyRate *
        (percent / 100);

      nightlyRate +=
        amount;

      dynamicPricingApplied =
        true;

      adjustments.push({
        type:
          'long_weekend',

        label:
          specialRule.label ||
          'Long weekend markup',

        percent,

        amount:
          roundCurrency(
            amount
          ),
      });
    }

    if (
      specialRule?.type ===
      'festival'
    ) {
      const percent =
        Number(
          specialRule.percent ??
            festivalMarkupPercent ??
            0
        );

      const amount =
        nightlyRate *
        (percent / 100);

      nightlyRate +=
        amount;

      dynamicPricingApplied =
        true;

      adjustments.push({
        type:
          'festival',

        label:
          specialRule.label ||
          'Festival markup',

        percent,

        amount:
          roundCurrency(
            amount
          ),
      });
    }

    if (
      specialRule?.type ===
      'season'
    ) {
      const percent =
        Number(
          specialRule.percent ??
            seasonMarkupPercent ??
            0
        );

      const amount =
        nightlyRate *
        (percent / 100);

      nightlyRate +=
        amount;

      dynamicPricingApplied =
        true;

      adjustments.push({
        type:
          'season',

        label:
          specialRule.label ||
          'Season markup',

        percent,

        amount:
          roundCurrency(
            amount
          ),
      });
    }

    if (
      specialRule?.type ===
      'custom'
    ) {
      if (
        specialRule.adjustmentType ===
        'flat'
      ) {
        const amount =
          Number(
            specialRule.value ||
              0
          );

        nightlyRate +=
          amount;

        dynamicPricingApplied =
          true;

        adjustments.push({
          type:
            'custom',

          label:
            specialRule.label ||
            'Custom adjustment',

          amount:
            roundCurrency(
              amount
            ),
        });
      } else {
        const percent =
          Number(
            specialRule.value ||
              0
          );

        const amount =
          nightlyRate *
          (percent / 100);

        nightlyRate +=
          amount;

        dynamicPricingApplied =
          true;

        adjustments.push({
          type:
            'custom',

          label:
            specialRule.label ||
            'Custom adjustment',

          percent,

          amount:
            roundCurrency(
              amount
            ),
        });
      }
    }
  }

  return {
    nightlyRate:
      roundCurrency(
        nightlyRate
      ),

    accommodationRate:
      roundCurrency(
        nightlyRate -
          extraGuestAmount
      ),

    extraGuestAmount:
      roundCurrency(
        extraGuestAmount
      ),

    rateSource:
      dynamicPricingApplied
        ? 'dynamic'
        : 'base',

    rateSourceLabel:
      dynamicPricingApplied
        ? 'Dynamic Rate'
        : 'Base Rate',

    rateOverrideId:
      null,

    rateOverrideNote:
      null,

    adjustments,
  };
}

export function findPricingRuleForDate(
  date,
  rules = []
) {
  const matchingRules =
    rules.filter(
      (rule) => {
        if (
          !rule.is_active
        ) {
          return false;
        }

        if (
          rule.start_date &&
          date <
            rule.start_date
        ) {
          return false;
        }

        if (
          rule.end_date &&
          date >
            rule.end_date
        ) {
          return false;
        }

        if (
          Array.isArray(
            rule.weekdays
          ) &&
          rule.weekdays.length >
            0
        ) {
          const weekday =
            new Date(
              `${date}T12:00:00`
            ).getDay();

          if (
            !rule.weekdays.includes(
              weekday
            )
          ) {
            return false;
          }
        }

        return true;
      }
    );

  if (
    !matchingRules.length
  ) {
    return null;
  }

  const sorted =
    [...matchingRules].sort(
      (a, b) =>
        Number(
          b.priority || 0
        ) -
        Number(
          a.priority || 0
        )
    );

  return sorted[0];
}

/*
  ---------------------------------------------------------
  GET RATE FOR ONE CALENDAR DATE
  ---------------------------------------------------------

  We will use this function on BOTH:

  Guest Property Calendar
  Host Property Calendar

  This guarantees that calendar price
  and booking price always use the
  same calculation.
*/

export function calculateCalendarDateRate({
  property,

  date,

  guestCount = null,

  pricingRules = [],

  rateOverrides = [],
}) {
  if (
    !property ||
    !date
  ) {
    return {
      valid: false,

      error:
        'Property and date are required.',
    };
  }

  const guests =
    Number(
      guestCount ??
        property.included_guests ??
        property.min_guests ??
        1
    );

  const pricingRule =
    findPricingRuleForDate(
      date,
      pricingRules
    );

  const rateOverride =
    findRateOverrideForDate(
      date,
      rateOverrides
    );

  const result =
    calculateNightlyRate({
      basePrice:
        property.base_price,

      guestCount:
        guests,

      includedGuests:
        property.included_guests,

      extraGuestFee:
        property.extra_guest_fee,

      date,

      dynamicPricingEnabled:
        property.dynamic_pricing_enabled,

      weekendMarkupPercent:
        property.weekend_markup_percent,

      longWeekendMarkupPercent:
        property.long_weekend_markup_percent,

      festivalMarkupPercent:
        property.festival_markup_percent,

      seasonMarkupPercent:
        property.season_markup_percent,

      specialRule:
        pricingRule,

      rateOverride,
    });

  return {
    valid: true,

    date,

    ...result,
  };
}

export function calculateBookingPrice({
  property,

  guestCount,

  checkIn,

  checkOut,

  pricingRules = [],

  rateOverrides = [],

  offer = null,

  gstRate = 18,
}) {
  if (!property) {
    return {
      valid: false,

      error:
        'Property is required.',
    };
  }

  const guests =
    Number(
      guestCount || 0
    );

  const minGuests =
    Number(
      property.min_guests ||
        1
    );

  const maxGuests =
    Number(
      property.max_guests ||
        1
    );

  if (
    guests <
    minGuests
  ) {
    return {
      valid: false,

      error: `Minimum ${minGuests} guest${
        minGuests === 1
          ? ''
          : 's'
      } required.`,
    };
  }

  if (
    guests >
    maxGuests
  ) {
    return {
      valid: false,

      error: `Maximum ${maxGuests} guests allowed.`,
    };
  }

  const start =
    new Date(
      `${checkIn}T12:00:00`
    );

  const end =
    new Date(
      `${checkOut}T12:00:00`
    );

  if (
    Number.isNaN(
      start.getTime()
    ) ||
    Number.isNaN(
      end.getTime()
    )
  ) {
    return {
      valid: false,

      error:
        'Please select valid dates.',
    };
  }

  const millisecondsPerDay =
    24 *
    60 *
    60 *
    1000;

  const nights =
    Math.round(
      (end - start) /
        millisecondsPerDay
    );

  if (
    nights <= 0
  ) {
    return {
      valid: false,

      error:
        'Check-out must be after check-in.',
    };
  }

  const minStay =
    Number(
      property.min_stay_nights ||
        1
    );

  const maxStay =
    property.max_stay_nights
      ? Number(
          property.max_stay_nights
        )
      : null;

  if (
    nights <
    minStay
  ) {
    return {
      valid: false,

      error: `Minimum stay is ${minStay} night${
        minStay === 1
          ? ''
          : 's'
      }.`,
    };
  }

  if (
    maxStay &&
    nights >
      maxStay
  ) {
    return {
      valid: false,

      error: `Maximum stay is ${maxStay} nights.`,
    };
  }

  const nightlyBreakdown = [];

  let staySubtotal = 0;

  for (
    let i = 0;
    i < nights;
    i += 1
  ) {
    const nightDate =
      new Date(start);

    nightDate.setDate(
      start.getDate() + i
    );

    const dateString =
      nightDate
        .toISOString()
        .slice(0, 10);

    const matchingRule =
      findPricingRuleForDate(
        dateString,
        pricingRules
      );

    const rateOverride =
      findRateOverrideForDate(
        dateString,
        rateOverrides
      );

    const result =
      calculateNightlyRate({
        basePrice:
          property.base_price,

        guestCount:
          guests,

        includedGuests:
          property.included_guests,

        extraGuestFee:
          property.extra_guest_fee,

        date:
          dateString,

        dynamicPricingEnabled:
          property.dynamic_pricing_enabled,

        weekendMarkupPercent:
          property.weekend_markup_percent,

        longWeekendMarkupPercent:
          property.long_weekend_markup_percent,

        festivalMarkupPercent:
          property.festival_markup_percent,

        seasonMarkupPercent:
          property.season_markup_percent,

        specialRule:
          matchingRule,

        rateOverride,
      });

    staySubtotal +=
      result.nightlyRate;

    nightlyBreakdown.push({
      date:
        dateString,

      rate:
        result.nightlyRate,

      accommodationRate:
        result.accommodationRate,

      extraGuestAmount:
        result.extraGuestAmount,

      rateSource:
        result.rateSource,

      rateSourceLabel:
        result.rateSourceLabel,

      rateOverrideId:
        result.rateOverrideId,

      rateOverrideNote:
        result.rateOverrideNote,

      adjustments:
        result.adjustments,
    });
  }

  staySubtotal =
    roundCurrency(
      staySubtotal
    );

  const cleaningFee =
    roundCurrency(
      property.cleaning_fee ||
        0
    );

  const securityDeposit =
    roundCurrency(
      property.security_deposit ||
        0
    );

  /*
    GST TAXABLE VALUE:

    Stay subtotal
    + cleaning fee
    - selected regular discount

    Refundable security deposit
    remains outside GST.
  */

  const amountBeforeDiscount =
    roundCurrency(
      staySubtotal +
        cleaningFee
    );

  let autoDiscountAmount =
    0;

  if (offer) {
    if (
      offer.discount_type ===
      'percent'
    ) {
      autoDiscountAmount =
        amountBeforeDiscount *
        (
          Number(
            offer.discount_value ||
              0
          ) /
          100
        );
    }

    if (
      offer.discount_type ===
      'flat'
    ) {
      autoDiscountAmount =
        Number(
          offer.discount_value ||
            0
        );
    }
  }

  autoDiscountAmount =
    roundCurrency(
      autoDiscountAmount
    );

  if (
    autoDiscountAmount >
    amountBeforeDiscount
  ) {
    autoDiscountAmount =
      amountBeforeDiscount;
  }

  if (
    autoDiscountAmount <
    0
  ) {
    autoDiscountAmount =
      0;
  }

  /*
    GST is calculated AFTER
    the selected regular discount.
  */

  const taxableAmount =
    roundCurrency(
      amountBeforeDiscount -
        autoDiscountAmount
    );

  const appliedGstRate =
    Number(
      gstRate || 0
    );

  const gstAmount =
    roundCurrency(
      taxableAmount *
        (
          appliedGstRate /
          100
        )
    );

  const amountIncludingGst =
    roundCurrency(
      taxableAmount +
        gstAmount
    );

  const totalPayable =
    roundCurrency(
      amountIncludingGst +
        securityDeposit
    );

  return {
    valid: true,

    nights,

    guests,

    staySubtotal,

    cleaningFee,

    amountBeforeDiscount,

    baseAmount:
      amountBeforeDiscount,

    autoDiscountAmount,

    taxableAmount,

    gstRate:
      appliedGstRate,

    gstAmount,

    amountIncludingGst,

    securityDeposit,

    totalPayable,

    nightlyBreakdown,
  };
}