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
      property?.check_in_time?.slice(0, 5) ||
      '14:00',

    check_out_time:
      property?.check_out_time?.slice(0, 5) ||
      '11:00',

    quiet_hours_start:
      property?.quiet_hours_start?.slice(0, 5) ||
      '22:00',

    quiet_hours_end:
      property?.quiet_hours_end?.slice(0, 5) ||
      '07:00',

    amenities:
      Array.isArray(property?.amenities)
        ? property.amenities
        : [],

    kitchen_features:
      Array.isArray(property?.kitchen_features)
        ? property.kitchen_features
        : [],

    features:
      Array.isArray(property?.features)
        ? property.features
        : [],

    house_rules_text:
      Array.isArray(property?.house_rules)
        ? property.house_rules.join('\n')
        : '',
  };
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
    useState({
      ...emptyForm,
    });

  /*
    Main page modes:

    list
    Shows all existing properties first.

    add
    Shows the Add New Property form.

    manage
    Opens one existing property with:
    Details
    Photos
    Pricing & Offers
    Calendar
  */

  const [screen, setScreen] =
    useState('list');

  const [manageTab, setManageTab] =
    useState('details');

  const [loadingProperties, setLoadingProperties] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState('');

  const [successMessage, setSuccessMessage] =
    useState('');

  useEffect(() => {
    startPage();
  }, []);

  async function startPage() {
    try {
      const {
        data: { session },
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
        error: profileError,
      } =
        await supabase
          .from('admin_profiles')
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

      setAdminProfile(profile);

      await loadProperties();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error.message ||
          'Unable to open property management.'
      );
    } finally {
      setCheckingSession(false);
    }
  }

  async function loadProperties() {
    setLoadingProperties(true);

    try {
      const {
        data,
        error,
      } =
        await supabase
          .from('properties')
          .select('*')
          .order(
            'created_at',
            {
              ascending: false,
            }
          );

      if (error) {
        throw error;
      }

      setProperties(
        data || []
      );
    } catch (error) {
      console.error(error);

      setErrorMessage(
        `Unable to load properties: ${
          error.message
        }`
      );
    } finally {
      setLoadingProperties(false);
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
            previous[field]
          )
            ? previous[field]
            : [];

        return {
          ...previous,

          [field]:
            existing.includes(value)
              ? existing.filter(
                  (item) =>
                    item !== value
                )
              : [
                  ...existing,
                  value,
                ],
        };
      }
    );

    setErrorMessage('');
    setSuccessMessage('');
  }

  function showPropertyList() {
    setScreen('list');

    setErrorMessage('');
    setSuccessMessage('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function startNewProperty() {
    setForm({
      ...emptyForm,
    });

    setScreen('add');
    setManageTab('details');

    setErrorMessage('');
    setSuccessMessage('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function manageProperty(
    property,
    tab = 'details'
  ) {
    setForm(
      normalizeProperty(
        property
      )
    );

    setScreen('manage');
    setManageTab(tab);

    setErrorMessage('');
    setSuccessMessage('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function saveProperty(event) {
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

      features: [
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

      if (
        form.id
      ) {
        const {
          data,
          error,
        } =
          await supabase
            .from('properties')
            .update(payload)
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
            .from('properties')
            .insert(payload)
            .select('*')
            .single();

        if (error) {
          throw error;
        }

        savedProperty =
          data;

        setSuccessMessage(
          'Property created successfully.'
        );
      }

      setForm(
        normalizeProperty(
          savedProperty
        )
      );

      /*
        A newly created property
        immediately opens in Manage mode.

        Photos is opened first so the host
        can complete the listing quickly.
      */

      setScreen(
        'manage'
      );

      setManageTab(
        form.id
          ? manageTab
          : 'photos'
      );

      await loadProperties();
    } catch (error) {
      console.error(error);

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
  async function toggleProperty(property) {
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { error } =
        await supabase
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
      console.error(error);

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

  if (checkingSession) {
    return (
      <main className="nosPropPage">
        <div className="nosPropLoadingBox">
          Loading property management...
        </div>

        <PageStyles />
      </main>
    );
  }

  if (
    !session ||
    !adminProfile
  ) {
    return (
      <main className="nosPropPage">
        <div className="nosPropLoginNotice">
          <h2>
            Admin login required
          </h2>

          <p>
            Please log in before
            managing properties.
          </p>
<a
  href="/login"
  className="nosPropPrimaryLink"
>
  Go to Admin Login
</a>        </div>

        <PageStyles />
      </main>
    );
  }

  return (
    <main className="nosPropPage">
      <header className="nosPropHeader">
        <div className="nosPropBrandArea">
          <div className="nosPropBrand">
            NightOutStays
          </div>

          <div className="nosPropMuted">
            Host Property Management
          </div>
        </div>

        <div className="nosPropHeaderRight">
          <div className="nosPropProfile">
            <strong>
              {adminProfile.full_name ||
                'Admin'}
            </strong>

            <span>
              {adminProfile.role ||
                'Admin'}
            </span>
          </div>

          <button
            type="button"
            onClick={logout}
            className="nosPropLogoutButton"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="nosPropContent">
        <div className="nosPropPageHeading">
          <div>
            <h1>
              Properties
            </h1>

            <p>
              Manage listings,
              photos, pricing,
              offers and property
              calendars.
            </p>
          </div>
        </div>

        <div className="nosPropMainTabs">
          <button
            type="button"
            onClick={
              showPropertyList
            }
            className={
              screen === 'list'
                ? 'nosPropMainTab nosPropMainTabActive'
                : 'nosPropMainTab'
            }
          >
            My Properties
          </button>

          <button
            type="button"
            onClick={
              startNewProperty
            }
            className={
              screen === 'add'
                ? 'nosPropMainTab nosPropMainTabActive'
                : 'nosPropMainTab'
            }
          >
            + Add New Property
          </button>
        </div>

        {screen === 'list' && (
          <>
            {errorMessage && (
              <div className="nosPropError">
                {errorMessage}
              </div>
            )}

            <MyProperties
              properties={
                properties
              }
              loading={
                loadingProperties
              }
              onManage={
                manageProperty
              }
              onToggle={
                toggleProperty
              }
              onAdd={
                startNewProperty
              }
            />
          </>
        )}

        {screen === 'add' && (
          <div className="nosPropEditor">
            <button
              type="button"
              onClick={
                showPropertyList
              }
              className="nosPropBackButton"
            >
              ← My Properties
            </button>

            <div className="nosPropEditorTitle">
              <h2>
                Add New Property
              </h2>

              <p>
                Add the basic
                property information,
                pricing, facilities,
                rules and booking
                settings.
              </p>
            </div>

            <PropertyDetailsForm
              form={form}
              updateField={
                updateField
              }
              toggleArrayItem={
                toggleArrayItem
              }
              saving={
                saving
              }
              errorMessage={
                errorMessage
              }
              successMessage={
                successMessage
              }
              onSubmit={
                saveProperty
              }
              isEditing={
                false
              }
            />
          </div>
        )}

        {screen === 'manage' &&
          form.id && (
            <div className="nosPropEditor">
              <div className="nosPropManageHeader">
                <div className="nosPropManageLeft">
                  <button
                    type="button"
                    onClick={
                      showPropertyList
                    }
                    className="nosPropBackButton"
                  >
                    ← My Properties
                  </button>

                  <div className="nosPropManageTitleRow">
                    <div>
                      <div className="nosPropSmallTitle">
                        MANAGE PROPERTY
                      </div>

                      <h2>
                        {form.name}
                      </h2>

                      <p>
                        {form.location_name ||
                          'Location not added'}
                      </p>
                    </div>

                    <span
                      className={
                        form.is_active
                          ? 'nosPropStatus nosPropStatusActive'
                          : 'nosPropStatus nosPropStatusInactive'
                      }
                    >
                      {form.is_active
                        ? 'Active'
                        : 'Inactive'}
                    </span>
                  </div>
                </div>

                {form.slug && (
                  <a
                    href={`/property/${form.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="nosPropPreviewTop"
                  >
                    View Property
                  </a>
                )}
              </div>

              <div className="nosPropManageTabsWrap">
                <div className="nosPropManageTabs">
                  <button
                    type="button"
                    onClick={() =>
                      setManageTab(
                        'details'
                      )
                    }
                    className={
                      manageTab ===
                      'details'
                        ? 'nosPropManageTab nosPropManageTabActive'
                        : 'nosPropManageTab'
                    }
                  >
                    Details
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setManageTab(
                        'photos'
                      )
                    }
                    className={
                      manageTab ===
                      'photos'
                        ? 'nosPropManageTab nosPropManageTabActive'
                        : 'nosPropManageTab'
                    }
                  >
                    Photos
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setManageTab(
                        'offers'
                      )
                    }
                    className={
                      manageTab ===
                      'offers'
                        ? 'nosPropManageTab nosPropManageTabActive'
                        : 'nosPropManageTab'
                    }
                  >
                    Pricing & Offers
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setManageTab(
                        'calendar'
                      )
                    }
                    className={
                      manageTab ===
                      'calendar'
                        ? 'nosPropManageTab nosPropManageTabActive'
                        : 'nosPropManageTab'
                    }
                  >
                    Calendar
                  </button>
                </div>
              </div>

              {manageTab ===
                'details' && (
                <PropertyDetailsForm
                  form={form}
                  updateField={
                    updateField
                  }
                  toggleArrayItem={
                    toggleArrayItem
                  }
                  saving={
                    saving
                  }
                  errorMessage={
                    errorMessage
                  }
                  successMessage={
                    successMessage
                  }
                  onSubmit={
                    saveProperty
                  }
                  isEditing={
                    true
                  }
                />
              )}

              {manageTab ===
                'photos' && (
                <div className="nosPropManagerPanel">
                  <div className="nosPropManagerHeading">
                    <h3>
                      Property Photos
                    </h3>

                    <p>
                      Upload and manage
                      photos for{' '}
                      <strong>
                        {form.name}
                      </strong>
                      .
                    </p>
                  </div>

                  <PropertyPhotoManager
                    propertyId={
                      form.id
                    }
                    propertyName={
                      form.name
                    }
                  />
                </div>
              )}

              {manageTab ===
                'offers' && (
                <div className="nosPropManagerPanel">
                  <div className="nosPropManagerHeading">
                    <h3>
                      Pricing & Offers
                    </h3>

                    <p>
                      Manage discounts
                      and property
                      offers for{' '}
                      <strong>
                        {form.name}
                      </strong>
                      .
                    </p>
                  </div>

                  <PropertyDiscountManager
                    propertyId={
                      form.id
                    }
                    propertyName={
                      form.name
                    }
                  />
                </div>
              )}

              {manageTab ===
                'calendar' && (
                <div className="nosPropManagerPanel">
                  <div className="nosPropManagerHeading">
                    <h3>
                      Property Calendar
                    </h3>

                    <p>
                      Manage date-wise
                      pricing and
                      availability for{' '}
                      <strong>
                        {form.name}
                      </strong>
                      .
                    </p>
                  </div>

                  <PropertyCalendarManager
                    propertyId={
                      form.id
                    }
                    propertyName={
                      form.name
                    }
                  />
                </div>
              )}
            </div>
          )}
      </section>

      <PageStyles />
    </main>
  );
}

/* =====================================================
   MY PROPERTIES LIST
===================================================== */

function MyProperties({
  properties,
  loading,
  onManage,
  onToggle,
  onAdd,
}) {
  if (loading) {
    return (
      <div className="nosPropLoadingBox">
        Loading properties...
      </div>
    );
  }

  if (!properties.length) {
    return (
      <div className="nosPropEmptyState">
        <div className="nosPropEmptyIcon">
          🏠
        </div>

        <h2>
          No properties added yet
        </h2>

        <p>
          Add your first property
          and start preparing it
          for direct bookings.
        </p>

        <button
          type="button"
          onClick={onAdd}
          className="nosPropPrimaryButton"
        >
          + Add New Property
        </button>
      </div>
    );
  }

  return (
    <section className="nosPropListSection">
      <div className="nosPropListHeading">
        <div>
          <h2>
            My Properties
          </h2>

          <p>
            {properties.length}{' '}
            {properties.length === 1
              ? 'property'
              : 'properties'}
          </p>
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="nosPropAddButton"
        >
          + Add Property
        </button>
      </div>

      <div className="nosPropPropertyGrid">
        {properties.map(
          (property) => (
            <article
              key={
                property.id
              }
              className="nosPropPropertyCard"
            >
              <div className="nosPropCardTop">
                <div className="nosPropCardTitle">
                  <h3>
                    {property.name}
                  </h3>

                  <p>
                    {property.location_name ||
                      'Location not added'}
                  </p>
                </div>

                <span
                  className={
                    property.is_active
                      ? 'nosPropStatus nosPropStatusActive'
                      : 'nosPropStatus nosPropStatusInactive'
                  }
                >
                  {property.is_active
                    ? 'Active'
                    : 'Inactive'}
                </span>
              </div>

              <div className="nosPropPrice">
                ₹
                {numberValue(
                  property.base_price
                ).toLocaleString(
                  'en-IN'
                )}

                <span>
                  / night
                </span>
              </div>

              <div className="nosPropCardInfo">
                <div>
                  <strong>
                    {property.bedrooms ||
                      0}
                  </strong>

                  <span>
                    Bedrooms
                  </span>
                </div>

                <div>
                  <strong>
                    {property.bathrooms ||
                      0}
                  </strong>

                  <span>
                    Bathrooms
                  </span>
                </div>

                <div>
                  <strong>
                    {property.max_guests ||
                      0}
                  </strong>

                  <span>
                    Max Guests
                  </span>
                </div>
              </div>

              <div className="nosPropBaseGuestInfo">
                Base price includes{' '}
                <strong>
                  {property.included_guests ||
                    1}
                </strong>{' '}
                guest(s)
              </div>

              {property.dynamic_pricing_enabled && (
                <div className="nosPropDynamicBadge">
                  Dynamic Pricing Active
                </div>
              )}

              <div className="nosPropCardActions">
                <button
                  type="button"
                  onClick={() =>
                    onManage(
                      property,
                      'details'
                    )
                  }
                  className="nosPropCardPrimary"
                >
                  Manage
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onManage(
                      property,
                      'photos'
                    )
                  }
                  className="nosPropCardSecondary"
                >
                  Photos
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onManage(
                      property,
                      'offers'
                    )
                  }
                  className="nosPropCardSecondary"
                >
                  Offers
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onManage(
                      property,
                      'calendar'
                    )
                  }
                  className="nosPropCardSecondary"
                >
                  Calendar
                </button>

                {property.slug && (
                  <a
                    href={`/property/${property.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="nosPropCardSecondary nosPropCardLink"
                  >
                    Preview
                  </a>
                )}

                <button
                  type="button"
                  onClick={() =>
                    onToggle(
                      property
                    )
                  }
                  className={
                    property.is_active
                      ? 'nosPropCardDanger'
                      : 'nosPropCardActivate'
                  }
                >
                  {property.is_active
                    ? 'Deactivate'
                    : 'Activate'}
                </button>
              </div>
            </article>
          )
        )}
      </div>
    </section>
  );
}

/* =====================================================
   PROPERTY DETAILS FORM
===================================================== */

function PropertyDetailsForm({
  form,
  updateField,
  toggleArrayItem,
  saving,
  errorMessage,
  successMessage,
  onSubmit,
  isEditing,
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="nosPropForm"
    >
      <FormSection title="Basic Property Information">
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
      </FormSection>

      <FormSection title="Rooms, Beds & Capacity">
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
      </FormSection>

      <FormSection title="Pricing">
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

        <div className="nosPropInfoBox">
          Base price ₹
          {numberValue(
            form.base_price
          ).toLocaleString(
            'en-IN'
          )}{' '}
          includes{' '}
          <strong>
            {form.included_guests}
          </strong>{' '}
          guest(s). Extra guests
          are charged ₹
          {numberValue(
            form.extra_guest_fee
          ).toLocaleString(
            'en-IN'
          )}{' '}
          per person per night.
        </div>
      </FormSection>

      <FormSection title="Stay Duration & Timing">
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
      </FormSection>
      <FormSection title="Facilities">
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
      </FormSection>

      <FormSection title="Kitchen Features">
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
      </FormSection>

      <FormSection title="Amenities">
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
      </FormSection>

      <FormSection title="Rules & Permissions">
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
      </FormSection>

      <FormSection title="Directions / Arrival Instructions">
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
      </FormSection>

      <FormSection title="Automatic Dynamic Pricing">
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
      </FormSection>

      <FormSection title="Publishing">
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
      </FormSection>

      {errorMessage && (
        <div className="nosPropError">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="nosPropSuccess">
          {successMessage}
        </div>
      )}

      <div className="nosPropSaveArea">
        <button
          type="submit"
          disabled={saving}
          className="nosPropSaveButton"
        >
          {saving
            ? 'Saving Property...'
            : isEditing
            ? 'Update Property'
            : 'Create Property'}
        </button>
      </div>
    </form>
  );
}

/* =====================================================
   FORM HELPERS
===================================================== */

function FormSection({
  title,
  children,
}) {
  return (
    <section className="nosPropFormSection">
      <h3>
        {title}
      </h3>

      <div className="nosPropFormGrid">
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
    <label className="nosPropField">
      <span>
        {label}
      </span>

      <input
        type="text"
        value={value ?? ''}
        placeholder={
          placeholder
        }
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
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
    <label className="nosPropField">
      <span>
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
    <label className="nosPropField">
      <span>
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
    <label className="nosPropField nosPropFullWidth">
      <span>
        {label}
      </span>

      <textarea
        value={value ?? ''}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        rows="5"
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
    <label className="nosPropToggle">
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

      <span className="nosPropToggleSwitch" />

      <strong>
        {label}
      </strong>
    </label>
  );
}

function CheckboxGrid({
  items,
  selected,
  onToggle,
}) {
  return (
    <div className="nosPropCheckboxGrid nosPropFullWidth">
      {items.map(
        (item) => (
          <label
            key={item}
            className="nosPropCheckboxItem"
          >
            <input
              type="checkbox"
              checked={
                selected?.includes(
                  item
                ) || false
              }
              onChange={() =>
                onToggle(item)
              }
            />

            <span>
              {item}
            </span>
          </label>
        )
      )}
    </div>
  );
}

/* =====================================================
   RESPONSIVE STYLES
===================================================== */

function PageStyles() {
  return (
    <style jsx global>{`
      .nosPropPage {
        min-height: 100vh;
        background: #f5f7fa;
        color: #172033;
        font-family: Arial, Helvetica, sans-serif;
      }

      .nosPropPage *,
      .nosPropPage *::before,
      .nosPropPage *::after {
        box-sizing: border-box;
      }

      .nosPropHeader {
        min-height: 76px;
        padding: 14px 28px;
        background: #ffffff;
        border-bottom: 1px solid #e3e7ee;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
      }

      .nosPropBrand {
        font-size: 22px;
        font-weight: 800;
        letter-spacing: -0.4px;
      }

      .nosPropMuted,
      .nosPropHeaderRight span,
      .nosPropPageHeading p,
      .nosPropEditorTitle p,
      .nosPropManageTitleRow p,
      .nosPropManagerHeading p,
      .nosPropListHeading p,
      .nosPropCardTitle p {
        color: #697386;
      }

      .nosPropBrandArea .nosPropMuted {
        margin-top: 4px;
        font-size: 13px;
      }

      .nosPropHeaderRight {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .nosPropProfile {
        display: flex;
        flex-direction: column;
        text-align: right;
        gap: 3px;
        font-size: 13px;
      }

      .nosPropProfile strong {
        font-size: 14px;
      }

      .nosPropLogoutButton,
      .nosPropBackButton,
      .nosPropMainTab,
      .nosPropAddButton,
      .nosPropPrimaryButton,
      .nosPropSaveButton,
      .nosPropManageTab,
      .nosPropCardActions button,
      .nosPropCardActions a,
      .nosPropPreviewTop {
        min-height: 44px;
        cursor: pointer;
        font: inherit;
      }

      .nosPropLogoutButton {
        border: 1px solid #d8dee8;
        background: #ffffff;
        padding: 9px 16px;
        border-radius: 9px;
        font-weight: 700;
      }

      .nosPropContent {
        width: min(1400px, calc(100% - 48px));
        margin: 0 auto;
        padding: 32px 0 60px;
      }

      .nosPropPageHeading h1 {
        margin: 0;
        font-size: 30px;
      }

      .nosPropPageHeading p {
        margin: 8px 0 0;
        line-height: 1.5;
      }

      .nosPropMainTabs {
        margin-top: 24px;
        display: inline-flex;
        padding: 5px;
        background: #e9edf3;
        border-radius: 12px;
        gap: 5px;
      }

      .nosPropMainTab {
        border: 0;
        background: transparent;
        padding: 10px 18px;
        border-radius: 9px;
        font-weight: 700;
        color: #536071;
      }

      .nosPropMainTabActive {
        background: #ffffff;
        color: #172033;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
      }

      .nosPropListSection {
        margin-top: 28px;
      }

      .nosPropListHeading {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        margin-bottom: 18px;
      }

      .nosPropListHeading h2 {
        margin: 0;
        font-size: 22px;
      }

      .nosPropListHeading p {
        margin: 5px 0 0;
        font-size: 14px;
      }

      .nosPropAddButton,
      .nosPropPrimaryButton,
      .nosPropSaveButton {
        border: 0;
        background: #172033;
        color: #ffffff;
        border-radius: 9px;
        padding: 10px 18px;
        font-weight: 800;
      }

      .nosPropPropertyGrid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
      }

      .nosPropPropertyCard {
        background: #ffffff;
        border: 1px solid #e1e6ed;
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 4px 14px rgba(21, 32, 51, 0.04);
        min-width: 0;
      }

      .nosPropCardTop {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      }

      .nosPropCardTitle {
        min-width: 0;
      }

      .nosPropCardTitle h3 {
        margin: 0;
        font-size: 18px;
        line-height: 1.35;
        overflow-wrap: anywhere;
      }

      .nosPropCardTitle p {
        margin: 6px 0 0;
        font-size: 13px;
        line-height: 1.4;
      }

      .nosPropStatus {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 28px;
        padding: 5px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 800;
        white-space: nowrap;
      }

      .nosPropStatusActive {
        background: #e8f7ee;
        color: #16733d;
      }

      .nosPropStatusInactive {
        background: #f1f2f4;
        color: #697386;
      }

      .nosPropPrice {
        margin-top: 20px;
        font-size: 24px;
        font-weight: 800;
      }

      .nosPropPrice span {
        font-size: 13px;
        font-weight: 500;
        color: #697386;
      }

      .nosPropCardInfo {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        margin-top: 18px;
        border: 1px solid #e8ebf0;
        border-radius: 11px;
        overflow: hidden;
      }

      .nosPropCardInfo > div {
        min-width: 0;
        padding: 11px 7px;
        text-align: center;
        border-right: 1px solid #e8ebf0;
      }

      .nosPropCardInfo > div:last-child {
        border-right: 0;
      }

      .nosPropCardInfo strong,
      .nosPropCardInfo span {
        display: block;
      }

      .nosPropCardInfo strong {
        font-size: 16px;
      }

      .nosPropCardInfo span {
        margin-top: 4px;
        color: #697386;
        font-size: 11px;
      }

      .nosPropBaseGuestInfo {
        margin-top: 13px;
        color: #697386;
        font-size: 12px;
      }

      .nosPropDynamicBadge {
        margin-top: 12px;
        display: inline-block;
        padding: 6px 9px;
        border-radius: 7px;
        background: #fff4d6;
        color: #795800;
        font-size: 11px;
        font-weight: 800;
      }

      .nosPropCardActions {
        margin-top: 18px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      .nosPropCardActions button,
      .nosPropCardActions a {
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        padding: 8px 10px;
        font-weight: 700;
        font-size: 12px;
        text-decoration: none;
        text-align: center;
      }

      .nosPropCardPrimary {
        border: 1px solid #172033;
        background: #172033;
        color: #ffffff;
      }

      .nosPropCardSecondary {
        border: 1px solid #dbe1e9;
        background: #ffffff;
        color: #27364a;
      }

      .nosPropCardDanger {
        border: 1px solid #f1cccc;
        background: #fff5f5;
        color: #a12b2b;
      }

      .nosPropCardActivate {
        border: 1px solid #bfe3cd;
        background: #f1fbf5;
        color: #16733d;
      }

      .nosPropEditor {
        margin-top: 28px;
      }

      .nosPropBackButton {
        border: 0;
        background: transparent;
        padding: 0 4px;
        color: #41546d;
        font-weight: 800;
      }

      .nosPropEditorTitle {
        margin: 10px 0 20px;
      }

      .nosPropEditorTitle h2,
      .nosPropManageTitleRow h2 {
        margin: 0;
        font-size: 25px;
      }

      .nosPropEditorTitle p,
      .nosPropManageTitleRow p {
        margin: 7px 0 0;
        line-height: 1.5;
      }

      .nosPropManageHeader {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 20px;
        margin-bottom: 18px;
      }

      .nosPropManageLeft {
        min-width: 0;
        flex: 1;
      }

      .nosPropManageTitleRow {
        margin-top: 10px;
        display: flex;
        align-items: flex-start;
        gap: 14px;
      }

      .nosPropSmallTitle {
        margin-bottom: 5px;
        color: #8791a0;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 1px;
      }

      .nosPropPreviewTop {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #d8dee8;
        background: #ffffff;
        color: #27364a;
        border-radius: 9px;
        padding: 9px 16px;
        text-decoration: none;
        font-weight: 700;
        white-space: nowrap;
      }

      .nosPropManageTabsWrap {
        overflow-x: auto;
        scrollbar-width: thin;
        margin-bottom: 20px;
      }

      .nosPropManageTabs {
        min-width: max-content;
        display: flex;
        gap: 6px;
        padding: 5px;
        background: #e9edf3;
        border-radius: 11px;
      }

      .nosPropManageTab {
        border: 0;
        background: transparent;
        color: #536071;
        padding: 9px 16px;
        border-radius: 8px;
        font-weight: 800;
        white-space: nowrap;
      }

      .nosPropManageTabActive {
        background: #ffffff;
        color: #172033;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
      }

      .nosPropManagerPanel,
      .nosPropFormSection {
        background: #ffffff;
        border: 1px solid #e1e6ed;
        border-radius: 14px;
        padding: 22px;
        margin-bottom: 18px;
      }

      .nosPropManagerHeading {
        padding-bottom: 16px;
        margin-bottom: 18px;
        border-bottom: 1px solid #e8ebf0;
      }

      .nosPropManagerHeading h3,
      .nosPropFormSection h3 {
        margin: 0;
        font-size: 18px;
      }

      .nosPropManagerHeading p {
        margin: 6px 0 0;
        line-height: 1.45;
      }

      .nosPropForm {
        width: 100%;
      }

      .nosPropFormGrid {
        margin-top: 18px;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
        gap: 16px;
        align-items: start;
      }

      .nosPropField {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 7px;
      }

      .nosPropField > span {
        color: #59677a;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.25px;
      }

      .nosPropField input,
      .nosPropField textarea {
        width: 100%;
        min-height: 44px;
        border: 1px solid #d8dee8;
        border-radius: 8px;
        background: #ffffff;
        color: #172033;
        padding: 10px 12px;
        font: inherit;
        outline: none;
      }

      .nosPropField textarea {
        min-height: 110px;
        resize: vertical;
        line-height: 1.5;
      }

      .nosPropField input:focus,
      .nosPropField textarea:focus {
        border-color: #7e8ca0;
        box-shadow: 0 0 0 3px rgba(90, 110, 140, 0.09);
      }

      .nosPropFullWidth {
        grid-column: 1 / -1;
      }

      .nosPropInfoBox {
        grid-column: 1 / -1;
        padding: 12px 14px;
        background: #f6f8fb;
        border: 1px solid #e2e7ee;
        border-radius: 8px;
        color: #536071;
        font-size: 13px;
        line-height: 1.5;
      }

      .nosPropToggle {
        min-height: 50px;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border: 1px solid #e1e6ed;
        border-radius: 9px;
        cursor: pointer;
        user-select: none;
      }

      .nosPropToggle input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
      }

      .nosPropToggleSwitch {
        position: relative;
        width: 40px;
        height: 23px;
        flex: 0 0 40px;
        border-radius: 999px;
        background: #c9d0da;
        transition: 0.2s ease;
      }

      .nosPropToggleSwitch::after {
        content: '';
        position: absolute;
        width: 17px;
        height: 17px;
        left: 3px;
        top: 3px;
        border-radius: 50%;
        background: #ffffff;
        transition: 0.2s ease;
      }

      .nosPropToggle input:checked + .nosPropToggleSwitch {
        background: #172033;
      }

      .nosPropToggle input:checked + .nosPropToggleSwitch::after {
        transform: translateX(17px);
      }

      .nosPropToggle strong {
        font-size: 13px;
      }

      .nosPropCheckboxGrid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
      }

      .nosPropCheckboxItem {
        min-height: 46px;
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 9px 11px;
        border: 1px solid #e1e6ed;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
      }

      .nosPropCheckboxItem input {
        width: 17px;
        height: 17px;
        flex: 0 0 17px;
      }

      .nosPropSaveArea {
        display: flex;
        justify-content: flex-end;
        padding: 4px 0 24px;
      }

      .nosPropSaveButton {
        min-width: 190px;
      }

      .nosPropSaveButton:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .nosPropError,
      .nosPropSuccess {
        margin: 14px 0;
        padding: 12px 14px;
        border-radius: 9px;
        font-size: 13px;
        line-height: 1.5;
      }

      .nosPropError {
        background: #fff3f3;
        border: 1px solid #f0cccc;
        color: #9d2929;
      }

      .nosPropSuccess {
        background: #effaf3;
        border: 1px solid #c9e8d4;
        color: #17663a;
      }

      .nosPropLoadingBox,
      .nosPropLoginNotice,
      .nosPropEmptyState {
        margin-top: 28px;
        background: #ffffff;
        border: 1px solid #e1e6ed;
        border-radius: 14px;
        padding: 32px;
        text-align: center;
      }

      .nosPropLoginNotice {
        width: min(520px, calc(100% - 32px));
        margin: 60px auto;
      }

      .nosPropLoginNotice h2,
      .nosPropEmptyState h2 {
        margin: 8px 0;
      }

      .nosPropLoginNotice p,
      .nosPropEmptyState p {
        color: #697386;
        line-height: 1.5;
      }

      .nosPropPrimaryLink {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        margin-top: 8px;
        padding: 10px 18px;
        border-radius: 9px;
        background: #172033;
        color: #ffffff;
        text-decoration: none;
        font-weight: 800;
      }

      .nosPropEmptyIcon {
        font-size: 36px;
      }

      @media (max-width: 1100px) {
        .nosPropPropertyGrid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .nosPropCheckboxGrid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      @media (max-width: 768px) {
        .nosPropHeader {
          padding: 13px 18px;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .nosPropHeaderRight {
          width: 100%;
          justify-content: space-between;
          border-top: 1px solid #edf0f4;
          padding-top: 11px;
        }

        .nosPropProfile {
          text-align: left;
        }

        .nosPropContent {
          width: calc(100% - 28px);
          padding-top: 22px;
        }

        .nosPropPageHeading h1 {
          font-size: 26px;
        }

        .nosPropMainTabs {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr 1fr;
        }

        .nosPropMainTab {
          padding-left: 8px;
          padding-right: 8px;
          font-size: 13px;
        }

        .nosPropPropertyGrid {
          grid-template-columns: 1fr;
        }

        .nosPropListHeading {
          align-items: flex-end;
        }

        .nosPropManageHeader {
          align-items: flex-start;
          flex-direction: column;
        }

        .nosPropPreviewTop {
          width: 100%;
        }

        .nosPropManageTitleRow {
          justify-content: space-between;
        }

        .nosPropManagerPanel,
        .nosPropFormSection {
          padding: 17px;
          border-radius: 12px;
        }

        .nosPropFormGrid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .nosPropCheckboxGrid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .nosPropSaveButton {
          width: 100%;
        }
      }

      @media (max-width: 520px) {
        .nosPropBrand {
          font-size: 20px;
        }

        .nosPropContent {
          width: calc(100% - 20px);
        }

        .nosPropListHeading {
          align-items: stretch;
          flex-direction: column;
        }

        .nosPropAddButton {
          width: 100%;
        }

        .nosPropPropertyCard {
          padding: 16px;
        }

        .nosPropCardTop {
          gap: 8px;
        }

        .nosPropCardInfo {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .nosPropCardActions {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .nosPropFormGrid {
          grid-template-columns: 1fr;
        }

        .nosPropCheckboxGrid {
          grid-template-columns: 1fr;
        }

        .nosPropFullWidth,
        .nosPropInfoBox {
          grid-column: 1;
        }

        .nosPropManageTitleRow {
          flex-direction: column;
        }

        .nosPropManageTabsWrap {
          margin-left: -10px;
          margin-right: -10px;
          padding: 0 10px;
        }

        .nosPropEditorTitle h2,
        .nosPropManageTitleRow h2 {
          font-size: 22px;
        }
      }

      @media (max-width: 360px) {
        .nosPropCardActions {
          grid-template-columns: 1fr;
        }

        .nosPropMainTabs {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  );
}