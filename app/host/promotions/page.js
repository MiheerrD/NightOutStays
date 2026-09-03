'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

function money(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function dateText(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function statusLabel(status) {
  const map = {
    not_started: 'Not Promoted',
    pending_payment: 'Payment Pending',
    pending_approval: 'Pending Admin Approval',
    active: 'Premium Active',
    rejected: 'Rejected',
    expired: 'Expired',
    cancelled: 'Cancelled',
    failed: 'Payment Failed',
  };
  return map[status] || status || 'Not Promoted';
}

async function loadRazorpay() {
  if (window.Razorpay) return true;
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function HostPromotionsPage() {
  const [session, setSession] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('all');

  async function getSession() {
    const { data } = await supabase.auth.getSession();
    const next = data?.session || null;
    setSession(next);
    return next;
  }

  async function loadData(givenSession) {
    try {
      setLoading(true);
      setError('');
      const s = givenSession || session || await getSession();
      if (!s?.access_token) {
        window.location.href = '/host/register';
        return;
      }
      const response = await fetch('/api/host/promotions', {
        headers: { Authorization: `Bearer ${s.access_token}` },
        cache: 'no-store',
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Unable to load promotions.');
      setRows(json.properties || []);
    } catch (e) {
      setError(e?.message || 'Unable to load promotions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    getSession().then((s) => loadData(s));
  }, []);

  async function startPromotion(property) {
    try {
      setPayingId(property.id);
      setError('');
      setMessage('');
      const s = session || await getSession();
      if (!s?.access_token) throw new Error('Please log in again.');
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error('Unable to load Razorpay checkout. Please try again.');

      const response = await fetch('/api/host/promotions/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${s.access_token}`,
        },
        body: JSON.stringify({ propertyId: property.id }),
      });
      const order = await response.json();
      if (!response.ok) throw new Error(order?.error || 'Unable to create promotion payment order.');

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'NightOutStays',
        description: `Premium promotion - ${property.name}`,
        order_id: order.orderId,
        handler: async function (payment) {
          try {
            const verifyResponse = await fetch('/api/host/promotions/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${s.access_token}`,
              },
              body: JSON.stringify({ promotionId: order.promotionId, ...payment }),
            });
            const verified = await verifyResponse.json();
            if (!verifyResponse.ok) throw new Error(verified?.error || 'Payment verification failed.');
            setMessage(`Payment received for ${property.name}. Premium promotion is now waiting for Admin approval.`);
            await loadData(s);
          } catch (e) {
            setError(e?.message || 'Payment verification failed.');
          } finally {
            setPayingId('');
          }
        },
        modal: { ondismiss: () => setPayingId('') },
        theme: { color: '#082f5a' },
      };
      new window.Razorpay(options).open();
    } catch (e) {
      setError(e?.message || 'Unable to start promotion payment.');
      setPayingId('');
    }
  }

  const summary = useMemo(() => ({
    total: rows.length,
    active: rows.filter((row) => row.promotion_status === 'active').length,
    pending: rows.filter((row) => row.promotion_status === 'pending_approval').length,
    eligible: rows.filter((row) => row.eligible).length,
  }), [rows]);

  const visibleRows = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'eligible') return rows.filter((row) => row.eligible);
    return rows.filter((row) => row.promotion_status === filter);
  }, [rows, filter]);

  return (
    <main className="promoPage">
      <div className="promoWrap">
        <section className="heading">
          <div>
            <h1>Premium Promotions</h1>
            <p>Boost approved NightOutStays properties with premium visibility.</p>
          </div>
        </section>

        <section className="premiumInfo">
          <strong>Premium promotion pricing</strong>
          <span>Promotion fee = 2× the property monthly subscription base fee + 18% GST.</span>
          <span>The 1-month promotion period starts only after Admin approval, so approval time does not reduce the paid promotion period.</span>
          <span>When several premium properties compete in the same area, NightOutStays can rotate premium visibility fairly.</span>
        </section>

        <section className="stats">
          <article><strong>{summary.total}</strong><span>Properties</span></article>
          <article><strong>{summary.eligible}</strong><span>Eligible</span></article>
          <article><strong>{summary.pending}</strong><span>Pending Approval</span></article>
          <article><strong>{summary.active}</strong><span>Premium Active</span></article>
        </section>

        <section className="filters">
          {[
            ['all', 'All Properties'],
            ['eligible', 'Eligible'],
            ['pending_approval', 'Pending Approval'],
            ['active', 'Active'],
            ['expired', 'Expired'],
            ['rejected', 'Rejected'],
          ].map(([value, label]) => (
            <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </section>

        {message ? <div className="success">{message}</div> : null}
        {error ? <div className="error">{error}</div> : null}

        {loading ? (
          <div className="empty">Loading promotions...</div>
        ) : visibleRows.length === 0 ? (
          <div className="empty">No properties found for this filter.</div>
        ) : (
          <section className="cards">
            {visibleRows.map((property) => {
              const status = property.promotion_status || 'not_started';
              const latest = property.latest_promotion;
              const active = property.current_promotion;
              const pending = property.pending_approval;
              const isPaying = payingId === property.id;
              const blocked = ['pending_payment', 'pending_approval', 'active'].includes(status);

              return (
                <article className="card" key={property.id}>
                  <div className="cardTop">
                    <div>
                      <h2>{property.name}</h2>
                      <p>{property.area || property.city || 'Location not specified'} · {money(property.base_price)} per night</p>
                    </div>
                    <span className={`status ${status}`}>{statusLabel(status)}</span>
                  </div>

                  <div className="grid">
                    <div><span>Monthly Subscription Base</span><strong>{money(property.subscription_base_fee)}</strong></div>
                    <div><span>Premium Fee (2×)</span><strong>{money(property.promotion_fee)}</strong></div>
                    <div><span>GST 18%</span><strong>{money(property.gst_amount)}</strong></div>
                    <div><span>Total Payable</span><strong>{money(property.total_payable)}</strong></div>
                  </div>

                  <div className="details">
                    <div><span>Property Status</span><strong>{property.moderation_status || '—'} / {property.is_active ? 'Live' : 'Not Live'}</strong></div>
                    <div><span>Promotion Period</span><strong>{active?.starts_at ? `${dateText(active.starts_at)} to ${dateText(active.expires_at)}` : pending ? 'Starts after Admin approval' : '—'}</strong></div>
                    {latest?.paid_at ? <div><span>Last Payment</span><strong>{dateText(latest.paid_at)}</strong></div> : null}
                    {latest?.rejection_reason ? <div><span>Admin Note</span><strong>{latest.rejection_reason}</strong></div> : null}
                  </div>

                  {!property.eligible ? (
                    <div className="warning">Only properties that are Admin-approved and currently live can use Premium Promotion.</div>
                  ) : status === 'pending_approval' ? (
                    <div className="note">Payment received. NightOutStays Admin approval is pending. Your 1-month promotion starts only when approved.</div>
                  ) : status === 'active' ? (
                    <div className="successInline">Premium promotion is active for this property.</div>
                  ) : null}

                  <button
                    disabled={!property.eligible || blocked || isPaying}
                    onClick={() => startPromotion(property)}
                  >
                    {isPaying
                      ? 'Opening Payment...'
                      : status === 'pending_approval'
                        ? 'Awaiting Admin Approval'
                        : status === 'active'
                          ? 'Premium Active'
                          : status === 'pending_payment'
                            ? 'Payment Pending'
                            : 'Promote for 1 Month'}
                  </button>
                </article>
              );
            })}
          </section>
        )}
      </div>

      <style jsx>{`
        .promoPage{min-height:100vh;background:#f6f8fb;padding:34px 20px 60px;color:#10243a}.promoWrap{max-width:1180px;margin:0 auto}.heading{margin-bottom:20px}.heading h1{font-size:34px;margin:0 0 6px;color:#082f5a}.heading p{margin:0;color:#64748b}.premiumInfo{display:grid;gap:6px;background:#082f5a;color:#fff;border-radius:16px;padding:18px 22px;margin-bottom:18px}.premiumInfo strong{font-size:17px}.premiumInfo span{font-size:14px;opacity:.95}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}.stats article{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px}.stats strong{display:block;font-size:27px;color:#082f5a}.stats span{font-size:13px;color:#64748b}.filters{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}.filters button{border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:10px;padding:9px 13px;font-weight:700;cursor:pointer}.filters button.active{background:#082f5a;color:#fff;border-color:#082f5a}.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:22px;box-shadow:0 3px 12px rgba(15,23,42,.04)}.cardTop{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.card h2{margin:0;color:#082f5a;font-size:21px}.cardTop p{margin:5px 0 0;color:#64748b}.status{font-size:12px;font-weight:800;border-radius:999px;padding:7px 10px;background:#eef2f7;white-space:nowrap}.status.active{background:#dcfce7;color:#166534}.status.pending_approval,.status.pending_payment{background:#fef3c7;color:#92400e}.status.rejected,.status.failed{background:#fee2e2;color:#991b1b}.status.expired{background:#e2e8f0;color:#475569}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:20px 0}.grid div,.details div{border:1px solid #e7edf4;border-radius:12px;padding:12px}.grid span,.details span{display:block;font-size:12px;color:#64748b;margin-bottom:4px}.grid strong,.details strong{font-size:14px}.details{display:grid;gap:10px;margin-bottom:14px}.warning,.note,.successInline{padding:12px 14px;border-radius:12px;font-size:13px;line-height:1.45;margin-bottom:14px}.warning{background:#fff1f2;color:#9f1239;border:1px solid #fecdd3}.note{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}.successInline{background:#ecfdf5;color:#166534;border:1px solid #bbf7d0}.card button{width:100%;border:0;border-radius:11px;background:#082f5a;color:#fff;padding:13px 16px;font-weight:800;cursor:pointer}.card button:disabled{opacity:.55;cursor:not-allowed}.success,.error,.empty{border-radius:12px;padding:14px 16px;margin-bottom:18px}.success{background:#ecfdf5;color:#166534;border:1px solid #bbf7d0}.error{background:#fff1f2;color:#991b1b;border:1px solid #fecdd3}.empty{background:#fff;border:1px solid #e2e8f0;color:#64748b}@media(max-width:850px){.stats{grid-template-columns:repeat(2,1fr)}.cards{grid-template-columns:1fr}}@media(max-width:520px){.promoPage{padding:24px 12px 40px}.heading h1{font-size:28px}.stats{grid-template-columns:1fr 1fr}.card{padding:16px}.grid{grid-template-columns:1fr}.cardTop{flex-direction:column}.status{white-space:normal}}
      `}</style>
    </main>
  );
}
