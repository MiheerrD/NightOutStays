'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

const money = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const dateText = (value) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
};

export default function HostPayoutsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [property, setProperty] = useState('all');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) {
          window.location.href = '/host/register';
          return;
        }
        const res = await fetch('/api/host/payouts', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Unable to load payout information.');
        if (alive) setData(json);
      } catch (e) {
        if (alive) setError(e.message || 'Unable to load payout information.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const rows = data?.bookings || [];
    const q = query.trim().toLowerCase();
    return rows.filter((b) => {
      const propertyOk = property === 'all' || b.property_id === property;
      const text = `${b.booking_code || ''} ${b.property_name || ''} ${b.guest_name || ''}`.toLowerCase();
      return propertyOk && (!q || text.includes(q));
    });
  }, [data, query, property]);

  if (loading) return <main className="wrap"><div className="panel">Loading financial overview…</div><Styles /></main>;
  if (error) return <main className="wrap"><div className="error">{error}</div><Styles /></main>;

  const s = data.summary || {};
  const bank = data.bank || {};

  return (
    <main className="wrap">
      <section className="hero">
        <div>
          <div className="eyebrow">HOST FINANCE</div>
          <h1>Payouts</h1>
          <p>Financial overview of your paid NightOutStays bookings.</p>
        </div>
        <div className="phase">
          <strong>Phase 1</strong>
          <span>Read-only financial dashboard</span>
        </div>
      </section>

      <section className="notice">
        <strong>Payout processing is coming in Phase 2.</strong>
        <span>No money transfer, automatic settlement or payment-hold action is performed from this page.</span>
      </section>

      <section className="cards">
        <Card label="Paid Bookings" value={s.paid_bookings || 0} />
        <Card label="Gross Paid Value" value={money(s.gross_paid_value)} />
        <Card label="GST Collected" value={money(s.gst_amount)} />
        <Card label="Security Deposits" value={money(s.security_deposits)} />
        <Card label="Booking Value Before GST" value={money(s.taxable_amount)} />
      </section>

      <section className="bank panel">
        <div>
          <div className="eyebrow">SETTLEMENT ACCOUNT</div>
          <h2>Bank Details</h2>
          <p>{bank.complete ? 'Your bank details are complete for future payout activation.' : 'Complete your bank details before Phase 2 payout activation.'}</p>
        </div>
        <div className={`badge ${bank.complete ? 'good' : 'warn'}`}>
          {bank.complete ? 'Complete' : 'Incomplete'}
        </div>
        <div className="bankGrid">
          <Info label="Account Holder" value={bank.account_name} />
          <Info label="Bank" value={bank.bank_name} />
          <Info label="Account Number" value={bank.masked_account_number} />
          <Info label="IFSC" value={bank.ifsc} />
          <Info label="Account Type" value={bank.account_type} />
          <Info label="Bank Proof" value={bank.has_bank_proof ? 'Uploaded' : 'Not uploaded'} />
        </div>
        {!bank.complete && <a className="button" href="/host/profile">Update Bank Details</a>}
      </section>

      <section className="panel">
        <div className="sectionHead">
          <div>
            <div className="eyebrow">PROPERTY PERFORMANCE</div>
            <h2>Property-wise Earnings</h2>
          </div>
        </div>
        <div className="propertyGrid">
          {(data.property_summary || []).map((p) => (
            <div className="propertyCard" key={p.property_id}>
              <strong>{p.property_name}</strong>
              <span>{p.paid_bookings} paid booking{p.paid_bookings === 1 ? '' : 's'}</span>
              <b>{money(p.gross_paid_value)}</b>
            </div>
          ))}
          {!data.property_summary?.length && <div className="empty">No paid booking earnings yet.</div>}
        </div>
      </section>

      <section className="panel">
        <div className="sectionHead">
          <div>
            <div className="eyebrow">TRANSACTIONS</div>
            <h2>Booking-wise Financial Details</h2>
          </div>
          <div className="filters">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search booking, property or guest" />
            <select value={property} onChange={(e) => setProperty(e.target.value)}>
              <option value="all">All Properties</option>
              {(data.properties || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Booking</th><th>Property / Guest</th><th>Stay</th><th>Taxable</th>
                <th>GST</th><th>Security Deposit</th><th>Paid Amount</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id}>
                  <td><strong>{b.booking_code || 'Booking'}</strong><small>Paid {dateText(b.paid_at)}</small></td>
                  <td><strong>{b.property_name}</strong><small>{b.guest_name || 'Guest'}</small></td>
                  <td>{dateText(b.check_in)}<small>to {dateText(b.check_out)} · {b.nights || 0} nights</small></td>
                  <td>{money(b.taxable_amount)}</td>
                  <td>{money(b.gst_amount)}<small>{Number(b.gst_rate || 0)}% GST</small></td>
                  <td>{money(b.security_deposit)}</td>
                  <td><strong>{money(b.paid_amount)}</strong></td>
                  <td><span className="status">{b.booking_status || 'Paid'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <div className="empty">No paid bookings match this filter.</div>}
        </div>
      </section>

      <Styles />
    </main>
  );
}

function Card({ label, value }) {
  return <div className="card"><span>{label}</span><strong>{value}</strong></div>;
}
function Info({ label, value }) {
  return <div className="info"><span>{label}</span><strong>{value || '—'}</strong></div>;
}
function Styles() {
  return <style jsx global>{`
    .wrap{max-width:1500px;margin:0 auto;padding:30px;background:#f6f8fb;min-height:100vh;color:#17324d;font-family:Arial,sans-serif}
    .hero,.sectionHead,.bank{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}
    h1{font-size:36px;margin:5px 0 8px;color:#082f5a} h2{margin:5px 0 8px;color:#082f5a}
    p{margin:0;color:#65788a}.eyebrow{font-size:12px;font-weight:800;letter-spacing:1.4px;color:#35618c}
    .phase{background:#082f5a;color:white;border-radius:14px;padding:14px 18px;display:flex;flex-direction:column;gap:4px}
    .phase span{font-size:12px;opacity:.8}.notice{margin:22px 0;padding:16px 18px;border:1px solid #d9e2ec;background:white;border-radius:14px;display:flex;gap:12px;flex-wrap:wrap}
    .cards{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:20px}.card,.panel{background:white;border:1px solid #dde5ed;border-radius:16px}
    .card{padding:18px}.card span,.info span{display:block;font-size:12px;color:#718396;margin-bottom:8px}.card strong{font-size:22px;color:#082f5a}
    .panel{padding:22px;margin-bottom:20px}.bank{flex-wrap:wrap}.bankGrid{width:100%;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    .info{background:#f7f9fc;border-radius:12px;padding:13px}.badge{padding:9px 13px;border-radius:999px;font-weight:800}.good{background:#e9f8ef;color:#19733c}.warn{background:#fff4df;color:#9a5b00}
    .button{display:inline-block;background:#082f5a;color:white;text-decoration:none;padding:11px 16px;border-radius:10px;font-weight:700}
    .propertyGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:15px}.propertyCard{border:1px solid #e0e7ef;border-radius:13px;padding:16px;display:flex;flex-direction:column;gap:7px}
    .propertyCard span{font-size:13px;color:#718396}.propertyCard b{font-size:20px;color:#082f5a}.filters{display:flex;gap:10px;flex-wrap:wrap}
    input,select{border:1px solid #ccd7e2;border-radius:10px;padding:11px 12px;background:white;min-width:210px}.tableWrap{overflow:auto;margin-top:16px}
    table{width:100%;border-collapse:collapse;min-width:1000px}th,td{text-align:left;padding:13px;border-bottom:1px solid #e7edf3;vertical-align:top}
    th{font-size:12px;color:#607487;background:#f8fafc}td{font-size:14px}td small{display:block;margin-top:5px;color:#7c8d9d}.status{background:#eaf2fb;color:#214e78;padding:6px 9px;border-radius:999px;font-size:12px;font-weight:700}
    .empty{padding:25px;text-align:center;color:#748698}
    @media(max-width:1100px){.cards{grid-template-columns:repeat(2,1fr)}.propertyGrid,.bankGrid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:700px){.wrap{padding:18px}.hero,.sectionHead{flex-direction:column}.cards,.propertyGrid,.bankGrid{grid-template-columns:1fr}.filters{width:100%}input,select{width:100%}}
  `}</style>;
}
