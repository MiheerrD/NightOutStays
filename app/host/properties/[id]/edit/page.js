'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useParams,
} from 'next/navigation';

import {
  createClient,
} from '@supabase/supabase-js';


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


const EDITABLE_STATUSES = [
  'draft',
  'changes_requested',
  'declined',
  'approved',
];


export default function EditPropertyPage() {

  const params = useParams();

  const propertyId =
    params?.id
      ? String(params.id)
      : '';


  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);


  const [host, setHost] =
    useState(null);

  const [sessionUser, setSessionUser] =
    useState(null);

  const [property, setProperty] =
    useState(null);


  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');


  const [existingPhotos, setExistingPhotos] =
    useState([]);

  const [selectedPhotos, setSelectedPhotos] =
    useState([]);


  const [amenities, setAmenities] =
    useState([]);


  const [form, setForm] =
    useState({
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

    if (!propertyId) {
      return;
    }

    initialise();

  }, [propertyId]);


  async function initialise() {

    try {

      setLoading(true);
      setError('');


      const {
        data: {
          session,
        },
        error: sessionError,
      } =
        await supabase.auth.getSession();


      if (sessionError) {
        throw sessionError;
      }


      if (!session?.user) {

        window.location.replace(
          `/login?redirect=/host/properties/${propertyId}/edit`
        );

        return;
      }


      setSessionUser(
        session.user
      );


      const {
        data: roles,
        error: roleError,
      } =
        await supabase.rpc(
          'get_my_platform_roles'
        );


      if (roleError) {
        throw roleError;
      }


      const isSuperAdmin =
        (roles || []).some(
          (item) =>
            item.role ===
              'super_admin' &&
            item.is_active === true
        );


      if (isSuperAdmin) {

        window.location.replace(
          '/admin'
        );

        return;
      }


      const isHost =
        (roles || []).some(
          (item) =>
            item.role === 'host' &&
            item.is_active === true
        );


      if (!isHost) {

        window.location.replace(
          '/account/bookings'
        );

        return;
      }


      const {
        data: hostData,
        error: hostError,
      } =
        await supabase
          .from('host_profiles')
          .select(`
            id,
            user_id,
            full_name,
            business_name,
            status
          `)
          .eq(
            'user_id',
            session.user.id
          )
          .single();


      if (hostError) {
        throw hostError;
      }


      if (
        hostData.status !==
        'active'
      ) {

        throw new Error(
          'Your Host account is not active.'
        );
      }


      setHost(
        hostData
      );


      const {
        data: propertyData,
        error: propertyError,
      } =
        await supabase
          .from('properties')
          .select('*')
          .eq(
            'id',
            propertyId
          )
          .eq(
            'host_id',
            hostData.id
          )
          .single();


      if (propertyError) {
        throw propertyError;
      }


      if (!propertyData) {

        throw new Error(
          'Property not found.'
        );
      }


      setProperty(
        propertyData
      );


      fillForm(
        propertyData
      );


      const {
        data: photoData,
        error: photoError,
      } =
        await supabase
          .from('property_photos')
          .select(`
            id,
            property_id,
            image_url,
            alt_text,
            sort_order,
            is_cover,
            created_at
          `)
          .eq(
            'property_id',
            propertyId
          )
          .order(
            'sort_order',
            {
              ascending: true,
            }
          );


      if (photoError) {
        throw photoError;
      }


      setExistingPhotos(
        photoData || []
      );

    } catch (err) {

      console.error(err);

      setError(
        err?.message ||
          'Unable to open property.'
      );

    } finally {

      setLoading(false);
    }
  }


  function fillForm(data) {

    setAmenities(
      Array.isArray(data.amenities)
        ? data.amenities
        : []
    );


    setForm({

      name:
        data.name || '',

      propertyType:
        data.property_type ||
        'Apartment / Flat',

      shortDescription:
        data.short_description || '',

      description:
        data.description || '',


      city:
        data.city || 'Pune',

      area:
        data.area || '',

      locationName:
        data.location_name || '',

      address:
        data.address || '',

      googleMapsUrl:
        data.google_maps_url || '',

      latitude:
        data.latitude ?? '',

      longitude:
        data.longitude ?? '',


      bedrooms:
        data.bedrooms ?? 1,

      bathrooms:
        data.bathrooms ?? 1,


      minGuests:
        data.min_guests ?? 1,

      includedGuests:
        data.included_guests ?? 4,

      maxGuests:
        data.max_guests ?? 4,

      extraGuestFee:
        data.extra_guest_fee ?? 0,


      basePrice:
        data.base_price ?? '',

      cleaningFee:
        data.cleaning_fee ?? 0,

      securityDeposit:
        data.security_deposit ?? 0,


      minStayNights:
        data.min_stay_nights ?? 1,

      maxStayNights:
        data.max_stay_nights ?? 30,


      checkInTime:
        cleanTime(
          data.check_in_time,
          '14:00'
        ),

      checkOutTime:
        cleanTime(
          data.check_out_time,
          '11:00'
        ),

      lateCheckoutHourlyFee:
        data.late_checkout_hourly_fee ??
        0,


      fridgeAvailable:
        Boolean(
          data.fridge_available
        ),

      tvAvailable:
        Boolean(
          data.tv_available
        ),

      washingMachineAvailable:
        Boolean(
          data.washing_machine_available
        ),

      acAvailable:
        Boolean(
          data.ac_available
        ),

      acCount:
        data.ac_count ?? 0,


      wifiAvailable:
        Boolean(
          data.wifi_available
        ),

      waterHeaterCount:
        data.water_heater_count ?? 0,


      sofaCumBedCount:
        data.sofa_cum_bed_count ?? 0,

      singleBedCount:
        data.single_bed_count ?? 0,

      queenBedCount:
        data.queen_bed_count ?? 0,


      petsAllowed:
        Boolean(
          data.pets_allowed
        ),

      partiesAllowed:
        Boolean(
          data.parties_allowed
        ),

      couplesAllowed:
        data.couples_allowed ===
        undefined
          ? true
          : Boolean(
              data.couples_allowed
            ),

      alcoholAllowed:
        Boolean(
          data.alcohol_allowed
        ),

      smokingAllowed:
        Boolean(
          data.smoking_allowed
        ),


      quietHoursEnabled:
        Boolean(
          data.quiet_hours_enabled
        ),

      quietHoursStart:
        cleanTime(
          data.quiet_hours_start,
          '22:00'
        ),

      quietHoursEnd:
        cleanTime(
          data.quiet_hours_end,
          '08:00'
        ),


      directionInstructions:
        data.direction_instructions ||
        '',

      houseRulesText:
        arrayToLines(
          data.house_rules
        ),

      featuresText:
        arrayToLines(
          data.features
        ),

      kitchenFeaturesText:
        arrayToLines(
          data.kitchen_features
        ),


      dynamicPricingEnabled:
        Boolean(
          data.dynamic_pricing_enabled
        ),

      weekendMarkupPercent:
        data.weekend_markup_percent ??
        0,

      longWeekendMarkupPercent:
        data.long_weekend_markup_percent ??
        0,

      festivalMarkupPercent:
        data.festival_markup_percent ??
        0,

      seasonMarkupPercent:
        data.season_markup_percent ??
        0,
    });
  }


  function cleanTime(
    value,
    fallback
  ) {

    if (!value) {
      return fallback;
    }

    return String(value).slice(
      0,
      5
    );
  }


  function arrayToLines(
    value
  ) {

    if (!Array.isArray(value)) {
      return '';
    }

    return value.join('\n');
  }


  async function resolveGoogleMapsLocation() {
    const url = String(form.googleMapsUrl || '').trim();
    if (!url) { alert('Paste the Google Maps link first.'); return; }
    try {
      const response = await fetch('/api/maps/resolve', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url}) });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Unable to resolve map location.');
      setForm((current) => ({ ...current, latitude:String(json.latitude), longitude:String(json.longitude), googleMapsUrl:json.resolvedUrl || current.googleMapsUrl }));
      alert('Exact map coordinates captured successfully.');
    } catch (error) {
      alert(error.message || 'Unable to resolve map location.');
    }
  }

  function updateField(
    event
  ) {

    const {
      name,
      value,
      type,
      checked,
    } =
      event.target;


    setForm(
      (current) => ({
        ...current,

        [name]:
          type === 'checkbox'
            ? checked
            : value,
      })
    );
  }


  function toggleAmenity(
    item
  ) {

    setAmenities(
      (current) =>
        current.includes(item)
          ? current.filter(
              (value) =>
                value !== item
            )
          : [
              ...current,
              item,
            ]
    );
  }


  function handlePhotoSelection(
    event
  ) {

    const files =
      Array.from(
        event.target.files ||
          []
      );


    if (!files.length) {
      return;
    }


    const imageFiles =
      files.filter(
        (file) =>
          file.type.startsWith(
            'image/'
          )
      );


    if (
      imageFiles.length !==
      files.length
    ) {

      setError(
        'Only image files can be uploaded.'
      );

      return;
    }


    setSelectedPhotos(
      (current) => [
        ...current,
        ...imageFiles,
      ]
    );


    event.target.value = '';
  }


  function removeSelectedPhoto(
    index
  ) {

    setSelectedPhotos(
      (current) =>
        current.filter(
          (_, itemIndex) =>
            itemIndex !== index
        )
    );
  }


  function splitLines(
    value
  ) {

    return String(
      value || ''
    )
      .split('\n')
      .map(
        (item) =>
          item.trim()
      )
      .filter(Boolean);
  }


  async function removeExistingPhoto(
    photo
  ) {

    if (saving) {
      return;
    }


    const confirmed =
      window.confirm(
        'Remove this property photo?'
      );


    if (!confirmed) {
      return;
    }


    try {

      setError('');
      setSaving(true);


      const {
        error: deleteError,
      } =
        await supabase
          .from(
            'property_photos'
          )
          .delete()
          .eq(
            'id',
            photo.id
          )
          .eq(
            'property_id',
            propertyId
          );


      if (deleteError) {
        throw deleteError;
      }


      const storagePath =
        getStoragePath(
          photo.image_url
        );


      if (storagePath) {

        const {
          error:
            storageDeleteError,
        } =
          await supabase.storage
            .from(
              'property-photos'
            )
            .remove([
              storagePath,
            ]);


        if (
          storageDeleteError
        ) {

          console.warn(
            storageDeleteError
          );
        }
      }


      const remaining =
        existingPhotos.filter(
          (item) =>
            item.id !==
            photo.id
        );


      setExistingPhotos(
        remaining
      );


      if (
        photo.is_cover &&
        remaining.length
      ) {

        await setCoverPhoto(
          remaining[0].id
        );
      }

    } catch (err) {

      console.error(err);

      setError(
        err?.message ||
          'Unable to remove photo.'
      );

    } finally {

      setSaving(false);
    }
  }


  function getStoragePath(
    publicUrl
  ) {

    if (!publicUrl) {
      return '';
    }


    const marker =
      '/storage/v1/object/public/property-photos/';


    const markerIndex =
      publicUrl.indexOf(
        marker
      );


    if (
      markerIndex === -1
    ) {

      return '';
    }


    return decodeURIComponent(
      publicUrl.substring(
        markerIndex +
          marker.length
      )
    );
  }


  async function setCoverPhoto(
    photoId
  ) {

    await supabase
      .from(
        'property_photos'
      )
      .update({
        is_cover: false,
      })
      .eq(
        'property_id',
        propertyId
      );


    const {
      error,
    } =
      await supabase
        .from(
          'property_photos'
        )
        .update({
          is_cover: true,
        })
        .eq(
          'id',
          photoId
        )
        .eq(
          'property_id',
          propertyId
        );


    if (error) {
      throw error;
    }


    setExistingPhotos(
      (current) =>
        current.map(
          (item) => ({
            ...item,

            is_cover:
              item.id ===
              photoId,
          })
        )
    );
  }


  async function uploadNewPhotos() {

    if (
      !selectedPhotos.length
    ) {

      return;
    }


    const existingCount =
      existingPhotos.length;


    for (
      let index = 0;
      index <
      selectedPhotos.length;
      index += 1
    ) {

      const file =
        selectedPhotos[index];


      const extension =
        file.name
          .split('.')
          .pop() ||
        'jpg';


      const safeName =
        `${Date.now()}-${index}.${extension}`;


      const storagePath =
        `${sessionUser.id}/${propertyId}/${safeName}`;


      const {
        error:
          uploadError,
      } =
        await supabase.storage
          .from(
            'property-photos'
          )
          .upload(
            storagePath,
            file,
            {
              cacheControl:
                '3600',

              upsert:
                false,
            }
          );


      if (uploadError) {
        throw uploadError;
      }


      const {
        data:
          publicUrlData,
      } =
        supabase.storage
          .from(
            'property-photos'
          )
          .getPublicUrl(
            storagePath
          );


      const imageUrl =
        publicUrlData?.publicUrl;


      if (!imageUrl) {

        throw new Error(
          'Photo URL could not be generated.'
        );
      }


      const shouldBeCover =
        existingCount === 0 &&
        index === 0;


      const {
        error:
          photoInsertError,
      } =
        await supabase
          .from(
            'property_photos'
          )
          .insert({
            property_id:
              propertyId,

            image_url:
              imageUrl,

            alt_text:
              `${form.name.trim()} photo ${
                existingCount +
                index +
                1
              }`,

            sort_order:
              existingCount +
              index,

            is_cover:
              shouldBeCover,
          });


      if (
        photoInsertError
      ) {

        throw photoInsertError;
      }
    }


    setSelectedPhotos([]);
  }


  function validateForm() {

    if (
      !form.name.trim()
    ) {

      setError(
        'Please enter the property name.'
      );

      return false;
    }


    if (
      !form.city.trim()
    ) {

      setError(
        'Please enter the city.'
      );

      return false;
    }


    if (
      !form.area.trim()
    ) {

      setError(
        'Please enter the area or locality.'
      );

      return false;
    }


    if (
      !form.basePrice
    ) {

      setError(
        'Please enter the nightly base rate.'
      );

      return false;
    }


    if (
      Number(
        form.maxGuests
      ) <
      Number(
        form.includedGuests
      )
    ) {

      setError(
        'Maximum guests cannot be less than included guests.'
      );

      return false;
    }


    if (
      Number(
        form.maxStayNights
      ) <
      Number(
        form.minStayNights
      )
    ) {

      setError(
        'Maximum nights cannot be less than minimum nights.'
      );

      return false;
    }


    return true;
  }


  async function saveProperty(
    submitForReview
  ) {

    setError('');
    setSuccess('');


    if (!host?.id) {

      setError(
        'Host information is missing.'
      );

      return;
    }


    if (
      !property?.id
    ) {

      setError(
        'Property information is missing.'
      );

      return;
    }


    if (
      !EDITABLE_STATUSES.includes(
        property.moderation_status
      )
    ) {

      setError(
        'This property cannot currently be edited.'
      );

      return;
    }


    if (!validateForm()) {
      return;
    }


    try {

      setSaving(true);


      const moderationStatus =
        submitForReview
          ? 'pending_review'
          : 'draft';


      const payload = {

        name:
          form.name.trim(),

        property_type:
          form.propertyType,


        short_description:
          form.shortDescription.trim() ||
          null,

        description:
          form.description.trim() ||
          null,


        city:
          form.city.trim(),

        area:
          form.area.trim(),

        location_name:
          form.locationName.trim() ||
          `${form.area.trim()}, ${form.city.trim()}`,

        address:
          form.address.trim() ||
          null,

        google_maps_url:
          form.googleMapsUrl.trim() ||
          null,


        latitude:
          form.latitude === ''
            ? null
            : Number(
                form.latitude
              ),

        longitude:
          form.longitude === ''
            ? null
            : Number(
                form.longitude
              ),


        bedrooms:
          Number(
            form.bedrooms
          ),

        bathrooms:
          Number(
            form.bathrooms
          ),


        min_guests:
          Number(
            form.minGuests
          ),

        included_guests:
          Number(
            form.includedGuests
          ),

        max_guests:
          Number(
            form.maxGuests
          ),

        extra_guest_fee:
          Number(
            form.extraGuestFee ||
              0
          ),


        base_price:
          Number(
            form.basePrice
          ),

        cleaning_fee:
          Number(
            form.cleaningFee ||
              0
          ),

        security_deposit:
          Number(
            form.securityDeposit ||
              0
          ),


        min_stay_nights:
          Number(
            form.minStayNights
          ),

        max_stay_nights:
          Number(
            form.maxStayNights
          ),


        check_in_time:
          form.checkInTime,

        check_out_time:
          form.checkOutTime,

        late_checkout_hourly_fee:
          Number(
            form.lateCheckoutHourlyFee ||
              0
          ),


        amenities,


        features:
          splitLines(
            form.featuresText
          ),

        house_rules:
          splitLines(
            form.houseRulesText
          ),

        kitchen_features:
          splitLines(
            form.kitchenFeaturesText
          ),

        direction_instructions:
          form.directionInstructions.trim() ||
          null,


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
            ? Number(
                form.acCount ||
                  0
              )
            : 0,


        wifi_available:
          form.wifiAvailable,

        water_heater_count:
          Number(
            form.waterHeaterCount ||
              0
          ),


        sofa_cum_bed_count:
          Number(
            form.sofaCumBedCount ||
              0
          ),

        single_bed_count:
          Number(
            form.singleBedCount ||
              0
          ),

        queen_bed_count:
          Number(
            form.queenBedCount ||
              0
          ),


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
          Number(
            form.weekendMarkupPercent ||
              0
          ),

        long_weekend_markup_percent:
          Number(
            form.longWeekendMarkupPercent ||
              0
          ),

        festival_markup_percent:
          Number(
            form.festivalMarkupPercent ||
              0
          ),

        season_markup_percent:
          Number(
            form.seasonMarkupPercent ||
              0
          ),


        moderation_status:
          moderationStatus,


        submitted_for_review_at:
          submitForReview
            ? new Date().toISOString()
            : null,


        reviewed_at:
          null,

        reviewed_by:
          null,

        moderation_notes:
          submitForReview
            ? null
            : property.moderation_notes,

        is_active:
          false,

        updated_at:
          new Date().toISOString(),
      };


      const {
        error:
          updateError,
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
            propertyId
          )
          .eq(
            'host_id',
            host.id
          );


      if (updateError) {
        throw updateError;
      }


      await uploadNewPhotos();


      setProperty(
        (current) => ({
          ...current,
          ...payload,
        })
      );


      setSuccess(
        submitForReview
          ? 'Property submitted for Admin review successfully.'
          : 'Property changes saved as Draft successfully.'
      );


      setTimeout(
        () => {

          window.location.replace(
            '/host/properties'
          );

        },
        900
      );

    } catch (err) {

      console.error(err);

      setError(
        err?.message ||
          'Unable to update property.'
      );

    } finally {

      setSaving(false);
    }
  }


  const photoPreviews =
    useMemo(
      () =>
        selectedPhotos.map(
          (file) => ({
            file,

            url:
              URL.createObjectURL(
                file
              ),
          })
        ),
      [selectedPhotos]
    );


  if (loading) {

    return (
      <main className="nosEditLoading">

        Loading Property...

        <PageStyles />

      </main>
    );
  }


  if (
    error &&
    !property
  ) {

    return (
      <main className="nosEditPage">
        <div className="nosEditShell">

          <div className="nosEditAlert nosEditError">
            {error}
          </div>

        </div>


        <PageStyles />

      </main>
    );
  }


  const canEdit =
    EDITABLE_STATUSES.includes(
      property?.moderation_status
    );


  return (
    <main className="nosEditPage">
      <div className="nosEditShell">

        <section className="nosEditPageTitle">

          <div>

            <p className="nosEditEyebrow">
              HOST PROPERTY LISTING
            </p>

            <h1>
              Edit Property
            </h1>

            <p>
              Update the listing and submit it for Admin review when ready.
            </p>

          </div>


          <StatusBadge
            status={
              property?.moderation_status
            }
          />

        </section>


        {property?.moderation_notes && (

          <section className="nosEditAdminNote">

            <strong>
              Admin Note
            </strong>

            <p>
              {
                property.moderation_notes
              }
            </p>

          </section>

        )}


        {!canEdit && (

          <section className="nosEditLocked">

            <strong>
              Editing is currently locked
            </strong>

            <p>

              This listing currently has status

              {' '}

              <b>
                {
                  formatStatus(
                    property?.moderation_status
                  )
                }
              </b>

              .

              Approved, Draft, Changes Requested and Declined listings can be edited. Changes to an approved listing remain subject to platform moderation rules.

            </p>

          </section>

        )}


        {error && (

          <div className="nosEditAlert nosEditError">
            {error}
          </div>

        )}


        {success && (

          <div className="nosEditAlert nosEditSuccess">
            {success}
          </div>

        )}


        <div className="nosEditFormLayout">

          <div className="nosEditMainColumn">


            <Section title="Basic Information">

              <div className="nosEditGrid2">

                <Field
                  label="PROPERTY NAME"
                  name="name"
                  value={form.name}
                  onChange={updateField}
                  disabled={!canEdit}
                  placeholder="Example: Cozy 2BHK Bavdhan"
                  full
                />


                <SelectField
                  label="PROPERTY TYPE"
                  name="propertyType"
                  value={form.propertyType}
                  onChange={updateField}
                  disabled={!canEdit}
                  options={
                    PROPERTY_TYPES
                  }
                />


                <Field
                  label="SHORT DESCRIPTION"
                  name="shortDescription"
                  value={
                    form.shortDescription
                  }
                  onChange={updateField}
                  disabled={!canEdit}
                  placeholder="Short property highlight"
                />


                <TextArea
                  label="FULL DESCRIPTION"
                  name="description"
                  value={
                    form.description
                  }
                  onChange={updateField}
                  disabled={!canEdit}
                  placeholder="Describe the property, stay experience and nearby attractions."
                  full
                />

              </div>

            </Section>


            <Section title="Location">

              <div className="nosEditGrid2">

                <Field
                  label="CITY"
                  name="city"
                  value={form.city}
                  onChange={updateField}
                  disabled={!canEdit}
                />


                <Field
                  label="AREA / LOCALITY"
                  name="area"
                  value={form.area}
                  onChange={updateField}
                  disabled={!canEdit}
                  placeholder="Bavdhan"
                />


                <Field
                  label="DISPLAY LOCATION"
                  name="locationName"
                  value={
                    form.locationName
                  }
                  onChange={updateField}
                  disabled={!canEdit}
                  placeholder="Bavdhan, Pune"
                />


                <Field
                  label="GOOGLE MAPS LINK"
                  name="googleMapsUrl"
                  value={
                    form.googleMapsUrl
                  }
                  onChange={updateField}
                  disabled={!canEdit}
                  placeholder="Paste Maps link"
                />

                <div style={{display:'flex',alignItems:'end'}}>
                  <button type="button" disabled={!canEdit} onClick={resolveGoogleMapsLocation} style={{width:'100%',minHeight:44,border:'1px solid #d8dee4',borderRadius:10,background:canEdit?'#303a44':'#aab1b7',color:'#fff',fontWeight:800,cursor:canEdit?'pointer':'not-allowed'}}>Use exact location from Maps link</button>
                </div>


                <TextArea
                  label="FULL ADDRESS"
                  name="address"
                  value={form.address}
                  onChange={updateField}
                  disabled={!canEdit}
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
                  disabled={!canEdit}
                />


                <Field
                  label="LONGITUDE"
                  name="longitude"
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={updateField}
                  disabled={!canEdit}
                />

              </div>

            </Section>


            <Section title="Rooms and Guests">

              <div className="nosEditGrid4">

                <NumberField
                  label="BEDROOMS"
                  name="bedrooms"
                  value={
                    form.bedrooms
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <NumberField
                  label="BATHROOMS"
                  name="bathrooms"
                  value={
                    form.bathrooms
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <NumberField
                  label="MIN GUESTS"
                  name="minGuests"
                  value={
                    form.minGuests
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <NumberField
                  label="INCLUDED GUESTS"
                  name="includedGuests"
                  value={
                    form.includedGuests
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <NumberField
                  label="MAX GUESTS"
                  name="maxGuests"
                  value={
                    form.maxGuests
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <NumberField
                  label="QUEEN BEDS"
                  name="queenBedCount"
                  value={
                    form.queenBedCount
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <NumberField
                  label="SINGLE BEDS"
                  name="singleBedCount"
                  value={
                    form.singleBedCount
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <NumberField
                  label="SOFA CUM BEDS"
                  name="sofaCumBedCount"
                  value={
                    form.sofaCumBedCount
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />

              </div>

            </Section>


            <Section title="Pricing">

              <div className="nosEditGrid4">

                <NumberField
                  label="BASE NIGHTLY RATE ₹"
                  name="basePrice"
                  value={
                    form.basePrice
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <NumberField
                  label="EXTRA GUEST FEE ₹"
                  name="extraGuestFee"
                  value={
                    form.extraGuestFee
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <NumberField
                  label="CLEANING FEE ₹"
                  name="cleaningFee"
                  value={
                    form.cleaningFee
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <NumberField
                  label="SECURITY DEPOSIT ₹"
                  name="securityDeposit"
                  value={
                    form.securityDeposit
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <NumberField
                  label="MINIMUM NIGHTS"
                  name="minStayNights"
                  value={
                    form.minStayNights
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <NumberField
                  label="MAXIMUM NIGHTS"
                  name="maxStayNights"
                  value={
                    form.maxStayNights
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <NumberField
                  label="LATE CHECKOUT / HOUR ₹"
                  name="lateCheckoutHourlyFee"
                  value={
                    form.lateCheckoutHourlyFee
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />

              </div>

            </Section>


            <Section title="Check-in and House Rules">

              <div className="nosEditGrid2">

                <Field
                  label="CHECK-IN TIME"
                  name="checkInTime"
                  type="time"
                  value={
                    form.checkInTime
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <Field
                  label="CHECK-OUT TIME"
                  name="checkOutTime"
                  type="time"
                  value={
                    form.checkOutTime
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />

              </div>


              <div className="nosEditChecks">

                <Check
                  label="Pets Allowed"
                  name="petsAllowed"
                  checked={
                    form.petsAllowed
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <Check
                  label="Parties Allowed"
                  name="partiesAllowed"
                  checked={
                    form.partiesAllowed
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <Check
                  label="Couples Allowed"
                  name="couplesAllowed"
                  checked={
                    form.couplesAllowed
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <Check
                  label="Alcohol Allowed"
                  name="alcoholAllowed"
                  checked={
                    form.alcoholAllowed
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <Check
                  label="Smoking Allowed"
                  name="smokingAllowed"
                  checked={
                    form.smokingAllowed
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <Check
                  label="Quiet Hours Enabled"
                  name="quietHoursEnabled"
                  checked={
                    form.quietHoursEnabled
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />

              </div>


              {form.quietHoursEnabled && (

                <div className="nosEditGrid2">

                  <Field
                    label="QUIET HOURS START"
                    name="quietHoursStart"
                    type="time"
                    value={
                      form.quietHoursStart
                    }
                    onChange={
                      updateField
                    }
                    disabled={!canEdit}
                  />


                  <Field
                    label="QUIET HOURS END"
                    name="quietHoursEnd"
                    type="time"
                    value={
                      form.quietHoursEnd
                    }
                    onChange={
                      updateField
                    }
                    disabled={!canEdit}
                  />

                </div>

              )}


              <TextArea
                label="HOUSE RULES"
                name="houseRulesText"
                value={
                  form.houseRulesText
                }
                onChange={
                  updateField
                }
                disabled={!canEdit}
                placeholder={
                  'Enter one rule per line\nNo loud music after 10 PM\nGovernment ID required'
                }
                full
              />

            </Section>


            <Section title="Amenities">

              <div className="nosEditAmenities">

                {AMENITIES.map(
                  (item) => (

                    <button
                      type="button"
                      key={item}
                      disabled={!canEdit}
                      onClick={() =>
                        toggleAmenity(
                          item
                        )
                      }
                      className={
                        amenities.includes(
                          item
                        )
                          ? 'nosEditAmenity active'
                          : 'nosEditAmenity'
                      }
                    >
                      {item}
                    </button>

                  )
                )}

              </div>


              <div className="nosEditChecks">

                <Check
                  label="Wi-Fi Available"
                  name="wifiAvailable"
                  checked={
                    form.wifiAvailable
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <Check
                  label="TV Available"
                  name="tvAvailable"
                  checked={
                    form.tvAvailable
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <Check
                  label="Fridge Available"
                  name="fridgeAvailable"
                  checked={
                    form.fridgeAvailable
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <Check
                  label="Washing Machine"
                  name="washingMachineAvailable"
                  checked={
                    form.washingMachineAvailable
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <Check
                  label="AC Available"
                  name="acAvailable"
                  checked={
                    form.acAvailable
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />

              </div>


              <div className="nosEditGrid4">

                <NumberField
                  label="AC COUNT"
                  name="acCount"
                  value={
                    form.acCount
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />


                <NumberField
                  label="WATER HEATERS"
                  name="waterHeaterCount"
                  value={
                    form.waterHeaterCount
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                />

              </div>


              <div className="nosEditGrid2">

                <TextArea
                  label="OTHER FEATURES"
                  name="featuresText"
                  value={
                    form.featuresText
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                  placeholder="One feature per line"
                />


                <TextArea
                  label="KITCHEN FEATURES"
                  name="kitchenFeaturesText"
                  value={
                    form.kitchenFeaturesText
                  }
                  onChange={
                    updateField
                  }
                  disabled={!canEdit}
                  placeholder="One item per line"
                />

              </div>

            </Section>


            <Section title="Directions">

              <TextArea
                label="DIRECTION / CHECK-IN INSTRUCTIONS"
                name="directionInstructions"
                value={
                  form.directionInstructions
                }
                onChange={
                  updateField
                }
                disabled={!canEdit}
                placeholder="Landmark, entry gate, parking instructions etc."
                full
              />

            </Section>


            <Section title="Property Photos">

              <p className="nosEditHelper">

                The photo marked COVER is the main property image.

              </p>


              {existingPhotos.length >
                0 && (

                <>
                  <h3 className="nosEditSubheading">
                    Existing Photos
                  </h3>


                  <div className="nosEditPhotoGrid">

                    {existingPhotos.map(
                      (
                        photo,
                        index
                      ) => (

                        <div
                          className="nosEditPhotoItem"
                          key={
                            photo.id
                          }
                        >

                          <img
                            src={
                              photo.image_url
                            }
                            alt={
                              photo.alt_text ||
                              ''
                            }
                          />


                          {photo.is_cover && (

                            <span className="nosEditCover">
                              COVER
                            </span>

                          )}


                          <div className="nosEditPhotoActions">

                            {!photo.is_cover &&
                              canEdit && (

                              <button
                                type="button"
                                disabled={
                                  saving
                                }
                                onClick={() =>
                                  setCoverPhoto(
                                    photo.id
                                  )
                                }
                              >
                                Make Cover
                              </button>

                            )}


                            {canEdit && (

                              <button
                                type="button"
                                className="nosEditRemovePhoto"
                                disabled={
                                  saving
                                }
                                onClick={() =>
                                  removeExistingPhoto(
                                    photo
                                  )
                                }
                              >
                                Remove
                              </button>

                            )}

                          </div>

                        </div>

                      )
                    )}

                  </div>
                </>

              )}


              {canEdit && (

                <>
                  <h3 className="nosEditSubheading">
                    Add More Photos
                  </h3>


                  <label className="nosEditUploadBox">

                    <span>
                      Select Property Photos
                    </span>

                    <small>
                      Choose multiple JPG, PNG or WEBP images
                    </small>


                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={
                        handlePhotoSelection
                      }
                    />

                  </label>
                </>

              )}


              {photoPreviews.length >
                0 && (

                <div className="nosEditPhotoGrid">

                  {photoPreviews.map(
                    (
                      item,
                      index
                    ) => (

                      <div
                        className="nosEditPhotoItem"
                        key={
                          `${item.file.name}-${index}`
                        }
                      >

                        <img
                          src={
                            item.url
                          }
                          alt=""
                        />


                        {existingPhotos.length ===
                          0 &&
                          index === 0 && (

                          <span className="nosEditCover">
                            NEW COVER
                          </span>

                        )}


                        <button
                          type="button"
                          className="nosEditNewRemove"
                          onClick={() =>
                            removeSelectedPhoto(
                              index
                            )
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


          <aside className="nosEditSideColumn">


            <section className="nosEditSideCard">

              <h2>
                Dynamic Pricing
              </h2>


              <Check
                label="Enable automatic pricing markups"
                name="dynamicPricingEnabled"
                checked={
                  form.dynamicPricingEnabled
                }
                onChange={
                  updateField
                }
                disabled={!canEdit}
              />


              {form.dynamicPricingEnabled && (

                <div className="nosEditGrid2">

                  <NumberField
                    label="WEEKEND MARKUP %"
                    name="weekendMarkupPercent"
                    value={
                      form.weekendMarkupPercent
                    }
                    onChange={
                      updateField
                    }
                    disabled={!canEdit}
                  />


                  <NumberField
                    label="LONG WEEKEND %"
                    name="longWeekendMarkupPercent"
                    value={
                      form.longWeekendMarkupPercent
                    }
                    onChange={
                      updateField
                    }
                    disabled={!canEdit}
                  />


                  <NumberField
                    label="FESTIVAL %"
                    name="festivalMarkupPercent"
                    value={
                      form.festivalMarkupPercent
                    }
                    onChange={
                      updateField
                    }
                    disabled={!canEdit}
                  />


                  <NumberField
                    label="SEASON %"
                    name="seasonMarkupPercent"
                    value={
                      form.seasonMarkupPercent
                    }
                    onChange={
                      updateField
                    }
                    disabled={!canEdit}
                  />

                </div>

              )}

            </section>


            <section className="nosEditReviewCard">

              <h2>
                Listing Status
              </h2>


              <StatusBadge
                status={
                  property?.moderation_status
                }
              />


              <p>

                Save as Draft while making changes.

                Submit for Review when the listing is complete.

              </p>


              <div className="nosEditReviewSteps">

                <span>
                  1. Edit property
                </span>

                <span>
                  2. Submit for review
                </span>

                <span>
                  3. Admin reviews listing
                </span>

                <span>
                  4. Admin approves or requests changes
                </span>

                <span>
                  5. Approved property goes live
                </span>

              </div>

            </section>

          </aside>

        </div>


        {canEdit && (

          <div className="nosEditBottomActions">

            <a
              href="/host/properties"
              className="nosEditCancel"
            >
              Cancel
            </a>


            <button
              type="button"
              className="nosEditDraftButton"
              disabled={saving}
              onClick={() =>
                saveProperty(
                  false
                )
              }
            >

              {saving
                ? 'Saving...'
                : 'Save as Draft'}

            </button>


            <button
              type="button"
              className="nosEditSubmitButton"
              disabled={saving}
              onClick={() =>
                saveProperty(
                  true
                )
              }
            >

              {saving
                ? 'Submitting...'
                : 'Submit for Review'}

            </button>

          </div>

        )}

      </div>


      <PageStyles />

    </main>
  );
}


function Section({
  title,
  children,
}) {

  return (
    <section className="nosEditCard">

      <h2>
        {title}
      </h2>

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
          ? 'nosEditField nosEditFull'
          : 'nosEditField'
      }
    >

      <span>
        {label}
      </span>

      <input
        {...props}
      />

    </label>
  );
}


function NumberField(
  props
) {

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
    <label className="nosEditField">

      <span>
        {label}
      </span>


      <select
        {...props}
      >

        {options.map(
          (option) => (

            <option
              key={
                option
              }
              value={
                option
              }
            >
              {option}
            </option>

          )
        )}

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
          ? 'nosEditField nosEditFull'
          : 'nosEditField'
      }
    >

      <span>
        {label}
      </span>


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
    <label className="nosEditCheck">

      <input
        type="checkbox"
        {...props}
      />

      <span>
        {label}
      </span>

    </label>
  );
}


function StatusBadge({
  status,
}) {

  const cleanStatus =
    status || 'draft';


  return (
    <span
      className={
        `nosEditStatus nosEditStatus-${cleanStatus}`
      }
    >
      {
        formatStatus(
          cleanStatus
        )
      }
    </span>
  );
}


function formatStatus(
  value
) {

  if (!value) {
    return 'Draft';
  }


  return String(value)
    .replace(
      /_/g,
      ' '
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
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


      .nosEditPage,
      .nosEditLoading {
        min-height: 100vh;
        width: 100%;
        background: #f6f7f9;
        color: #111827;
        font-family: Arial, sans-serif;
      }


      .nosEditLoading {
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
      }


      .nosEditHeader {
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


      .nosEditBrandArea {
        display: flex;
        align-items: center;
        gap: 12px;
      }


      .nosEditBrand {
        color: #f00078;
        font-size: 25px;
        font-weight: 900;
        text-decoration: none;
      }


      .nosEditBadge {
        background: #111827;
        color: #ffffff;

        border-radius: 999px;

        padding: 7px 11px;

        font-size: 10px;
        font-weight: 900;
      }


      .nosEditBack {
        color: #374151;

        border: 1px solid #d1d5db;

        padding: 10px 14px;

        border-radius: 8px;

        text-decoration: none;

        font-size: 12px;
        font-weight: 800;
      }


      .nosEditShell {
        width: min(
          1500px,
          calc(100% - 48px)
        );

        margin: 0 auto;

        padding: 32px 0 50px;
      }


      .nosEditPageTitle {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;

        gap: 24px;

        margin-bottom: 24px;
      }


      .nosEditEyebrow {
        margin: 0 0 7px;

        color: #6b7280;

        font-size: 11px;
        font-weight: 900;

        letter-spacing: 1px;
      }


      .nosEditPageTitle h1 {
        margin: 0;

        font-size: 34px;
      }


      .nosEditPageTitle p:last-child {
        margin: 8px 0 0;

        color: #6b7280;

        font-size: 14px;
      }


      .nosEditFormLayout {
        display: grid;

        grid-template-columns:
          minmax(0, 1fr)
          340px;

        gap: 22px;

        align-items: start;
      }


      .nosEditMainColumn {
        min-width: 0;
      }


      .nosEditSideColumn {
        display: flex;
        flex-direction: column;

        gap: 18px;

        position: sticky;
        top: 94px;
      }


      .nosEditCard,
      .nosEditSideCard,
      .nosEditReviewCard {
        width: 100%;

        background: #ffffff;

        border: 1px solid #e5e7eb;

        border-radius: 14px;

        padding: 24px;

        margin-bottom: 18px;
      }


      .nosEditSideCard,
      .nosEditReviewCard {
        margin-bottom: 0;
      }


      .nosEditCard h2,
      .nosEditSideCard h2,
      .nosEditReviewCard h2 {
        margin: 0 0 20px;

        font-size: 19px;
      }


      .nosEditSubheading {
        margin: 22px 0 12px;

        font-size: 14px;
      }


      .nosEditGrid2 {
        display: grid;

        grid-template-columns:
          repeat(
            2,
            minmax(0, 1fr)
          );

        gap: 16px;
      }


      .nosEditGrid4 {
        display: grid;

        grid-template-columns:
          repeat(
            4,
            minmax(0, 1fr)
          );

        gap: 16px;
      }


      .nosEditField {
        min-width: 0;

        display: flex;
        flex-direction: column;

        gap: 7px;
      }


      .nosEditFull {
        grid-column: 1 / -1;
      }


      .nosEditField span {
        min-height: 14px;

        color: #374151;

        font-size: 11px;
        font-weight: 900;

        letter-spacing: 0.35px;

        line-height: 1.3;
      }


      .nosEditField input,
      .nosEditField select,
      .nosEditField textarea {
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


      .nosEditField input,
      .nosEditField select {
        height: 45px;
      }


      .nosEditField textarea {
        min-height: 110px;

        resize: vertical;
      }


      .nosEditField input:focus,
      .nosEditField select:focus,
      .nosEditField textarea:focus {
        border-color: #111827;

        box-shadow:
          0 0 0 2px
          rgba(
            17,
            24,
            39,
            0.06
          );
      }


      .nosEditField input:disabled,
      .nosEditField select:disabled,
      .nosEditField textarea:disabled {
        background: #f3f4f6;

        cursor: not-allowed;

        color: #6b7280;
      }


      .nosEditChecks {
        display: grid;

        grid-template-columns:
          repeat(
            3,
            minmax(0, 1fr)
          );

        gap: 10px;

        margin: 18px 0 22px;
      }


      .nosEditCheck {
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


      .nosEditCheck input {
        width: 16px;
        height: 16px;

        flex: 0 0 auto;
      }


      .nosEditCheck:has(
        input:disabled
      ) {
        background: #f3f4f6;

        cursor: not-allowed;

        opacity: 0.7;
      }


      .nosEditAmenities {
        display: grid;

        grid-template-columns:
          repeat(
            4,
            minmax(0, 1fr)
          );

        gap: 10px;

        margin-bottom: 18px;
      }


      .nosEditAmenity {
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


      .nosEditAmenity.active {
        background: #111827;

        color: #ffffff;

        border-color: #111827;
      }


      .nosEditAmenity:disabled {
        opacity: 0.55;

        cursor: not-allowed;
      }


      .nosEditHelper {
        margin: -6px 0 16px;

        color: #6b7280;

        font-size: 13px;
      }


      .nosEditUploadBox {
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


      .nosEditUploadBox span {
        font-size: 14px;
        font-weight: 900;
      }


      .nosEditUploadBox small {
        color: #6b7280;
      }


      .nosEditUploadBox input {
        display: none;
      }


      .nosEditPhotoGrid {
        display: grid;

        grid-template-columns:
          repeat(
            4,
            minmax(0, 1fr)
          );

        gap: 14px;

        margin-top: 18px;
      }


      .nosEditPhotoItem {
        position: relative;

        overflow: hidden;

        border: 1px solid #e5e7eb;

        border-radius: 10px;

        background: #ffffff;
      }


      .nosEditPhotoItem img {
        display: block;

        width: 100%;

        aspect-ratio: 16 / 10;

        object-fit: cover;
      }


      .nosEditCover {
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


      .nosEditPhotoActions {
        display: grid;

        grid-template-columns:
          repeat(
            2,
            minmax(0, 1fr)
          );
      }


      .nosEditPhotoActions button,
      .nosEditNewRemove {
        min-height: 38px;

        border: 0;

        border-top:
          1px solid
          #e5e7eb;

        background: #ffffff;

        cursor: pointer;

        font-size: 11px;
        font-weight: 800;
      }


      .nosEditRemovePhoto,
      .nosEditNewRemove {
        color: #b91c1c;
      }


      .nosEditNewRemove {
        width: 100%;
      }


      .nosEditReviewCard {
        background: #fff4f9;

        border-color: #ffd9eb;
      }


      .nosEditReviewCard p {
        margin: 18px 0 16px;

        color: #4b5563;

        font-size: 13px;

        line-height: 1.6;
      }


      .nosEditReviewSteps {
        display: flex;
        flex-direction: column;

        gap: 8px;
      }


      .nosEditReviewSteps span {
        display: block;

        padding: 9px 10px;

        border-radius: 8px;

        background:
          rgba(
            255,
            255,
            255,
            0.7
          );

        font-size: 12px;
        font-weight: 700;
      }


      .nosEditAdminNote {
        margin-bottom: 18px;

        padding: 18px;

        border: 1px solid #f59e0b;

        border-radius: 12px;

        background: #fffbeb;
      }


      .nosEditAdminNote strong {
        display: block;

        margin-bottom: 7px;

        color: #92400e;
      }


      .nosEditAdminNote p {
        margin: 0;

        color: #78350f;

        line-height: 1.6;
      }


      .nosEditLocked {
        margin-bottom: 18px;

        padding: 18px;

        border: 1px solid #d1d5db;

        border-radius: 12px;

        background: #ffffff;
      }


      .nosEditLocked strong {
        display: block;

        margin-bottom: 7px;
      }


      .nosEditLocked p {
        margin: 0;

        color: #6b7280;

        line-height: 1.6;
      }


      .nosEditAlert {
        border-radius: 10px;

        padding: 13px 15px;

        margin-bottom: 18px;

        font-weight: 700;
      }


      .nosEditError {
        background: #fef2f2;

        color: #b91c1c;
      }


      .nosEditSuccess {
        background: #ecfdf5;

        color: #047857;
      }


      .nosEditBottomActions {
        display: flex;

        justify-content: flex-end;

        gap: 10px;

        padding-top: 6px;
      }


      .nosEditCancel,
      .nosEditDraftButton,
      .nosEditSubmitButton {
        min-height: 46px;

        display: inline-flex;
        align-items: center;
        justify-content: center;

        border-radius: 9px;

        padding: 0 19px;

        font-size: 13px;
        font-weight: 900;
      }


      .nosEditCancel {
        border: 1px solid #d1d5db;

        background: #ffffff;

        color: #374151;

        text-decoration: none;
      }


      .nosEditDraftButton {
        border: 1px solid #d1d5db;

        background: #ffffff;

        color: #111827;

        cursor: pointer;
      }


      .nosEditSubmitButton {
        border: 0;

        background: #111827;

        color: #ffffff;

        cursor: pointer;
      }


      .nosEditDraftButton:disabled,
      .nosEditSubmitButton:disabled {
        opacity: 0.6;

        cursor: not-allowed;
      }


      .nosEditStatus {
        display: inline-flex;

        align-items: center;

        width: fit-content;

        min-height: 32px;

        padding: 0 11px;

        border-radius: 999px;

        background: #f3f4f6;

        color: #374151;

        font-size: 11px;
        font-weight: 900;
      }


      .nosEditStatus-draft {
        background: #f3f4f6;

        color: #374151;
      }


      .nosEditStatus-pending_review {
        background: #fff7ed;

        color: #c2410c;
      }


      .nosEditStatus-changes_requested {
        background: #fef2f2;

        color: #b91c1c;
      }


      .nosEditStatus-approved {
        background: #ecfdf5;

        color: #047857;
      }


      .nosEditStatus-declined {
        background: #fef2f2;

        color: #b91c1c;
      }


      @media (
        max-width: 1150px
      ) {

        .nosEditFormLayout {
          grid-template-columns:
            1fr;
        }


        .nosEditSideColumn {
          position: static;

          display: grid;

          grid-template-columns:
            repeat(
              2,
              minmax(
                0,
                1fr
              )
            );
        }


        .nosEditGrid4 {
          grid-template-columns:
            repeat(
              2,
              minmax(
                0,
                1fr
              )
            );
        }


        .nosEditAmenities {
          grid-template-columns:
            repeat(
              3,
              minmax(
                0,
                1fr
              )
            );
        }

      }


      @media (
        max-width: 800px
      ) {

        .nosEditHeader {
          padding:
            0
            18px;
        }


        .nosEditShell {
          width:
            min(
              calc(
                100% - 24px
              ),
              1500px
            );

          padding-top:
            22px;
        }


        .nosEditPageTitle {
          flex-direction:
            column;
        }


        .nosEditGrid2,
        .nosEditGrid4 {
          grid-template-columns:
            1fr;
        }


        .nosEditFull {
          grid-column:
            auto;
        }


        .nosEditChecks {
          grid-template-columns:
            repeat(
              2,
              minmax(
                0,
                1fr
              )
            );
        }


        .nosEditAmenities {
          grid-template-columns:
            repeat(
              2,
              minmax(
                0,
                1fr
              )
            );
        }


        .nosEditPhotoGrid {
          grid-template-columns:
            repeat(
              2,
              minmax(
                0,
                1fr
              )
            );
        }


        .nosEditSideColumn {
          grid-template-columns:
            1fr;
        }

      }


      @media (
        max-width: 520px
      ) {

        .nosEditHeader {
          min-height:
            64px;
        }


        .nosEditBrand {
          font-size:
            20px;
        }


        .nosEditBack {
          font-size:
            10px;

          padding:
            8px
            9px;
        }


        .nosEditPageTitle h1 {
          font-size:
            28px;
        }


        .nosEditCard,
        .nosEditSideCard,
        .nosEditReviewCard {
          padding:
            18px;
        }


        .nosEditChecks,
        .nosEditAmenities,
        .nosEditPhotoGrid {
          grid-template-columns:
            1fr;
        }


        .nosEditBottomActions {
          flex-direction:
            column;
        }


        .nosEditCancel,
        .nosEditDraftButton,
        .nosEditSubmitButton {
          width:
            100%;
        }

      }

    `}</style>
  );
}