'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

function monthStart(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function monthEnd(date) { return new Date(date.getFullYear(), date.getMonth() + 1, 0); }
function ymd(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function parseDate(value) { return new Date(`${value}T12:00:00`); }
function formatMonth(date) { return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); }
function formatDate(value) { return value ? parseDate(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
function dateInStay(day, checkIn, checkOut) { return Boolean(checkIn && checkOut && day >= checkIn && day < checkOut); }
function dateInBlock(day, start, end) { return Boolean(start && end && day >= start && day <= end); }
function initials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'G';
  return words.length === 1 ? words[0].slice(0, 2).toUpperCase() : `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}
function shortName(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'Guest';
  return words.length === 1 ? words[0] : `${words[0]} ${words[1][0]}.`;
}
function isPaidBooking(b) { return String(b.payment_status || '').toLowerCase() === 'paid'; }
function isInactiveBooking(b) {
  const s = String(b.booking_status || '').toLowerCase();
  const d = String(b.host_decision || '').toLowerCase();
  return ['cancelled', 'declined', 'expired'].includes(s) || d === 'declined';
}
function interestLabel(b) {
  if (isPaidBooking(b)) return 'Property Booked';
  if (String(b.offer_status || '').toLowerCase() === 'host_offered') return 'Special Offer Sent';
  if (String(b.host_decision || '').toLowerCase() === 'approved') return 'Host Approved - Payment Pending';
  if (b.guest_discount_requested) return 'Discount Requested';
  return 'Booking Requested';
}
function sourceLabel(source) {
  const s = String(source || '').toLowerCase();
  if (s === 'manual') return 'Host Blocked';
  if (s === 'airbnb') return 'Airbnb';
  if (s === 'booking.com' || s === 'booking_com') return 'Booking.com';
  return source || 'External Portal';
}

export default function HostCalendarPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [properties, setProperties] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [bookings, setBookings] = useState([]);
  const [blockedDates, setBlockedDates] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(monthStart(new Date()));
  const [selectedDate, setSelectedDate] = useState(ymd(new Date()));
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockStart, setBlockStart] = useState(ymd(new Date()));
  const [blockEnd, setBlockEnd] = useState(ymd(new Date()));
  const [blockReason, setBlockReason] = useState('Host blocked');
  const [busy, setBusy] = useState(false);

  useEffect(() => { initialise(); }, []);
  useEffect(() => { if (selectedPropertyId) loadCalendar(selectedPropertyId); }, [selectedPropertyId]);

  async function token() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      window.location.replace('/login?redirect=/host/calendar');
      return null;
    }
    return session.access_token;
  }

  async function api(path, options = {}) {
    const accessToken = await token();
    if (!accessToken) throw new Error('Login required.');
    const response = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) },
    });
    const body = await response.json();
    if (!response.ok || !body.success) throw new Error(body.error || 'Request failed.');
    return body;
  }

  async function initialise() {
    setLoading(true); setError('');
    try {
      const data = await api('/api/host/calendar');
      setProperties(data.properties || []);
      if ((data.properties || []).length) setSelectedPropertyId(data.properties[0].id);
    } catch (e) { setError(e?.message || 'Unable to load Host calendar.'); }
    finally { setLoading(false); }
  }

  async function loadCalendar(propertyId = selectedPropertyId) {
    if (!propertyId) return;
    try {
      setError('');
      const data = await api(`/api/host/calendar?propertyId=${encodeURIComponent(propertyId)}`);
      setProperties(data.properties || []);
      setBookings((data.bookings || []).filter((b) => !isInactiveBooking(b)));
      setBlockedDates(data.blockedDates || []);
    } catch (e) { setError(e?.message || 'Unable to load calendar data.'); }
  }

  const selectedProperty = useMemo(() => properties.find((p) => p.id === selectedPropertyId) || null, [properties, selectedPropertyId]);

  const calendarDays = useMemo(() => {
    const first = monthStart(currentMonth);
    const last = monthEnd(currentMonth);
    const days = Array(first.getDay()).fill(null);
    for (let day = 1; day <= last.getDate(); day += 1) days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
    while (days.length % 7) days.push(null);
    return days;
  }, [currentMonth]);

  function dayInfo(day) {
    const dayBookings = bookings.filter((b) => dateInStay(day, b.check_in, b.check_out));
    const paid = dayBookings.find(isPaidBooking) || null;
    const interests = dayBookings.filter((b) => !isPaidBooking(b));
    const blocks = blockedDates.filter((b) => dateInBlock(day, b.start_date, b.end_date));
    const external = blocks.find((b) => String(b.source || '').toLowerCase() !== 'manual') || null;
    const manual = blocks.find((b) => String(b.source || '').toLowerCase() === 'manual') || null;
    return { dayBookings, paid, interests, blocks, external, manual };
  }

  const selectedInfo = useMemo(() => selectedDate ? dayInfo(selectedDate) : { paid: null, interests: [], blocks: [], external: null, manual: null }, [selectedDate, bookings, blockedDates]);

  const monthStats = useMemo(() => {
    const monthPrefix = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    const paid = bookings.filter((b) => isPaidBooking(b) && (String(b.check_in || '').startsWith(monthPrefix) || String(b.check_out || '').startsWith(monthPrefix))).length;
    const interests = bookings.filter((b) => !isPaidBooking(b) && (String(b.check_in || '').startsWith(monthPrefix) || String(b.check_out || '').startsWith(monthPrefix))).length;
    const external = blockedDates.filter((b) => String(b.source || '').toLowerCase() !== 'manual' && String(b.start_date || '').startsWith(monthPrefix)).length;
    const manual = blockedDates.filter((b) => String(b.source || '').toLowerCase() === 'manual' && String(b.start_date || '').startsWith(monthPrefix)).length;
    return { paid, interests, external, manual };
  }, [currentMonth, bookings, blockedDates]);

  function previousMonth() { setCurrentMonth((d) => monthStart(new Date(d.getFullYear(), d.getMonth() - 1, 1))); }
  function nextMonth() { setCurrentMonth((d) => monthStart(new Date(d.getFullYear(), d.getMonth() + 1, 1))); }
  function today() { const now = new Date(); setCurrentMonth(monthStart(now)); setSelectedDate(ymd(now)); }

  function openBlockForm(date = selectedDate) {
    const start = date || ymd(new Date());
    setBlockStart(start); setBlockEnd(start); setBlockReason('Host blocked'); setShowBlockForm(true); setNotice(''); setError('');
  }

  async function saveBlock(e) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await api('/api/host/calendar/block', {
        method: 'POST',
        body: JSON.stringify({ propertyId: selectedPropertyId, startDate: blockStart, endDate: blockEnd, reason: blockReason }),
      });
      setNotice('Dates blocked successfully.'); setShowBlockForm(false); await loadCalendar();
    } catch (e2) { setError(e2?.message || 'Unable to block dates.'); }
    finally { setBusy(false); }
  }

  async function removeBlock(block) {
    if (!window.confirm(`Remove block from ${formatDate(block.start_date)} to ${formatDate(block.end_date)}?`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api('/api/host/calendar/block', { method: 'DELETE', body: JSON.stringify({ blockId: block.id }) });
      setNotice('Calendar block removed.'); await loadCalendar();
    } catch (e) { setError(e?.message || 'Unable to remove block.'); }
    finally { setBusy(false); }
  }

  async function copyCalendarLink() {
    if (!selectedPropertyId) return;
    const link = `${window.location.origin}/api/calendar/${selectedPropertyId}`;
    try { await navigator.clipboard.writeText(link); setNotice('NightOutStays calendar link copied.'); }
    catch { setError('Unable to copy calendar link.'); }
  }

  if (loading) return <main className="hc-loading">Loading Property Calendar...<Styles /></main>;

  return (
    <main className="hc-page">
      <section className="hc-container">
        <div className="hc-title-row">
          <div><p className="hc-kicker">HOST OPERATIONS</p><h1>Property Calendar</h1><p>See confirmed bookings, guest interest, blocked dates and external portal blocks.</p></div>
          <div className="hc-actions"><button onClick={() => loadCalendar()}>Refresh</button><button className="primary" onClick={() => openBlockForm()}>Block Dates</button></div>
        </div>

        {error && <div className="hc-alert error">{error}</div>}
        {notice && <div className="hc-alert success">{notice}</div>}

        <section className="hc-controls">
          <label>Property<select value={selectedPropertyId} onChange={(e) => { setSelectedPropertyId(e.target.value); setSelectedDate(''); }}><option value="">Select property</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}{p.location_name ? ` - ${p.location_name}` : ''}</option>)}</select></label>
          <div className="hc-month-nav"><button onClick={previousMonth}>‹</button><button onClick={today}>Today</button><strong>{formatMonth(currentMonth)}</strong><button onClick={nextMonth}>›</button></div>
        </section>

        {!properties.length ? <section className="hc-empty"><h3>No properties found</h3><p>Add a property first to use the Host calendar.</p></section> : <>
          <section className="hc-stats">
            <Stat value={monthStats.paid} label="Confirmed / Paid" />
            <Stat value={monthStats.interests} label="Booking Interests" />
            <Stat value={monthStats.manual} label="Host Blocks" />
            <Stat value={monthStats.external} label="External Blocks" />
          </section>

          <div className="hc-legend"><span><i className="booked" />Booked</span><span><i className="interest" />Interest</span><span><i className="manual" />Host Blocked</span><span><i className="external" />External Portal</span></div>

          <div className="hc-layout">
            <section className="hc-calendar-card">
              <div className="hc-weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => <strong key={d}>{d}</strong>)}</div>
              <div className="hc-grid">{calendarDays.map((date, index) => {
                if (!date) return <div className="hc-day blank" key={`blank-${index}`} />;
                const ds = ymd(date); const info = dayInfo(ds); const cls = ['hc-day'];
                if (selectedDate === ds) cls.push('selected');
                if (info.paid) cls.push('booked'); else if (info.external) cls.push('external'); else if (info.manual) cls.push('manual'); else if (info.interests.length) cls.push('interest');
                return <button className={cls.join(' ')} key={ds} onClick={() => setSelectedDate(ds)}>
                  <span className="hc-num">{date.getDate()}</span>
                  {info.paid && <span className="hc-booked-name"><b>{initials(info.paid.guests?.full_name)}</b>{shortName(info.paid.guests?.full_name)}</span>}
                  {!info.paid && info.external && <span className="hc-tag">{sourceLabel(info.external.source)}</span>}
                  {!info.paid && !info.external && info.manual && <span className="hc-tag">Blocked</span>}
                  {!info.paid && !info.external && !info.manual && info.interests.length > 0 && <span className="hc-tag">{info.interests.length} interest{info.interests.length === 1 ? '' : 's'}</span>}
                </button>;
              })}</div>
            </section>

            <aside className="hc-side">
              <section className="hc-panel">
                <h2>{selectedDate ? formatDate(selectedDate) : 'Select a date'}</h2>
                {!selectedDate ? <p>Select any date to view booking and availability details.</p> : <>
                  {selectedInfo.paid ? <div className="hc-detail booked"><strong>Confirmed Booking</strong><span>{selectedInfo.paid.booking_code || 'Booking'}</span><span>{selectedInfo.paid.guests?.full_name || 'Guest'} · {selectedInfo.paid.guests_count || '—'} guest(s)</span><span>{formatDate(selectedInfo.paid.check_in)} → {formatDate(selectedInfo.paid.check_out)}</span></div> : <div className="hc-detail available"><strong>Not booked on NightOutStays</strong><span>Check interests or blocks below.</span></div>}

                  {selectedInfo.interests.length > 0 && <div className="hc-section"><h3>Booking Interests ({selectedInfo.interests.length})</h3>{selectedInfo.interests.map((b) => <div className="hc-interest" key={b.id}><strong>{b.guests?.full_name || 'Guest'}</strong><span>{interestLabel(b)}</span><small>{b.booking_code || ''} · {b.guests_count || '—'} guest(s)</small></div>)}</div>}

                  {selectedInfo.blocks.length > 0 && <div className="hc-section"><h3>Calendar Blocks</h3>{selectedInfo.blocks.map((b) => <div className="hc-block" key={b.id}><strong>{sourceLabel(b.source)}</strong><span>{formatDate(b.start_date)} → {formatDate(b.end_date)}</span><small>{b.reason || 'Unavailable'}</small>{String(b.source || '').toLowerCase() === 'manual' && <button disabled={busy} onClick={() => removeBlock(b)}>Remove Block</button>}</div>)}</div>}

                  {!selectedInfo.paid && !selectedInfo.external && !selectedInfo.manual && <button className="hc-full primary" onClick={() => openBlockForm(selectedDate)}>Block This Date</button>}
                </>}
              </section>

              <section className="hc-panel"><h2>Calendar Sync</h2><p>Use this NightOutStays calendar link in Airbnb, Booking.com or another iCal-compatible portal. It exports paid bookings and blocked dates without guest personal details.</p><button className="hc-full" onClick={copyCalendarLink}>Copy Export Calendar Link</button><small className="hc-muted">External calendar imports already stored in blocked dates will appear here automatically. Automated import-feed management can be connected when external feed storage is enabled.</small></section>
            </aside>
          </div>
        </>}

        {showBlockForm && <div className="hc-modal-backdrop" onMouseDown={() => !busy && setShowBlockForm(false)}><form className="hc-modal" onSubmit={saveBlock} onMouseDown={(e) => e.stopPropagation()}><h2>Block Property Dates</h2><p>{selectedProperty?.name || 'Selected property'}</p><label>Start Date<input type="date" required value={blockStart} onChange={(e) => setBlockStart(e.target.value)} /></label><label>End Date<input type="date" required value={blockEnd} min={blockStart} onChange={(e) => setBlockEnd(e.target.value)} /></label><label>Reason<input value={blockReason} maxLength={250} onChange={(e) => setBlockReason(e.target.value)} placeholder="Maintenance, owner use, unavailable..." /></label><div className="hc-modal-actions"><button type="button" disabled={busy} onClick={() => setShowBlockForm(false)}>Cancel</button><button type="submit" className="primary" disabled={busy}>{busy ? 'Saving...' : 'Block Dates'}</button></div></form></div>}
      </section>
      <Styles />
    </main>
  );
}

function Stat({ value, label }) { return <div className="hc-stat"><strong>{value}</strong><span>{label}</span></div>; }

function Styles() { return <style jsx global>{`
  .hc-page{min-height:100vh;background:#f5f7fa;padding:34px clamp(18px,4vw,56px) 70px;color:#172033;font-family:Arial,sans-serif}.hc-loading{min-height:60vh;display:grid;place-items:center;font:700 18px Arial}.hc-container{max-width:1500px;margin:0 auto}.hc-title-row{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:22px}.hc-kicker{font-size:12px;font-weight:800;letter-spacing:1.5px;color:#35618c;margin:0 0 8px}.hc-title-row h1{font-size:36px;color:#082f5a;margin:0 0 8px}.hc-title-row p{margin:0;color:#667085}.hc-actions{display:flex;gap:10px}.hc-actions button,.hc-controls button,.hc-full,.hc-block button,.hc-modal button{border:1px solid #cbd5e1;background:#fff;color:#082f5a;border-radius:9px;padding:10px 14px;font-weight:800;cursor:pointer}.primary{background:#082f5a!important;color:#fff!important;border-color:#082f5a!important}.hc-alert{padding:13px 16px;border-radius:10px;margin-bottom:16px;font-weight:700}.hc-alert.error{background:#fff1f2;color:#9f1239;border:1px solid #fecdd3}.hc-alert.success{background:#ecfdf3;color:#166534;border:1px solid #bbf7d0}.hc-controls{display:flex;align-items:end;justify-content:space-between;gap:18px;background:#fff;border:1px solid #dbe3ec;border-radius:14px;padding:15px 16px;margin-bottom:16px}.hc-controls label{font-size:12px;color:#667085;font-weight:800;display:grid;gap:6px;min-width:min(430px,100%)}.hc-controls select,.hc-modal input{border:1px solid #cbd5e1;border-radius:9px;padding:11px 12px;background:#fff;font:inherit;color:#172033}.hc-month-nav{display:flex;align-items:center;gap:8px}.hc-month-nav strong{min-width:165px;text-align:center;color:#082f5a}.hc-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}.hc-stat{background:#fff;border:1px solid #dbe3ec;border-radius:13px;padding:16px}.hc-stat strong{display:block;font-size:25px;color:#082f5a}.hc-stat span{display:block;margin-top:4px;font-size:12px;font-weight:700;color:#667085}.hc-legend{display:flex;gap:18px;flex-wrap:wrap;background:#fff;border:1px solid #dbe3ec;border-radius:12px;padding:11px 14px;margin-bottom:14px;font-size:12px;font-weight:700;color:#667085}.hc-legend span{display:flex;align-items:center;gap:6px}.hc-legend i{width:11px;height:11px;border-radius:3px;display:inline-block}.hc-legend i.booked{background:#d1fae5}.hc-legend i.interest{background:#fef3c7}.hc-legend i.manual{background:#e2e8f0}.hc-legend i.external{background:#dbeafe}.hc-layout{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px}.hc-calendar-card,.hc-panel{background:#fff;border:1px solid #dbe3ec;border-radius:16px;box-shadow:0 4px 16px rgba(8,47,90,.04)}.hc-calendar-card{padding:16px}.hc-weekdays,.hc-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:7px}.hc-weekdays{margin-bottom:7px}.hc-weekdays strong{text-align:center;font-size:11px;text-transform:uppercase;color:#7b8794;padding:7px}.hc-day{min-height:105px;border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:9px;text-align:left;display:flex;flex-direction:column;gap:7px;cursor:pointer;color:#172033}.hc-day:hover{border-color:#8da9c5}.hc-day.selected{outline:2px solid #35618c}.hc-day.booked{background:#ecfdf3;border-color:#a7f3d0}.hc-day.interest{background:#fffbeb;border-color:#fde68a}.hc-day.manual{background:#f1f5f9;border-color:#cbd5e1}.hc-day.external{background:#eff6ff;border-color:#bfdbfe}.hc-day.blank{border:0;background:transparent;cursor:default}.hc-num{font-weight:800;color:#082f5a}.hc-booked-name{display:grid;gap:3px;font-size:11px;color:#166534}.hc-booked-name b{width:26px;height:26px;border-radius:999px;background:#166534;color:#fff;display:grid;place-items:center;font-size:10px}.hc-tag{font-size:10px;font-weight:800;color:#475467;line-height:1.25}.hc-side{display:grid;align-content:start;gap:16px}.hc-panel{padding:18px}.hc-panel h2{margin:0 0 8px;color:#082f5a;font-size:19px}.hc-panel p{color:#667085;line-height:1.5;font-size:13px}.hc-detail{border-radius:10px;padding:12px;margin-top:12px;display:grid;gap:5px;font-size:12px}.hc-detail.booked{background:#ecfdf3;color:#166534}.hc-detail.available{background:#f8fafc;color:#475467}.hc-section{margin-top:16px;border-top:1px solid #e2e8f0;padding-top:14px}.hc-section h3{margin:0 0 10px;font-size:13px;color:#082f5a}.hc-interest,.hc-block{border:1px solid #e2e8f0;border-radius:9px;padding:10px;margin-bottom:8px;display:grid;gap:4px;font-size:12px}.hc-interest span{color:#92400e;font-weight:700}.hc-interest small,.hc-block small,.hc-muted{color:#667085}.hc-block button{margin-top:5px;width:max-content;padding:7px 10px;color:#9f1239}.hc-full{width:100%;margin-top:12px}.hc-muted{display:block;margin-top:10px;line-height:1.45;font-size:11px}.hc-empty{background:#fff;border:1px dashed #cbd5e1;border-radius:16px;text-align:center;padding:55px 20px}.hc-empty h3{color:#082f5a}.hc-modal-backdrop{position:fixed;inset:0;background:rgba(8,47,90,.38);display:grid;place-items:center;padding:20px;z-index:9999}.hc-modal{width:min(500px,100%);background:#fff;border-radius:16px;padding:22px;box-shadow:0 25px 70px rgba(0,0,0,.2)}.hc-modal h2{margin:0 0 6px;color:#082f5a}.hc-modal p{margin:0 0 18px;color:#667085}.hc-modal label{display:grid;gap:6px;margin:12px 0;font-size:12px;font-weight:800;color:#475467}.hc-modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}@media(max-width:1100px){.hc-layout{grid-template-columns:1fr}.hc-side{grid-template-columns:repeat(2,1fr)}.hc-day{min-height:90px}.hc-stats{grid-template-columns:repeat(2,1fr)}}@media(max-width:720px){.hc-page{padding:24px 12px 50px}.hc-title-row,.hc-controls{align-items:stretch;flex-direction:column}.hc-actions{width:100%}.hc-actions button{flex:1}.hc-controls label{min-width:0}.hc-month-nav{justify-content:space-between}.hc-month-nav strong{min-width:0}.hc-side{grid-template-columns:1fr}.hc-weekdays,.hc-grid{gap:3px}.hc-calendar-card{padding:8px;overflow-x:auto}.hc-weekdays,.hc-grid{min-width:650px}.hc-stats{grid-template-columns:repeat(2,1fr)}}
`}</style>; }
