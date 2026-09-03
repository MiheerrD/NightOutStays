'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function dateText(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function statusLabel(status) {
  const map = {
    active: 'Active', upcoming: 'Renewal Queued', pending: 'Payment Pending', expired: 'Expired',
    not_started: 'Not Started', cancelled: 'Cancelled', failed: 'Payment Failed',
  };
  return map[status] || status || 'Not Started';
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

export default function HostSubscriptionPage() {
  const [session, setSession] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
      const response = await fetch('/api/host/subscription', {
        headers: { Authorization: `Bearer ${s.access_token}` },
        cache: 'no-store',
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Unable to load subscription information.');
      setRows(json.properties || []);
    } catch (e) {
      setError(e?.message || 'Unable to load subscription information.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    getSession().then((s) => loadData(s));
  }, []);

  async function startPayment(property) {
    try {
      setPayingId(property.id);
      setError('');
      setMessage('');
      const s = session || await getSession();
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error('Unable to load Razorpay checkout. Please try again.');

      const response = await fetch('/api/host/subscription/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
        body: JSON.stringify({ propertyId: property.id }),
      });
      const order = await response.json();
      if (!response.ok) throw new Error(order?.error || 'Unable to create payment order.');

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'NightOutStays',
        description: `1 month subscription - ${property.name}`,
        order_id: order.orderId,
        handler: async function (payment) {
          try {
            const verifyResponse = await fetch('/api/host/subscription/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
              body: JSON.stringify({ subscriptionId: order.subscriptionId, ...payment }),
            });
            const verified = await verifyResponse.json();
            if (!verifyResponse.ok) throw new Error(verified?.error || 'Payment verification failed.');
            setMessage(`Subscription activated for ${property.name}.`);
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
      setError(e?.message || 'Unable to start payment.');
      setPayingId('');
    }
  }

  const summary = useMemo(() => ({
    total: rows.length,
    active: rows.filter((r) => r.subscription_status === 'active').length,
    expired: rows.filter((r) => r.subscription_status === 'expired').length,
    notStarted: rows.filter((r) => r.subscription_status === 'not_started').length,
  }), [rows]);

  return (
    <main className="subPage">
      <div className="subWrap">
        <section className="heading">
          <div>
            <h1>Property Subscriptions</h1>
            <p>Manage monthly NightOutStays subscriptions for each property.</p>
          </div>
        </section>

        <section className="pricingInfo">
          <strong>Monthly subscription pricing</strong>
          <span>Up to ₹4,999/night: ₹2,500 + 18% GST = ₹2,950</span>
          <span>₹5,000–₹9,999/night: ₹3,500 + 18% GST = ₹4,130</span>
          <span>₹10,000+/night: ₹5,000 + 18% GST = ₹5,900</span>
        </section>

        <section className="stats">
          <article><strong>{summary.total}</strong><span>Properties</span></article>
          <article><strong>{summary.active}</strong><span>Active</span></article>
          <article><strong>{summary.expired}</strong><span>Expired</span></article>
          <article><strong>{summary.notStarted}</strong><span>Not Started</span></article>
        </section>

        {message ? <div className="success">{message}</div> : null}
        {error ? <div className="error">{error}</div> : null}

        {loading ? (
          <div className="empty">Loading subscriptions...</div>
        ) : rows.length === 0 ? (
          <div className="empty">No properties found.</div>
        ) : (
          <section className="cards">
            {rows.map((property) => {
              const current = property.current_subscription;
              const upcoming = property.upcoming_subscription;
              const isPaying = payingId === property.id;
              const buttonText = property.subscription_status === 'active' ? 'Renew for 1 Month' : 'Activate for 1 Month';
              return (
                <article className="card" key={property.id}>
                  <div className="cardTop">
                    <div>
                      <h2>{property.name}</h2>
                      <p>{money(property.base_price)} per night</p>
                    </div>
                    <span className={`status ${property.subscription_status}`}>{statusLabel(property.subscription_status)}</span>
                  </div>

                  <div className="grid">
                    <div><span>Subscription Fee</span><strong>{money(property.subscription_fee)}</strong></div>
                    <div><span>GST 18%</span><strong>{money(property.gst_amount)}</strong></div>
                    <div><span>Total Payable</span><strong>{money(property.total_payable)}</strong></div>
                    <div><span>Moderation</span><strong>{property.moderation_status || '—'}</strong></div>
                  </div>

                  <div className="period">
                    <div><span>Current Period</span><strong>{current ? `${dateText(current.starts_at)} to ${dateText(current.expires_at)}` : 'No active period'}</strong></div>
                    {upcoming ? <div><span>Next Renewal</span><strong>{dateText(upcoming.starts_at)} to {dateText(upcoming.expires_at)}</strong></div> : null}
                  </div>

                  {property.subscription_required && property.subscription_status === 'expired' ? (
                    <div className="warning">This property is hidden from public availability until the subscription is renewed.</div>
                  ) : null}

                  {!property.subscription_required && property.subscription_status === 'not_started' ? (
                    <div className="note">Legacy listing: your property remains live until you activate its first NightOutStays subscription. After activation, an expired subscription will automatically remove it from public availability.</div>
                  ) : null}

                  <button disabled={isPaying} onClick={() => startPayment(property)}>{isPaying ? 'Opening Payment...' : buttonText}</button>
                </article>
              );
            })}
          </section>
        )}
      </div>

      <style jsx>{`
        .subPage{min-height:100vh;background:#f6f8fb;padding:34px 20px 60px;color:#10243a}.subWrap{max-width:1180px;margin:0 auto}.heading{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px}.heading h1{font-size:34px;margin:0 0 6px;color:#082f5a}.heading p{margin:0;color:#64748b}.pricingInfo{display:grid;gap:6px;background:#082f5a;color:white;border-radius:16px;padding:18px 22px;margin-bottom:18px}.pricingInfo strong{font-size:17px}.pricingInfo span{font-size:14px;opacity:.94}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px}.stats article{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px}.stats strong{display:block;font-size:27px;color:#082f5a}.stats span{font-size:13px;color:#64748b}.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:22px;box-shadow:0 3px 12px rgba(15,23,42,.04)}.cardTop{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.card h2{margin:0;color:#082f5a;font-size:21px}.cardTop p{margin:5px 0 0;color:#64748b}.status{font-size:12px;font-weight:800;border-radius:999px;padding:7px 10px;background:#eef2f7}.status.active{background:#dcfce7;color:#166534}.status.expired,.status.failed{background:#fee2e2;color:#991b1b}.status.pending,.status.upcoming{background:#fef3c7;color:#92400e}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:20px 0}.grid div,.period div{border:1px solid #e7edf4;border-radius:12px;padding:12px}.grid span,.period span{display:block;font-size:12px;color:#64748b;margin-bottom:4px}.grid strong,.period strong{font-size:14px}.period{display:grid;gap:10px;margin-bottom:14px}.warning,.note{padding:12px 14px;border-radius:12px;font-size:13px;line-height:1.45;margin-bottom:14px}.warning{background:#fff1f2;color:#9f1239;border:1px solid #fecdd3}.note{background:#eff6ff;color:#1e3a8a;border:1px solid #bfdbfe}.card button{width:100%;border:0;border-radius:11px;background:#082f5a;color:#fff;padding:13px 16px;font-weight:800;cursor:pointer}.card button:disabled{opacity:.6;cursor:not-allowed}.success,.error,.empty{border-radius:12px;padding:14px 16px;margin-bottom:18px}.success{background:#ecfdf5;color:#166534;border:1px solid #bbf7d0}.error{background:#fff1f2;color:#991b1b;border:1px solid #fecdd3}.empty{background:#fff;border:1px solid #e2e8f0;color:#64748b}@media(max-width:850px){.stats{grid-template-columns:repeat(2,1fr)}.cards{grid-template-columns:1fr}}@media(max-width:520px){.subPage{padding:24px 12px 40px}.heading h1{font-size:28px}.stats{grid-template-columns:1fr 1fr}.card{padding:16px}.grid{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}
