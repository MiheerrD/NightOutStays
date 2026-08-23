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
}) {
  let nightlyRate = Number(basePrice || 0);

  const guests = Number(guestCount || 0);
  const included = Number(includedGuests || 0);
  const extraFee = Number(extraGuestFee || 0);

  if (guests > included) {
    nightlyRate +=
      (guests - included) * extraFee;
  }

  const adjustments = [];

  if (dynamicPricingEnabled) {
    const day = new Date(date).getDay();

    const isWeekend =
      day === 5 || day === 6;

    if (isWeekend) {
      const percent =
        Number(weekendMarkupPercent || 0);

      nightlyRate +=
        nightlyRate * (percent / 100);

      adjustments.push({
        type: 'weekend',
        label: 'Weekend markup',
        percent,
      });
    }

    if (specialRule?.type === 'long_weekend') {
      const percent =
        Number(
          specialRule.percent ??
            longWeekendMarkupPercent ??
            0
        );

      nightlyRate +=
        nightlyRate * (percent / 100);

      adjustments.push({
        type: 'long_weekend',
        label: 'Long weekend markup',
        percent,
      });
    }

    if (specialRule?.type === 'festival') {
      const percent =
        Number(
          specialRule.percent ??
            festivalMarkupPercent ??
            0
        );

      nightlyRate +=
        nightlyRate * (percent / 100);

      adjustments.push({
        type: 'festival',
        label: 'Festival markup',
        percent,
      });
    }

    if (specialRule?.type === 'season') {
      const percent =
        Number(
          specialRule.percent ??
            seasonMarkupPercent ??
            0
        );

      nightlyRate +=
        nightlyRate * (percent / 100);

      adjustments.push({
        type: 'season',
        label: 'Season markup',
        percent,
      });
    }

    if (specialRule?.type === 'custom') {
      if (specialRule.adjustmentType === 'flat') {
        nightlyRate +=
          Number(specialRule.value || 0);

        adjustments.push({
          type: 'custom',
          label:
            specialRule.label ||
            'Custom adjustment',
          flat:
            Number(
              specialRule.value || 0
            ),
        });
      } else {
        const percent =
          Number(specialRule.value || 0);

        nightlyRate +=
          nightlyRate * (percent / 100);

        adjustments.push({
          type: 'custom',
          label:
            specialRule.label ||
            'Custom adjustment',
          percent,
        });
      }
    }
  }

  return {
    nightlyRate:
      Math.round(nightlyRate * 100) / 100,
    adjustments,
  };
}

export function calculateBookingPrice({
  property,
  guestCount,
  checkIn,
  checkOut,
  pricingRules = [],
  offer = null,
}) {
  if (!property) {
    return {
      valid: false,
      error: 'Property is required.',
    };
  }

  const guests = Number(guestCount || 0);

  const minGuests =
    Number(property.min_guests || 1);

  const maxGuests =
    Number(property.max_guests || 1);

  if (guests < minGuests) {
    return {
      valid: false,
      error: `Minimum ${minGuests} guest${
        minGuests === 1 ? '' : 's'
      } required.`,
    };
  }

  if (guests > maxGuests) {
    return {
      valid: false,
      error: `Maximum ${maxGuests} guests allowed.`,
    };
  }

  const start = new Date(checkIn);
  const end = new Date(checkOut);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return {
      valid: false,
      error: 'Please select valid dates.',
    };
  }

  const millisecondsPerDay =
    24 * 60 * 60 * 1000;

  const nights =
    Math.round(
      (end - start) /
        millisecondsPerDay
    );

  if (nights <= 0) {
    return {
      valid: false,
      error:
        'Check-out must be after check-in.',
    };
  }

  const minStay =
    Number(
      property.min_stay_nights || 1
    );

  const maxStay =
    property.max_stay_nights
      ? Number(property.max_stay_nights)
      : null;

  if (nights < minStay) {
    return {
      valid: false,
      error: `Minimum stay is ${minStay} night${
        minStay === 1 ? '' : 's'
      }.`,
    };
  }

  if (
    maxStay &&
    nights > maxStay
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

    const result =
      calculateNightlyRate({
        basePrice:
          property.base_price,
        guestCount: guests,
        includedGuests:
          property.included_guests,
        extraGuestFee:
          property.extra_guest_fee,
        date: dateString,
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
      });

    staySubtotal +=
      result.nightlyRate;

    nightlyBreakdown.push({
      date: dateString,
      rate:
        result.nightlyRate,
      adjustments:
        result.adjustments,
    });
  }

  const cleaningFee =
    Number(property.cleaning_fee || 0);

  const securityDeposit =
    Number(
      property.security_deposit || 0
    );

  const baseAmount =
    staySubtotal +
    cleaningFee;

  let autoDiscountAmount = 0;

  if (offer) {
    if (
      offer.discount_type === 'percent'
    ) {
      autoDiscountAmount =
        baseAmount *
        (Number(
          offer.discount_value || 0
        ) /
          100);
    }

    if (
      offer.discount_type === 'flat'
    ) {
      autoDiscountAmount =
        Number(
          offer.discount_value || 0
        );
    }
  }

  if (
    autoDiscountAmount >
    baseAmount
  ) {
    autoDiscountAmount =
      baseAmount;
  }

  const payableBeforeDeposit =
    baseAmount -
    autoDiscountAmount;

  const totalPayable =
    payableBeforeDeposit +
    securityDeposit;

  return {
    valid: true,
    nights,
    guests,
    staySubtotal:
      roundCurrency(staySubtotal),
    cleaningFee:
      roundCurrency(cleaningFee),
    securityDeposit:
      roundCurrency(
        securityDeposit
      ),
    baseAmount:
      roundCurrency(baseAmount),
    autoDiscountAmount:
      roundCurrency(
        autoDiscountAmount
      ),
    payableBeforeDeposit:
      roundCurrency(
        payableBeforeDeposit
      ),
    totalPayable:
      roundCurrency(
        totalPayable
      ),
    nightlyBreakdown,
  };
}

export function findPricingRuleForDate(
  date,
  rules = []
) {
  const matchingRules =
    rules.filter((rule) => {
      if (!rule.is_active) {
        return false;
      }

      return (
        date >= rule.start_date &&
        date <= rule.end_date
      );
    });

  if (!matchingRules.length) {
    return null;
  }

  const sorted =
    [...matchingRules].sort(
      (a, b) =>
        Number(b.priority || 0) -
        Number(a.priority || 0)
    );

  return sorted[0];
}

export function roundCurrency(value) {
  return (
    Math.round(
      Number(value || 0) * 100
    ) / 100
  );
}