'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useParams, useRouter } from 'next/navigation';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function BookingPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const bookingCode = decodeURIComponent(String(params?.bookingCode || ''));
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [booking, setBooking] = useState(null);
  const [guest, setGuest] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { initialise(); }, [bookingCode]);

  async function initialise() {
    try {
      setLoading(true); setError('');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.replace(`/login?redirect=${encodeURIComponent(`/booking/${bookingCode}/pay`)}`);
        return;
      }
      const { data: guestRow, error: guestError } = await supabase
        .from('guests').select('id,full_name,email,phone').eq('user_id', session.user.id).maybeSingle();
      if (guestError || !guestRow) throw guestError || new Error('Guest profile not found.');
      setGuest(guestRow);
      const { data: bookingRow, error: bookingError } = await supabase
        .from('bookings')
        .select('id,booking_code,guest_id,property_id,check_in,check_out,nights,total_amount,amount_including_gst,final_payable_amount,offer_status,booking_status,payment_status,host_decision,payment_due_at,properties(name,location_name)')
        .eq('booking_code', bookingCode).eq('guest_id', guestRow.id).maybeSingle();
      if (bookingError || !bookingRow) throw bookingError || new Error('Booking not found.');
      setBooking(bookingRow);
    } catch (e) {
      setError(e?.message || 'Unable to load payment details.');
    } finally { setLoading(false); }
  }

  async function payNow() {
    if (!booking || paying) return;
    try {
      setPaying(true); setError('');
      const ready = await loadRazorpay();
      if (!ready) throw new Error('Unable to load Razorpay checkout. Please try again.');
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingCode: booking.booking_code }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok) throw new Error(order.error || 'Unable to create payment order.');

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'NightOutStays',
        description: `Booking ${booking.booking_code}`,
        order_id: order.orderId,
        prefill: { name: guest?.full_name || '', email: guest?.email || '', contact: guest?.phone || '' },
        notes: { booking_code: booking.booking_code },
        theme: { color: '#0b4b8c' },
        handler: async (response) => {
          try {
            const verifyRes = await fetch('/api/razorpay/verify', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bookingCode: booking.booking_code, ...response }),
            });
            const verify = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verify.error || 'Payment verification failed.');
            router.replace('/account/bookings?payment=success');
          } catch (e) {
            setPaying(false);
            setError(e?.message || 'Payment verification failed.');
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      checkout.on('payment.failed', (response) => {
        setPaying(false);
        setError(response?.error?.description || 'Payment failed. Please try again.');
      });
      checkout.open();
    } catch (e) {
      setPaying(false);
      setError(e?.message || 'Unable to start payment.');
    }
  }

  const payable = booking?.offer_status === 'accepted' && Number(booking?.final_payable_amount) > 0
    ? booking.final_payable_amount
    : (booking?.amount_including_gst || booking?.total_amount || 0);

  if (loading) return <main className="payPage"><div className="payCard">Loading payment…<Styles /></div></main>;

  return (
    <main className="payPage">
      <div className="payCard">
        <a className="brand" href="/">NightOutStays</a>
        <p className="eyebrow">SECURE PAYMENT</p>
        <h1>Complete your booking</h1>
        {error && <div className="error">{error}</div>}
        {booking && <>
          <div className="summary">
            <div><span>Booking</span><strong>{booking.booking_code}</strong></div>
            <div><span>Property</span><strong>{booking.properties?.name || 'NightOutStays property'}</strong></div>
            <div><span>Stay</span><strong>{booking.check_in} → {booking.check_out}</strong></div>
            <div><span>Amount payable</span><strong className="amount">{money(payable)}</strong></div>
          </div>
          {booking.payment_status === 'paid' ? (
            <button className="primary" onClick={() => router.push('/account/bookings')}>Payment already completed</button>
          ) : booking.host_decision !== 'approved' ? (
            <div className="notice">Host approval is required before payment.</div>
          ) : (
            <button className="primary" disabled={paying} onClick={payNow}>{paying ? 'Opening Razorpay…' : `Pay ${money(payable)}`}</button>
          )}
          <button className="secondary" onClick={() => router.push('/account/bookings')}>Back to My Bookings</button>
        </>}
      </div>
      <Styles />
    </main>
  );
}

function Styles(){return <style jsx global>{`
  body{margin:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#10233f}.payPage{min-height:100vh;display:grid;place-items:center;padding:24px}.payCard{width:min(620px,100%);background:white;border:1px solid #e5e7eb;border-radius:20px;padding:30px;box-shadow:0 18px 45px rgba(15,23,42,.08)}.brand{font-size:24px;font-weight:900;color:#0b4b8c;text-decoration:none}.eyebrow{margin:28px 0 8px;font-size:11px;font-weight:900;letter-spacing:1px;color:#ec4899}h1{margin:0 0 22px;font-size:32px}.summary{border:1px solid #e5e7eb;border-radius:15px;overflow:hidden;margin:18px 0}.summary>div{display:flex;justify-content:space-between;gap:18px;padding:14px 16px;border-bottom:1px solid #eef2f7}.summary>div:last-child{border-bottom:0}.summary span{color:#64748b}.amount{font-size:20px;color:#0b4b8c}.primary,.secondary{width:100%;padding:14px;border-radius:12px;font-weight:900;font-size:15px;cursor:pointer}.primary{border:0;background:#0b4b8c;color:white;margin-top:8px}.primary:disabled{opacity:.65}.secondary{border:1px solid #d9e0ea;background:white;color:#10233f;margin-top:10px}.error{background:#fff1f2;border:1px solid #fecdd3;color:#be123c;padding:12px;border-radius:10px;margin:14px 0}.notice{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;padding:13px;border-radius:10px;margin:12px 0}@media(max-width:640px){.payPage{padding:12px}.payCard{padding:20px;border-radius:14px}h1{font-size:26px}.summary>div{flex-direction:column;gap:5px}}
`}</style>}
