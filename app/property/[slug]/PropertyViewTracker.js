'use client';

import { useEffect } from 'react';

const VIEW_COOLDOWN_MS = 30 * 60 * 1000;

export default function PropertyViewTracker({
  supabase,
  propertyId,
  guestProfile,
  session,
}) {
  useEffect(() => {
    async function trackPropertyView() {
      try {
        const guestId = guestProfile?.id;
        const userId = session?.user?.id;

        if (!supabase || !propertyId || !guestId || !userId) {
          return;
        }

        const storageKey =
          `nightoutstay-property-view:${guestId}:${propertyId}`;

        const previousView = localStorage.getItem(storageKey);

        if (previousView) {
          const previousTimestamp = Number(previousView);

          if (
            Number.isFinite(previousTimestamp) &&
            Date.now() - previousTimestamp < VIEW_COOLDOWN_MS
          ) {
            return;
          }
        }

        const { error } = await supabase
          .from('property_views')
          .insert({
            property_id: propertyId,
            guest_id: guestId,
            user_id: userId,
            source: 'property_page',
          });

        if (error) {
          console.warn(
            'Property view tracking failed:',
            error.message
          );

          return;
        }

        localStorage.setItem(
          storageKey,
          String(Date.now())
        );
      } catch (error) {
        console.warn(
          'Property view tracking failed:',
          error
        );
      }
    }

    trackPropertyView();
  }, [
    supabase,
    propertyId,
    guestProfile?.id,
    session?.user?.id,
  ]);

  return null;
}