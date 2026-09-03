'use client';

import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

const VIEW_COOLDOWN_MS =
  30 * 60 * 1000; // 30 minutes

export default function PropertyViewTracker({
  propertyId,
  guestProfile,
  session,
}) {
  useEffect(() => {
    if (
      !propertyId ||
      !guestProfile?.id ||
      !session?.user?.id
    ) {
      return;
    }

    const userId =
      session.user.id;

    const guestId =
      guestProfile.id;

    const storageKey =
      `nightoutstay-property-view:${guestId}:${propertyId}`;

    let lastRecordedAt = 0;

    try {
      lastRecordedAt =
        Number(
          window.localStorage.getItem(
            storageKey
          ) || 0
        );
    } catch {
      lastRecordedAt = 0;
    }

    const now =
      Date.now();

    /*
      Do not count repeated refreshes/openings
      of the same property by the same guest
      within 30 minutes as separate views.
    */
    if (
      lastRecordedAt &&
      now - lastRecordedAt <
        VIEW_COOLDOWN_MS
    ) {
      return;
    }

    let cancelled = false;

    async function recordView() {
      try {
        const {
          error,
        } = await supabase
          .from('property_views')
          .insert({
            property_id:
              propertyId,

            guest_id:
              guestId,

            user_id:
              userId,

            source:
              'property_page',
          });

        if (cancelled) {
          return;
        }

        if (error) {
          console.warn(
            'Property view tracking:',
            error
          );

          return;
        }

        try {
          window.localStorage.setItem(
            storageKey,
            String(now)
          );
        } catch {
          // Tracking still succeeds even if
          // localStorage is unavailable.
        }
      } catch (error) {
        console.warn(
          'Property view tracking:',
          error
        );
      }
    }

    recordView();

    return () => {
      cancelled = true;
    };
  }, [
    propertyId,
    guestProfile?.id,
    session?.user?.id,
  ]);

  return null;
}