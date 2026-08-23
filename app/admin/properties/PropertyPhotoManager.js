'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

function getStoragePathFromPublicUrl(imageUrl) {
  const marker =
    '/storage/v1/object/public/property-photos/';

  const index = imageUrl.indexOf(marker);

  if (index === -1) {
    return null;
  }

  return decodeURIComponent(
    imageUrl.substring(index + marker.length)
  );
}

function getExtension(filename) {
  const parts = filename.split('.');

  if (parts.length < 2) {
    return 'jpg';
  }

  return parts.pop().toLowerCase();
}

export default function PropertyPhotoManager({
  propertyId,
  propertyName,
}) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyPhotoId, setBusyPhotoId] = useState('');

  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (propertyId) {
      loadPhotos();
    }
  }, [propertyId]);

  async function loadPhotos() {
    setLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('property_photos')
      .select('*')
      .eq('property_id', propertyId)
      .order('sort_order', {
        ascending: true,
      });

    setLoading(false);

    if (error) {
      setErrorMessage(
        `Unable to load photos: ${error.message}`
      );
      return;
    }

    setPhotos(data || []);
  }

  async function uploadPhotos(event) {
    const files = Array.from(
      event.target.files || []
    );

    if (!files.length) {
      return;
    }

    setUploading(true);
    setMessage('');
    setErrorMessage('');

    try {
      let nextSortOrder = photos.length;

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];

        if (!file.type.startsWith('image/')) {
          throw new Error(
            'Only image files are allowed.'
          );
        }

        if (file.size > 10 * 1024 * 1024) {
          throw new Error(
            'Each image must be below 10 MB.'
          );
        }

        const extension = getExtension(
          file.name
        );

        const storagePath =
          `${propertyId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } =
          await supabase.storage
            .from('property-photos')
            .upload(storagePath, file, {
              cacheControl: '3600',
              upsert: false,
            });

        if (uploadError) {
          throw new Error(
            `Upload failed: ${uploadError.message}`
          );
        }

        const { data: publicData } =
          supabase.storage
            .from('property-photos')
            .getPublicUrl(storagePath);

        const shouldBeCover =
          photos.length === 0 && i === 0;

        const { error: insertError } =
          await supabase
            .from('property_photos')
            .insert({
              property_id: propertyId,
              image_url:
                publicData.publicUrl,
              alt_text:
                propertyName || '',
              sort_order:
                nextSortOrder,
              is_cover:
                shouldBeCover,
            });

        if (insertError) {
          await supabase.storage
            .from('property-photos')
            .remove([storagePath]);

          throw new Error(
            `Unable to save photo: ${insertError.message}`
          );
        }

        nextSortOrder += 1;
      }

      setMessage(
        'Photos uploaded successfully.'
      );

      event.target.value = '';

      await loadPhotos();
    } catch (error) {
      setErrorMessage(
        error.message ||
          'Unable to upload photos.'
      );
    } finally {
      setUploading(false);
    }
  }

  async function makeMainPhoto(photo) {
    setBusyPhotoId(photo.id);
    setMessage('');
    setErrorMessage('');

    try {
      const { error: clearError } =
        await supabase
          .from('property_photos')
          .update({
            is_cover: false,
          })
          .eq(
            'property_id',
            propertyId
          );

      if (clearError) {
        throw clearError;
      }

      const { error: updateError } =
        await supabase
          .from('property_photos')
          .update({
            is_cover: true,
          })
          .eq('id', photo.id);

      if (updateError) {
        throw updateError;
      }

      setMessage(
        'Main display photo updated.'
      );

      await loadPhotos();
    } catch (error) {
      setErrorMessage(
        `Unable to change main photo: ${
          error.message || 'Unknown error'
        }`
      );
    } finally {
      setBusyPhotoId('');
    }
  }

  async function replacePhoto(photo, file) {
    if (!file) {
      return;
    }

    setBusyPhotoId(photo.id);
    setMessage('');
    setErrorMessage('');

    try {
      if (!file.type.startsWith('image/')) {
        throw new Error(
          'Please select an image file.'
        );
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error(
          'Image must be below 10 MB.'
        );
      }

      const extension = getExtension(
        file.name
      );

      const newStoragePath =
        `${propertyId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } =
        await supabase.storage
          .from('property-photos')
          .upload(
            newStoragePath,
            file,
            {
              cacheControl: '3600',
              upsert: false,
            }
          );

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicData } =
        supabase.storage
          .from('property-photos')
          .getPublicUrl(
            newStoragePath
          );

      const oldStoragePath =
        getStoragePathFromPublicUrl(
          photo.image_url
        );

      const { error: updateError } =
        await supabase
          .from('property_photos')
          .update({
            image_url:
              publicData.publicUrl,
            alt_text:
              propertyName || '',
          })
          .eq('id', photo.id);

      if (updateError) {
        await supabase.storage
          .from('property-photos')
          .remove([
            newStoragePath,
          ]);

        throw updateError;
      }

      if (oldStoragePath) {
        await supabase.storage
          .from('property-photos')
          .remove([
            oldStoragePath,
          ]);
      }

      setMessage(
        'Photo replaced successfully.'
      );

      await loadPhotos();
    } catch (error) {
      setErrorMessage(
        `Unable to replace photo: ${
          error.message || 'Unknown error'
        }`
      );
    } finally {
      setBusyPhotoId('');
    }
  }

  async function deletePhoto(photo) {
    const confirmed =
      window.confirm(
        'Delete this photo permanently?'
      );

    if (!confirmed) {
      return;
    }

    setBusyPhotoId(photo.id);
    setMessage('');
    setErrorMessage('');

    try {
      const oldStoragePath =
        getStoragePathFromPublicUrl(
          photo.image_url
        );

      const { error: deleteError } =
        await supabase
          .from('property_photos')
          .delete()
          .eq('id', photo.id);

      if (deleteError) {
        throw deleteError;
      }

      if (oldStoragePath) {
        await supabase.storage
          .from('property-photos')
          .remove([
            oldStoragePath,
          ]);
      }

      const remaining = photos.filter(
        (item) =>
          item.id !== photo.id
      );

      if (
        photo.is_cover &&
        remaining.length > 0
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
      }

      await updateSortOrder(remaining);

      setMessage(
        'Photo deleted successfully.'
      );

      await loadPhotos();
    } catch (error) {
      setErrorMessage(
        `Unable to delete photo: ${
          error.message || 'Unknown error'
        }`
      );
    } finally {
      setBusyPhotoId('');
    }
  }

  async function movePhoto(
    currentIndex,
    direction
  ) {
    const newIndex =
      direction === 'left'
        ? currentIndex - 1
        : currentIndex + 1;

    if (
      newIndex < 0 ||
      newIndex >= photos.length
    ) {
      return;
    }

    const reordered = [...photos];

    const temp =
      reordered[currentIndex];

    reordered[currentIndex] =
      reordered[newIndex];

    reordered[newIndex] =
      temp;

    setPhotos(reordered);

    setMessage('');
    setErrorMessage('');

    try {
      await updateSortOrder(
        reordered
      );

      setMessage(
        'Photo order updated.'
      );

      await loadPhotos();
    } catch (error) {
      setErrorMessage(
        `Unable to reorder photos: ${
          error.message || 'Unknown error'
        }`
      );

      await loadPhotos();
    }
  }

  async function updateSortOrder(
    orderedPhotos
  ) {
    for (
      let i = 0;
      i < orderedPhotos.length;
      i += 1
    ) {
      const { error } =
        await supabase
          .from('property_photos')
          .update({
            sort_order: i,
          })
          .eq(
            'id',
            orderedPhotos[i].id
          );

      if (error) {
        throw error;
      }
    }
  }

  if (!propertyId) {
    return null;
  }

  return (
    <section style={styles.section}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>
            Property Photos
          </h2>

          <p style={styles.description}>
            Upload, replace, delete, reorder and choose the main display photo.
          </p>
        </div>

        <label style={styles.uploadButton}>
          {uploading
            ? 'Uploading...'
            : '+ Add Photos'}

          <input
            type="file"
            multiple
            accept="image/*"
            onChange={
              uploadPhotos
            }
            disabled={
              uploading
            }
            style={{
              display: 'none',
            }}
          />
        </label>
      </div>

      {errorMessage && (
        <div style={styles.error}>
          {errorMessage}
        </div>
      )}

      {message && (
        <div style={styles.success}>
          {message}
        </div>
      )}

      {loading ? (
        <p>Loading photos...</p>
      ) : photos.length === 0 ? (
        <div style={styles.empty}>
          No property photos uploaded yet.
        </div>
      ) : (
        <div style={styles.grid}>
          {photos.map(
            (photo, index) => (
              <div
                key={photo.id}
                style={styles.card}
              >
                <div style={styles.imageWrapper}>
                  <img
                    src={
                      photo.image_url
                    }
                    alt={
                      photo.alt_text ||
                      propertyName ||
                      'Property'
                    }
                    style={styles.image}
                  />

                  {photo.is_cover && (
                    <div style={styles.mainBadge}>
                      MAIN PHOTO
                    </div>
                  )}

                  <div style={styles.numberBadge}>
                    {index + 1}
                  </div>
                </div>

                <div style={styles.actions}>
                  {!photo.is_cover && (
                    <button
                      type="button"
                      onClick={() =>
                        makeMainPhoto(
                          photo
                        )
                      }
                      disabled={
                        busyPhotoId ===
                        photo.id
                      }
                      style={styles.mainButton}
                    >
                      Make Main
                    </button>
                  )}

                  <div style={styles.moveRow}>
                    <button
                      type="button"
                      disabled={
                        index === 0
                      }
                      onClick={() =>
                        movePhoto(
                          index,
                          'left'
                        )
                      }
                      style={styles.moveButton}
                    >
                      ← Left
                    </button>

                    <button
                      type="button"
                      disabled={
                        index ===
                        photos.length - 1
                      }
                      onClick={() =>
                        movePhoto(
                          index,
                          'right'
                        )
                      }
                      style={styles.moveButton}
                    >
                      Right →
                    </button>
                  </div>

                  <label style={styles.replaceButton}>
                    Replace Photo

                    <input
                      type="file"
                      accept="image/*"
                      style={{
                        display: 'none',
                      }}
                      disabled={
                        busyPhotoId ===
                        photo.id
                      }
                      onChange={(
                        event
                      ) => {
                        const file =
                          event.target
                            .files?.[0];

                        replacePhoto(
                          photo,
                          file
                        );

                        event.target.value =
                          '';
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      deletePhoto(photo)
                    }
                    disabled={
                      busyPhotoId ===
                      photo.id
                    }
                    style={styles.deleteButton}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}

const styles = {
  section: {
    marginTop: '22px',
    background: '#ffffff',
    padding: '24px',
    border:
      '1px solid #e2e5e8',
    borderRadius: '16px',
  },

  headerRow: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },

  title: {
    margin: 0,
  },

  description: {
    color: '#687080',
    marginTop: '6px',
    marginBottom: 0,
  },

  uploadButton: {
    padding: '11px 16px',
    background: '#163c74',
    color: '#ffffff',
    borderRadius: '10px',
    fontWeight: '700',
    cursor: 'pointer',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(230px, 1fr))',
    gap: '18px',
    marginTop: '20px',
  },

  card: {
    border:
      '1px solid #dfe3e8',
    borderRadius: '14px',
    overflow: 'hidden',
    background: '#ffffff',
  },

  imageWrapper: {
    position: 'relative',
  },

  image: {
    width: '100%',
    aspectRatio: '16 / 9',
    objectFit: 'cover',
    display: 'block',
  },

  mainBadge: {
    position: 'absolute',
    top: '9px',
    left: '9px',
    background: '#163c74',
    color: '#ffffff',
    padding: '6px 9px',
    borderRadius: '8px',
    fontSize: '10px',
    fontWeight: '800',
  },

  numberBadge: {
    position: 'absolute',
    top: '9px',
    right: '9px',
    width: '28px',
    height: '28px',
    background:
      'rgba(255,255,255,0.94)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontSize: '12px',
  },

  actions: {
    display: 'grid',
    gap: '9px',
    padding: '12px',
  },

  mainButton: {
    padding: '10px',
    border: 0,
    borderRadius: '9px',
    background: '#163c74',
    color: '#ffffff',
    fontWeight: '700',
    cursor: 'pointer',
  },

  moveRow: {
    display: 'grid',
    gridTemplateColumns:
      '1fr 1fr',
    gap: '8px',
  },

  moveButton: {
    padding: '9px',
    border:
      '1px solid #ccd3db',
    borderRadius: '9px',
    background: '#ffffff',
    cursor: 'pointer',
  },

  replaceButton: {
    textAlign: 'center',
    padding: '10px',
    border:
      '1px solid #b07b12',
    borderRadius: '9px',
    background: '#fffaf0',
    color: '#8a600e',
    fontWeight: '700',
    cursor: 'pointer',
  },

  deleteButton: {
    padding: '10px',
    border: 0,
    borderRadius: '9px',
    background: '#ffe8e8',
    color: '#a11f1f',
    fontWeight: '700',
    cursor: 'pointer',
  },

  error: {
    marginTop: '15px',
    padding: '12px',
    background: '#ffecec',
    color: '#8b2020',
    borderRadius: '10px',
    fontWeight: '700',
  },

  success: {
    marginTop: '15px',
    padding: '12px',
    background: '#edf9f0',
    color: '#25663a',
    borderRadius: '10px',
    fontWeight: '700',
  },

  empty: {
    marginTop: '20px',
    padding: '24px',
    background: '#f6f7f9',
    borderRadius: '12px',
    color: '#687080',
  },
};