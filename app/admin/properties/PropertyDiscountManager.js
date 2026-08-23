'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

const dayOptions = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
];

const emptyOffer = {
  id: '',
  title: '',
  discount_type: 'percent',
  discount_value: '',
  start_date: '',
  end_date: '',
  min_nights: 1,
  offer_category: 'custom',
  applicable_days: [],
  apply_scope: 'eligible_nights',
  guest_selectable: true,
  is_active: true,
};

export default function PropertyDiscountManager({
  propertyId,
  propertyName,
}) {
  const [offers, setOffers] = useState([]);
  const [form, setForm] = useState(emptyOffer);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (propertyId) {
      loadOffers();
    }
  }, [propertyId]);

  async function loadOffers() {
    setLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('property_offers')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    setLoading(false);

    if (error) {
      setErrorMessage(
        `Unable to load discounts: ${error.message}`
      );
      return;
    }

    setOffers(data || []);
  }

  function updateField(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setMessage('');
    setErrorMessage('');
  }

  function toggleDay(day) {
    setForm((previous) => {
      const current =
        previous.applicable_days || [];

      const exists =
        current.includes(day);

      return {
        ...previous,
        applicable_days: exists
          ? current.filter(
              (item) => item !== day
            )
          : [...current, day],
      };
    });
  }

  function resetForm() {
    setForm(emptyOffer);
    setMessage('');
    setErrorMessage('');
  }

  function editOffer(offer) {
    setForm({
      ...emptyOffer,
      ...offer,
      applicable_days:
        Array.isArray(
          offer.applicable_days
        )
          ? offer.applicable_days
          : [],
    });

    setMessage('');
    setErrorMessage('');

    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: 'smooth',
    });
  }

  async function saveOffer(event) {
    event.preventDefault();

    setMessage('');
    setErrorMessage('');

    if (!form.title.trim()) {
      setErrorMessage(
        'Offer name is required.'
      );
      return;
    }

    if (
      !form.discount_value ||
      Number(form.discount_value) <= 0
    ) {
      setErrorMessage(
        'Enter a valid discount value.'
      );
      return;
    }

    if (
      form.discount_type === 'percent' &&
      Number(form.discount_value) > 100
    ) {
      setErrorMessage(
        'Percentage discount cannot exceed 100%.'
      );
      return;
    }

    if (
      form.start_date &&
      form.end_date &&
      form.end_date < form.start_date
    ) {
      setErrorMessage(
        'End date cannot be before start date.'
      );
      return;
    }

    setSaving(true);

    try {
      const payload = {
        property_id: propertyId,
        title: form.title.trim(),
        discount_type:
          form.discount_type,
        discount_value: Number(
          form.discount_value
        ),
        start_date:
          form.start_date || null,
        end_date:
          form.end_date || null,
        min_nights: Number(
          form.min_nights || 1
        ),
        offer_category:
          form.offer_category,
        applicable_days:
          form.applicable_days || [],
        apply_scope:
          form.apply_scope,
        guest_selectable:
          Boolean(
            form.guest_selectable
          ),
        is_active:
          Boolean(form.is_active),
        updated_at:
          new Date().toISOString(),
      };

      let result;

      if (form.id) {
        result = await supabase
          .from('property_offers')
          .update(payload)
          .eq('id', form.id);
      } else {
        result = await supabase
          .from('property_offers')
          .insert(payload);
      }

      if (result.error) {
        throw result.error;
      }

      setMessage(
        form.id
          ? 'Discount updated successfully.'
          : 'Discount created successfully.'
      );

      setForm(emptyOffer);

      await loadOffers();
    } catch (error) {
      setErrorMessage(
        `Unable to save discount: ${
          error.message ||
          'Unknown error'
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleOffer(offer) {
    setMessage('');
    setErrorMessage('');

    const { error } = await supabase
      .from('property_offers')
      .update({
        is_active:
          !offer.is_active,
        updated_at:
          new Date().toISOString(),
      })
      .eq('id', offer.id);

    if (error) {
      setErrorMessage(
        `Unable to update discount: ${error.message}`
      );
      return;
    }

    await loadOffers();
  }

  async function deleteOffer(offer) {
    const confirmed =
      window.confirm(
        `Delete discount "${offer.title}"?`
      );

    if (!confirmed) return;

    setMessage('');
    setErrorMessage('');

    const { error } = await supabase
      .from('property_offers')
      .delete()
      .eq('id', offer.id);

    if (error) {
      setErrorMessage(
        `Unable to delete discount: ${error.message}`
      );
      return;
    }

    setMessage(
      'Discount deleted successfully.'
    );

    await loadOffers();
  }

  if (!propertyId) {
    return null;
  }

  return (
    <section style={styles.section}>
      <div style={styles.headingRow}>
        <div>
          <h2 style={styles.heading}>
            Discounts & Offers
          </h2>

          <p style={styles.help}>
            Manage guest-selectable discounts for {propertyName}.
            Guests may select only one regular discount per booking.
            A host special offer may be added separately later.
          </p>
        </div>
      </div>

      <form
        onSubmit={saveOffer}
        style={styles.form}
      >
        <div style={styles.formGrid}>
          <Field
            label="OFFER NAME"
            value={form.title}
            onChange={(value) =>
              updateField(
                'title',
                value
              )
            }
            placeholder="Weekday Saver"
          />

          <SelectField
            label="OFFER CATEGORY"
            value={
              form.offer_category
            }
            onChange={(value) =>
              updateField(
                'offer_category',
                value
              )
            }
            options={[
              {
                value: 'weekday',
                label:
                  'Weekday Discount',
              },
              {
                value: 'weekend',
                label:
                  'Weekend Discount',
              },
              {
                value: 'specific_dates',
                label:
                  'Specific Dates',
              },
              {
                value: 'specific_week',
                label:
                  'Specific Week',
              },
              {
                value: 'seasonal',
                label:
                  'Seasonal',
              },
              {
                value: 'festival',
                label:
                  'Festival',
              },
              {
                value: 'all_days',
                label:
                  'All Days',
              },
              {
                value: 'custom',
                label:
                  'Custom',
              },
            ]}
          />

          <SelectField
            label="DISCOUNT TYPE"
            value={
              form.discount_type
            }
            onChange={(value) =>
              updateField(
                'discount_type',
                value
              )
            }
            options={[
              {
                value: 'percent',
                label:
                  'Percentage %',
              },
              {
                value: 'flat',
                label:
                  'Flat ₹',
              },
            ]}
          />

          <Field
            label="DISCOUNT VALUE"
            type="number"
            value={
              form.discount_value
            }
            onChange={(value) =>
              updateField(
                'discount_value',
                value
              )
            }
            placeholder={
              form.discount_type ===
              'percent'
                ? '10'
                : '500'
            }
          />

          <Field
            label="START DATE"
            type="date"
            value={
              form.start_date || ''
            }
            onChange={(value) =>
              updateField(
                'start_date',
                value
              )
            }
          />

          <Field
            label="END DATE"
            type="date"
            value={
              form.end_date || ''
            }
            onChange={(value) =>
              updateField(
                'end_date',
                value
              )
            }
          />

          <Field
            label="MINIMUM NIGHTS"
            type="number"
            value={
              form.min_nights
            }
            onChange={(value) =>
              updateField(
                'min_nights',
                value
              )
            }
          />

          <SelectField
            label="APPLY TO"
            value={
              form.apply_scope
            }
            onChange={(value) =>
              updateField(
                'apply_scope',
                value
              )
            }
            options={[
              {
                value:
                  'eligible_nights',
                label:
                  'Eligible Nights Only',
              },
              {
                value:
                  'entire_booking',
                label:
                  'Entire Booking',
              },
            ]}
          />
        </div>

        <div style={styles.daysBox}>
          <div style={styles.label}>
            APPLICABLE DAYS
          </div>

          <div style={styles.dayGrid}>
            {dayOptions.map((day) => (
              <label
                key={day.value}
                style={styles.dayItem}
              >
                <input
                  type="checkbox"
                  checked={
                    form.applicable_days.includes(
                      day.value
                    )
                  }
                  onChange={() =>
                    toggleDay(
                      day.value
                    )
                  }
                />

                {day.label}
              </label>
            ))}
          </div>

          <div style={styles.help}>
            Leave all days unchecked if the offer should apply every day in the selected date range.
          </div>
        </div>

        <div style={styles.toggleGrid}>
          <Toggle
            label="Guest Can Select This Offer"
            checked={
              form.guest_selectable
            }
            onChange={(value) =>
              updateField(
                'guest_selectable',
                value
              )
            }
          />

          <Toggle
            label="Offer Active"
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

        <div style={styles.formActions}>
          <button
            type="submit"
            disabled={saving}
            style={styles.saveButton}
          >
            {saving
              ? 'Saving...'
              : form.id
              ? 'Update Discount'
              : 'Create Discount'}
          </button>

          {form.id && (
            <button
              type="button"
              onClick={resetForm}
              style={styles.cancelButton}
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      <div style={styles.listHeading}>
        Existing Discounts
      </div>

      {loading ? (
        <p>Loading discounts...</p>
      ) : offers.length === 0 ? (
        <div style={styles.empty}>
          No discounts created yet.
        </div>
      ) : (
        <div style={styles.offerGrid}>
          {offers.map((offer) => (
            <div
              key={offer.id}
              style={styles.offerCard}
            >
              <div style={styles.offerTop}>
                <div>
                  <div style={styles.offerTitle}>
                    {offer.title}
                  </div>

                  <div style={styles.offerMeta}>
                    {offer.offer_category?.replaceAll(
                      '_',
                      ' '
                    )}
                  </div>
                </div>

                <span
                  style={{
                    ...styles.statusBadge,
                    background:
                      offer.is_active
                        ? '#e8f7ed'
                        : '#eeeeee',
                  }}
                >
                  {offer.is_active
                    ? 'Active'
                    : 'Inactive'}
                </span>
              </div>

              <div style={styles.discountValue}>
                {offer.discount_type ===
                'percent'
                  ? `${Number(
                      offer.discount_value
                    )}% OFF`
                  : `₹${Number(
                      offer.discount_value
                    ).toLocaleString(
                      'en-IN'
                    )} OFF`}
              </div>

              <div style={styles.offerMeta}>
                {offer.start_date
                  ? `From ${offer.start_date}`
                  : 'No start date'}
                {' → '}
                {offer.end_date ||
                  'No end date'}
              </div>

              <div style={styles.offerMeta}>
                Minimum stay:{' '}
                {offer.min_nights || 1}{' '}
                night
                {Number(
                  offer.min_nights
                ) === 1
                  ? ''
                  : 's'}
              </div>

              <div style={styles.offerMeta}>
                Apply to:{' '}
                {offer.apply_scope ===
                'entire_booking'
                  ? 'Entire Booking'
                  : 'Eligible Nights Only'}
              </div>

              <div style={styles.offerMeta}>
                Guest selectable:{' '}
                {offer.guest_selectable
                  ? 'Yes'
                  : 'No'}
              </div>

              {Array.isArray(
                offer.applicable_days
              ) &&
                offer.applicable_days
                  .length > 0 && (
                  <div style={styles.dayLabels}>
                    {offer.applicable_days.map(
                      (dayValue) => {
                        const day =
                          dayOptions.find(
                            (item) =>
                              item.value ===
                              dayValue
                          );

                        return (
                          <span
                            key={
                              dayValue
                            }
                            style={
                              styles.dayBadge
                            }
                          >
                            {day?.label ||
                              dayValue}
                          </span>
                        );
                      }
                    )}
                  </div>
                )}

              <div style={styles.cardActions}>
                <button
                  type="button"
                  onClick={() =>
                    editOffer(
                      offer
                    )
                  }
                  style={styles.editButton}
                >
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() =>
                    toggleOffer(
                      offer
                    )
                  }
                  style={styles.statusButton}
                >
                  {offer.is_active
                    ? 'Deactivate'
                    : 'Activate'}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    deleteOffer(
                      offer
                    )
                  }
                  style={styles.deleteButton}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
}) {
  return (
    <div>
      <label style={styles.label}>
        {label}
      </label>

      <input
        type={type}
        value={value ?? ''}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={placeholder}
        style={styles.input}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}) {
  return (
    <div>
      <label style={styles.label}>
        {label}
      </label>

      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        style={styles.input}
      >
        {options.map(
          (option) => (
            <option
              key={
                option.value
              }
              value={
                option.value
              }
            >
              {option.label}
            </option>
          )
        )}
      </select>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}) {
  return (
    <label style={styles.toggle}>
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

const styles = {
  section: {
    marginTop: '22px',
    background: '#ffffff',
    padding: '24px',
    border:
      '1px solid #e2e5e8',
    borderRadius: '16px',
  },

  headingRow: {
    display: 'flex',
    justifyContent:
      'space-between',
    gap: '20px',
    flexWrap: 'wrap',
  },

  heading: {
    margin: 0,
  },

  help: {
    color: '#687080',
    fontSize: '13px',
    marginTop: '7px',
  },

  form: {
    marginTop: '24px',
    padding: '18px',
    background: '#f7f8fa',
    borderRadius: '14px',
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '15px',
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
    boxSizing:
      'border-box',
    padding: '11px',
    border:
      '1px solid #ccd1d8',
    borderRadius: '9px',
    background: '#ffffff',
  },

  daysBox: {
    marginTop: '18px',
  },

  dayGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },

  dayItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 10px',
    border:
      '1px solid #d9dde3',
    borderRadius: '9px',
    background: '#ffffff',
    cursor: 'pointer',
  },

  toggleGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '10px',
    marginTop: '18px',
  },

  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '11px',
    background: '#ffffff',
    border:
      '1px solid #dfe3e8',
    borderRadius: '9px',
    cursor: 'pointer',
  },

  error: {
    marginTop: '15px',
    padding: '12px',
    background: '#ffecec',
    color: '#8b2020',
    borderRadius: '9px',
    fontWeight: '700',
  },

  success: {
    marginTop: '15px',
    padding: '12px',
    background: '#edf9f0',
    color: '#25663a',
    borderRadius: '9px',
    fontWeight: '700',
  },

  formActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '18px',
  },

  saveButton: {
    flex: 1,
    border: 0,
    padding: '12px',
    borderRadius: '9px',
    background: '#163c74',
    color: '#ffffff',
    fontWeight: '800',
    cursor: 'pointer',
  },

  cancelButton: {
    border:
      '1px solid #ccd1d8',
    padding: '12px 16px',
    borderRadius: '9px',
    background: '#ffffff',
    cursor: 'pointer',
  },

  listHeading: {
    marginTop: '30px',
    marginBottom: '12px',
    fontSize: '19px',
    fontWeight: '800',
  },

  empty: {
    padding: '20px',
    background: '#f7f8fa',
    borderRadius: '10px',
    color: '#687080',
  },

  offerGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
  },

  offerCard: {
    border:
      '1px solid #e0e3e7',
    borderRadius: '13px',
    padding: '17px',
    background: '#ffffff',
  },

  offerTop: {
    display: 'flex',
    justifyContent:
      'space-between',
    gap: '12px',
  },

  offerTitle: {
    fontSize: '17px',
    fontWeight: '800',
  },

  offerMeta: {
    marginTop: '7px',
    color: '#687080',
    fontSize: '13px',
    textTransform:
      'capitalize',
  },

  statusBadge: {
    height: 'fit-content',
    padding: '6px 9px',
    borderRadius: '18px',
    fontSize: '11px',
    fontWeight: '800',
  },

  discountValue: {
    marginTop: '16px',
    fontSize: '24px',
    fontWeight: '900',
    color: '#b07b12',
  },

  dayLabels: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '10px',
  },

  dayBadge: {
    padding: '5px 8px',
    background: '#eef4fb',
    color: '#163c74',
    borderRadius: '14px',
    fontSize: '11px',
    fontWeight: '700',
  },

  cardActions: {
    display: 'grid',
    gridTemplateColumns:
      '1fr 1fr 1fr',
    gap: '8px',
    marginTop: '16px',
  },

  editButton: {
    border: 0,
    background: '#163c74',
    color: '#ffffff',
    borderRadius: '8px',
    padding: '9px',
    fontWeight: '700',
    cursor: 'pointer',
  },

  statusButton: {
    border:
      '1px solid #163c74',
    background: '#ffffff',
    color: '#163c74',
    borderRadius: '8px',
    padding: '9px',
    fontWeight: '700',
    cursor: 'pointer',
  },

  deleteButton: {
    border: 0,
    background: '#ffe8e8',
    color: '#9f2525',
    borderRadius: '8px',
    padding: '9px',
    fontWeight: '700',
    cursor: 'pointer',
  },
};