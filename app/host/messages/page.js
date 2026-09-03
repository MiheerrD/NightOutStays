'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gxwemplbykjxhezefykh.supabase.co',
  'sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS'
);

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return value; }
}

function formatDateTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return value; }
}

function statusText(booking) {
  const payment = String(booking?.payment_status || '').toLowerCase();
  const status = String(booking?.booking_status || '').toLowerCase();
  const decision = String(booking?.host_decision || '').toLowerCase();

  if (payment === 'paid') return 'Paid / Confirmed';
  if (decision === 'approved') return 'Host Approved - Payment Pending';
  if (decision === 'declined') return 'Declined';
  if (status === 'cancelled' || status === 'canceled') return 'Cancelled';
  if (status === 'completed') return 'Completed';
  return 'Booking Requested';
}

function senderLabel(message) {
  if (message?.sender_type === 'host') return message.sender_name || 'You';
  if (message?.sender_type === 'guest') return message.sender_name || 'Guest';
  return 'NightOutStays';
}

export default function HostMessagesPage() {
  const [threads, setThreads] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const selectedIdRef = useRef('');
  const syncInFlightRef = useRef(false);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    loadMessages(true);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => loadMessages(false), 4000);
    const onFocus = () => loadMessages(false);
    const onOnline = () => loadMessages(false);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') loadMessages(false);
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`host-booking-messages-live-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'booking_messages' },
        () => loadMessages(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedId, threads]);

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      window.location.href = '/host';
      throw new Error('Login required.');
    }
    return {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }

  async function loadMessages(firstLoad = false) {
    if (!firstLoad && syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    if (firstLoad) setLoading(true);
    else setRefreshing(true);

    try {
      setError('');
      const headers = await authHeaders();
      const response = await fetch('/api/host/messages', { headers, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to load messages.');

      const rows = data.threads || [];
      setThreads(rows);

      const urlBooking = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('booking')
        : '';

      const currentSelectedId = selectedIdRef.current;
      const currentStillExists = rows.some((t) => t.booking.id === currentSelectedId);
      const requested = rows.find((t) => t.booking.id === urlBooking || t.booking.booking_code === urlBooking);
      const nextId = requested?.booking?.id || (currentStillExists ? currentSelectedId : rows[0]?.booking?.id || '');

      setSelectedId(nextId);
      if (nextId) markRead(nextId, headers, false);
    } catch (e) {
      console.error(e);
      setError(e?.message || 'Unable to load messages.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      syncInFlightRef.current = false;
    }
  }

  async function markRead(bookingId, suppliedHeaders = null, reload = true) {
    if (!bookingId) return;
    try {
      const headers = suppliedHeaders || await authHeaders();
      await fetch('/api/host/messages', {
        method: 'PATCH', headers, body: JSON.stringify({ bookingId }),
      });
      setThreads((old) => old.map((t) => t.booking.id === bookingId ? {
        ...t,
        unread: 0,
        messages: t.messages.map((m) => m.sender_type === 'guest' ? { ...m, is_read: true } : m),
      } : t));
      if (reload) loadMessages(false);
    } catch (e) {
      console.error(e);
    }
  }

  async function openThread(bookingId) {
    setSelectedId(bookingId);
    setReply('');
    markRead(bookingId);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('booking', bookingId);
      window.history.replaceState({}, '', url);
    }
  }

  async function sendMessage() {
    const text = reply.trim();
    if (!text || !selectedId || sending) return;

    setSending(true);
    setError('');
    try {
      const headers = await authHeaders();
      const response = await fetch('/api/host/messages', {
        method: 'POST', headers,
        body: JSON.stringify({ bookingId: selectedId, message: text }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to send message.');

      setReply('');
      setThreads((old) => old.map((t) => t.booking.id === selectedId
        ? { ...t, messages: [...t.messages, data.message], lastMessage: data.message }
        : t
      ));
    } catch (e) {
      console.error(e);
      setError(e?.message || 'Unable to send message.');
    } finally {
      setSending(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return threads.filter((thread) => {
      if (filter === 'unread' && !thread.unread) return false;
      if (filter === 'discount' && !thread.booking.guest_discount_requested) return false;
      if (filter === 'payment' && String(thread.booking.host_decision || '').toLowerCase() !== 'approved') return false;
      if (!q) return true;
      const haystack = [
        thread.guest?.full_name,
        thread.guest?.phone,
        thread.guest?.email,
        thread.property?.name,
        thread.property?.location_name,
        thread.booking?.booking_code,
        thread.lastMessage?.message,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [threads, search, filter]);

  const selected = useMemo(
    () => threads.find((t) => t.booking.id === selectedId) || null,
    [threads, selectedId]
  );

  const unreadCount = threads.reduce((sum, t) => sum + Number(t.unread || 0), 0);
  const discountCount = threads.filter((t) => t.booking.guest_discount_requested).length;
  const paymentPending = threads.filter((t) => String(t.booking.host_decision || '').toLowerCase() === 'approved' && String(t.booking.payment_status || '').toLowerCase() !== 'paid').length;

  if (loading) {
    return <main className="hmPage"><div className="hmLoading">Loading Host messages...</div><style jsx>{styles}</style></main>;
  }

  return (
    <main className="hmPage">
      <section className="hmTop">
        <div>
          <div className="hmEyebrow">HOST MESSENGER</div>
          <h1>Messages</h1>
          <p>Manage guest conversations connected to your booking requests.</p>
        </div>
        <button className="hmRefresh" onClick={() => loadMessages(false)} disabled={refreshing}>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </section>

      <section className="hmStats">
        <Stat label="Conversations" value={threads.length} />
        <Stat label="Unread Messages" value={unreadCount} />
        <Stat label="Discount Requests" value={discountCount} />
        <Stat label="Payment Pending" value={paymentPending} />
      </section>

      {error ? <div className="hmError">{error}</div> : null}

      <section className="hmWorkspace">
        <aside className="hmSidebar">
          <div className="hmTools">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search guest, property or booking"
            />
            <div className="hmFilters">
              {[
                ['all', 'All'],
                ['unread', 'Unread'],
                ['discount', 'Discount'],
                ['payment', 'Payment Pending'],
              ].map(([value, label]) => (
                <button key={value} onClick={() => setFilter(value)} className={filter === value ? 'active' : ''}>{label}</button>
              ))}
            </div>
          </div>

          <div className="hmThreadList">
            {!filtered.length ? <div className="hmEmptySide">No conversations found.</div> : null}
            {filtered.map((thread) => {
              const active = thread.booking.id === selectedId;
              const guestName = thread.guest?.full_name || 'Guest';
              return (
                <button
                  key={thread.booking.id}
                  className={`hmThread ${active ? 'active' : ''}`}
                  onClick={() => openThread(thread.booking.id)}
                >
                  <div className="hmThreadTop">
                    <strong>{guestName}</strong>
                    {thread.unread ? <span className="hmUnread">{thread.unread}</span> : null}
                  </div>
                  <div className="hmPropertyName">{thread.property?.name || 'Property'}</div>
                  <div className="hmPreview">{thread.lastMessage?.message || 'No messages yet'}</div>
                  <div className="hmThreadMeta">
                    <span>{thread.booking.booking_code || 'Booking'}</span>
                    <span>{formatDateTime(thread.lastMessage?.created_at || thread.booking.updated_at)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="hmChat">
          {!selected ? (
            <div className="hmNoSelection">
              <div className="hmNoIcon">💬</div>
              <h2>Select a conversation</h2>
              <p>Booking-linked guest conversations will appear here.</p>
            </div>
          ) : (
            <>
              <header className="hmChatHeader">
                <div>
                  <h2>{selected.guest?.full_name || 'Guest'}</h2>
                  <div className="hmHeaderSub">
                    {selected.property?.name || 'Property'} · {selected.booking.booking_code || 'Booking'}
                  </div>
                </div>
                <a className="hmBookingLink" href={`/host/bookings?booking=${encodeURIComponent(selected.booking.id)}`}>View Booking</a>
              </header>

              <div className="hmBookingBar">
                <span className="hmStatus">{statusText(selected.booking)}</span>
                <span>{formatDate(selected.booking.check_in)} → {formatDate(selected.booking.check_out)}</span>
                <span>{selected.booking.guests_count || 0} guest{Number(selected.booking.guests_count || 0) === 1 ? '' : 's'}</span>
                {selected.booking.guest_discount_requested ? <span className="hmDiscountFlag">Discount Requested</span> : null}
              </div>

              <div className="hmMessages">
                {!selected.messages.length ? (
                  <div className="hmNoMessages">No messages yet. You can start the conversation below.</div>
                ) : null}

                {selected.messages.map((message) => {
                  const host = message.sender_type === 'host';
                  const system = message.sender_type === 'system';
                  if (system) {
                    return <div key={message.id} className="hmSystem">{message.message}</div>;
                  }
                  return (
                    <div key={message.id} className={`hmBubbleRow ${host ? 'host' : 'guest'}`}>
                      <div className="hmBubble">
                        <div className="hmSender">{senderLabel(message)}</div>
                        <div className="hmText">{message.message}</div>
                        <div className="hmTime">{formatDateTime(message.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="hmComposer">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type a message to the guest..."
                  maxLength={3000}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <button onClick={sendMessage} disabled={!reply.trim() || sending}>{sending ? 'Sending...' : 'Send'}</button>
              </div>
            </>
          )}
        </section>
      </section>

      <style jsx>{styles}</style>
    </main>
  );
}

function Stat({ label, value }) {
  return <div className="hmStat"><div>{label}</div><strong>{value}</strong></div>;
}

const styles = `
  .hmPage{min-height:100vh;background:#f5f7fa;padding:28px 28px 50px;color:#172033;font-family:Arial,sans-serif}
  .hmTop{max-width:1440px;margin:0 auto 20px;display:flex;align-items:flex-start;justify-content:space-between;gap:20px}
  .hmEyebrow{font-size:12px;font-weight:800;color:#35618c;letter-spacing:.12em;margin-bottom:7px}
  h1{margin:0;color:#082f5a;font-size:34px;line-height:1.1} .hmTop p{margin:8px 0 0;color:#667085}
  .hmRefresh{border:1px solid #cfd8e3;background:#fff;color:#082f5a;font-weight:700;border-radius:10px;padding:11px 16px;cursor:pointer}
  .hmStats{max-width:1440px;margin:0 auto 20px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
  .hmStat{background:#fff;border:1px solid #e3e8ef;border-radius:14px;padding:16px 18px}.hmStat div{font-size:13px;color:#667085;font-weight:700}.hmStat strong{display:block;margin-top:7px;font-size:28px;color:#082f5a}
  .hmError{max-width:1440px;margin:0 auto 16px;background:#fff1f1;color:#9e1c1c;border:1px solid #f3c4c4;padding:12px 14px;border-radius:10px}
  .hmWorkspace{max-width:1440px;height:680px;margin:0 auto;display:grid;grid-template-columns:380px minmax(0,1fr);background:#fff;border:1px solid #dde4ec;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(8,47,90,.05)}
  .hmSidebar{border-right:1px solid #e4e8ee;display:flex;flex-direction:column;min-height:0}.hmTools{padding:16px;border-bottom:1px solid #e8edf2}.hmTools input{width:100%;box-sizing:border-box;border:1px solid #d8e0e8;border-radius:10px;padding:11px 12px;outline:none;font-size:14px}
  .hmFilters{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.hmFilters button{border:1px solid #d8e0e8;background:#fff;color:#4b5b70;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:700;cursor:pointer}.hmFilters button.active{background:#082f5a;color:#fff;border-color:#082f5a}
  .hmThreadList{overflow:auto;min-height:0}.hmThread{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid #eef1f4;background:#fff;padding:15px 16px;cursor:pointer;color:inherit}.hmThread:hover{background:#f8fafc}.hmThread.active{background:#edf4fb;border-left:4px solid #35618c;padding-left:12px}.hmThreadTop{display:flex;justify-content:space-between;gap:10px;align-items:center}.hmThreadTop strong{font-size:15px;color:#172033}.hmUnread{min-width:22px;height:22px;border-radius:50%;background:#35618c;color:#fff;font-size:11px;display:grid;place-items:center;font-weight:800}.hmPropertyName{font-size:12px;color:#35618c;font-weight:700;margin-top:5px}.hmPreview{font-size:13px;color:#667085;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hmThreadMeta{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:#98a2b3;margin-top:8px}.hmEmptySide{padding:30px 18px;text-align:center;color:#98a2b3}
  .hmChat{display:flex;flex-direction:column;min-width:0;min-height:0}.hmChatHeader{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:18px 20px;border-bottom:1px solid #e8edf2}.hmChatHeader h2{margin:0;color:#082f5a;font-size:20px}.hmHeaderSub{font-size:13px;color:#667085;margin-top:4px}.hmBookingLink{color:#082f5a;text-decoration:none;font-weight:800;font-size:13px;border:1px solid #cbd6e2;border-radius:9px;padding:9px 12px;background:#fff}
  .hmBookingBar{padding:10px 20px;background:#f8fafc;border-bottom:1px solid #e8edf2;display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:12px;color:#5c6879}.hmStatus{font-weight:800;color:#082f5a}.hmDiscountFlag{background:#fff3d8;color:#8a5d00;border-radius:999px;padding:5px 8px;font-weight:800}
  .hmMessages{flex:1;overflow:auto;background:#f7f9fc;padding:20px}.hmBubbleRow{display:flex;margin:10px 0}.hmBubbleRow.host{justify-content:flex-end}.hmBubbleRow.guest{justify-content:flex-start}.hmBubble{max-width:72%;background:#fff;border:1px solid #e1e7ee;border-radius:14px;padding:10px 12px;box-shadow:0 2px 8px rgba(15,23,42,.03)}.hmBubbleRow.host .hmBubble{background:#e8f1fb;border-color:#c7d9ec}.hmSender{font-size:11px;font-weight:800;color:#35618c;margin-bottom:5px}.hmText{white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.45}.hmTime{text-align:right;color:#98a2b3;font-size:10px;margin-top:6px}.hmSystem{margin:12px auto;text-align:center;background:#eef2f6;color:#667085;font-size:12px;padding:8px 12px;border-radius:999px;max-width:80%}.hmNoMessages{height:100%;display:grid;place-items:center;color:#98a2b3;text-align:center}.hmNoSelection{height:100%;display:grid;place-content:center;text-align:center;color:#667085}.hmNoSelection h2{margin:8px 0 4px;color:#082f5a}.hmNoSelection p{margin:0}.hmNoIcon{font-size:42px}
  .hmComposer{display:grid;grid-template-columns:1fr auto;gap:10px;padding:14px;border-top:1px solid #e3e8ef;background:#fff}.hmComposer textarea{resize:none;min-height:48px;max-height:110px;border:1px solid #d3dbe5;border-radius:11px;padding:11px 12px;font:inherit;outline:none}.hmComposer button{align-self:stretch;min-width:96px;border:0;background:#082f5a;color:#fff;font-weight:800;border-radius:11px;padding:0 18px;cursor:pointer}.hmComposer button:disabled{opacity:.5;cursor:not-allowed}.hmLoading{max-width:1000px;margin:100px auto;text-align:center;font-weight:700;color:#667085}
  @media(max-width:900px){.hmPage{padding:18px 12px 36px}.hmStats{grid-template-columns:repeat(2,minmax(0,1fr))}.hmWorkspace{grid-template-columns:1fr;height:auto;min-height:780px}.hmSidebar{border-right:0;border-bottom:1px solid #e4e8ee;max-height:340px}.hmChat{min-height:560px}.hmTop{align-items:center}.hmBubble{max-width:86%}}
  @media(max-width:520px){h1{font-size:28px}.hmStats{grid-template-columns:1fr 1fr;gap:9px}.hmStat{padding:12px}.hmStat strong{font-size:22px}.hmBookingBar{gap:8px}.hmChatHeader{align-items:flex-start}.hmBookingLink{font-size:12px}.hmComposer{grid-template-columns:1fr}.hmComposer button{min-height:44px}.hmThreadMeta{display:block}.hmThreadMeta span{display:block;margin-top:3px}}
`;
