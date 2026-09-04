'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

const PACKAGE_MIN = { weekly: 6, fortnightly: 12, monthly: 20 };
const CATEGORY_OPTIONS = [
  ['all_days', 'All Days'], ['weekday', 'Weekday Discount'], ['weekend', 'Weekend Discount'],
  ['weekly', 'Weekly — Min 6 Nights'], ['fortnightly', 'Fortnightly — Min 12 Nights'],
  ['monthly', 'Monthly — Min 20 Nights'], ['specific_dates', 'Specific Dates'],
  ['seasonal', 'Seasonal'], ['festival', 'Festival'], ['custom', 'Custom'],
];
const DAY_OPTIONS = [
  ['1', 'Mon'], ['2', 'Tue'], ['3', 'Wed'], ['4', 'Thu'], ['5', 'Fri'], ['6', 'Sat'], ['0', 'Sun'],
];

const emptyForm = {
  id: '', property_id: '', title: '', description: '', discount_type: 'percent', discount_value: '',
  start_date: '', end_date: '', min_nights: 1, offer_category: 'all_days', applicable_days: [],
  apply_scope: 'eligible_nights', guest_selectable: true, is_active: true,
};

function categoryLabel(value) {
  return CATEGORY_OPTIONS.find(([v]) => v === value)?.[1] || String(value || 'Custom').replaceAll('_', ' ');
}
function money(value) { return `₹${Number(value || 0).toLocaleString('en-IN')}`; }
function formatDate(value) {
  if (!value) return 'No date limit';
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function HostOffersPage() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [properties, setProperties] = useState([]);
  const [offers, setOffers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/login'; return; }
      setSession(session);
      await loadData(session.access_token);
    })();
  }, []);

  async function api(path = '', options = {}, token = session?.access_token) {
    const response = await fetch(`/api/host/offers${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }

  async function loadData(token = session?.access_token) {
    try {
      setLoading(true); setError('');
      const data = await api('', { method: 'GET' }, token);
      setProperties(data.properties || []); setOffers(data.offers || []);
      setForm((f) => ({ ...f, property_id: f.property_id || data.properties?.[0]?.id || '' }));
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  function updateField(name, value) {
    setMessage(''); setError('');
    if (name === 'offer_category') {
      const required = PACKAGE_MIN[value];
      setForm((f) => ({
        ...f, offer_category: value,
        min_nights: required || f.min_nights || 1,
        discount_type: required ? 'percent' : f.discount_type,
        apply_scope: required ? 'entire_booking' : f.apply_scope,
        applicable_days: value === 'weekday' ? [1,2,3,4,5] : value === 'weekend' ? [0,6] : required ? [] : f.applicable_days,
      }));
      return;
    }
    setForm((f) => ({ ...f, [name]: value }));
  }

  function toggleDay(day) {
    if (['weekday', 'weekend'].includes(form.offer_category) || PACKAGE_MIN[form.offer_category]) return;
    setForm((f) => ({ ...f, applicable_days: f.applicable_days.includes(day) ? f.applicable_days.filter((d) => d !== day) : [...f.applicable_days, day] }));
  }

  function startEdit(offer) {
    setForm({
      id: offer.id, property_id: offer.property_id, title: offer.title || '', description: offer.description || '',
      discount_type: offer.discount_type || 'percent', discount_value: String(offer.discount_value ?? ''),
      start_date: offer.start_date || '', end_date: offer.end_date || '', min_nights: offer.min_nights || 1,
      offer_category: offer.offer_category || 'custom', applicable_days: Array.isArray(offer.applicable_days) ? offer.applicable_days : [],
      apply_scope: offer.apply_scope || 'eligible_nights', guest_selectable: offer.guest_selectable !== false, is_active: offer.is_active !== false,
    });
    setMessage(''); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setForm({ ...emptyForm, property_id: properties[0]?.id || '' }); setMessage(''); setError('');
  }

  async function saveOffer(e) {
    e.preventDefault();
    try {
      setSaving(true); setError(''); setMessage('');
      const payload = { ...form, discount_value: Number(form.discount_value), min_nights: Number(form.min_nights) || 1 };
      if (!payload.property_id) throw new Error('Please select a property.');
      if (!payload.title.trim()) throw new Error('Offer title is required.');
      if (!(payload.discount_value > 0)) throw new Error('Enter a valid discount value.');
      if (payload.discount_type === 'percent' && payload.discount_value > 100) throw new Error('Percentage discount cannot exceed 100%.');
      if (payload.start_date && payload.end_date && payload.end_date < payload.start_date) throw new Error('End date cannot be before start date.');

      await api('', { method: form.id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setMessage(form.id ? 'Offer updated successfully.' : 'Offer created successfully.');
      setForm({ ...emptyForm, property_id: properties[0]?.id || '' });
      await loadData();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  async function toggleOffer(offer) {
    try { setError(''); setMessage(''); await api('', { method: 'PATCH', body: JSON.stringify({ id: offer.id, action: 'toggle' }) }); await loadData(); }
    catch (e) { setError(e.message); }
  }

  async function deleteOffer(offer) {
    if (!window.confirm(`Delete “${offer.title}”?`)) return;
    try { setError(''); setMessage(''); await api(`?id=${encodeURIComponent(offer.id)}`, { method: 'DELETE' }); setMessage('Offer deleted.'); if (form.id === offer.id) resetForm(); await loadData(); }
    catch (e) { setError(e.message); }
  }

  const propertyMap = useMemo(() => Object.fromEntries(properties.map((p) => [p.id, p])), [properties]);
  const filtered = useMemo(() => offers.filter((o) => {
    const text = `${o.title || ''} ${o.description || ''} ${propertyMap[o.property_id]?.name || ''}`.toLowerCase();
    const okSearch = !search.trim() || text.includes(search.trim().toLowerCase());
    const okProperty = propertyFilter === 'all' || o.property_id === propertyFilter;
    const okStatus = statusFilter === 'all' || (statusFilter === 'active' ? o.is_active : !o.is_active);
    return okSearch && okProperty && okStatus;
  }), [offers, search, propertyFilter, statusFilter, propertyMap]);

  const activeCount = offers.filter((o) => o.is_active).length;
  const scheduledCount = offers.filter((o) => o.is_active && o.start_date && o.start_date > new Date().toISOString().slice(0, 10)).length;
  const packageOffer = Boolean(PACKAGE_MIN[form.offer_category]);

  if (loading) return <main style={s.page}><div style={s.card}>Loading offers...</div></main>;

  return (
    <main style={s.page}>
      <section style={s.hero}>
        <div><p style={s.eyebrow}>HOST OFFERS</p><h1 style={s.h1}>Offers & Discounts</h1><p style={s.muted}>Create property-wide discounts. Guest-specific special offers stay inside Bookings and Messages.</p></div>
      </section>

      <section style={s.stats}>
        <Stat label="Total Offers" value={offers.length} />
        <Stat label="Active" value={activeCount} />
        <Stat label="Scheduled" value={scheduledCount} />
        <Stat label="Properties" value={properties.length} />
      </section>

      {error && <div style={s.error}>{error}</div>}
      {message && <div style={s.success}>{message}</div>}

      <section style={s.card}>
        <div style={s.sectionHead}><div><h2 style={s.h2}>{form.id ? 'Edit Offer' : 'Create New Offer'}</h2><p style={s.muted}>Only one guest-selectable discount should ultimately apply to a booking; Host special offers are handled separately.</p></div>{form.id && <button style={s.secondaryButton} onClick={resetForm}>Cancel Edit</button>}</div>
        <form onSubmit={saveOffer} style={s.formGrid}>
          <Field label="Property"><select style={s.input} value={form.property_id} onChange={(e) => updateField('property_id', e.target.value)} disabled={Boolean(form.id)}><option value="">Select property</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Offer Category"><select style={s.input} value={form.offer_category} onChange={(e) => updateField('offer_category', e.target.value)}>{CATEGORY_OPTIONS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field label="Offer Title"><input style={s.input} value={form.title} onChange={(e) => updateField('title', e.target.value)} placeholder="Example: Weekend Escape 15% Off" /></Field>
          <Field label="Discount Type"><select style={s.input} value={form.discount_type} disabled={packageOffer} onChange={(e) => updateField('discount_type', e.target.value)}><option value="percent">Percentage (%)</option><option value="fixed">Fixed Amount (₹)</option></select></Field>
          <Field label={form.discount_type === 'percent' ? 'Discount Percentage' : 'Discount Amount'}><input type="number" min="0" step="0.01" style={s.input} value={form.discount_value} onChange={(e) => updateField('discount_value', e.target.value)} /></Field>
          <Field label="Minimum Nights"><input type="number" min={PACKAGE_MIN[form.offer_category] || 1} style={s.input} value={form.min_nights} disabled={packageOffer} onChange={(e) => updateField('min_nights', e.target.value)} /></Field>
          <Field label="Start Date"><input type="date" style={s.input} value={form.start_date} onChange={(e) => updateField('start_date', e.target.value)} /></Field>
          <Field label="End Date"><input type="date" style={s.input} value={form.end_date} onChange={(e) => updateField('end_date', e.target.value)} /></Field>
          <Field label="Apply Discount To"><select style={s.input} value={form.apply_scope} disabled={packageOffer} onChange={(e) => updateField('apply_scope', e.target.value)}><option value="eligible_nights">Eligible Nights Only</option><option value="entire_booking">Entire Eligible Booking</option></select></Field>
          <Field label="Guest Can Select"><select style={s.input} value={String(form.guest_selectable)} onChange={(e) => updateField('guest_selectable', e.target.value === 'true')}><option value="true">Yes</option><option value="false">No — Host Applied</option></select></Field>
          <div style={{ ...s.full, ...s.field }}><label style={s.label}>Applicable Days</label><div style={s.days}>{DAY_OPTIONS.map(([v,l]) => { const n = Number(v); const active = form.applicable_days.includes(n); return <button type="button" key={v} onClick={() => toggleDay(n)} style={{ ...s.dayButton, ...(active ? s.dayActive : {}) }}>{l}</button>; })}</div><small style={s.help}>{packageOffer ? 'Stay-length packages apply to the complete eligible stay.' : form.offer_category === 'weekday' || form.offer_category === 'weekend' ? 'Days are set automatically by the selected category.' : 'Leave all days unselected to apply based only on the date range/category.'}</small></div>
          <div style={{ ...s.full, ...s.field }}><label style={s.label}>Description</label><textarea rows="3" style={s.input} value={form.description} onChange={(e) => updateField('description', e.target.value)} placeholder="Short explanation visible with this offer" /></div>
          <div style={s.full}><button type="submit" disabled={saving || !properties.length} style={s.primaryButton}>{saving ? 'Saving...' : form.id ? 'Update Offer' : 'Create Offer'}</button></div>
        </form>
      </section>

      <section style={s.card}>
        <div style={s.sectionHead}><div><h2 style={s.h2}>Your Offers</h2><p style={s.muted}>{filtered.length} offer{filtered.length === 1 ? '' : 's'} shown</p></div></div>
        <div style={s.filters}>
          <input style={s.input} placeholder="Search offer or property" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select style={s.input} value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)}><option value="all">All Properties</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <select style={s.input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        </div>

        {!filtered.length ? <div style={s.empty}>No offers match the current filters.</div> : <div style={s.offerGrid}>{filtered.map((o) => {
          const prop = propertyMap[o.property_id];
          return <article key={o.id} style={s.offerCard}>
            <div style={s.offerTop}><div><span style={{ ...s.badge, ...(o.is_active ? s.activeBadge : s.inactiveBadge) }}>{o.is_active ? 'ACTIVE' : 'INACTIVE'}</span><h3 style={s.h3}>{o.title}</h3><p style={s.propertyName}>{prop?.name || 'Property'}</p></div><div style={s.discount}>{o.discount_type === 'percent' ? `${Number(o.discount_value)}%` : money(o.discount_value)}<small> OFF</small></div></div>
            <div style={s.metaGrid}><Meta label="Category" value={categoryLabel(o.offer_category)} /><Meta label="Dates" value={`${formatDate(o.start_date)} → ${formatDate(o.end_date)}`} /><Meta label="Min Stay" value={`${o.min_nights || 1} night${Number(o.min_nights || 1) === 1 ? '' : 's'}`} /><Meta label="Application" value={o.apply_scope === 'entire_booking' ? 'Entire Booking' : 'Eligible Nights'} /></div>
            {o.description && <p style={s.description}>{o.description}</p>}
            <div style={s.actions}><button style={s.secondaryButton} onClick={() => startEdit(o)}>Edit</button><button style={s.secondaryButton} onClick={() => toggleOffer(o)}>{o.is_active ? 'Deactivate' : 'Activate'}</button><button style={s.dangerButton} onClick={() => deleteOffer(o)}>Delete</button></div>
          </article>;
        })}</div>}
      </section>
    </main>
  );
}

function Stat({ label, value }) { return <div style={s.stat}><div style={s.statValue}>{value}</div><div style={s.statLabel}>{label}</div></div>; }
function Field({ label, children }) { return <div style={s.field}><label style={s.label}>{label}</label>{children}</div>; }
function Meta({ label, value }) { return <div><div style={s.metaLabel}>{label}</div><div style={s.metaValue}>{value}</div></div>; }

const s = {
  page: { minHeight: '100vh', background: '#f5f7fa', padding: '28px', color: '#15263a', fontFamily: 'Arial, sans-serif' },
  hero: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', maxWidth: 1400, margin: '0 auto 20px' },
  eyebrow: { margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: '#35618c' },
  h1: { margin: '6px 0 8px', fontSize: 34, color: '#303a44' }, h2: { margin: 0, fontSize: 22, color: '#303a44' }, h3: { margin: '10px 0 4px', fontSize: 20, color: '#303a44' },
  muted: { margin: '5px 0 0', color: '#66788a', lineHeight: 1.5 },
  stats: { maxWidth: 1400, margin: '0 auto 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14 },
  stat: { background: '#fff', border: '1px solid #dde4eb', borderRadius: 14, padding: '18px 20px' }, statValue: { fontSize: 28, fontWeight: 800, color: '#303a44' }, statLabel: { marginTop: 5, color: '#66788a', fontSize: 13 },
  card: { maxWidth: 1400, margin: '0 auto 20px', background: '#fff', border: '1px solid #dde4eb', borderRadius: 16, padding: 22, boxShadow: '0 2px 10px rgba(8,47,90,.04)' },
  sectionHead: { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16 }, field: { display: 'flex', flexDirection: 'column', gap: 7 }, full: { gridColumn: '1 / -1' },
  label: { fontSize: 13, fontWeight: 700, color: '#334b63' }, input: { width: '100%', boxSizing: 'border-box', border: '1px solid #cfd9e3', borderRadius: 9, padding: '11px 12px', fontSize: 14, background: '#fff', color: '#15263a' },
  days: { display: 'flex', gap: 8, flexWrap: 'wrap' }, dayButton: { border: '1px solid #cfd9e3', background: '#fff', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', color: '#334b63' }, dayActive: { background: '#303a44', color: '#fff', borderColor: '#303a44' }, help: { color: '#758697' },
  primaryButton: { border: 0, background: '#303a44', color: '#fff', padding: '12px 18px', borderRadius: 9, fontWeight: 700, cursor: 'pointer' }, secondaryButton: { border: '1px solid #bfcbd7', background: '#fff', color: '#303a44', padding: '9px 13px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }, dangerButton: { border: '1px solid #e1b7b7', background: '#fff5f5', color: '#a12b2b', padding: '9px 13px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' },
  filters: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 18 }, offerGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 16 }, offerCard: { border: '1px solid #dce4eb', borderRadius: 14, padding: 18, background: '#fff' },
  offerTop: { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }, badge: { display: 'inline-block', borderRadius: 999, padding: '5px 9px', fontSize: 10, fontWeight: 800, letterSpacing: .7 }, activeBadge: { background: '#e7f6ec', color: '#1f7a3f' }, inactiveBadge: { background: '#edf1f5', color: '#657484' },
  discount: { fontSize: 24, fontWeight: 900, color: '#303a44', textAlign: 'right', whiteSpace: 'nowrap' }, propertyName: { margin: 0, color: '#66788a', fontSize: 13 }, metaGrid: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12, marginTop: 18, paddingTop: 14, borderTop: '1px solid #edf1f4' }, metaLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: .6, color: '#8493a2' }, metaValue: { marginTop: 4, fontSize: 13, fontWeight: 700, color: '#31465b' },
  description: { color: '#566b7e', lineHeight: 1.5, margin: '15px 0 0' }, actions: { display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 18 },
  success: { maxWidth: 1400, margin: '0 auto 16px', background: '#eaf7ee', color: '#236b38', border: '1px solid #bfe2ca', padding: '12px 15px', borderRadius: 10 }, error: { maxWidth: 1400, margin: '0 auto 16px', background: '#fff1f1', color: '#9b2c2c', border: '1px solid #efc4c4', padding: '12px 15px', borderRadius: 10 }, empty: { padding: '34px 10px', textAlign: 'center', color: '#748596' },
};
