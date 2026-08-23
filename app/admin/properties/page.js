'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

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

  features: '',
  amenities: '',
  house_rules: '',
  kitchen_features: '',
  direction_instructions: '',

  fridge_available: false,
  tv_available: false,
  washing_machine_available: false,
  ac_available: false,
  ac_count: 0,

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

  is_active: true,
};

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function arrayToText(value) {
  if (!Array.isArray(value)) return '';
  return value.join(', ');
}

function textToArray(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AdminPropertiesPage() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [adminProfile, setAdminProfile] = useState(null);

  const [properties, setProperties] = useState([]);
  const [form, setForm] = useState(emptyForm);

  const [saving, setSaving] = useState(false);
  const [loadingProperties, setLoadingProperties] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    async function start() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);
      setCheckingSession(false);

      if (session) {
        await verifyAdmin(session.user.id);
      }
    }

    start();
  }, []);

  async function verifyAdmin(userId) {
    const { data, error } = await supabase
      .from('admin_profiles')
      .select('user_id, full_name, role, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      setAdminProfile(null);
      setErrorMessage(
        'This login does not have permission to manage properties.'
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
      .order('created_at', { ascending: false });

    setLoadingProperties(false);

    if (error) {
      console.error(error);
      setErrorMessage('Unable to load properties.');
      return;
    }

    setProperties(data || []);
  }

  function updateField(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setSuccessMessage('');
    setErrorMessage('');
  }

  function newProperty() {
    setForm(emptyForm);
    setErrorMessage('');
    setSuccessMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function editProperty(property) {
    setForm({
      ...emptyForm,
      ...property,

      features: arrayToText(property.features),
      amenities: arrayToText(property.amenities),
      house_rules: arrayToText(property.house_rules),
      kitchen_features: arrayToText(
        property.kitchen_features
      ),

      check_in_time:
        property.check_in_time?.slice(0, 5) || '14:00',

      check_out_time:
        property.check_out_time?.slice(0, 5) || '11:00',

      quiet_hours_start:
        property.quiet_hours_start?.slice(0, 5) ||
        '22:00',

      quiet_hours_end:
        property.quiet_hours_end?.slice(0, 5) ||
        '07:00',
    });

    setSuccessMessage('');
    setErrorMessage('');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveProperty(event) {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    if (!form.name.trim()) {
      setErrorMessage('Property name is required.');
      return;
    }

    if (!form.location_name.trim()) {
      setErrorMessage('Property location is required.');
      return;
    }

    if (Number(form.base_price) < 0) {
      setErrorMessage('Base price cannot be negative.');
      return;
    }

    if (
      Number(form.min_guests) >
      Number(form.max_guests)
    ) {
      setErrorMessage(
        'Minimum guests cannot be greater than maximum guests.'
      );
      return;
    }

    if (
      Number(form.included_guests) >
      Number(form.max_guests)
    ) {
      setErrorMessage(
        'Included guests cannot exceed maximum guests.'
      );
      return;
    }

    if (
      Number(form.min_stay_nights) >
      Number(form.max_stay_nights)
    ) {
      setErrorMessage(
        'Minimum stay cannot be greater than maximum stay.'
      );
      return;
    }

    const slug =
      form.slug.trim() || slugify(form.name);

    const payload = {
      name: form.name.trim(),
      slug,

      short_description:
        form.short_description.trim(),

      description: form.description.trim(),

      location_name: form.location_name.trim(),
      address: form.address.trim(),

      google_maps_url:
        form.google_maps_url.trim(),

      bedrooms: Number(form.bedrooms),
      bathrooms: Number(form.bathrooms),

      min_guests: Number(form.min_guests),
      included_guests: Number(
        form.included_guests
      ),
      max_guests: Number(form.max_guests),

      base_price: Number(form.base_price),

      extra_guest_fee: Number(
        form.extra_guest_fee
      ),

      cleaning_fee: Number(form.cleaning_fee),

      security_deposit: Number(
        form.security_deposit
      ),

      min_stay_nights: Number(
        form.min_stay_nights
      ),

      max_stay_nights: Number(
        form.max_stay_nights
      ),

      check_in_time: form.check_in_time,
      check_out_time: form.check_out_time,

      late_checkout_hourly_fee: Number(
        form.late_checkout_hourly_fee
      ),

      features: textToArray(form.features),
      amenities: textToArray(form.amenities),

      house_rules: textToArray(
        form.house_rules
      ),

      kitchen_features: textToArray(
        form.kitchen_features
      ),

      direction_instructions:
        form.direction_instructions.trim(),

      fridge_available:
        form.fridge_available,

      tv_available:
        form.tv_available,

      washing_machine_available:
        form.washing_machine_available,

      ac_available:
        form.ac_available,

      ac_count: form.ac_available
        ? Number(form.ac_count)
        : 0,

      pets_allowed:
        form.pets_allowed,

      parties_allowed:
        form.parties_allowed,

      couples_allowed:
        form.couples_allowed,

      alcohol_allowed:
        form.alcohol_allowed,

      smoking_allowed:
        form.smoking_allowed,

      quiet_hours_enabled:
        form.quiet_hours_enabled,

      quiet_hours_start:
        form.quiet_hours_enabled
          ? form.quiet_hours_start
          : null,

      quiet_hours_end:
        form.quiet_hours_enabled
          ? form.quiet_hours_end
          : null,

      dynamic_pricing_enabled:
        form.dynamic_pricing_enabled,

      weekend_markup_percent: Number(
        form.weekend_markup_percent
      ),

      long_weekend_markup_percent: Number(
        form.long_weekend_markup_percent
      ),

      festival_markup_percent: Number(
        form.festival_markup_percent
      ),

      season_markup_percent: Number(
        form.season_markup_percent
      ),

      is_active: form.is_active,

      updated_at: new Date().toISOString(),
    };

    setSaving(true);

    let result;

    if (form.id) {
      result = await supabase
        .from('properties')
        .update(payload)
        .eq('id', form.id);
    } else {
      result = await supabase
        .from('properties')
        .insert(payload);
    }

    setSaving(false);

    if (result.error) {
      console.error(result.error);

      if (
        result.error.message?.includes('slug')
      ) {
        setErrorMessage(
          'A property with this URL slug already exists.'
        );
      } else {
        setErrorMessage(
          'Unable to save property.'
        );
      }

      return;
    }

    setSuccessMessage(
      form.id
        ? 'Property updated successfully.'
        : 'Property created successfully.'
    );

    await loadProperties();

    if (!form.id) {
      setForm(emptyForm);
    }
  }

  async function toggleProperty(property) {
    const { error } = await supabase
      .from('properties')
      .update({
        is_active: !property.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', property.id);

    if (error) {
      setErrorMessage(
        'Unable to change property status.'
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

  if (checkingSession) {
    return (
      <main style={styles.page}>
        Loading property management...
      </main>
    );
  }

  if (!session || !adminProfile) {
    return (
      <main style={styles.page}>
        <div style={styles.notice}>
          <h2>Admin login required</h2>

          <p>
            Please log in before managing
            properties.
          </p>

          <a
            href="/admin/bookings"
            style={styles.primaryLink}
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
            NightOutStay
          </div>

          <div style={styles.muted}>
            Host Property Management
          </div>
        </div>

        <div style={styles.navigation}>
          <a
            href="/admin/bookings"
            style={styles.nav}
          >
            Bookings
          </a>

          <a
            href="/admin/offers"
            style={styles.nav}
          >
            Offers
          </a>

          <a
            href="/admin/properties"
            style={styles.activeNav}
          >
            Properties
          </a>

          <button
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
            <h1>
              {form.id
                ? 'Edit Property'
                : 'Add Property'}
            </h1>

            <p style={styles.muted}>
              Pricing, guest limits, amenities,
              rules and property settings can
              be changed anytime.
            </p>
          </div>

          {form.id && (
            <button
              onClick={newProperty}
              style={styles.secondaryButton}
            >
              + Add New Property
            </button>
          )}
        </div>

        <form onSubmit={saveProperty}>
          <Section title="Basic Information">
            <Field
              label="PROPERTY NAME"
              value={form.name}
              onChange={(value) =>
                updateField('name', value)
              }
            />

            <Field
              label="LOCATION"
              value={form.location_name}
              onChange={(value) =>
                updateField(
                  'location_name',
                  value
                )
              }
            />

            <Field
              label="FULL ADDRESS"
              value={form.address}
              onChange={(value) =>
                updateField('address', value)
              }
            />

            <Field
              label="GOOGLE MAPS LINK"
              value={form.google_maps_url}
              onChange={(value) =>
                updateField(
                  'google_maps_url',
                  value
                )
              }
            />

            <TextArea
              label="SHORT DESCRIPTION"
              value={form.short_description}
              onChange={(value) =>
                updateField(
                  'short_description',
                  value
                )
              }
            />

            <TextArea
              label="FULL DESCRIPTION"
              value={form.description}
              onChange={(value) =>
                updateField(
                  'description',
                  value
                )
              }
            />
          </Section>

          <Section title="Rooms & Guest Capacity">
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
              value={form.bathrooms}
              onChange={(value) =>
                updateField(
                  'bathrooms',
                  value
                )
              }
            />

            <NumberField
              label="MINIMUM GUESTS"
              value={form.min_guests}
              onChange={(value) =>
                updateField(
                  'min_guests',
                  value
                )
              }
            />

            <NumberField
              label="GUESTS INCLUDED IN BASE PRICE"
              value={form.included_guests}
              onChange={(value) =>
                updateField(
                  'included_guests',
                  value
                )
              }
            />

            <NumberField
              label="MAXIMUM GUESTS"
              value={form.max_guests}
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
              value={form.base_price}
              onChange={(value) =>
                updateField(
                  'base_price',
                  value
                )
              }
            />

            <NumberField
              label="EXTRA GUEST FEE ₹ / PERSON / NIGHT"
              value={form.extra_guest_fee}
              onChange={(value) =>
                updateField(
                  'extra_guest_fee',
                  value
                )
              }
            />

            <NumberField
              label="CLEANING FEE ₹"
              value={form.cleaning_fee}
              onChange={(value) =>
                updateField(
                  'cleaning_fee',
                  value
                )
              }
            />

            <NumberField
              label="SECURITY DEPOSIT ₹"
              value={form.security_deposit}
              onChange={(value) =>
                updateField(
                  'security_deposit',
                  value
                )
              }
            />

            <div style={styles.example}>
              Example: ₹
              {Number(
                form.base_price || 0
              ).toLocaleString('en-IN')}
              {' '}includes up to{' '}
              {form.included_guests} guests.
              Each extra guest costs ₹
              {Number(
                form.extra_guest_fee || 0
              ).toLocaleString('en-IN')}
              {' '}per night.
            </div>
          </Section>

          <Section title="Stay Duration & Timing">
            <NumberField
              label="MINIMUM STAY NIGHTS"
              value={form.min_stay_nights}
              onChange={(value) =>
                updateField(
                  'min_stay_nights',
                  value
                )
              }
            />

            <NumberField
              label="MAXIMUM STAY NIGHTS"
              value={form.max_stay_nights}
              onChange={(value) =>
                updateField(
                  'max_stay_nights',
                  value
                )
              }
            />

            <TimeField
              label="CHECK-IN TIME"
              value={form.check_in_time}
              onChange={(value) =>
                updateField(
                  'check_in_time',
                  value
                )
              }
            />

            <TimeField
              label="CHECK-OUT TIME"
              value={form.check_out_time}
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

          <Section title="Features & Amenities">
            <TextArea
              label="FEATURES — separate with commas"
              value={form.features}
              onChange={(value) =>
                updateField(
                  'features',
                  value
                )
              }
              placeholder="Garden, mountain view, balcony"
            />

            <TextArea
              label="AMENITIES — separate with commas"
              value={form.amenities}
              onChange={(value) =>
                updateField(
                  'amenities',
                  value
                )
              }
              placeholder="Free parking, Wi-Fi, hot water"
            />

            <TextArea
              label="KITCHEN FEATURES — separate with commas"
              value={form.kitchen_features}
              onChange={(value) =>
                updateField(
                  'kitchen_features',
                  value
                )
              }
              placeholder="Gas stove, utensils, kettle"
            />

            <Toggle
              label="Fridge Available"
              checked={form.fridge_available}
              onChange={(value) =>
                updateField(
                  'fridge_available',
                  value
                )
              }
            />

            <Toggle
              label="TV Available"
              checked={form.tv_available}
              onChange={(value) =>
                updateField(
                  'tv_available',
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
              label="AC Available"
              checked={form.ac_available}
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
                value={form.ac_count}
                onChange={(value) =>
                  updateField(
                    'ac_count',
                    value
                  )
                }
              />
            )}
          </Section>

          <Section title="House Rules">
            <Toggle
              label="Pets Allowed"
              checked={form.pets_allowed}
              onChange={(value) =>
                updateField(
                  'pets_allowed',
                  value
                )
              }
            />

            <Toggle
              label="Party Allowed"
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

            <TextArea
              label="HOUSE RULES — separate with commas"
              value={form.house_rules}
              onChange={(value) =>
                updateField(
                  'house_rules',
                  value
                )
              }
              placeholder="No loud music after 10 PM, keep property clean"
            />
          </Section>

          <Section title="Noise / Quiet Hours">
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
                  label="QUIET HOURS START"
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
                  label="QUIET HOURS END"
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
          </Section>

          <Section title="Directions">
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
              placeholder="Landmarks, gate instructions, parking directions..."
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
              checked={form.is_active}
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

        <hr style={styles.separator} />

        <div style={styles.topRow}>
          <div>
            <h1>Existing Properties</h1>

            <p style={styles.muted}>
              Select any property to edit its
              details anytime.
            </p>
          </div>

          <button
            onClick={newProperty}
            style={styles.secondaryButton}
          >
            + Add Property
          </button>
        </div>

        {loadingProperties ? (
          <p>Loading...</p>
        ) : (
          <div style={styles.propertyGrid}>
            {properties.map((property) => (
              <div
                key={property.id}
                style={styles.propertyCard}
              >
                <div style={styles.cardTop}>
                  <div>
                    <h3 style={styles.cardTitle}>
                      {property.name}
                    </h3>

                    <div style={styles.muted}>
                      {property.location_name}
                    </div>
                  </div>

                  <span
                    style={{
                      ...styles.status,
                      background:
                        property.is_active
                          ? '#e7f7ec'
                          : '#eeeeee',
                    }}
                  >
                    {property.is_active
                      ? 'Active'
                      : 'Inactive'}
                  </span>
                </div>

                <div style={styles.cardInfo}>
                  ₹
                  {Number(
                    property.base_price
                  ).toLocaleString('en-IN')}
                  {' '}/ night
                </div>

                <div style={styles.small}>
                  Up to {property.max_guests}{' '}
                  guests
                </div>

                <div style={styles.cardButtons}>
                  <button
                    onClick={() =>
                      editProperty(property)
                    }
                    style={styles.editButton}
                  >
                    Edit Property
                  </button>

                  <button
                    onClick={() =>
                      toggleProperty(property)
                    }
                    style={styles.statusButton}
                  >
                    {property.is_active
                      ? 'Deactivate'
                      : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>
        {title}
      </h2>

      <div style={styles.formGrid}>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder = '',
}) {
  return (
    <div>
      <label style={styles.label}>
        {label}
      </label>

      <input
        style={styles.input}
        value={value || ''}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}) {
  return (
    <div>
      <label style={styles.label}>
        {label}
      </label>

      <input
        style={styles.input}
        type="number"
        min="0"
        step="0.01"
        value={value ?? 0}
        onChange={(event) =>
          onChange(event.target.value)
        }
      />
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
}) {
  return (
    <div>
      <label style={styles.label}>
        {label}
      </label>

      <input
        style={styles.input}
        type="time"
        value={value || ''}
        onChange={(event) =>
          onChange(event.target.value)
        }
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder = '',
}) {
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <label style={styles.label}>
        {label}
      </label>

      <textarea
        style={styles.textarea}
        value={value || ''}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
      />
    </div>
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
        checked={Boolean(checked)}
        onChange={(event) =>
          onChange(event.target.checked)
        }
      />

      <span>{label}</span>
    </label>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f6f7f9',
    color: '#172033',
    fontFamily: 'Arial, sans-serif',
  },

  header: {
    background: '#ffffff',
    padding: '18px 5vw',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e5e5e5',
    flexWrap: 'wrap',
    gap: '14px',
  },

  brand: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#163c74',
  },

  navigation: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },

  nav: {
    padding: '9px 13px',
    textDecoration: 'none',
    color: '#163c74',
  },

  activeNav: {
    padding: '9px 14px',
    background: '#163c74',
    color: '#ffffff',
    borderRadius: '20px',
    textDecoration: 'none',
  },

  logout: {
    padding: '9px 14px',
    border: '1px solid #ddd',
    background: '#fff',
    borderRadius: '20px',
    cursor: 'pointer',
  },

  content: {
    maxWidth: '1350px',
    margin: 'auto',
    padding: '35px 5vw 80px',
  },

  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    flexWrap: 'wrap',
  },

  muted: {
    color: '#687080',
  },

  section: {
    background: '#ffffff',
    border: '1px solid #e3e5e9',
    borderRadius: '16px',
    padding: '24px',
    marginTop: '22px',
  },

  sectionTitle: {
    marginTop: 0,
    marginBottom: '20px',
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(230px, 1fr))',
    gap: '18px',
  },

  label: {
    display: 'block',
    fontSize: '10px',
    fontWeight: '800',
    letterSpacing: '1px',
    marginBottom: '6px',
  },

  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #d4d7dc',
    borderRadius: '10px',
    background: '#ffffff',
  },

  textarea: {
    width: '100%',
    minHeight: '90px',
    padding: '12px',
    border: '1px solid #d4d7dc',
    borderRadius: '10px',
    resize: 'vertical',
  },

  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px',
    border: '1px solid #e1e3e7',
    borderRadius: '10px',
    background: '#fafafa',
    cursor: 'pointer',
  },

  example: {
    gridColumn: '1 / -1',
    padding: '14px',
    borderRadius: '10px',
    background: '#fff8e8',
    fontWeight: '700',
  },

  saveButton: {
    width: '100%',
    padding: '16px',
    marginTop: '25px',
    border: 0,
    borderRadius: '12px',
    background: '#163c74',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '800',
    cursor: 'pointer',
  },

  secondaryButton: {
    padding: '11px 17px',
    borderRadius: '10px',
    border: '1px solid #163c74',
    background: '#ffffff',
    color: '#163c74',
    fontWeight: '700',
    cursor: 'pointer',
  },

  error: {
    marginTop: '20px',
    padding: '14px',
    borderRadius: '10px',
    background: '#ffecec',
    color: '#8b2020',
    fontWeight: '700',
  },

  success: {
    marginTop: '20px',
    padding: '14px',
    borderRadius: '10px',
    background: '#edf9f0',
    color: '#25663a',
    fontWeight: '700',
  },

  separator: {
    margin: '55px 0 30px',
    border: 0,
    borderTop: '1px solid #ddd',
  },

  propertyGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
    marginTop: '20px',
  },

  propertyCard: {
    background: '#ffffff',
    border: '1px solid #e2e4e8',
    borderRadius: '16px',
    padding: '20px',
  },

  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '15px',
  },

  cardTitle: {
    margin: 0,
  },

  status: {
    padding: '6px 10px',
    height: 'fit-content',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '800',
  },

  cardInfo: {
    marginTop: '20px',
    fontSize: '21px',
    fontWeight: '800',
    color: '#163c74',
  },

  small: {
    fontSize: '13px',
    color: '#666',
    marginTop: '6px',
  },

  cardButtons: {
    display: 'flex',
    gap: '10px',
    marginTop: '20px',
  },

  editButton: {
    flex: 1,
    padding: '10px',
    border: 0,
    borderRadius: '10px',
    background: '#163c74',
    color: '#fff',
    fontWeight: '700',
    cursor: 'pointer',
  },

  statusButton: {
    padding: '10px',
    border: '1px solid #ccc',
    borderRadius: '10px',
    background: '#ffffff',
    cursor: 'pointer',
  },

  notice: {
    maxWidth: '450px',
    margin: '80px auto',
    background: '#ffffff',
    padding: '30px',
    borderRadius: '16px',
  },

  primaryLink: {
    display: 'inline-block',
    marginTop: '15px',
    padding: '11px 16px',
    background: '#163c74',
    color: '#ffffff',
    borderRadius: '10px',
    textDecoration: 'none',
  },
};