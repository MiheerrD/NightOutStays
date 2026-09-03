'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

const FILTERS = ['all', 'requests', 'payment_pending', 'confirmed', 'completed', 'cancelled'];

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
function date(value) {
  if (!value) return '—';
  return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function dateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
function statusOf(b) {
  const payment = String(b.payment_status || '').toLowerCase();
  const decision = String(b.host_decision || '').toLowerCase();
  const status = String(b.booking_status || '').toLowerCase();
  const checkout = b.check_out ? new Date(`${b.check_out}T23:59:59`) : null;
  if (['cancelled', 'declined', 'expired'].includes(status) || decision === 'declined') return 'cancelled';
  if (payment === 'paid' && checkout && checkout < new Date()) return 'completed';
  if (payment === 'paid') return 'confirmed';
  if (decision === 'approved') return 'payment_pending';
  return 'requests';
}
function label(s) {
  return ({ all:'All Bookings', requests:'Booking Requests', payment_pending:'Payment Pending', confirmed:'Confirmed / Paid', completed:'Completed', cancelled:'Cancelled / Declined' })[s] || s;
}

export default function HostBookingsPage() {
  const [loading, setLoading] = useState(true);
  const [host, setHost] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { initialize(); }, []);

  async function initialize() {
    try {
      setLoading(true); setError('');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user) { window.location.replace('/login?redirect=/host/bookings'); return; }

      const { data: hostData, error: hostError } = await supabase
        .from('host_profiles').select('id, user_id, full_name, business_name, status')
        .eq('user_id', session.user.id).maybeSingle();
      if (hostError) throw hostError;
      if (!hostData || hostData.status !== 'active') throw new Error('Active Host account required.');
      setHost(hostData);
      await loadBookings(hostData.id);
    } catch (e) { setError(e?.message || 'Unable to load Host bookings.'); }
    finally { setLoading(false); }
  }

  async function loadBookings(hostId = host?.id) {
    if (!hostId) return;
    const { data: properties, error: propertyError } = await supabase
      .from('properties').select('id, name, location_name').eq('host_id', hostId);
    if (propertyError) throw propertyError;
    const propertyRows = properties || [];
    const ids = propertyRows.map(p => p.id);
    if (!ids.length) { setBookings([]); return; }

    const { data: rows, error: bookingError } = await supabase
      .from('bookings').select('*').in('property_id', ids).order('created_at', { ascending: false });
    if (bookingError) throw bookingError;

    const guestIds = [...new Set((rows || []).map(b => b.guest_id).filter(Boolean))];
    let guests = [];
    if (guestIds.length) {
      const result = await supabase.from('guests').select('id, full_name, phone, email').in('id', guestIds);
      if (!result.error) guests = result.data || [];
    }
    const pMap = Object.fromEntries(propertyRows.map(p => [p.id, p]));
    const gMap = Object.fromEntries(guests.map(g => [g.id, g]));
    setBookings((rows || []).map(b => ({ ...b, property: pMap[b.property_id] || null, guest: gMap[b.guest_id] || null })));
  }

  async function decide(booking, decision) {
    if (!window.confirm(`${decision === 'approved' ? 'Approve' : 'Decline'} booking ${booking.booking_code || ''}?`)) return;
    setBusy(booking.id); setError(''); setNotice('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/host/bookings/decision', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ bookingId: booking.id, decision }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to update booking.');
      setNotice(decision === 'approved' ? 'Booking approved. Guest has 24 hours to complete payment.' : 'Booking declined.');
      await loadBookings();
    } catch (e) { setError(e?.message || 'Unable to update booking.'); }
    finally { setBusy(''); }
  }

  const counts = useMemo(() => {
    const c = { all: bookings.length, requests:0, payment_pending:0, confirmed:0, completed:0, cancelled:0 };
    bookings.forEach(b => { const s = statusOf(b); c[s] = (c[s] || 0) + 1; });
    return c;
  }, [bookings]);

  const visible = useMemo(() => bookings.filter(b => {
    const s = statusOf(b);
    if (filter !== 'all' && s !== filter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [b.booking_code, b.property?.name, b.property?.location_name, b.guest?.full_name, b.guest?.phone, b.guest?.email]
      .some(v => String(v || '').toLowerCase().includes(q));
  }), [bookings, filter, search]);

  if (loading) return <main className="hb-loading">Loading Host Bookings...<Styles /></main>;

  return (
    <main className="hb-page">
      <section className="hb-head">
        <div><p className="hb-kicker">HOST OPERATIONS</p><h1>Bookings</h1><p>Manage booking requests and confirmed stays for your properties.</p></div>
        <button onClick={() => loadBookings()} className="hb-refresh">Refresh</button>
      </section>

      {error && <div className="hb-alert hb-error">{error}</div>}
      {notice && <div className="hb-alert hb-success">{notice}</div>}

      <section className="hb-stats">
        {FILTERS.map(f => <button key={f} className={filter === f ? 'hb-stat active' : 'hb-stat'} onClick={() => setFilter(f)}><strong>{counts[f] || 0}</strong><span>{label(f)}</span></button>)}
      </section>

      <section className="hb-toolbar">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search booking code, guest, property or phone" />
        <span>{visible.length} booking{visible.length === 1 ? '' : 's'}</span>
      </section>

      {!visible.length ? <section className="hb-empty"><h3>No bookings found</h3><p>Bookings matching this filter will appear here.</p></section> :
        <section className="hb-list">{visible.map(b => {
          const s = statusOf(b); const canDecide = s === 'requests' && String(b.payment_status || '').toLowerCase() !== 'paid';
          return <article className="hb-card" key={b.id}>
            <div className="hb-cardtop"><div><span className="hb-code">{b.booking_code || 'Booking'}</span><h2>{b.property?.name || 'Property'}</h2><p>{b.property?.location_name || 'Location not added'}</p></div><span className={`hb-badge ${s}`}>{label(s)}</span></div>
            <div className="hb-grid">
              <Info title="Guest" value={b.guest?.full_name || 'Guest'} sub={b.guest?.phone || b.guest?.email || ''} />
              <Info title="Stay" value={`${date(b.check_in)} → ${date(b.check_out)}`} sub={`${b.nights || '—'} night(s) • ${b.guests_count || '—'} guest(s)`} />
              <Info title="Amount" value={money(b.final_payable_amount ?? b.total_amount)} sub={`Payment: ${b.payment_status || 'unpaid'}`} />
              <Info title="Request" value={dateTime(b.created_at)} sub={b.guest_discount_requested ? 'Guest requested extra discount' : 'No extra discount request'} />
            </div>
            {s === 'payment_pending' && <div className="hb-due">Payment deadline: <strong>{dateTime(b.payment_due_at)}</strong></div>}
            {b.guest_discount_message && <div className="hb-note"><strong>Discount request:</strong> {b.guest_discount_message}</div>}
            <div className="hb-actions">
              {canDecide && <><button disabled={busy === b.id} onClick={() => decide(b, 'approved')} className="hb-approve">{busy === b.id ? 'Please wait...' : 'Approve Request'}</button><button disabled={busy === b.id} onClick={() => decide(b, 'declined')} className="hb-decline">Decline</button></>}
              <span className="hb-small">Host decision: {b.host_decision || 'pending'} • Offer: {b.offer_status || 'none'}</span>
            </div>
          </article>;
        })}</section>}
      <Styles />
    </main>
  );
}

function Info({ title, value, sub }) { return <div className="hb-info"><span>{title}</span><strong>{value}</strong>{sub && <small>{sub}</small>}</div>; }
function Styles() { return <style jsx global>{`
  .hb-page{min-height:100vh;background:#f5f7fa;padding:34px clamp(18px,4vw,56px) 70px;color:#132238;font-family:Arial,sans-serif}.hb-loading{min-height:60vh;display:grid;place-items:center;font:700 18px Arial}.hb-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;margin-bottom:24px}.hb-kicker{font-size:12px;font-weight:800;letter-spacing:1.5px;color:#35618c;margin:0 0 8px}.hb-head h1{font-size:36px;margin:0 0 8px;color:#082f5a}.hb-head p{margin:0;color:#667085}.hb-refresh{border:1px solid #cbd5e1;background:white;border-radius:10px;padding:11px 18px;font-weight:700;color:#082f5a;cursor:pointer}.hb-alert{padding:13px 16px;border-radius:10px;margin:0 0 18px;font-weight:700}.hb-error{background:#fff1f2;color:#9f1239;border:1px solid #fecdd3}.hb-success{background:#ecfdf3;color:#166534;border:1px solid #bbf7d0}.hb-stats{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:20px}.hb-stat{background:#fff;border:1px solid #dbe3ec;border-radius:14px;padding:18px 14px;text-align:left;cursor:pointer}.hb-stat.active{border:2px solid #35618c;background:#f7fbff}.hb-stat strong{display:block;font-size:26px;color:#082f5a}.hb-stat span{display:block;margin-top:5px;font-size:12px;color:#667085;font-weight:700}.hb-toolbar{background:#fff;border:1px solid #dbe3ec;border-radius:14px;padding:14px;display:flex;align-items:center;gap:15px;margin-bottom:18px}.hb-toolbar input{flex:1;border:1px solid #cbd5e1;border-radius:9px;padding:12px 14px;font-size:14px}.hb-toolbar span{font-size:13px;font-weight:700;color:#667085}.hb-list{display:grid;gap:16px}.hb-card{background:#fff;border:1px solid #dbe3ec;border-radius:16px;padding:22px;box-shadow:0 4px 16px rgba(8,47,90,.04)}.hb-cardtop{display:flex;justify-content:space-between;gap:20px}.hb-code{font-size:12px;font-weight:800;color:#35618c}.hb-card h2{margin:5px 0;font-size:20px;color:#082f5a}.hb-card p{margin:0;color:#667085}.hb-badge{height:max-content;padding:7px 10px;border-radius:999px;font-size:11px;font-weight:800;background:#eef2f6;color:#475467}.hb-badge.requests{background:#fff7ed;color:#9a3412}.hb-badge.payment_pending{background:#fffbeb;color:#92400e}.hb-badge.confirmed{background:#ecfdf3;color:#166534}.hb-badge.completed{background:#eff6ff;color:#1d4ed8}.hb-badge.cancelled{background:#fff1f2;color:#9f1239}.hb-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:20px}.hb-info{background:#f8fafc;border-radius:11px;padding:13px}.hb-info span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.7px;color:#7b8794;font-weight:800}.hb-info strong{display:block;margin-top:7px;font-size:14px}.hb-info small{display:block;margin-top:5px;color:#667085;line-height:1.4}.hb-due,.hb-note{margin-top:14px;padding:11px 13px;border-radius:9px;background:#fffbeb;color:#713f12;font-size:13px}.hb-note{background:#f8fafc;color:#344054}.hb-actions{margin-top:17px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.hb-actions button{border:0;border-radius:9px;padding:10px 15px;font-weight:800;cursor:pointer}.hb-approve{background:#082f5a;color:#fff}.hb-decline{background:#fff1f2;color:#9f1239}.hb-small{margin-left:auto;font-size:12px;color:#667085}.hb-empty{background:#fff;border:1px dashed #cbd5e1;border-radius:16px;text-align:center;padding:55px 20px}.hb-empty h3{color:#082f5a;margin:0 0 8px}.hb-empty p{color:#667085;margin:0}@media(max-width:1050px){.hb-stats{grid-template-columns:repeat(3,1fr)}.hb-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.hb-page{padding:24px 14px 50px}.hb-head{align-items:flex-start;flex-direction:column}.hb-head h1{font-size:30px}.hb-stats{grid-template-columns:repeat(2,1fr)}.hb-grid{grid-template-columns:1fr}.hb-toolbar{align-items:stretch;flex-direction:column}.hb-cardtop{flex-direction:column}.hb-small{margin-left:0;width:100%}}
`}</style>; }
