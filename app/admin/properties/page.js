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

const kitchenOptions = [
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

const amenityOptions = [
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

  queen_bed_count: 0,
  single_bed_count: 0,
  sofa_cum_bed_count: 0,

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

  wifi_available: false,
  tv_available: false,
  fridge_available: false,
  washing_machine_available: false,

  ac_available: false,
  ac_count: 0,

  water_heater_count: 0,

  pets_allowed: false,
  parties_allowed: false,
  couples_allowed: true,
  alcohol_allowed: false,
  smoking_allowed: false,

  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',

  kitchen_features: [],
  amenities: [],
  features: [],

  house_rules_text: '',
  direction_instructions: '',

  dynamic_pricing_enabled: false,

  weekend_markup_percent: 0,
  long_weekend_markup_percent: 0,
  festival_markup_percent: 0,
  season_markup_percent: 0,

  is_active: true,
};

function numberValue(value, fallback = 0) {
  const result = Number(value);

  return Number.isNaN(result)
    ? fallback
    : result;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeProperty(property) {
  return {
    ...emptyForm,
    ...property,

    check_in_time:
      property?.check_in_time?.slice(
        0,
        5
      ) || '14:00',

    check_out_time:
      property?.check_out_time?.slice(
        0,
        5
      ) || '11:00',

    quiet_hours_start:
      property?.quiet_hours_start?.slice(
        0,
        5
      ) || '22:00',

    quiet_hours_end:
      property?.quiet_hours_end?.slice(
        0,
        5
      ) || '07:00',

    amenities:
      Array.isArray(
        property?.amenities
      )
        ? property.amenities
        : [],

    kitchen_features:
      Array.isArray(
        property?.kitchen_features
      )
        ? property.kitchen_features
        : [],

    features:
      Array.isArray(
        property?.features
      )
        ? property.features
        : [],

    house_rules_text:
      Array.isArray(
        property?.house_rules
      )
        ? property.house_rules.join(
            '\n'
          )
        : '',
  };
}

export default function AdminPropertiesPage() {
  const [
    checkingSession,
    setCheckingSession,
  ] = useState(true);

  const [
    session,
    setSession,
  ] = useState(null);

  const [
    adminProfile,
    setAdminProfile,
  ] = useState(null);

  const [
    properties,
    setProperties,
  ] = useState([]);

  const [
    form,
    setForm,
  ] = useState(emptyForm);

  const [
    loadingProperties,
    setLoadingProperties,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('');

  useEffect(() => {
    startPage();
  }, []);

  async function startPage() {
    try {
      const {
        data: {
          session,
        },
        error,
      } =
        await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      setSession(session);

      if (!session) {
        return;
      }

      const {
        data: profile,
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
          'This account does not have permission to manage properties.'
        );
      }

      setAdminProfile(
        profile
      );

      await loadProperties();
    } catch (error) {
      console.error(
        error
      );

      setErrorMessage(
        error.message ||
          'Unable to open property management.'
      );
    } finally {
      setCheckingSession(
        false
      );
    }
  }

  async function loadProperties() {
    setLoadingProperties(
      true
    );

    try {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            'properties'
          )
          .select('*')
          .order(
            'created_at',
            {
              ascending:
                false,
            }
          );

      if (error) {
        throw error;
      }

      setProperties(
        data || []
      );
    } catch (error) {
      setErrorMessage(
        `Unable to load properties: ${
          error.message
        }`
      );
    } finally {
      setLoadingProperties(
        false
      );
    }
  }

  function updateField(
    field,
    value
  ) {
    setForm(
      (previous) => ({
        ...previous,
        [field]: value,
      })
    );

    setErrorMessage('');
    setSuccessMessage('');
  }

  function toggleArrayItem(
    field,
    value
  ) {
    setForm(
      (previous) => {
        const existing =
          Array.isArray(
            previous[
              field
            ]
          )
            ? previous[
                field
              ]
            : [];

        return {
          ...previous,

          [field]:
            existing.includes(
              value
            )
              ? existing.filter(
                  (item) =>
                    item !==
                    value
                )
              : [
                  ...existing,
                  value,
                ],
        };
      }
    );
  }

  function startNewProperty() {
    setForm({
      ...emptyForm,
    });

    setErrorMessage('');
    setSuccessMessage('');

    window.scrollTo({
      top: 0,
      behavior:
        'smooth',
    });
  }

  function editProperty(
    property
  ) {
    setForm(
      normalizeProperty(
        property
      )
    );

    setErrorMessage('');
    setSuccessMessage('');

    window.scrollTo({
      top: 0,
      behavior:
        'smooth',
    });
  }

  async function saveProperty(
    event
  ) {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    if (
      !form.name.trim()
    ) {
      setErrorMessage(
        'Property name is required.'
      );

      return;
    }

    if (
      !form.location_name.trim()
    ) {
      setErrorMessage(
        'Location is required.'
      );

      return;
    }

    const minGuests =
      numberValue(
        form.min_guests,
        1
      );

    const includedGuests =
      numberValue(
        form.included_guests,
        1
      );

    const maxGuests =
      numberValue(
        form.max_guests,
        1
      );

    if (
      minGuests < 1
    ) {
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
        'Guests included in base price cannot be lower than minimum guests.'
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
        'Maximum guests cannot be lower than minimum guests.'
      );

      return;
    }

    const minStay =
      numberValue(
        form.min_stay_nights,
        1
      );

    const maxStay =
      numberValue(
        form.max_stay_nights,
        30
      );

    if (
      minStay < 1
    ) {
      setErrorMessage(
        'Minimum stay must be at least one night.'
      );

      return;
    }

    if (
      maxStay <
      minStay
    ) {
      setErrorMessage(
        'Maximum stay cannot be lower than minimum stay.'
      );

      return;
    }

    const houseRules =
      String(
        form.house_rules_text ||
          ''
      )
        .split('\n')
        .map(
          (item) =>
            item.trim()
        )
        .filter(Boolean);

    const automaticFeatures = [
      'Wi-Fi',
      'TV',
      'Fridge',
      'Washing Machine',
      'Air Conditioning',
    ];

    const featureList =
      (
        form.features ||
        []
      ).filter(
        (item) =>
          !automaticFeatures.includes(
            item
          )
      );

    if (
      form.wifi_available
    ) {
      featureList.push(
        'Wi-Fi'
      );
    }

    if (
      form.tv_available
    ) {
      featureList.push(
        'TV'
      );
    }

    if (
      form.fridge_available
    ) {
      featureList.push(
        'Fridge'
      );
    }

    if (
      form.washing_machine_available
    ) {
      featureList.push(
        'Washing Machine'
      );
    }

    if (
      form.ac_available
    ) {
      featureList.push(
        'Air Conditioning'
      );
    }

    const payload = {
      name:
        form.name.trim(),

      slug:
        form.slug.trim() ||
        slugify(
          form.name
        ),

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
        numberValue(
          form.bedrooms,
          1
        ),

      bathrooms:
        numberValue(
          form.bathrooms,
          1
        ),

      queen_bed_count:
        numberValue(
          form.queen_bed_count
        ),

      single_bed_count:
        numberValue(
          form.single_bed_count
        ),

      sofa_cum_bed_count:
        numberValue(
          form.sofa_cum_bed_count
        ),

      min_guests:
        minGuests,

      included_guests:
        includedGuests,

      max_guests:
        maxGuests,

      base_price:
        numberValue(
          form.base_price
        ),

      extra_guest_fee:
        numberValue(
          form.extra_guest_fee
        ),

      cleaning_fee:
        numberValue(
          form.cleaning_fee
        ),

      security_deposit:
        numberValue(
          form.security_deposit
        ),

      min_stay_nights:
        minStay,

      max_stay_nights:
        maxStay,

      check_in_time:
        form.check_in_time,

      check_out_time:
        form.check_out_time,

      late_checkout_hourly_fee:
        numberValue(
          form.late_checkout_hourly_fee
        ),

      wifi_available:
        Boolean(
          form.wifi_available
        ),

      tv_available:
        Boolean(
          form.tv_available
        ),

      fridge_available:
        Boolean(
          form.fridge_available
        ),

      washing_machine_available:
        Boolean(
          form.washing_machine_available
        ),

      ac_available:
        Boolean(
          form.ac_available
        ),

      ac_count:
        form.ac_available
          ? numberValue(
              form.ac_count
            )
          : 0,

      water_heater_count:
        numberValue(
          form.water_heater_count
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

      kitchen_features:
        form.kitchen_features ||
        [],

      amenities:
        form.amenities ||
        [],

      features:
        [
          ...new Set(
            featureList
          ),
        ],

      house_rules:
        houseRules,

      direction_instructions:
        form.direction_instructions?.trim() ||
        '',

      dynamic_pricing_enabled:
        Boolean(
          form.dynamic_pricing_enabled
        ),

      weekend_markup_percent:
        numberValue(
          form.weekend_markup_percent
        ),

      long_weekend_markup_percent:
        numberValue(
          form.long_weekend_markup_percent
        ),

      festival_markup_percent:
        numberValue(
          form.festival_markup_percent
        ),

      season_markup_percent:
        numberValue(
          form.season_markup_percent
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
      let savedProperty;

      if (form.id) {
        const {
          data,
          error,
        } =
          await supabase
            .from(
              'properties'
            )
            .update(
              payload
            )
            .eq(
              'id',
              form.id
            )
            .select('*')
            .single();

        if (error) {
          throw error;
        }

        savedProperty =
          data;

        setSuccessMessage(
          'Property updated successfully.'
        );
      } else {
        const {
          data,
          error,
        } =
          await supabase
            .from(
              'properties'
            )
            .insert(
              payload
            )
            .select('*')
            .single();

        if (error) {
          throw error;
        }

        savedProperty =
          data;

        setSuccessMessage(
          'Property created successfully. You can now manage photos, discounts and calendar rates.'
        );
      }

      setForm(
        normalizeProperty(
          savedProperty
        )
      );

      await loadProperties();
    } catch (error) {
      console.error(
        error
      );

      setErrorMessage(
        `Unable to save property: ${
          error.message ||
          'Unknown error'
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleProperty(
    property
  ) {
    setErrorMessage('');

    try {
      const {
        error,
      } =
        await supabase
          .from(
            'properties'
          )
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
        throw error;
      }

      await loadProperties();

      if (
        form.id ===
        property.id
      ) {
        setForm(
          (previous) => ({
            ...previous,

            is_active:
              !property.is_active,
          })
        );
      }
    } catch (error) {
      setErrorMessage(
        `Unable to update property status: ${
          error.message
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
            Go to Admin
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

        <div style={styles.headerRight}>
          <div>
            <strong>
              {adminProfile.full_name ||
                'Admin'}
            </strong>

            <div style={styles.roleText}>
              {adminProfile.role ||
                'admin'}
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            style={styles.logout}
          >
            Logout
          </button>
        </div>
      </header>

      <section style={styles.content}>
        <div style={styles.topRow}>
          <div>
            <h1 style={styles.pageTitle}>
              {form.id
                ? 'Edit Property'
                : 'Add New Property'}
            </h1>

            <p style={styles.muted}>
              Manage property details, pricing, photos,
              discounts, availability and calendar rates.
            </p>
          </div>

          {form.id && (
            <button
              type="button"
              onClick={
                startNewProperty
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
            <TextField
              label="PROPERTY NAME"
              value={form.name}
              onChange={(value) =>
                updateField(
                  'name',
                  value
                )
              }
            />

            <TextField
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

            <TextField
              label="PROPERTY URL SLUG"
              value={form.slug}
              placeholder="Leave blank to generate automatically"
              onChange={(value) =>
                updateField(
                  'slug',
                  value
                )
              }
            />

            <TextField
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
              value={form.address}
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
              value={form.bedrooms}
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
              Base rate ₹
              {numberValue(
                form.base_price
              ).toLocaleString(
                'en-IN'
              )}{' '}
              includes{' '}
              <strong>
                {form.included_guests}
              </strong>{' '}
              guest(s). Extra guest charge ₹
              {numberValue(
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
                kitchenOptions
              }
              selected={
                form.kitchen_features
              }
              onToggle={(value) =>
                toggleArrayItem(
                  'kitchen_features',
                  value
                )
              }
            />
          </Section>

          <Section title="Amenities">
            <CheckboxGrid
              items={
                amenityOptions
              }
              selected={
                form.amenities
              }
              onToggle={(value) =>
                toggleArrayItem(
                  'amenities',
                  value
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
              label="Enable Quiet Hours"
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
              label="OTHER HOUSE RULES — ONE PER LINE"
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
            propertyId={
              form.id
            }
            propertyName={
              form.name
            }
          />
        )}

        {form.id && (
          <PropertyDiscountManager
            propertyId={
              form.id
            }
            propertyName={
              form.name
            }
          />
        )}

        {form.id && (
          <PropertyCalendarManager
            propertyId={
              form.id
            }
            propertyName={
              form.name
            }
          />
        )}

        <hr style={styles.separator} />

        <div style={styles.topRow}>
          <div>
            <h2 style={styles.pageTitle}>
              Existing Properties
            </h2>

            <p style={styles.muted}>
              Select a property to manage its details,
              photos, discounts, availability and rates.
            </p>
          </div>

          <button
            type="button"
            onClick={
              startNewProperty
            }
            style={
              styles.secondaryButton
            }
          >
            + Add Property
          </button>
        </div>

        {loadingProperties ? (
          <div style={styles.loading}>
            Loading properties...
          </div>
        ) : properties.length ===
          0 ? (
          <div style={styles.empty}>
            No properties found.
          </div>
        ) : (
          <div style={styles.propertyGrid}>
            {properties.map(
              (property) => (
                <article
                  key={
                    property.id
                  }
                  style={
                    styles.propertyCard
                  }
                >
                  <div style={styles.cardTop}>
                    <div>
                      <h3 style={styles.cardTitle}>
                        {property.name}
                      </h3>

                      <div style={styles.muted}>
                        {
                          property.location_name
                        }
                      </div>
                    </div>

                    <span
                      style={{
                        ...styles.status,

                        background:
                          property.is_active
                            ? '#e7f7ec'
                            : '#eeeeee',

                        color:
                          property.is_active
                            ? '#24663a'
                            : '#666666',
                      }}
                    >
                      {property.is_active
                        ? 'Active'
                        : 'Inactive'}
                    </span>
                  </div>

                  <div style={styles.cardPrice}>
                    ₹
                    {numberValue(
                      property.base_price
                    ).toLocaleString(
                      'en-IN'
                    )}
                    {' / night'}
                  </div>

                  <div style={styles.small}>
                    Base price includes{' '}
                    {property.included_guests}{' '}
                    guest(s)
                  </div>

                  <div style={styles.small}>
                    Maximum{' '}
                    {property.max_guests}{' '}
                    guests
                  </div>

                  {property.dynamic_pricing_enabled && (
                    <div style={styles.dynamicBadge}>
                      Dynamic Pricing Active
                    </div>
                  )}

                  <div style={styles.cardButtons}>
                    <button
                      type="button"
                      onClick={() =>
                        editProperty(
                          property
                        )
                      }
                      style={
                        styles.editButton
                      }
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
                        styles.statusButton
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
                        style={
                          styles.viewButton
                        }
                      >
                        View
                      </a>
                    )}
                  </div>
                </article>
              )
            )}
          </div>
        )}
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

function TextField({
  label,
  value,
  onChange,
  placeholder = '',
}) {
  return (
    <label>
      <span style={styles.label}>
        {label}
      </span>

      <input
        type="text"
        value={value ?? ''}
        placeholder={placeholder}
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

function NumberField({
  label,
  value,
  onChange,
}) {
  return (
    <label>
      <span style={styles.label}>
        {label}
      </span>

      <input
        type="number"
        min="0"
        step="0.01"
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
    <label>
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
    <label style={styles.fullWidth}>
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
    <label style={styles.toggleRow}>
      <input
        type="checkbox"
        checked={
          Boolean(checked)
        }
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
    <div style={styles.fullWidth}>
      <div style={styles.checkboxGrid}>
        {items.map(
          (item) => (
            <label
              key={item}
              style={
                styles.checkboxItem
              }
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
    minHeight:
      '100vh',

    background:
      '#f6f7f9',

    color:
      '#172033',

    fontFamily:
      'Arial, sans-serif',
  },

  header: {
    background:
      '#ffffff',

    padding:
      '18px 5vw',

    display:
      'flex',

    justifyContent:
      'space-between',

    alignItems:
      'center',

    gap: 15,

    borderBottom:
      '1px solid #e4e6e9',
  },

  headerRight: {
    display:
      'flex',

    alignItems:
      'center',

    gap: 16,
  },

  brand: {
    fontSize: 24,
    fontWeight: 900,
    color: '#163c74',
  },

  roleText: {
    fontSize: 11,
    color: '#687080',
    textTransform:
      'capitalize',
  },

  logout: {
    border:
      '1px solid #dddddd',

    background:
      '#ffffff',

    borderRadius: 20,

    padding:
      '9px 15px',

    cursor:
      'pointer',
  },

  content: {
    maxWidth: 1400,

    margin:
      '0 auto',

    padding:
      '35px 5vw 80px',
  },

  pageTitle: {
    marginTop: 0,
  },

  topRow: {
    display:
      'flex',

    justifyContent:
      'space-between',

    alignItems:
      'center',

    flexWrap:
      'wrap',

    gap: 20,
  },

  muted: {
    color:
      '#687080',

    lineHeight:
      1.5,
  },

  section: {
    marginTop: 22,

    background:
      '#ffffff',

    padding: 24,

    border:
      '1px solid #e2e5e8',

    borderRadius: 16,
  },

  sectionTitle: {
    marginTop: 0,
    marginBottom: 20,
  },

  formGrid: {
    display:
      'grid',

    gridTemplateColumns:
      'repeat(auto-fit, minmax(230px, 1fr))',

    gap: 18,
  },

  fullWidth: {
    gridColumn:
      '1 / -1',
  },

  label: {
    display:
      'block',

    fontSize: 10,

    fontWeight: 800,

    letterSpacing: 1,

    marginBottom: 6,
  },

  input: {
    width:
      '100%',

    boxSizing:
      'border-box',

    padding: 12,

    border:
      '1px solid #ccd1d7',

    borderRadius: 10,

    background:
      '#ffffff',
  },

  textarea: {
    width:
      '100%',

    boxSizing:
      'border-box',

    minHeight: 100,

    padding: 12,

    border:
      '1px solid #ccd1d7',

    borderRadius: 10,

    resize:
      'vertical',
  },

  toggleRow: {
    display:
      'flex',

    alignItems:
      'center',

    gap: 10,

    padding: 13,

    border:
      '1px solid #e0e3e7',

    borderRadius: 10,

    background:
      '#fafafa',

    cursor:
      'pointer',
  },

  checkboxGrid: {
    display:
      'grid',

    gridTemplateColumns:
      'repeat(auto-fit, minmax(180px, 1fr))',

    gap: 10,
  },

  checkboxItem: {
    display:
      'flex',

    alignItems:
      'center',

    gap: 9,

    padding: 11,

    border:
      '1px solid #e0e3e7',

    borderRadius: 10,

    background:
      '#fafafa',

    cursor:
      'pointer',
  },

  infoBox: {
    gridColumn:
      '1 / -1',

    padding: 14,

    background:
      '#fff7e5',

    borderRadius: 10,

    fontWeight: 700,
  },

  error: {
    marginTop: 20,

    padding: 14,

    borderRadius: 10,

    background:
      '#ffeaea',

    color:
      '#8c2020',

    fontWeight: 700,
  },

  success: {
    marginTop: 20,

    padding: 14,

    borderRadius: 10,

    background:
      '#eaf8ee',

    color:
      '#236339',

    fontWeight: 700,
  },

  saveButton: {
    width:
      '100%',

    marginTop: 25,

    padding: 16,

    border: 0,

    borderRadius: 12,

    background:
      '#163c74',

    color:
      '#ffffff',

    fontSize: 16,

    fontWeight: 800,

    cursor:
      'pointer',
  },

  secondaryButton: {
    padding:
      '11px 17px',

    borderRadius: 10,

    background:
      '#ffffff',

    border:
      '1px solid #163c74',

    color:
      '#163c74',

    fontWeight: 700,

    cursor:
      'pointer',
  },

  separator: {
    margin:
      '55px 0 30px',

    border: 0,

    borderTop:
      '1px solid #dddddd',
  },

  propertyGrid: {
    display:
      'grid',

    gridTemplateColumns:
      'repeat(auto-fit, minmax(280px, 1fr))',

    gap: 20,

    marginTop: 20,
  },

  propertyCard: {
    background:
      '#ffffff',

    border:
      '1px solid #e2e4e8',

    borderRadius: 16,

    padding: 20,
  },

  cardTop: {
    display:
      'flex',

    justifyContent:
      'space-between',

    gap: 15,
  },

  cardTitle: {
    margin: 0,
  },

  status: {
    height:
      'fit-content',

    padding:
      '6px 10px',

    borderRadius: 20,

    fontSize: 11,

    fontWeight: 800,
  },

  cardPrice: {
    marginTop: 20,

    color:
      '#163c74',

    fontSize: 21,

    fontWeight: 800,
  },

  small: {
    marginTop: 5,

    fontSize: 13,

    color:
      '#666666',
  },

  dynamicBadge: {
    width:
      'fit-content',

    marginTop: 10,

    padding:
      '6px 9px',

    borderRadius: 8,

    background:
      '#fff3d5',

    color:
      '#7c5900',

    fontSize: 10,

    fontWeight: 800,
  },

  cardButtons: {
    display:
      'flex',

    gap: 10,

    flexWrap:
      'wrap',

    marginTop: 20,
  },

  editButton: {
    padding: 10,

    border: 0,

    borderRadius: 10,

    background:
      '#163c74',

    color:
      '#ffffff',

    fontWeight: 700,

    cursor:
      'pointer',
  },

  statusButton: {
    padding: 10,

    border:
      '1px solid #cccccc',

    borderRadius: 10,

    background:
      '#ffffff',

    cursor:
      'pointer',
  },

  viewButton: {
    padding:
      '9px 12px',

    border:
      '1px solid #163c74',

    borderRadius: 10,

    background:
      '#ffffff',

    color:
      '#163c74',

    textDecoration:
      'none',

    fontWeight: 700,

    fontSize: 12,
  },

  empty: {
    padding: 30,

    marginTop: 20,

    background:
      '#ffffff',

    borderRadius: 15,
  },

  loading: {
    padding: 40,
  },

  notice: {
    maxWidth: 450,

    margin:
      '80px auto',

    background:
      '#ffffff',

    padding: 30,

    borderRadius: 16,
  },

  primaryLink: {
    display:
      'inline-block',

    marginTop: 15,

    padding:
      '11px 16px',

    borderRadius: 10,

    background:
      '#163c74',

    color:
      '#ffffff',

    textDecoration:
      'none',
  },
};