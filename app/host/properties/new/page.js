'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

const PROPERTY_TYPES = [
  'Apartment / Flat',
  'Studio',
  'Condominium',
  'Villa',
  'Bungalow',
  'Farm House',
  'Private Room',
  'Sharing Room',
  'PG',
  'Cottage',
  'Container House',
  'Tree House',
  'Row House',
  'Homestay',
  'Resort',
  'Cabin',
  'Tent / Glamping',
  'Independent House',
  'Serviced Apartment',
];

const AMENITIES = [
  'Parking',
  'Wi-Fi',
  'Kitchen',
  'Balcony',
  'Lift',
  'Swimming Pool',
  'Clubhouse',
  'Gym',
  'Garden',
  'Security',
  'Power Backup',
  'Workspace',
  'Dining Area',
  'Microwave',
  'Gas Stove',
  'Induction',
  'Kettle',
  'Cookware',
];

export default function AddPropertyPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [host, setHost] = useState(null);
  const [sessionUser, setSessionUser] = useState(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [amenities, setAmenities] = useState([]);

  const [form, setForm] = useState({
    name: '',
    propertyType: 'Apartment / Flat',

    shortDescription: '',
    description: '',

    city: 'Pune',
    area: '',
    locationName: '',
    address: '',
    googleMapsUrl: '',
    latitude: '',
    longitude: '',

    bedrooms: 1,
    bathrooms: 1,

    minGuests: 1,
    includedGuests: 4,
    maxGuests: 4,
    extraGuestFee: 0,

    basePrice: '',
    cleaningFee: 0,
    securityDeposit: 0,

    minStayNights: 1,
    maxStayNights: 30,

    checkInTime: '14:00',
    checkOutTime: '11:00',
    lateCheckoutHourlyFee: 0,

    fridgeAvailable: false,
    tvAvailable: false,
    washingMachineAvailable: false,
    acAvailable: false,
    acCount: 0,

    wifiAvailable: false,
    waterHeaterCount: 0,

    sofaCumBedCount: 0,
    singleBedCount: 0,
    queenBedCount: 1,

    petsAllowed: false,
    partiesAllowed: false,
    couplesAllowed: true,
    alcoholAllowed: false,
    smokingAllowed: false,

    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',

    directionInstructions: '',
    houseRulesText: '',
    featuresText: '',
    kitchenFeaturesText: '',

    dynamicPricingEnabled: false,
    weekendMarkupPercent: 0,
    longWeekendMarkupPercent: 0,
    festivalMarkupPercent: 0,
    seasonMarkupPercent: 0,
  });

  useEffect(() => {
    initialise();
  }, []);

  async function initialise() {
    try {
      setLoading(true);
      setError('');

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session?.user) {
        window.location.replace(
          '/login?redirect=/host/properties/new'
        );
        return;
      }

      setSessionUser(session.user);

      const { data: roles, error: roleError } =
        await supabase.rpc('get_my_platform_roles');

      if (roleError) throw roleError;

      const isSuperAdmin = (roles || []).some(
        (item) =>
          item.role === 'super_admin' &&
          item.is_active === true
      );

      if (isSuperAdmin) {
        window.location.replace('/admin');
        return;
      }

      const isHost = (roles || []).some(
        (item) =>
          item.role === 'host' &&
          item.is_active === true
      );

      if (!isHost) {
        window.location.replace('/account/bookings');
        return;
      }

      const { data: hostData, error: hostError } =
        await supabase
          .from('host_profiles')
          .select(`
            id,
            user_id,
            full_name,
            business_name,
            status
          `)
          .eq('user_id', session.user.id)
          .single();

      if (hostError) throw hostError;

      if (hostData.status !== 'active') {
        throw new Error('Your Host account is not active.');
      }

      setHost(hostData);
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          'Unable to open Add Property.'
      );
    } finally {
      setLoading(false);
    }
  }

  function updateField(event) {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]:
        type === 'checkbox'
          ? checked
          : value,
    }));
  }

  function toggleAmenity(item) {
    setAmenities((current) =>
      current.includes(item)
        ? current.filter((value) => value !== item)
        : [...current, item]
    );
  }

  function handlePhotoSelection(event) {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    const imageFiles = files.filter((file) =>
      file.type.startsWith('image/')
    );

    if (imageFiles.length !== files.length) {
      setError('Only image files can be uploaded.');
      return;
    }

    setSelectedPhotos((current) => [
      ...current,
      ...imageFiles,
    ]);

    event.target.value = '';
  }

  function removeSelectedPhoto(index) {
    setSelectedPhotos((current) =>
      current.filter(
        (_, itemIndex) =>
          itemIndex !== index
      )
    );
  }

  function createSlug(name) {
    const clean = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    return `${clean}-${Date.now()}`;
  }

  function splitLines(value) {
    return String(value || '')
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function uploadPhotos(propertyId, propertyName) {
    if (!selectedPhotos.length) {
      return;
    }

    for (
      let index = 0;
      index < selectedPhotos.length;
      index += 1
    ) {
      const file = selectedPhotos[index];

      const extension =
        file.name.split('.').pop() || 'jpg';

      const safeName =
        `${Date.now()}-${index}.${extension}`;

      const storagePath =
        `${sessionUser.id}/${propertyId}/${safeName}`;

      const { error: uploadError } =
        await supabase.storage
          .from('property-photos')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } =
        supabase.storage
          .from('property-photos')
          .getPublicUrl(storagePath);

      const imageUrl =
        publicUrlData?.publicUrl;

      if (!imageUrl) {
        throw new Error(
          'Photo URL could not be generated.'
        );
      }

      const { error: photoInsertError } =
        await supabase
          .from('property_photos')
          .insert({
            property_id: propertyId,
            image_url: imageUrl,
            alt_text:
              `${propertyName} photo ${index + 1}`,
            sort_order: index,
            is_cover: index === 0,
          });

      if (photoInsertError) {
        throw photoInsertError;
      }
    }
  }

  async function saveProperty(submitForReview) {
    setError('');
    setSuccess('');

    if (!host?.id) {
      setError('Host information is missing.');
      return;
    }

    if (!form.name.trim()) {
      setError('Please enter the property name.');
      return;
    }

    if (!form.city.trim()) {
      setError('Please enter the city.');
      return;
    }

    if (!form.area.trim()) {
      setError('Please enter the area or locality.');
      return;
    }

    if (!form.basePrice) {
      setError('Please enter the nightly base rate.');
      return;
    }

    if (
      Number(form.maxGuests) <
      Number(form.includedGuests)
    ) {
      setError(
        'Maximum guests cannot be less than included guests.'
      );
      return;
    }

    if (
      Number(form.maxStayNights) <
      Number(form.minStayNights)
    ) {
      setError(
        'Maximum nights cannot be less than minimum nights.'
      );
      return;
    }

    try {
      setSaving(true);

      const moderationStatus =
        submitForReview
          ? 'pending_review'
          : 'draft';

      const slug = createSlug(form.name);

      const payload = {
        host_id: host.id,

        name: form.name.trim(),
        slug,

        property_type:
          form.propertyType,

        short_description:
          form.shortDescription.trim() || null,

        description:
          form.description.trim() || null,

        city: form.city.trim(),

        area: form.area.trim(),

        location_name:
          form.locationName.trim() ||
          `${form.area.trim()}, ${form.city.trim()}`,

        address:
          form.address.trim() || null,

        google_maps_url:
          form.googleMapsUrl.trim() || null,

        latitude:
          form.latitude === ''
            ? null
            : Number(form.latitude),

        longitude:
          form.longitude === ''
            ? null
            : Number(form.longitude),

        bedrooms:
          Number(form.bedrooms),

        bathrooms:
          Number(form.bathrooms),

        min_guests:
          Number(form.minGuests),

        included_guests:
          Number(form.includedGuests),

        max_guests:
          Number(form.maxGuests),

        extra_guest_fee:
          Number(form.extraGuestFee || 0),

        base_price:
          Number(form.basePrice),

        cleaning_fee:
          Number(form.cleaningFee || 0),

        security_deposit:
          Number(form.securityDeposit || 0),

        min_stay_nights:
          Number(form.minStayNights),

        max_stay_nights:
          Number(form.maxStayNights),

        check_in_time:
          form.checkInTime,

        check_out_time:
          form.checkOutTime,

        late_checkout_hourly_fee:
          Number(form.lateCheckoutHourlyFee || 0),

        amenities,

        features:
          splitLines(form.featuresText),

        house_rules:
          splitLines(form.houseRulesText),

        kitchen_features:
          splitLines(form.kitchenFeaturesText),

        direction_instructions:
          form.directionInstructions.trim() || null,

        fridge_available:
          form.fridgeAvailable,

        tv_available:
          form.tvAvailable,

        washing_machine_available:
          form.washingMachineAvailable,

        ac_available:
          form.acAvailable,

        ac_count:
          form.acAvailable
            ? Number(form.acCount || 0)
            : 0,

        wifi_available:
          form.wifiAvailable,

        water_heater_count:
          Number(form.waterHeaterCount || 0),

        sofa_cum_bed_count:
          Number(form.sofaCumBedCount || 0),

        single_bed_count:
          Number(form.singleBedCount || 0),

        queen_bed_count:
          Number(form.queenBedCount || 0),

        pets_allowed:
          form.petsAllowed,

        parties_allowed:
          form.partiesAllowed,

        couples_allowed:
          form.couplesAllowed,

        alcohol_allowed:
          form.alcoholAllowed,

        smoking_allowed:
          form.smokingAllowed,

        quiet_hours_enabled:
          form.quietHoursEnabled,

        quiet_hours_start:
          form.quietHoursEnabled
            ? form.quietHoursStart
            : null,

        quiet_hours_end:
          form.quietHoursEnabled
            ? form.quietHoursEnd
            : null,

        dynamic_pricing_enabled:
          form.dynamicPricingEnabled,

        weekend_markup_percent:
          Number(form.weekendMarkupPercent || 0),

        long_weekend_markup_percent:
          Number(
            form.longWeekendMarkupPercent || 0
          ),

        festival_markup_percent:
          Number(form.festivalMarkupPercent || 0),

        season_markup_percent:
          Number(form.seasonMarkupPercent || 0),

        moderation_status:
          moderationStatus,

        submitted_for_review_at:
          submitForReview
            ? new Date().toISOString()
            : null,

        reviewed_at: null,
        reviewed_by: null,
        moderation_notes: null,

        is_active: false,
      };

      const {
        data: property,
        error: insertError,
      } = await supabase
        .from('properties')
        .insert(payload)
        .select('id, name')
        .single();

      if (insertError) {
        throw insertError;
      }

      await uploadPhotos(
        property.id,
        property.name
      );

      setSuccess(
        submitForReview
          ? 'Property submitted for Admin review successfully.'
          : 'Property saved as Draft successfully.'
      );

      setTimeout(() => {
        window.location.replace(
          '/host/properties'
        );
      }, 900);
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          'Unable to save property.'
      );
    } finally {
      setSaving(false);
    }
  }

  const photoPreviews = useMemo(
    () =>
      selectedPhotos.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [selectedPhotos]
  );

  if (loading) {
    return (
      <main className="nosAddLoading">
        Loading Add Property...
        <PageStyles />
      </main>
    );
  }

  return (
    <main className="nosAddPage">
      <div className="nosAddShell">
        <section className="nosAddPageTitle">
          <div>
            <p className="nosAddEyebrow">
              HOST PROPERTY LISTING
            </p>

            <h1>Add Property</h1>

            <p>
              Create your listing, save it as Draft,
              or submit it for Admin review.
            </p>
          </div>

          <div className="nosAddTopActions">
            <button
              type="button"
              disabled={saving}
              className="nosAddDraftButton"
              onClick={() =>
                saveProperty(false)
              }
            >
              Save as Draft
            </button>

            <button
              type="button"
              disabled={saving}
              className="nosAddSubmitButton"
              onClick={() =>
                saveProperty(true)
              }
            >
              Submit for Review
            </button>
          </div>
        </section>

        {error && (
          <div className="nosAddAlert nosAddError">
            {error}
          </div>
        )}

        {success && (
          <div className="nosAddAlert nosAddSuccess">
            {success}
          </div>
        )}

        <div className="nosAddFormLayout">
          <div className="nosAddMainColumn">
            <Section title="Basic Information">
              <div className="nosAddGrid2">
                <Field
                  label="PROPERTY NAME"
                  name="name"
                  value={form.name}
                  onChange={updateField}
                  placeholder="Example: Cozy 2BHK Bavdhan"
                  full
                />

                <SelectField
                  label="PROPERTY TYPE"
                  name="propertyType"
                  value={form.propertyType}
                  onChange={updateField}
                  options={PROPERTY_TYPES}
                />

                <Field
                  label="SHORT DESCRIPTION"
                  name="shortDescription"
                  value={form.shortDescription}
                  onChange={updateField}
                  placeholder="Short property highlight"
                />

                <TextArea
                  label="FULL DESCRIPTION"
                  name="description"
                  value={form.description}
                  onChange={updateField}
                  placeholder="Describe the property, stay experience and nearby attractions."
                  full
                />
              </div>
            </Section>

            <Section title="Location">
              <div className="nosAddGrid2">
                <Field
                  label="CITY"
                  name="city"
                  value={form.city}
                  onChange={updateField}
                />

                <Field
                  label="AREA / LOCALITY"
                  name="area"
                  value={form.area}
                  onChange={updateField}
                  placeholder="Bavdhan"
                />

                <Field
                  label="DISPLAY LOCATION"
                  name="locationName"
                  value={form.locationName}
                  onChange={updateField}
                  placeholder="Bavdhan, Pune"
                />

                <Field
                  label="GOOGLE MAPS LINK"
                  name="googleMapsUrl"
                  value={form.googleMapsUrl}
                  onChange={updateField}
                  placeholder="Paste Maps link"
                />

                <TextArea
                  label="FULL ADDRESS"
                  name="address"
                  value={form.address}
                  onChange={updateField}
                  placeholder="Exact property address"
                  full
                />

                <Field
                  label="LATITUDE"
                  name="latitude"
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={updateField}
                />

                <Field
                  label="LONGITUDE"
                  name="longitude"
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={updateField}
                />
              </div>
            </Section>

            <Section title="Rooms and Guests">
              <div className="nosAddGrid4">
                <NumberField
                  label="BEDROOMS"
                  name="bedrooms"
                  value={form.bedrooms}
                  onChange={updateField}
                />

                <NumberField
                  label="BATHROOMS"
                  name="bathrooms"
                  value={form.bathrooms}
                  onChange={updateField}
                />

                <NumberField
                  label="MIN GUESTS"
                  name="minGuests"
                  value={form.minGuests}
                  onChange={updateField}
                />

                <NumberField
                  label="INCLUDED GUESTS"
                  name="includedGuests"
                  value={form.includedGuests}
                  onChange={updateField}
                />

                <NumberField
                  label="MAX GUESTS"
                  name="maxGuests"
                  value={form.maxGuests}
                  onChange={updateField}
                />

                <NumberField
                  label="QUEEN BEDS"
                  name="queenBedCount"
                  value={form.queenBedCount}
                  onChange={updateField}
                />

                <NumberField
                  label="SINGLE BEDS"
                  name="singleBedCount"
                  value={form.singleBedCount}
                  onChange={updateField}
                />

                <NumberField
                  label="SOFA CUM BEDS"
                  name="sofaCumBedCount"
                  value={form.sofaCumBedCount}
                  onChange={updateField}
                />
              </div>
            </Section>

            <Section title="Pricing">
              <div className="nosAddGrid4">
                <NumberField
                  label="BASE NIGHTLY RATE ₹"
                  name="basePrice"
                  value={form.basePrice}
                  onChange={updateField}
                />

                <NumberField
                  label="EXTRA GUEST FEE ₹"
                  name="extraGuestFee"
                  value={form.extraGuestFee}
                  onChange={updateField}
                />

                <NumberField
                  label="CLEANING FEE ₹"
                  name="cleaningFee"
                  value={form.cleaningFee}
                  onChange={updateField}
                />

                <NumberField
                  label="SECURITY DEPOSIT ₹"
                  name="securityDeposit"
                  value={form.securityDeposit}
                  onChange={updateField}
                />

                <NumberField
                  label="MINIMUM NIGHTS"
                  name="minStayNights"
                  value={form.minStayNights}
                  onChange={updateField}
                />

                <NumberField
                  label="MAXIMUM NIGHTS"
                  name="maxStayNights"
                  value={form.maxStayNights}
                  onChange={updateField}
                />

                <NumberField
                  label="LATE CHECKOUT / HOUR ₹"
                  name="lateCheckoutHourlyFee"
                  value={form.lateCheckoutHourlyFee}
                  onChange={updateField}
                />
              </div>
            </Section>

            <Section title="Check-in and House Rules">
              <div className="nosAddGrid2">
                <Field
                  label="CHECK-IN TIME"
                  name="checkInTime"
                  type="time"
                  value={form.checkInTime}
                  onChange={updateField}
                />

                <Field
                  label="CHECK-OUT TIME"
                  name="checkOutTime"
                  type="time"
                  value={form.checkOutTime}
                  onChange={updateField}
                />
              </div>

              <div className="nosAddChecks">
                <Check
                  label="Pets Allowed"
                  name="petsAllowed"
                  checked={form.petsAllowed}
                  onChange={updateField}
                />

                <Check
                  label="Parties Allowed"
                  name="partiesAllowed"
                  checked={form.partiesAllowed}
                  onChange={updateField}
                />

                <Check
                  label="Couples Allowed"
                  name="couplesAllowed"
                  checked={form.couplesAllowed}
                  onChange={updateField}
                />

                <Check
                  label="Alcohol Allowed"
                  name="alcoholAllowed"
                  checked={form.alcoholAllowed}
                  onChange={updateField}
                />

                <Check
                  label="Smoking Allowed"
                  name="smokingAllowed"
                  checked={form.smokingAllowed}
                  onChange={updateField}
                />

                <Check
                  label="Quiet Hours Enabled"
                  name="quietHoursEnabled"
                  checked={form.quietHoursEnabled}
                  onChange={updateField}
                />
              </div>

              {form.quietHoursEnabled && (
                <div className="nosAddGrid2">
                  <Field
                    label="QUIET HOURS START"
                    name="quietHoursStart"
                    type="time"
                    value={form.quietHoursStart}
                    onChange={updateField}
                  />

                  <Field
                    label="QUIET HOURS END"
                    name="quietHoursEnd"
                    type="time"
                    value={form.quietHoursEnd}
                    onChange={updateField}
                  />
                </div>
              )}

              <TextArea
                label="HOUSE RULES"
                name="houseRulesText"
                value={form.houseRulesText}
                onChange={updateField}
                placeholder={
                  'Enter one rule per line\nNo loud music after 10 PM\nGovernment ID required'
                }
                full
              />
            </Section>

            <Section title="Amenities">
              <div className="nosAddAmenities">
                {AMENITIES.map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() =>
                      toggleAmenity(item)
                    }
                    className={
                      amenities.includes(item)
                        ? 'nosAddAmenity active'
                        : 'nosAddAmenity'
                    }
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="nosAddChecks">
                <Check
                  label="Wi-Fi Available"
                  name="wifiAvailable"
                  checked={form.wifiAvailable}
                  onChange={updateField}
                />

                <Check
                  label="TV Available"
                  name="tvAvailable"
                  checked={form.tvAvailable}
                  onChange={updateField}
                />

                <Check
                  label="Fridge Available"
                  name="fridgeAvailable"
                  checked={form.fridgeAvailable}
                  onChange={updateField}
                />

                <Check
                  label="Washing Machine"
                  name="washingMachineAvailable"
                  checked={
                    form.washingMachineAvailable
                  }
                  onChange={updateField}
                />

                <Check
                  label="AC Available"
                  name="acAvailable"
                  checked={form.acAvailable}
                  onChange={updateField}
                />
              </div>

              <div className="nosAddGrid4">
                <NumberField
                  label="AC COUNT"
                  name="acCount"
                  value={form.acCount}
                  onChange={updateField}
                />

                <NumberField
                  label="WATER HEATERS"
                  name="waterHeaterCount"
                  value={form.waterHeaterCount}
                  onChange={updateField}
                />
              </div>

              <div className="nosAddGrid2">
                <TextArea
                  label="OTHER FEATURES"
                  name="featuresText"
                  value={form.featuresText}
                  onChange={updateField}
                  placeholder="One feature per line"
                />

                <TextArea
                  label="KITCHEN FEATURES"
                  name="kitchenFeaturesText"
                  value={form.kitchenFeaturesText}
                  onChange={updateField}
                  placeholder="One item per line"
                />
              </div>
            </Section>

            <Section title="Directions">
              <TextArea
                label="DIRECTION / CHECK-IN INSTRUCTIONS"
                name="directionInstructions"
                value={form.directionInstructions}
                onChange={updateField}
                placeholder="Landmark, entry gate, parking instructions etc."
                full
              />
            </Section>

            <Section title="Photos">
              <p className="nosAddHelper">
                First photo will automatically become the cover photo.
              </p>

              <label className="nosAddUploadBox">
                <span>Select Property Photos</span>
                <small>
                  Choose multiple JPG, PNG or WEBP images
                </small>

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoSelection}
                />
              </label>

              {photoPreviews.length > 0 && (
                <div className="nosAddPhotoGrid">
                  {photoPreviews.map(
                    (item, index) => (
                      <div
                        className="nosAddPhotoItem"
                        key={`${item.file.name}-${index}`}
                      >
                        <img
                          src={item.url}
                          alt=""
                        />

                        {index === 0 && (
                          <span className="nosAddCover">
                            COVER
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            removeSelectedPhoto(index)
                          }
                        >
                          Remove
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}
            </Section>
          </div>

          <aside className="nosAddSideColumn">
            <section className="nosAddSideCard">
              <h2>Dynamic Pricing</h2>

              <Check
                label="Enable automatic pricing markups"
                name="dynamicPricingEnabled"
                checked={form.dynamicPricingEnabled}
                onChange={updateField}
              />

              {form.dynamicPricingEnabled && (
                <div className="nosAddGrid2">
                  <NumberField
                    label="WEEKEND MARKUP %"
                    name="weekendMarkupPercent"
                    value={
                      form.weekendMarkupPercent
                    }
                    onChange={updateField}
                  />

                  <NumberField
                    label="LONG WEEKEND %"
                    name="longWeekendMarkupPercent"
                    value={
                      form.longWeekendMarkupPercent
                    }
                    onChange={updateField}
                  />

                  <NumberField
                    label="FESTIVAL %"
                    name="festivalMarkupPercent"
                    value={
                      form.festivalMarkupPercent
                    }
                    onChange={updateField}
                  />

                  <NumberField
                    label="SEASON %"
                    name="seasonMarkupPercent"
                    value={
                      form.seasonMarkupPercent
                    }
                    onChange={updateField}
                  />
                </div>
              )}
            </section>

            <section className="nosAddReviewCard">
              <h2>Property Review</h2>

              <p>
                Save as Draft while preparing the listing.
                Submit for Review only when everything is complete.
              </p>

              <div className="nosAddReviewSteps">
                <span>1. Host creates listing</span>
                <span>2. Submit for review</span>
                <span>3. Admin checks listing</span>
                <span>4. Approve or request changes</span>
                <span>5. Approved property goes live</span>
              </div>
            </section>
          </aside>
        </div>

        <div className="nosAddBottomActions">
          <a
            href="/host/properties"
            className="nosAddCancel"
          >
            Cancel
          </a>

          <button
            type="button"
            disabled={saving}
            className="nosAddDraftButton"
            onClick={() =>
              saveProperty(false)
            }
          >
            {saving
              ? 'Saving...'
              : 'Save as Draft'}
          </button>

          <button
            type="button"
            disabled={saving}
            className="nosAddSubmitButton"
            onClick={() =>
              saveProperty(true)
            }
          >
            {saving
              ? 'Submitting...'
              : 'Submit for Review'}
          </button>
        </div>
      </div>

      <PageStyles />
    </main>
  );
}

function Section({ title, children }) {
  return (
    <section className="nosAddCard">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  full = false,
  ...props
}) {
  return (
    <label
      className={
        full
          ? 'nosAddField nosAddFull'
          : 'nosAddField'
      }
    >
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

function NumberField(props) {
  return (
    <Field
      {...props}
      type="number"
      min="0"
    />
  );
}

function SelectField({
  label,
  options,
  ...props
}) {
  return (
    <label className="nosAddField">
      <span>{label}</span>

      <select {...props}>
        {options.map((option) => (
          <option
            key={option}
            value={option}
          >
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({
  label,
  full = false,
  ...props
}) {
  return (
    <label
      className={
        full
          ? 'nosAddField nosAddFull'
          : 'nosAddField'
      }
    >
      <span>{label}</span>

      <textarea
        {...props}
        rows="5"
      />
    </label>
  );
}

function Check({
  label,
  ...props
}) {
  return (
    <label className="nosAddCheck">
      <input
        type="checkbox"
        {...props}
      />

      <span>{label}</span>
    </label>
  );
}

function PageStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
      }

      .nosAddPage,
      .nosAddLoading {
        min-height: 100vh;
        width: 100%;
        background: #f6f7f9;
        color: #111827;
        font-family: Arial, sans-serif;
      }

      .nosAddLoading {
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
      }

      .nosAddHeader {
        width: 100%;
        min-height: 72px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 40px;
        background: #ffffff;
        border-bottom: 1px solid #e5e7eb;
        position: sticky;
        top: 0;
        z-index: 100;
      }

      .nosAddBrandArea {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .nosAddBrand {
        color: #0b4b8c;
        font-size: 25px;
        font-weight: 900;
        text-decoration: none;
      }

      .nosAddBadge {
        background: #111827;
        color: #ffffff;
        border-radius: 999px;
        padding: 7px 11px;
        font-size: 10px;
        font-weight: 900;
      }

      .nosAddBack {
        color: #374151;
        border: 1px solid #d1d5db;
        padding: 10px 14px;
        border-radius: 8px;
        text-decoration: none;
        font-size: 12px;
        font-weight: 800;
      }

      .nosAddShell {
        width: min(1500px, calc(100% - 48px));
        margin: 0 auto;
        padding: 32px 0 50px;
      }

      .nosAddPageTitle {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 24px;
      }

      .nosAddEyebrow {
        margin: 0 0 7px;
        color: #6b7280;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 1px;
      }

      .nosAddPageTitle h1 {
        margin: 0;
        font-size: 34px;
      }

      .nosAddPageTitle p:last-child {
        margin: 8px 0 0;
        color: #6b7280;
        font-size: 14px;
      }

      .nosAddTopActions {
        display: flex;
        gap: 10px;
      }

      .nosAddFormLayout {
        display: grid;
        grid-template-columns:
          minmax(0, 1fr) 340px;
        gap: 22px;
        align-items: start;
      }

      .nosAddMainColumn {
        min-width: 0;
      }

      .nosAddSideColumn {
        display: flex;
        flex-direction: column;
        gap: 18px;
        position: sticky;
        top: 94px;
      }

      .nosAddCard,
      .nosAddSideCard,
      .nosAddReviewCard {
        width: 100%;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        padding: 24px;
        margin-bottom: 18px;
      }

      .nosAddSideCard,
      .nosAddReviewCard {
        margin-bottom: 0;
      }

      .nosAddCard h2,
      .nosAddSideCard h2,
      .nosAddReviewCard h2 {
        margin: 0 0 20px;
        font-size: 19px;
      }

      .nosAddGrid2 {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 16px;
      }

      .nosAddGrid4 {
        display: grid;
        grid-template-columns:
          repeat(4, minmax(0, 1fr));
        gap: 16px;
      }

      .nosAddField {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 7px;
      }

      .nosAddFull {
        grid-column: 1 / -1;
      }

      .nosAddField span {
        min-height: 14px;
        color: #374151;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 0.35px;
        line-height: 1.3;
      }

      .nosAddField input,
      .nosAddField select,
      .nosAddField textarea {
        width: 100%;
        min-width: 0;
        border: 1px solid #d1d5db;
        border-radius: 9px;
        background: #ffffff;
        color: #111827;
        padding: 12px 13px;
        font-size: 14px;
        font-family: inherit;
        outline: none;
      }

      .nosAddField input,
      .nosAddField select {
        height: 45px;
      }

      .nosAddField textarea {
        min-height: 110px;
        resize: vertical;
      }

      .nosAddField input:focus,
      .nosAddField select:focus,
      .nosAddField textarea:focus {
        border-color: #111827;
        box-shadow:
          0 0 0 2px
          rgba(17, 24, 39, 0.06);
      }

      .nosAddChecks {
        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin: 18px 0 22px;
      }

      .nosAddCheck {
        min-height: 44px;
        display: flex;
        align-items: center;
        gap: 9px;
        border: 1px solid #e5e7eb;
        border-radius: 9px;
        padding: 10px 12px;
        background: #ffffff;
        cursor: pointer;
        font-size: 13px;
        font-weight: 700;
      }

      .nosAddCheck input {
        width: 16px;
        height: 16px;
        flex: 0 0 auto;
      }

      .nosAddAmenities {
        display: grid;
        grid-template-columns:
          repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 18px;
      }

      .nosAddAmenity {
        min-height: 42px;
        border: 1px solid #d1d5db;
        border-radius: 9px;
        background: #ffffff;
        color: #374151;
        padding: 8px 10px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 800;
      }

      .nosAddAmenity.active {
        background: #111827;
        color: #ffffff;
        border-color: #111827;
      }

      .nosAddHelper {
        margin: -6px 0 16px;
        color: #6b7280;
        font-size: 13px;
      }

      .nosAddUploadBox {
        min-height: 120px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 7px;
        border: 2px dashed #d1d5db;
        border-radius: 12px;
        background: #fafafa;
        cursor: pointer;
        text-align: center;
      }

      .nosAddUploadBox span {
        font-size: 14px;
        font-weight: 900;
      }

      .nosAddUploadBox small {
        color: #6b7280;
      }

      .nosAddUploadBox input {
        display: none;
      }

      .nosAddPhotoGrid {
        display: grid;
        grid-template-columns:
          repeat(4, minmax(0, 1fr));
        gap: 14px;
        margin-top: 18px;
      }

      .nosAddPhotoItem {
        position: relative;
        overflow: hidden;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        background: white;
      }

      .nosAddPhotoItem img {
        display: block;
        width: 100%;
        aspect-ratio: 16 / 10;
        object-fit: cover;
      }

      .nosAddPhotoItem button {
        width: 100%;
        min-height: 38px;
        border: 0;
        border-top: 1px solid #e5e7eb;
        background: #ffffff;
        cursor: pointer;
        font-size: 12px;
        font-weight: 800;
      }

      .nosAddCover {
        position: absolute;
        top: 8px;
        left: 8px;
        background: #111827;
        color: #ffffff;
        padding: 5px 7px;
        border-radius: 5px;
        font-size: 9px;
        font-weight: 900;
      }

      .nosAddReviewCard {
        background: #eff6ff;
        border-color: #bfdbfe;
      }

      .nosAddReviewCard p {
        margin: 0 0 16px;
        color: #4b5563;
        font-size: 13px;
        line-height: 1.6;
      }

      .nosAddReviewSteps {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .nosAddReviewSteps span {
        display: block;
        padding: 9px 10px;
        border-radius: 8px;
        background: rgba(255,255,255,0.7);
        font-size: 12px;
        font-weight: 700;
      }

      .nosAddAlert {
        border-radius: 10px;
        padding: 13px 15px;
        margin-bottom: 18px;
        font-weight: 700;
      }

      .nosAddError {
        background: #fef2f2;
        color: #b91c1c;
      }

      .nosAddSuccess {
        background: #ecfdf5;
        color: #047857;
      }

      .nosAddBottomActions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding-top: 6px;
      }

      .nosAddCancel,
      .nosAddDraftButton,
      .nosAddSubmitButton {
        min-height: 46px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 9px;
        padding: 0 19px;
        font-size: 13px;
        font-weight: 900;
      }

      .nosAddCancel {
        border: 1px solid #d1d5db;
        background: #ffffff;
        color: #374151;
        text-decoration: none;
      }

      .nosAddDraftButton {
        border: 1px solid #d1d5db;
        background: #ffffff;
        color: #111827;
        cursor: pointer;
      }

      .nosAddSubmitButton {
        border: 0;
        background: #111827;
        color: #ffffff;
        cursor: pointer;
      }

      .nosAddDraftButton:disabled,
      .nosAddSubmitButton:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      @media (max-width: 1150px) {
        .nosAddFormLayout {
          grid-template-columns: 1fr;
        }

        .nosAddSideColumn {
          position: static;
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .nosAddGrid4 {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .nosAddAmenities {
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
        }
      }

      @media (max-width: 800px) {
        .nosAddHeader {
          padding: 0 18px;
        }

        .nosAddShell {
          width: min(100% - 24px, 1500px);
          padding-top: 22px;
        }

        .nosAddPageTitle {
          flex-direction: column;
        }

        .nosAddTopActions {
          width: 100%;
        }

        .nosAddTopActions button {
          flex: 1;
        }

        .nosAddGrid2,
        .nosAddGrid4 {
          grid-template-columns: 1fr;
        }

        .nosAddFull {
          grid-column: auto;
        }

        .nosAddChecks {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .nosAddAmenities {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .nosAddPhotoGrid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .nosAddSideColumn {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 520px) {
        .nosAddHeader {
          min-height: 64px;
        }

        .nosAddBrand {
          font-size: 20px;
        }

        .nosAddBack {
          font-size: 10px;
          padding: 8px 9px;
        }

        .nosAddPageTitle h1 {
          font-size: 28px;
        }

        .nosAddCard,
        .nosAddSideCard,
        .nosAddReviewCard {
          padding: 18px;
        }

        .nosAddChecks,
        .nosAddAmenities,
        .nosAddPhotoGrid {
          grid-template-columns: 1fr;
        }

        .nosAddBottomActions {
          flex-direction: column;
        }

        .nosAddCancel,
        .nosAddDraftButton,
        .nosAddSubmitButton {
          width: 100%;
        }
      }
    `}</style>
  );
}