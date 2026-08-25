'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import PropertyPhotoManager from './PropertyPhotoManager';
import PropertyDiscountManager from './PropertyDiscountManager';
import PropertyCalendarManager from './PropertyCalendarManager';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

const commonKitchenFeatures = [
  'Gas Stove',
  'Induction',
  'Microwave',
  'Electric Kettle',
  'Tea / Coffee Setup',
  'Cooking Utensils',
  'Plates & Cutlery',
  'Drinking Water',
  'RO Water Purifier',
  'Toaster',
];

const commonAmenities = [
  'Wi-Fi',
  'Free Parking',
  'Covered Parking',
  'Hot Water',
  'Power Backup',
  'Garden',
  'Balcony',
  'Terrace',
  'Swimming Pool',
  'Gym',
  'Clubhouse',
  'Security',
  'CCTV',
  'Lift',
  'Mountain View',
  'City View',
];

const emptyForm = {
  id: '',
  name: '',
  slug: '',
  short_description: '',
  description: '',
  location_name: '',
  address: '',
  google_maps_url: '',

  bedrooms: 1,
  bathrooms: 1,

  min_guests: 1,
  included_guests: 4,
  max_guests: 6,

  base_price: 2599,
  extra_guest_fee: 699,
  cleaning_fee: 0,
  security_deposit: 0,

  min_stay_nights: 1,
  max_stay_nights: 30,

  check_in_time: '14:00',
  check_out_time: '11:00',
  late_checkout_hourly_fee: 0,

  fridge_available: false,
  tv_available: false,
  washing_machine_available: false,
  wifi_available: false,

  ac_available: false,
  ac_count: 0,

  water_heater_count: 0,
  sofa_cum_bed_count: 0,
  single_bed_count: 0,
  queen_bed_count: 0,

  pets_allowed: false,
  parties_allowed: false,
  couples_allowed: true,
  alcohol_allowed: false,
  smoking_allowed: false,

  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',

  dynamic_pricing_enabled: false,
  weekend_markup_percent: 0,
  long_weekend_markup_percent: 0,
  festival_markup_percent: 0,
  season_markup_percent: 0,

  direction_instructions: '',

  features: [],
  amenities: [],
  kitchen_features: [],
  house_rules_text: '',

  is_active: true,
};

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toNumber(value, fallback = 0) {
  const result = Number(value);

  if (Number.isNaN(result)) {
    return fallback;
  }

  return result;
}

export default function AdminPropertiesPage() {
  const [checkingSession, setCheckingSession] =
    useState(true);

  const [session, setSession] =
    useState(null);

  const [adminProfile, setAdminProfile] =
    useState(null);

  const [properties, setProperties] =
    useState([]);

  const [form, setForm] =
    useState(emptyForm);

  const [saving, setSaving] =
    useState(false);

  const [loadingProperties, setLoadingProperties] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState('');

  const [successMessage, setSuccessMessage] =
    useState('');

  useEffect(() => {
    startPage();
  }, []);

  async function startPage() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    setSession(session);
    setCheckingSession(false);

    if (!session) {
      return;
    }

    await verifyAdmin(session.user.id);
  }

  async function verifyAdmin(userId) {
    const { data, error } = await supabase
      .from('admin_profiles')
      .select(
        'user_id, full_name, role, is_active'
      )
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      setErrorMessage(
        'This account does not have permission to manage properties.'
      );

      return;
    }

    setAdminProfile(data);

    await loadProperties();
  }

  async function loadProperties() {
    setLoadingProperties(true);

    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .order('created_at', {
        ascending: false,
      });

    setLoadingProperties(false);

    if (error) {
      setErrorMessage(
        `Unable to load properties: ${error.message}`
      );

      return;
    }

    setProperties(data || []);
  }

  function updateField(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setErrorMessage('');
    setSuccessMessage('');
  }

  function toggleListItem(field, item) {
    setForm((previous) => {
      const current = previous[field] || [];

      const exists =
        current.includes(item);

      return {
        ...previous,

        [field]: exists
          ? current.filter(
              (value) => value !== item
            )
          : [...current, item],
      };
    });
  }

  function newProperty() {
    setForm(emptyForm);
    setErrorMessage('');
    setSuccessMessage('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function editProperty(property) {
    setErrorMessage('');
    setSuccessMessage('');

    setForm({
      ...emptyForm,
      ...property,

      check_in_time:
        property.check_in_time?.slice(0, 5) ||
        '14:00',

      check_out_time:
        property.check_out_time?.slice(0, 5) ||
        '11:00',

      quiet_hours_start:
        property.quiet_hours_start?.slice(
          0,
          5
        ) || '22:00',

      quiet_hours_end:
        property.quiet_hours_end?.slice(
          0,
          5
        ) || '07:00',

      features:
        Array.isArray(property.features)
          ? property.features
          : [],

      amenities:
        Array.isArray(property.amenities)
          ? property.amenities
          : [],

      kitchen_features:
        Array.isArray(
          property.kitchen_features
        )
          ? property.kitchen_features
          : [],

      house_rules_text:
        Array.isArray(
          property.house_rules
        )
          ? property.house_rules.join('\n')
          : '',
    });

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function saveProperty(event) {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    if (!form.name.trim()) {
      setErrorMessage(
        'Property name is required.'
      );
      return;
    }

    if (!form.location_name.trim()) {
      setErrorMessage(
        'Location is required.'
      );
      return;
    }

    const minGuests =
      toNumber(form.min_guests, 1);

    const includedGuests =
      toNumber(form.included_guests, 1);

    const maxGuests =
      toNumber(form.max_guests, 1);

    if (minGuests < 1) {
      setErrorMessage(
        'Minimum guests must be at least 1.'
      );
      return;
    }

    if (
      includedGuests <
      minGuests
    ) {
      setErrorMessage(
        'Guests included in base price cannot be less than minimum guests.'
      );
      return;
    }

    if (
      includedGuests >
      maxGuests
    ) {
      setErrorMessage(
        'Guests included in base price cannot exceed maximum guests.'
      );
      return;
    }

    if (
      maxGuests <
      minGuests
    ) {
      setErrorMessage(
        'Maximum guests cannot be less than minimum guests.'
      );
      return;
    }

    const minNights =
      toNumber(
        form.min_stay_nights,
        1
      );

    const maxNights =
      toNumber(
        form.max_stay_nights,
        30
      );

    if (
      minNights < 1
    ) {
      setErrorMessage(
        'Minimum stay must be at least one night.'
      );
      return;
    }

    if (
      maxNights <
      minNights
    ) {
      setErrorMessage(
        'Maximum stay cannot be lower than minimum stay.'
      );
      return;
    }

    const slug =
      form.slug?.trim() ||
      slugify(form.name);

    const houseRules =
      String(
        form.house_rules_text || ''
      )
        .split('\n')
        .map((rule) =>
          rule.trim()
        )
        .filter(Boolean);

    const featureList = [
      ...form.features,
    ];

    if (
      form.wifi_available &&
      !featureList.includes('Wi-Fi')
    ) {
      featureList.push('Wi-Fi');
    }

    if (
      form.tv_available &&
      !featureList.includes('TV')
    ) {
      featureList.push('TV');
    }

    if (
      form.fridge_available &&
      !featureList.includes('Fridge')
    ) {
      featureList.push('Fridge');
    }

    if (
      form.washing_machine_available &&
      !featureList.includes(
        'Washing Machine'
      )
    ) {
      featureList.push(
        'Washing Machine'
      );
    }

    if (
      form.ac_available &&
      !featureList.includes(
        'Air Conditioning'
      )
    ) {
      featureList.push(
        'Air Conditioning'
      );
    }

    const payload = {
      name:
        form.name.trim(),

      slug,

      short_description:
        form.short_description?.trim() ||
        '',

      description:
        form.description?.trim() ||
        '',

      location_name:
        form.location_name.trim(),

      address:
        form.address?.trim() ||
        '',

      google_maps_url:
        form.google_maps_url?.trim() ||
        '',

      bedrooms:
        toNumber(
          form.bedrooms,
          1
        ),

      bathrooms:
        toNumber(
          form.bathrooms,
          1
        ),

      min_guests:
        minGuests,

      included_guests:
        includedGuests,

      max_guests:
        maxGuests,

      base_price:
        toNumber(
          form.base_price,
          0
        ),

      extra_guest_fee:
        toNumber(
          form.extra_guest_fee,
          0
        ),

      cleaning_fee:
        toNumber(
          form.cleaning_fee,
          0
        ),

      security_deposit:
        toNumber(
          form.security_deposit,
          0
        ),

      min_stay_nights:
        minNights,

      max_stay_nights:
        maxNights,

      check_in_time:
        form.check_in_time,

      check_out_time:
        form.check_out_time,

      late_checkout_hourly_fee:
        toNumber(
          form.late_checkout_hourly_fee,
          0
        ),

      features:
        featureList,

      amenities:
        form.amenities,

      kitchen_features:
        form.kitchen_features,

      house_rules:
        houseRules,

      direction_instructions:
        form.direction_instructions?.trim() ||
        '',

      fridge_available:
        Boolean(
          form.fridge_available
        ),

      tv_available:
        Boolean(
          form.tv_available
        ),

      washing_machine_available:
        Boolean(
          form.washing_machine_available
        ),

      wifi_available:
        Boolean(
          form.wifi_available
        ),

      ac_available:
        Boolean(
          form.ac_available
        ),

      ac_count:
        form.ac_available
          ? toNumber(
              form.ac_count,
              0
            )
          : 0,

      water_heater_count:
        toNumber(
          form.water_heater_count,
          0
        ),

      sofa_cum_bed_count:
        toNumber(
          form.sofa_cum_bed_count,
          0
        ),

      single_bed_count:
        toNumber(
          form.single_bed_count,
          0
        ),

      queen_bed_count:
        toNumber(
          form.queen_bed_count,
          0
        ),

      pets_allowed:
        Boolean(
          form.pets_allowed
        ),

      parties_allowed:
        Boolean(
          form.parties_allowed
        ),

      couples_allowed:
        Boolean(
          form.couples_allowed
        ),

      alcohol_allowed:
        Boolean(
          form.alcohol_allowed
        ),

      smoking_allowed:
        Boolean(
          form.smoking_allowed
        ),

      quiet_hours_enabled:
        Boolean(
          form.quiet_hours_enabled
        ),

      quiet_hours_start:
        form.quiet_hours_enabled
          ? form.quiet_hours_start
          : null,

      quiet_hours_end:
        form.quiet_hours_enabled
          ? form.quiet_hours_end
          : null,

      dynamic_pricing_enabled:
        Boolean(
          form.dynamic_pricing_enabled
        ),

      weekend_markup_percent:
        toNumber(
          form.weekend_markup_percent,
          0
        ),

      long_weekend_markup_percent:
        toNumber(
          form.long_weekend_markup_percent,
          0
        ),

      festival_markup_percent:
        toNumber(
          form.festival_markup_percent,
          0
        ),

      season_markup_percent:
        toNumber(
          form.season_markup_percent,
          0
        ),

      is_active:
        Boolean(
          form.is_active
        ),

      updated_at:
        new Date().toISOString(),
    };

    setSaving(true);

    try {
      let propertyId =
        form.id;

      if (form.id) {
        const {
          data,
          error,
        } = await supabase
          .from('properties')
          .update(payload)
          .eq(
            'id',
            form.id
          )
          .select('id')
          .single();

        if (error) {
          throw error;
        }

        propertyId =
          data.id;
      } else {
        const {
          data,
          error,
        } = await supabase
          .from('properties')
          .insert(payload)
          .select('id')
          .single();

        if (error) {
          throw error;
        }

        propertyId =
          data.id;
      }

      await loadProperties();

      if (form.id) {
        setSuccessMessage(
          'Property updated successfully.'
        );
      } else {
        setSuccessMessage(
          'Property created successfully. Click Edit Property to add photos, discounts and calendar rates.'
        );

        const createdProperty =
          properties.find(
            (item) =>
              item.id ===
              propertyId
          );

        setForm({
          ...emptyForm,
          id: propertyId,
          name:
            form.name,
          location_name:
            form.location_name,
        });

        if (createdProperty) {
          editProperty(
            createdProperty
          );
        }
      }
    } catch (error) {
      console.error(error);

      setErrorMessage(
        `Unable to save property: ${
          error?.message ||
          'Unknown error'
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleProperty(property) {
    setErrorMessage('');

    const {
      error,
    } = await supabase
      .from('properties')
      .update({
        is_active:
          !property.is_active,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        property.id
      );

    if (error) {
      setErrorMessage(
        `Unable to update property status: ${error.message}`
      );

      return;
    }

    await loadProperties();
  }

  async function logout() {
    await supabase.auth.signOut();

    window.location.href =
      '/admin/bookings';
  }

  if (
    checkingSession
  ) {
    return (
      <main style={styles.page}>
        <div style={styles.loading}>
          Loading property management...
        </div>
      </main>
    );
  }

  if (
    !session ||
    !adminProfile
  ) {
    return (
      <main style={styles.page}>
        <div style={styles.notice}>
          <h2>
            Admin login required
          </h2>

          <p>
            Please log in before managing properties.
          </p>

          <a
            href="/admin/bookings"
            style={
              styles.primaryLink
            }
          >
            Go to Admin Login
          </a>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.brand}>
            NightOutStays
          </div>

          <div style={styles.muted}>
            Host Property Management
          </div>
        </div>

        <button
          onClick={logout}
          style={styles.logout}
        >
          Logout
        </button>
      </header>

      <section style={styles.content}>
        <div style={styles.topRow}>
          <div>
            <h1>
              {form.id
                ? 'Edit Property'
                : 'Add New Property'}
            </h1>

            <p style={styles.muted}>
              Manage property information, pricing, guest capacity, facilities, rules, photos, discounts and the availability calendar.
            </p>
          </div>

          {form.id && (
            <button
              type="button"
              onClick={
                newProperty
              }
              style={
                styles.secondaryButton
              }
            >
              + Add New Property
            </button>
          )}
        </div>

        <form
          onSubmit={
            saveProperty
          }
        >
          <Section title="Basic Property Information">
            <Field
              label="PROPERTY NAME"
              value={
                form.name
              }
              onChange={(value) =>
                updateField(
                  'name',
                  value
                )
              }
            />

            <Field
              label="LOCATION"
              value={
                form.location_name
              }
              onChange={(value) =>
                updateField(
                  'location_name',
                  value
                )
              }
            />

            <Field
              label="PROPERTY URL SLUG"
              value={
                form.slug
              }
              onChange={(value) =>
                updateField(
                  'slug',
                  value
                )
              }
              placeholder="Leave blank to generate automatically"
            />

            <Field
              label="GOOGLE MAPS LINK"
              value={
                form.google_maps_url
              }
              onChange={(value) =>
                updateField(
                  'google_maps_url',
                  value
                )
              }
            />

            <TextArea
              label="FULL ADDRESS"
              value={
                form.address
              }
              onChange={(value) =>
                updateField(
                  'address',
                  value
                )
              }
            />

            <TextArea
              label="SHORT DESCRIPTION"
              value={
                form.short_description
              }
              onChange={(value) =>
                updateField(
                  'short_description',
                  value
                )
              }
            />

            <TextArea
              label="FULL DESCRIPTION"
              value={
                form.description
              }
              onChange={(value) =>
                updateField(
                  'description',
                  value
                )
              }
            />
          </Section>

          <Section title="Rooms, Beds & Capacity">
            <NumberField
              label="BEDROOMS"
              value={
                form.bedrooms
              }
              onChange={(value) =>
                updateField(
                  'bedrooms',
                  value
                )
              }
            />

            <NumberField
              label="BATHROOMS"
              value={
                form.bathrooms
              }
              onChange={(value) =>
                updateField(
                  'bathrooms',
                  value
                )
              }
            />

            <NumberField
              label="QUEEN SIZE BEDS"
              value={
                form.queen_bed_count
              }
              onChange={(value) =>
                updateField(
                  'queen_bed_count',
                  value
                )
              }
            />

            <NumberField
              label="SINGLE BEDS"
              value={
                form.single_bed_count
              }
              onChange={(value) =>
                updateField(
                  'single_bed_count',
                  value
                )
              }
            />

            <NumberField
              label="SOFA-CUM-BEDS"
              value={
                form.sofa_cum_bed_count
              }
              onChange={(value) =>
                updateField(
                  'sofa_cum_bed_count',
                  value
                )
              }
            />

            <NumberField
              label="MINIMUM GUESTS"
              value={
                form.min_guests
              }
              onChange={(value) =>
                updateField(
                  'min_guests',
                  value
                )
              }
            />

            <NumberField
              label="GUESTS INCLUDED IN BASE PRICE"
              value={
                form.included_guests
              }
              onChange={(value) =>
                updateField(
                  'included_guests',
                  value
                )
              }
            />

            <NumberField
              label="MAXIMUM GUESTS"
              value={
                form.max_guests
              }
              onChange={(value) =>
                updateField(
                  'max_guests',
                  value
                )
              }
            />
          </Section>

          <Section title="Pricing">
            <NumberField
              label="BASE NIGHTLY PRICE ₹"
              value={
                form.base_price
              }
              onChange={(value) =>
                updateField(
                  'base_price',
                  value
                )
              }
            />

            <NumberField
              label="EXTRA GUEST ₹ / PERSON / NIGHT"
              value={
                form.extra_guest_fee
              }
              onChange={(value) =>
                updateField(
                  'extra_guest_fee',
                  value
                )
              }
            />

            <NumberField
              label="CLEANING FEE ₹"
              value={
                form.cleaning_fee
              }
              onChange={(value) =>
                updateField(
                  'cleaning_fee',
                  value
                )
              }
            />

            <NumberField
              label="SECURITY DEPOSIT ₹"
              value={
                form.security_deposit
              }
              onChange={(value) =>
                updateField(
                  'security_deposit',
                  value
                )
              }
            />

            <div style={styles.infoBox}>
              ₹
              {toNumber(
                form.base_price
              ).toLocaleString(
                'en-IN'
              )}{' '}
              includes up to{' '}
              <strong>
                {form.included_guests}
              </strong>{' '}
              guests. Extra guest charge ₹
              {toNumber(
                form.extra_guest_fee
              ).toLocaleString(
                'en-IN'
              )}{' '}
              per person per night.
            </div>
          </Section>

          <Section title="Stay Duration & Timing">
            <NumberField
              label="MINIMUM STAY NIGHTS"
              value={
                form.min_stay_nights
              }
              onChange={(value) =>
                updateField(
                  'min_stay_nights',
                  value
                )
              }
            />

            <NumberField
              label="MAXIMUM STAY NIGHTS"
              value={
                form.max_stay_nights
              }
              onChange={(value) =>
                updateField(
                  'max_stay_nights',
                  value
                )
              }
            />

            <TimeField
              label="CHECK-IN TIME"
              value={
                form.check_in_time
              }
              onChange={(value) =>
                updateField(
                  'check_in_time',
                  value
                )
              }
            />

            <TimeField
              label="CHECK-OUT TIME"
              value={
                form.check_out_time
              }
              onChange={(value) =>
                updateField(
                  'check_out_time',
                  value
                )
              }
            />

            <NumberField
              label="LATE CHECK-OUT ₹ / HOUR"
              value={
                form.late_checkout_hourly_fee
              }
              onChange={(value) =>
                updateField(
                  'late_checkout_hourly_fee',
                  value
                )
              }
            />
          </Section>

          <Section title="Facilities">
            <Toggle
              label="Wi-Fi"
              checked={
                form.wifi_available
              }
              onChange={(value) =>
                updateField(
                  'wifi_available',
                  value
                )
              }
            />

            <Toggle
              label="TV"
              checked={
                form.tv_available
              }
              onChange={(value) =>
                updateField(
                  'tv_available',
                  value
                )
              }
            />

            <Toggle
              label="Fridge"
              checked={
                form.fridge_available
              }
              onChange={(value) =>
                updateField(
                  'fridge_available',
                  value
                )
              }
            />

            <Toggle
              label="Washing Machine"
              checked={
                form.washing_machine_available
              }
              onChange={(value) =>
                updateField(
                  'washing_machine_available',
                  value
                )
              }
            />

            <Toggle
              label="Air Conditioning"
              checked={
                form.ac_available
              }
              onChange={(value) =>
                updateField(
                  'ac_available',
                  value
                )
              }
            />

            {form.ac_available && (
              <NumberField
                label="NUMBER OF ACs"
                value={
                  form.ac_count
                }
                onChange={(value) =>
                  updateField(
                    'ac_count',
                    value
                  )
                }
              />
            )}

            <NumberField
              label="WATER HEATERS / GEYSERS"
              value={
                form.water_heater_count
              }
              onChange={(value) =>
                updateField(
                  'water_heater_count',
                  value
                )
              }
            />
          </Section>

          <Section title="Kitchen Features">
            <CheckboxGrid
              items={
                commonKitchenFeatures
              }
              selected={
                form.kitchen_features
              }
              onToggle={(item) =>
                toggleListItem(
                  'kitchen_features',
                  item
                )
              }
            />
          </Section>

          <Section title="Amenities">
            <CheckboxGrid
              items={
                commonAmenities
              }
              selected={
                form.amenities
              }
              onToggle={(item) =>
                toggleListItem(
                  'amenities',
                  item
                )
              }
            />
          </Section>

          <Section title="Rules & Permissions">
            <Toggle
              label="Pets Allowed"
              checked={
                form.pets_allowed
              }
              onChange={(value) =>
                updateField(
                  'pets_allowed',
                  value
                )
              }
            />

            <Toggle
              label="Parties Allowed"
              checked={
                form.parties_allowed
              }
              onChange={(value) =>
                updateField(
                  'parties_allowed',
                  value
                )
              }
            />

            <Toggle
              label="Couples Allowed"
              checked={
                form.couples_allowed
              }
              onChange={(value) =>
                updateField(
                  'couples_allowed',
                  value
                )
              }
            />

            <Toggle
              label="Alcohol Allowed"
              checked={
                form.alcohol_allowed
              }
              onChange={(value) =>
                updateField(
                  'alcohol_allowed',
                  value
                )
              }
            />

            <Toggle
              label="Smoking Allowed"
              checked={
                form.smoking_allowed
              }
              onChange={(value) =>
                updateField(
                  'smoking_allowed',
                  value
                )
              }
            />

            <Toggle
              label="Noise / Quiet Hours"
              checked={
                form.quiet_hours_enabled
              }
              onChange={(value) =>
                updateField(
                  'quiet_hours_enabled',
                  value
                )
              }
            />

            {form.quiet_hours_enabled && (
              <>
                <TimeField
                  label="QUIET HOURS FROM"
                  value={
                    form.quiet_hours_start
                  }
                  onChange={(value) =>
                    updateField(
                      'quiet_hours_start',
                      value
                    )
                  }
                />

                <TimeField
                  label="QUIET HOURS UNTIL"
                  value={
                    form.quiet_hours_end
                  }
                  onChange={(value) =>
                    updateField(
                      'quiet_hours_end',
                      value
                    )
                  }
                />
              </>
            )}

            <TextArea
              label="OTHER HOUSE RULES — one rule per line"
              value={
                form.house_rules_text
              }
              onChange={(value) =>
                updateField(
                  'house_rules_text',
                  value
                )
              }
            />
          </Section>

          <Section title="Directions / Arrival Instructions">
            <TextArea
              label="DIRECTION INSTRUCTIONS"
              value={
                form.direction_instructions
              }
              onChange={(value) =>
                updateField(
                  'direction_instructions',
                  value
                )
              }
            />
          </Section>

          <Section title="Automatic Dynamic Pricing">
            <Toggle
              label="Enable Dynamic Pricing"
              checked={
                form.dynamic_pricing_enabled
              }
              onChange={(value) =>
                updateField(
                  'dynamic_pricing_enabled',
                  value
                )
              }
            />

            {form.dynamic_pricing_enabled && (
              <>
                <NumberField
                  label="WEEKEND MARKUP %"
                  value={
                    form.weekend_markup_percent
                  }
                  onChange={(value) =>
                    updateField(
                      'weekend_markup_percent',
                      value
                    )
                  }
                />

                <NumberField
                  label="LONG WEEKEND MARKUP %"
                  value={
                    form.long_weekend_markup_percent
                  }
                  onChange={(value) =>
                    updateField(
                      'long_weekend_markup_percent',
                      value
                    )
                  }
                />

                <NumberField
                  label="FESTIVAL MARKUP %"
                  value={
                    form.festival_markup_percent
                  }
                  onChange={(value) =>
                    updateField(
                      'festival_markup_percent',
                      value
                    )
                  }
                />

                <NumberField
                  label="SEASON MARKUP %"
                  value={
                    form.season_markup_percent
                  }
                  onChange={(value) =>
                    updateField(
                      'season_markup_percent',
                      value
                    )
                  }
                />
              </>
            )}
          </Section>

          <Section title="Publishing">
            <Toggle
              label="Property Active / Visible to Guests"
              checked={
                form.is_active
              }
              onChange={(value) =>
                updateField(
                  'is_active',
                  value
                )
              }
            />
          </Section>

          {errorMessage && (
            <div style={styles.error}>
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div style={styles.success}>
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            style={styles.saveButton}
          >
            {saving
              ? 'Saving Property...'
              : form.id
              ? 'Update Property'
              : 'Create Property'}
          </button>
        </form>

        {form.id && (
          <PropertyPhotoManager
            propertyId={form.id}
            propertyName={form.name}
          />
        )}

        {form.id && (
          <PropertyDiscountManager
            propertyId={form.id}
            propertyName={form.name}
          />
        )}

        {form.id && (
          <PropertyCalendarManager
            propertyId={form.id}
            propertyName={form.name}
          />
        )}

        <hr style={styles.separator} />

        <section style={styles.listSection}>
          <div style={styles.topRow}>
            <div>
              <h2>
                Existing Properties
              </h2>

              <p style={styles.muted}>
                Edit any property to manage details, photos,
                discounts, availability and date-specific rates.
              </p>
            </div>

            <button
              type="button"
              onClick={loadProperties}
              style={styles.secondaryButton}
            >
              Refresh
            </button>
          </div>

          {loadingProperties ? (
            <div style={styles.loading}>
              Loading properties...
            </div>
          ) : properties.length === 0 ? (
            <div style={styles.empty}>
              No properties added yet.
            </div>
          ) : (
            <div style={styles.propertyGrid}>
              {properties.map(
                (property) => (
                  <article
                    key={property.id}
                    style={styles.propertyCard}
                  >
                    <div style={styles.cardTop}>
                      <div>
                        <h3 style={styles.propertyName}>
                          {property.name}
                        </h3>

                        <div style={styles.muted}>
                          {property.location_name}
                        </div>
                      </div>

                      <span
                        style={{
                          ...styles.statusBadge,

                          ...(property.is_active
                            ? styles.activeBadge
                            : styles.inactiveBadge),
                        }}
                      >
                        {property.is_active
                          ? 'Active'
                          : 'Inactive'}
                      </span>
                    </div>

                    <div style={styles.propertyDetails}>
                      <div>
                        <strong>
                          ₹
                          {toNumber(
                            property.base_price
                          ).toLocaleString(
                            'en-IN'
                          )}
                        </strong>
                        {' / night'}
                      </div>

                      <div>
                        {property.bedrooms || 0}
                        {' Bedrooms · '}
                        {property.bathrooms || 0}
                        {' Bathrooms'}
                      </div>

                      <div>
                        Up to{' '}
                        {property.max_guests || 0}
                        {' guests'}
                      </div>

                      <div>
                        Base price includes{' '}
                        {property.included_guests || 0}
                        {' guests'}
                      </div>

                      {property.dynamic_pricing_enabled && (
                        <div style={styles.dynamicTag}>
                          Dynamic Pricing Active
                        </div>
                      )}
                    </div>

                    <div style={styles.cardActions}>
                      <button
                        type="button"
                        onClick={() =>
                          editProperty(
                            property
                          )
                        }
                        style={styles.editButton}
                      >
                        Edit Property
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          toggleProperty(
                            property
                          )
                        }
                        style={
                          property.is_active
                            ? styles.deactivateButton
                            : styles.activateButton
                        }
                      >
                        {property.is_active
                          ? 'Deactivate'
                          : 'Activate'}
                      </button>

                      {property.slug && (
                        <a
                          href={`/property/${property.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          style={styles.viewLink}
                        >
                          View Guest Page
                        </a>
                      )}
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function Section({
  title,
  children,
}) {
  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>
        {title}
      </h2>

      <div style={styles.formGrid}>
        {children}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder = '',
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>
        {label}
      </span>

      <input
        type="text"
        value={value ?? ''}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={placeholder}
        style={styles.input}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>
        {label}
      </span>

      <input
        type="number"
        min={min}
        step={step}
        value={value ?? ''}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        style={styles.input}
      />
    </label>
  );
}

function TimeField({
  label,
  value,
  onChange,
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>
        {label}
      </span>

      <input
        type="time"
        value={value || ''}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        style={styles.input}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}) {
  return (
    <label style={styles.fullField}>
      <span style={styles.label}>
        {label}
      </span>

      <textarea
        value={value ?? ''}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        rows={5}
        style={styles.textarea}
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}) {
  return (
    <label style={styles.toggleCard}>
      <input
        type="checkbox"
        checked={Boolean(
          checked
        )}
        onChange={(event) =>
          onChange(
            event.target.checked
          )
        }
      />

      <span>
        {label}
      </span>
    </label>
  );
}

function CheckboxGrid({
  items,
  selected,
  onToggle,
}) {
  return (
    <div style={styles.fullField}>
      <div style={styles.checkboxGrid}>
        {items.map(
          (item) => (
            <label
              key={item}
              style={styles.checkboxCard}
            >
              <input
                type="checkbox"
                checked={
                  selected?.includes(
                    item
                  ) || false
                }
                onChange={() =>
                  onToggle(
                    item
                  )
                }
              />

              <span>
                {item}
              </span>
            </label>
          )
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f5f7fa',
    color: '#11213c',
    fontFamily:
      'Arial, sans-serif',
  },

  header: {
    background: '#ffffff',
    borderBottom:
      '1px solid #e1e5ea',
    padding: '17px 3vw',
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'center',
    gap: 20,
    position: 'sticky',
    top: 0,
    zIndex: 20,
  },

  brand: {
    fontSize: 25,
    fontWeight: 900,
    color: '#17457f',
  },

  muted: {
    color: '#687080',
    lineHeight: 1.5,
  },

  logout: {
    border:
      '1px solid #d6dae0',
    background: '#ffffff',
    color: '#11213c',
    padding: '9px 15px',
    borderRadius: 20,
    cursor: 'pointer',
    fontWeight: 700,
  },

  content: {
    maxWidth: 1450,
    margin: '0 auto',
    padding: '32px 3vw 80px',
  },

  topRow: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'center',
    gap: 20,
    flexWrap: 'wrap',
  },

  section: {
    marginTop: 22,
    padding: 22,
    background: '#ffffff',
    border:
      '1px solid #e1e5ea',
    borderRadius: 15,
    boxShadow:
      '0 3px 12px rgba(0,0,0,0.03)',
  },

  sectionTitle: {
    marginTop: 0,
    marginBottom: 18,
    fontSize: 21,
    color: '#11213c',
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 16,
    alignItems: 'start',
  },

  field: {
    display: 'block',
  },

  fullField: {
    display: 'block',
    gridColumn: '1 / -1',
  },

  label: {
    display: 'block',
    marginBottom: 7,
    fontSize: 10,
    fontWeight: 900,
    color: '#3d4653',
    letterSpacing: 0.4,
  },

  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 12px',
    border:
      '1px solid #ccd2d9',
    borderRadius: 9,
    background: '#ffffff',
    color: '#11213c',
    fontSize: 14,
    outline: 'none',
  },

  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    padding: 12,
    border:
      '1px solid #ccd2d9',
    borderRadius: 9,
    background: '#ffffff',
    color: '#11213c',
    fontSize: 14,
    resize: 'vertical',
    lineHeight: 1.5,
    outline: 'none',
  },

  toggleCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    minHeight: 43,
    padding: '9px 12px',
    border:
      '1px solid #dde1e6',
    borderRadius: 9,
    background: '#fafbfc',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 13,
  },

  checkboxGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 9,
  },

  checkboxCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 11px',
    border:
      '1px solid #dde1e6',
    borderRadius: 9,
    background: '#fafbfc',
    cursor: 'pointer',
    fontSize: 13,
  },

  infoBox: {
    gridColumn: '1 / -1',
    padding: 13,
    background: '#edf4ff',
    border:
      '1px solid #ccdcf3',
    color: '#17457f',
    borderRadius: 9,
    lineHeight: 1.5,
  },

  saveButton: {
    marginTop: 22,
    width: '100%',
    border: 0,
    background: '#17457f',
    color: '#ffffff',
    padding: '14px 20px',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 900,
    cursor: 'pointer',
  },

  secondaryButton: {
    border:
      '1px solid #17457f',
    background: '#ffffff',
    color: '#17457f',
    padding: '10px 15px',
    borderRadius: 9,
    fontWeight: 800,
    cursor: 'pointer',
  },

  error: {
    marginTop: 18,
    padding: 13,
    borderRadius: 9,
    background: '#ffe9e9',
    border:
      '1px solid #f2c5c5',
    color: '#8d2424',
    fontWeight: 700,
  },

  success: {
    marginTop: 18,
    padding: 13,
    borderRadius: 9,
    background: '#eaf8ee',
    border:
      '1px solid #c8e9d0',
    color: '#24663a',
    fontWeight: 700,
  },

  separator: {
    border: 0,
    borderTop:
      '1px solid #dfe3e7',
    margin: '42px 0',
  },

  listSection: {
    marginTop: 20,
  },

  propertyGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(310px, 1fr))',
    gap: 16,
    marginTop: 20,
  },

  propertyCard: {
    background: '#ffffff',
    border:
      '1px solid #dfe3e7',
    borderRadius: 14,
    padding: 18,
    boxShadow:
      '0 3px 12px rgba(0,0,0,0.03)',
  },

  cardTop: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },

  propertyName: {
    margin: 0,
    fontSize: 18,
  },

  statusBadge: {
    display: 'inline-flex',
    padding: '5px 9px',
    borderRadius: 20,
    fontSize: 10,
    fontWeight: 900,
  },

  activeBadge: {
    background: '#e7f7ec',
    color: '#27713e',
  },

  inactiveBadge: {
    background: '#eeeeee',
    color: '#656565',
  },

  propertyDetails: {
    display: 'grid',
    gap: 6,
    marginTop: 16,
    color: '#505967',
    fontSize: 13,
  },

  dynamicTag: {
    width: 'fit-content',
    marginTop: 4,
    padding: '5px 8px',
    background: '#fff4d8',
    color: '#7a5a00',
    borderRadius: 7,
    fontSize: 10,
    fontWeight: 900,
  },
  cardActions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 18,
  },

  editButton: {
    border: 0,
    background: '#17457f',
    color: '#ffffff',
    padding: '9px 12px',
    borderRadius: 8,
    fontWeight: 800,
    cursor: 'pointer',
  },

  deactivateButton: {
    border: 0,
    background: '#fff0e8',
    color: '#9a4a22',
    padding: '9px 12px',
    borderRadius: 8,
    fontWeight: 800,
    cursor: 'pointer',
  },

  activateButton: {
    border: 0,
    background: '#e8f7ed',
    color: '#27713e',
    padding: '9px 12px',
    borderRadius: 8,
    fontWeight: 800,
    cursor: 'pointer',
  },

  viewLink: {
    display: 'inline-flex',
    alignItems: 'center',
    textDecoration: 'none',
    border: '1px solid #17457f',
    color: '#17457f',
    background: '#ffffff',
    padding: '8px 12px',
    borderRadius: 8,
    fontWeight: 800,
    fontSize: 12,
  },

  loading: {
    padding: 30,
    textAlign: 'center',
    color: '#687080',
  },

  empty: {
    marginTop: 20,
    padding: 25,
    textAlign: 'center',
    background: '#ffffff',
    border: '1px solid #e1e5ea',
    borderRadius: 12,
    color: '#687080',
  },

  notice: {
    maxWidth: 520,
    margin: '80px auto',
    padding: 30,
    background: '#ffffff',
    border: '1px solid #e1e5ea',
    borderRadius: 15,
    textAlign: 'center',
  },

  primaryLink: {
    display: 'inline-block',
    marginTop: 12,
    padding: '11px 16px',
    borderRadius: 9,
    background: '#17457f',
    color: '#ffffff',
    textDecoration: 'none',
    fontWeight: 800,
  },
};