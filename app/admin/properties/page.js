'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import PropertyPhotoManager from './PropertyPhotoManager';

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

function getFileExtension(filename) {
  const parts = filename.split('.');

  if (parts.length < 2) return 'jpg';

  return parts.pop().toLowerCase();
}

export default function AdminPropertiesPage() {
  const [checkingSession, setCheckingSession] =
    useState(true);

  const [session, setSession] = useState(null);

  const [adminProfile, setAdminProfile] =
    useState(null);

  const [properties, setProperties] =
    useState([]);

  const [form, setForm] =
    useState(emptyForm);

  const [existingPhotos, setExistingPhotos] =
    useState([]);

  const [selectedFiles, setSelectedFiles] =
    useState([]);

  const [previewUrls, setPreviewUrls] =
    useState([]);

  const [saving, setSaving] =
    useState(false);

  const [uploadingPhotos, setUploadingPhotos] =
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

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) =>
        URL.revokeObjectURL(url)
      );
    };
  }, [previewUrls]);

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
      console.error(error);

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
      console.error(error);

      setErrorMessage(
        `Unable to load properties: ${error.message}`
      );

      return;
    }

    setProperties(data || []);
  }

  async function loadPropertyPhotos(propertyId) {
    const { data, error } = await supabase
      .from('property_photos')
      .select('*')
      .eq('property_id', propertyId)
      .order('is_cover', {
        ascending: false,
      })
      .order('sort_order', {
        ascending: true,
      });

    if (error) {
      console.error(error);

      setErrorMessage(
        `Unable to load property photos: ${error.message}`
      );

      return;
    }

    setExistingPhotos(data || []);
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

  function resetPhotoSelection() {
    previewUrls.forEach((url) =>
      URL.revokeObjectURL(url)
    );

    setSelectedFiles([]);
    setPreviewUrls([]);
  }

  function newProperty() {
    resetPhotoSelection();

    setForm(emptyForm);
    setExistingPhotos([]);

    setErrorMessage('');
    setSuccessMessage('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function editProperty(property) {
    resetPhotoSelection();

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

    await loadPropertyPhotos(property.id);

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function handlePhotoSelection(event) {
    const files =
      Array.from(event.target.files || []);

    if (!files.length) {
      return;
    }

    const invalidFile =
      files.find(
        (file) =>
          !file.type.startsWith('image/')
      );

    if (invalidFile) {
      setErrorMessage(
        'Please select image files only.'
      );

      return;
    }

    const oversized =
      files.find(
        (file) =>
          file.size >
          10 * 1024 * 1024
      );

    if (oversized) {
      setErrorMessage(
        'Each property photo must be below 10 MB.'
      );

      return;
    }

    resetPhotoSelection();

    setSelectedFiles(files);

    setPreviewUrls(
      files.map((file) =>
        URL.createObjectURL(file)
      )
    );
  }

  async function uploadSelectedPhotos(
    propertyId,
    existingPhotoCount = 0
  ) {
    if (!selectedFiles.length) {
      return true;
    }

    setUploadingPhotos(true);

    try {
      const hasCover =
        existingPhotos.some(
          (photo) => photo.is_cover
        );

      for (
        let index = 0;
        index < selectedFiles.length;
        index += 1
      ) {
        const file =
          selectedFiles[index];

        const extension =
          getFileExtension(file.name);

        const uniqueName =
          `${Date.now()}-${index}-${crypto.randomUUID()}.${extension}`;

        const storagePath =
          `${propertyId}/${uniqueName}`;

        const {
          error: uploadError,
        } = await supabase.storage
          .from('property-photos')
          .upload(
            storagePath,
            file,
            {
              cacheControl: '3600',
              upsert: false,
            }
          );

        if (uploadError) {
          throw new Error(
            `Photo upload failed: ${uploadError.message}`
          );
        }

        const {
          data: publicData,
        } = supabase.storage
          .from('property-photos')
          .getPublicUrl(storagePath);

        const shouldBeCover =
          !hasCover &&
          existingPhotoCount === 0 &&
          index === 0;

        const {
          error: photoRowError,
        } = await supabase
          .from('property_photos')
          .insert({
            property_id:
              propertyId,

            image_url:
              publicData.publicUrl,

            alt_text:
              form.name,

            sort_order:
              existingPhotoCount +
              index,

            is_cover:
              shouldBeCover,
          });

        if (photoRowError) {
          await supabase.storage
            .from('property-photos')
            .remove([
              storagePath,
            ]);

          throw new Error(
            `Photo database save failed: ${photoRowError.message}`
          );
        }
      }

      resetPhotoSelection();

      await loadPropertyPhotos(
        propertyId
      );

      return true;
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error.message ||
          'Unable to upload property photos.'
      );

      return false;
    } finally {
      setUploadingPhotos(false);
    }
  }

  async function setCoverPhoto(photo) {
    if (!form.id) {
      return;
    }

    setErrorMessage('');

    const {
      error: clearError,
    } = await supabase
      .from('property_photos')
      .update({
        is_cover: false,
      })
      .eq(
        'property_id',
        form.id
      );

    if (clearError) {
      setErrorMessage(
        `Unable to change cover photo: ${clearError.message}`
      );

      return;
    }

    const {
      error: setError,
    } = await supabase
      .from('property_photos')
      .update({
        is_cover: true,
      })
      .eq('id', photo.id);

    if (setError) {
      setErrorMessage(
        `Unable to change cover photo: ${setError.message}`
      );

      return;
    }

    await loadPropertyPhotos(
      form.id
    );

    setSuccessMessage(
      'Main / display photo updated.'
    );
  }

  function getStoragePathFromPublicUrl(
    imageUrl
  ) {
    const marker =
      '/storage/v1/object/public/property-photos/';

    const position =
      imageUrl.indexOf(marker);

    if (position === -1) {
      return null;
    }

    return decodeURIComponent(
      imageUrl.substring(
        position +
          marker.length
      )
    );
  }

  async function deletePhoto(photo) {
    const confirmed =
      window.confirm(
        'Delete this property photo?'
      );

    if (!confirmed) {
      return;
    }

    setErrorMessage('');

    const storagePath =
      getStoragePathFromPublicUrl(
        photo.image_url
      );

    const {
      error: databaseError,
    } = await supabase
      .from('property_photos')
      .delete()
      .eq('id', photo.id);

    if (databaseError) {
      setErrorMessage(
        `Unable to delete photo: ${databaseError.message}`
      );

      return;
    }

    if (storagePath) {
      await supabase.storage
        .from('property-photos')
        .remove([storagePath]);
    }

    await loadPropertyPhotos(
      form.id
    );

    if (
      photo.is_cover
    ) {
      const {
        data: remaining,
      } = await supabase
        .from('property_photos')
        .select('id')
        .eq(
          'property_id',
          form.id
        )
        .order(
          'sort_order',
          {
            ascending: true,
          }
        )
        .limit(1);

      if (
        remaining?.length
      ) {
        await supabase
          .from('property_photos')
          .update({
            is_cover: true,
          })
          .eq(
            'id',
            remaining[0].id
          );

        await loadPropertyPhotos(
          form.id
        );
      }
    }

    setSuccessMessage(
      'Photo deleted.'
    );
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

    if (
      !form.location_name.trim()
    ) {
      setErrorMessage(
        'Location is required.'
      );

      return;
    }

    const minGuests =
      toNumber(
        form.min_guests,
        1
      );

    const includedGuests =
      toNumber(
        form.included_guests,
        1
      );

    const maxGuests =
      toNumber(
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
      slugify(
        form.name
      );

    const houseRules =
      String(
        form.house_rules_text ||
          ''
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
      !featureList.includes(
        'Wi-Fi'
      )
    ) {
      featureList.push(
        'Wi-Fi'
      );
    }

    if (
      form.tv_available &&
      !featureList.includes(
        'TV'
      )
    ) {
      featureList.push(
        'TV'
      );
    }

    if (
      form.fridge_available &&
      !featureList.includes(
        'Fridge'
      )
    ) {
      featureList.push(
        'Fridge'
      );
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

      const photoSuccess =
        await uploadSelectedPhotos(
          propertyId,
          existingPhotos.length
        );

      if (!photoSuccess) {
        setSaving(false);

        return;
      }

      await loadProperties();

      setSuccessMessage(
        form.id
          ? 'Property updated successfully.'
          : 'Property created successfully.'
      );

      if (form.id) {
        await loadPropertyPhotos(
          propertyId
        );
      } else {
        setForm(
          emptyForm
        );

        setExistingPhotos([]);
      }
    } catch (error) {
      console.error(error);

      const message =
        error?.message ||
        'Unknown property save error';

      setErrorMessage(
        `Unable to save property: ${message}`
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleProperty(
    property
  ) {
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
              Manage property information, pricing, guest capacity, facilities, rules and photos.
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
              placeholder="Girivan, Lonavala, Bavdhan..."
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
              Example: ₹
              {toNumber(
                form.base_price
              ).toLocaleString(
                'en-IN'
              )}{' '}
              includes up to{' '}
              <strong>
                {form.included_guests}
              </strong>{' '}
              guests. Every additional guest costs ₹
              {toNumber(
                form.extra_guest_fee
              ).toLocaleString(
                'en-IN'
              )}{' '}
              per night.
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
              placeholder={
                'No loud music after 10 PM\nPlease keep property clean\nNo unauthorized guests'
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
              placeholder="Landmarks, gate number, parking instructions, caretaker details..."
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

          <Section title="Property Photos">
            <div style={styles.fullWidth}>
              <label style={styles.label}>
                UPLOAD PROPERTY PHOTOS
              </label>

              <input
                type="file"
                accept="image/*"
                multiple
                onChange={
                  handlePhotoSelection
                }
                style={
                  styles.fileInput
                }
              />

              <p style={styles.helpText}>
                You can select multiple photos together. Maximum 10 MB per image.
              </p>

              {previewUrls.length >
                0 && (
                <>
                  <h3>
                    New Photos
                  </h3>

                  <div style={styles.photoGrid}>
                    {previewUrls.map(
                      (
                        url,
                        index
                      ) => (
                        <div
                          key={url}
                          style={
                            styles.photoCard
                          }
                        >
                          <img
                            src={
                              url
                            }
                            alt={`New property photo ${
                              index +
                              1
                            }`}
                            style={
                              styles.photoImage
                            }
                          />

                          {index ===
                            0 &&
                            existingPhotos.length ===
                              0 && (
                              <div
                                style={
                                  styles.coverBadge
                                }
                              >
                                Will become Main Photo
                              </div>
                            )}
                        </div>
                      )
                    )}
                  </div>
                </>
              )}

              {form.id &&
                existingPhotos.length >
                  0 && (
                  <>
                    <h3 style={{ marginTop: 28 }}>
                      Current Property Photos
                    </h3>

                    <p style={styles.helpText}>
                      The Main Photo is used as the property display/cover image.
                    </p>

                    <div style={styles.photoGrid}>
                      {existingPhotos.map(
                        (
                          photo
                        ) => (
                          <div
                            key={
                              photo.id
                            }
                            style={
                              styles.photoCard
                            }
                          >
                            <img
                              src={
                                photo.image_url
                              }
                              alt={
                                photo.alt_text ||
                                form.name
                              }
                              style={
                                styles.photoImage
                              }
                            />

                            {photo.is_cover && (
                              <div
                                style={
                                  styles.coverBadge
                                }
                              >
                                MAIN / DISPLAY PHOTO
                              </div>
                            )}

                            <div
                              style={
                                styles.photoActions
                              }
                            >
                              {!photo.is_cover && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCoverPhoto(
                                      photo
                                    )
                                  }
                                  style={
                                    styles.coverButton
                                  }
                                >
                                  Make Main Photo
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  deletePhoto(
                                    photo
                                  )
                                }
                                style={
                                  styles.deletePhotoButton
                                }
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </>
                )}
            </div>
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
            disabled={
              saving ||
              uploadingPhotos
            }
            style={styles.saveButton}
          >
            {saving
              ? 'Saving Property...'
              : uploadingPhotos
              ? 'Uploading Photos...'
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

        <hr style={styles.separator} />

        <div style={styles.topRow}>
          <div>
            <h1>
              Existing Properties
            </h1>

            <p style={styles.muted}>
              Select a property to edit pricing, rules, photos or facilities.
            </p>
          </div>

          <button
            type="button"
            onClick={
              newProperty
            }
            style={
              styles.secondaryButton
            }
          >
            + Add Property
          </button>
        </div>

        {loadingProperties ? (
          <p>
            Loading properties...
          </p>
        ) : properties.length ===
          0 ? (
          <div style={styles.empty}>
            No properties found.
          </div>
        ) : (
          <div
            style={
              styles.propertyGrid
            }
          >
            {properties.map(
              (
                property
              ) => (
                <div
                  key={
                    property.id
                  }
                  style={
                    styles.propertyCard
                  }
                >
                  <div style={styles.cardTop}>
                    <div>
                      <h3
                        style={
                          styles.cardTitle
                        }
                      >
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
                      }}
                    >
                      {property.is_active
                        ? 'Active'
                        : 'Inactive'}
                    </span>
                  </div>

                  <div style={styles.cardPrice}>
                    ₹
                    {toNumber(
                      property.base_price
                    ).toLocaleString(
                      'en-IN'
                    )}
                    {' / night'}
                  </div>

                  <div style={styles.small}>
                    Base rate includes{' '}
                    {
                      property.included_guests
                    }{' '}
                    guest
                    {property.included_guests !==
                    1
                      ? 's'
                      : ''}
                  </div>

                  <div style={styles.small}>
                    Maximum{' '}
                    {
                      property.max_guests
                    }{' '}
                    guests
                  </div>

                  {toNumber(
                    property.extra_guest_fee
                  ) >
                    0 && (
                    <div style={styles.small}>
                      Extra guest ₹
                      {toNumber(
                        property.extra_guest_fee
                      ).toLocaleString(
                        'en-IN'
                      )}{' '}
                      / night
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
                  </div>
                </div>
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
        type="text"
        value={value || ''}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(
            event.target.value
          )
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
        value={
          value ?? 0
        }
        onChange={(event) =>
          onChange(
            event.target.value
          )
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
          onChange(
            event.target.value
          )
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
    <div style={styles.fullWidth}>
      <label style={styles.label}>
        {label}
      </label>

      <textarea
        style={styles.textarea}
        value={value || ''}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(
            event.target.value
          )
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
        {items.map((item) => (
          <label
            key={item}
            style={
              styles.checkboxItem
            }
          >
            <input
              type="checkbox"
              checked={
                selected.includes(
                  item
                )
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
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f6f7f9',
    color: '#172033',
    fontFamily:
      'Arial, sans-serif',
  },

  loading: {
    padding: 40,
  },

  header: {
    background: '#ffffff',
    padding: '18px 5vw',
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'center',
    gap: 15,
    borderBottom:
      '1px solid #e4e6e9',
  },

  brand: {
    fontSize: 24,
    fontWeight: 800,
    color: '#163c74',
  },

  logout: {
    border:
      '1px solid #ddd',
    background: '#fff',
    borderRadius: 20,
    padding: '9px 15px',
    cursor: 'pointer',
  },

  content: {
    maxWidth: 1400,
    margin: 'auto',
    padding:
      '35px 5vw 80px',
  },

  topRow: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 20,
  },

  muted: {
    color: '#687080',
  },

  section: {
    marginTop: 22,
    background: '#ffffff',
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
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(230px, 1fr))',
    gap: 18,
  },

  fullWidth: {
    gridColumn:
      '1 / -1',
  },

  label: {
    display: 'block',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 1,
    marginBottom: 6,
  },

  input: {
    width: '100%',
    boxSizing:
      'border-box',
    padding: 12,
    border:
      '1px solid #ccd1d7',
    borderRadius: 10,
    background: '#fff',
  },

  textarea: {
    width: '100%',
    boxSizing:
      'border-box',
    minHeight: 100,
    padding: 12,
    border:
      '1px solid #ccd1d7',
    borderRadius: 10,
    resize: 'vertical',
  },

  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: 13,
    border:
      '1px solid #e0e3e7',
    borderRadius: 10,
    background: '#fafafa',
    cursor: 'pointer',
  },

  checkboxGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 10,
  },

  checkboxItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    padding: 11,
    border:
      '1px solid #e0e3e7',
    borderRadius: 10,
    background: '#fafafa',
    cursor: 'pointer',
  },

  infoBox: {
    gridColumn:
      '1 / -1',
    padding: 14,
    background: '#fff7e5',
    borderRadius: 10,
    fontWeight: 700,
  },

  fileInput: {
    display: 'block',
    marginTop: 8,
    padding: 12,
    border:
      '1px dashed #9ba4af',
    borderRadius: 10,
    width: '100%',
    boxSizing:
      'border-box',
  },

  helpText: {
    fontSize: 13,
    color: '#69717f',
  },

  photoGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(210px, 1fr))',
    gap: 16,
    marginTop: 16,
  },

  photoCard: {
    position: 'relative',
    background: '#fff',
    border:
      '1px solid #ddd',
    borderRadius: 12,
    overflow: 'hidden',
  },

  photoImage: {
    width: '100%',
    aspectRatio: '16 / 9',
    objectFit: 'cover',
    display: 'block',
  },

  coverBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    background: '#163c74',
    color: '#fff',
    padding: '6px 9px',
    borderRadius: 8,
    fontSize: 10,
    fontWeight: 800,
  },

  photoActions: {
    display: 'flex',
    gap: 8,
    padding: 10,
  },

  coverButton: {
    flex: 1,
    padding: 9,
    border:
      '1px solid #163c74',
    borderRadius: 8,
    background: '#fff',
    color: '#163c74',
    cursor: 'pointer',
    fontWeight: 700,
  },

  deletePhotoButton: {
    padding: 9,
    border: 0,
    borderRadius: 8,
    background: '#ffe8e8',
    color: '#a11f1f',
    cursor: 'pointer',
    fontWeight: 700,
  },

  error: {
    marginTop: 20,
    padding: 14,
    borderRadius: 10,
    background: '#ffeaea',
    color: '#8c2020',
    fontWeight: 700,
  },

  success: {
    marginTop: 20,
    padding: 14,
    borderRadius: 10,
    background: '#eaf8ee',
    color: '#236339',
    fontWeight: 700,
  },

  saveButton: {
    width: '100%',
    marginTop: 25,
    padding: 16,
    border: 0,
    borderRadius: 12,
    background: '#163c74',
    color: '#fff',
    fontSize: 16,
    fontWeight: 800,
    cursor: 'pointer',
  },

  secondaryButton: {
    padding: '11px 17px',
    borderRadius: 10,
    background: '#fff',
    border:
      '1px solid #163c74',
    color: '#163c74',
    fontWeight: 700,
    cursor: 'pointer',
  },

  separator: {
    margin:
      '55px 0 30px',
    border: 0,
    borderTop:
      '1px solid #ddd',
  },

  propertyGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 20,
    marginTop: 20,
  },

  propertyCard: {
    background: '#fff',
    border:
      '1px solid #e2e4e8',
    borderRadius: 16,
    padding: 20,
  },

  cardTop: {
    display: 'flex',
    justifyContent:
      'space-between',
    gap: 15,
  },

  cardTitle: {
    margin: 0,
  },

  status: {
    height: 'fit-content',
    padding: '6px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 800,
  },

  cardPrice: {
    marginTop: 20,
    color: '#163c74',
    fontSize: 21,
    fontWeight: 800,
  },

  small: {
    marginTop: 5,
    fontSize: 13,
    color: '#666',
  },

  cardButtons: {
    display: 'flex',
    gap: 10,
    marginTop: 20,
  },

  editButton: {
    flex: 1,
    padding: 10,
    border: 0,
    borderRadius: 10,
    background: '#163c74',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },

  statusButton: {
    padding: 10,
    border:
      '1px solid #ccc',
    borderRadius: 10,
    background: '#fff',
    cursor: 'pointer',
  },

  empty: {
    padding: 30,
    marginTop: 20,
    background: '#fff',
    borderRadius: 15,
  },

  notice: {
    maxWidth: 450,
    margin: '80px auto',
    background: '#fff',
    padding: 30,
    borderRadius: 16,
  },

  primaryLink: {
    display: 'inline-block',
    marginTop: 15,
    padding: '11px 16px',
    borderRadius: 10,
    background: '#163c74',
    color: '#fff',
    textDecoration: 'none',
  },
};