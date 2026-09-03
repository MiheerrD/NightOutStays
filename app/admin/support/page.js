"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://gxwemplbykjxhezefykh.supabase.co",
  "sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS"
);

function dt(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function elapsed(fromValue, toValue) {
  if (!fromValue || !toValue) return "—";

  const from = new Date(fromValue).getTime();
  const to = new Date(toValue).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return "—";

  let totalMinutes = Math.floor((to - from) / 60000);
  const days = Math.floor(totalMinutes / 1440);
  totalMinutes -= days * 1440;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes - hours * 60;

  const parts = [];
  if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours) parts.push(`${hours} hr${hours === 1 ? "" : "s"}`);
  parts.push(`${minutes} min${minutes === 1 ? "" : "s"}`);

  return parts.join(" ");
}

export default function AdminSupport() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("tickets");
  const [selected, setSelected] = useState("");
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState("");
  const [liveState, setLiveState] = useState("connecting");
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [ticketFilter, setTicketFilter] = useState("all");
  const [faq, setFaq] = useState({ category: "general", question: "", answer: "", keywords: "", sortOrder: 0 });

  const selectedRef = useRef("");
  const refreshTimerRef = useRef(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  async function token() {
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData?.session?.access_token || "";
  }

  async function load(ticketId = selectedRef.current, silent = false) {
    if (loadingRef.current && silent) return;
    loadingRef.current = true;

    try {
      if (!silent) setError("");
      const accessToken = await token();
      if (!accessToken) {
        window.location.href = "/admin/login";
        return;
      }

      const url = `/api/admin/support${ticketId ? `?ticket=${encodeURIComponent(ticketId)}` : ""}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Unable to load support.");

      setData(json);
      setMessages(json.messages || []);

      try {
        const notificationResponse = await fetch("/api/admin/notifications", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        const notificationJson = await notificationResponse.json();
        if (notificationResponse.ok) {
          setUnreadNotifications(notificationJson?.summary?.unread || 0);
        }
      } catch {}
    } catch (err) {
      if (!silent) setError(err?.message || "Unable to load support.");
    } finally {
      loadingRef.current = false;
    }
  }

  function scheduleLiveReload() {
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      load(selectedRef.current, true);
    }, 180);
  }

  async function postAction(payload, actionKey, options = {}) {
    if (busy) return false;
    setBusy(actionKey);
    setError("");
    if (!options.keepSuccess) setSuccess("");

    try {
      const accessToken = await token();
      if (!accessToken) {
        window.location.href = "/admin/login";
        return false;
      }

      const response = await fetch("/api/admin/support", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Unable to save.");

      setSuccess(json.message || "Saved.");
      await load(selectedRef.current, true);
      return true;
    } catch (err) {
      setError(err?.message || "Unable to save.");
      await load(selectedRef.current, true);
      return false;
    } finally {
      setBusy("");
    }
  }

  function optimisticallyUpdateTicket(ticketId, patch) {
    setData((old) => {
      if (!old) return old;
      return {
        ...old,
        tickets: (old.tickets || []).map((ticket) =>
          ticket.id === ticketId ? { ...ticket, ...patch } : ticket
        ),
      };
    });
  }

  async function updateTicket(ticketId, field, value) {
    if (!ticketId || busy) return;
    optimisticallyUpdateTicket(ticketId, { [field]: value });
    const ok = await postAction(
      { action: "update_ticket", ticketId, [field]: value },
      `${field}:${ticketId}`
    );
    if (!ok) await load(ticketId, true);
  }

  async function sendReply(ticket) {
    const text = reply.trim();
    if (!ticket || !text || busy) return;

    const ok = await postAction(
      { action: "reply", ticketId: ticket.id, message: text },
      `reply:${ticket.id}`
    );
    if (ok) setReply("");
  }

  async function choose(id) {
    setSelected(id);
    selectedRef.current = id;
    window.history.replaceState(null, "", `/admin/support?ticket=${id}`);
    await load(id, false);
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("ticket") || "";
    setSelected(q);
    selectedRef.current = q;
    load(q, false);

    const channel = supabase
      .channel("admin-support-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, scheduleLiveReload)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_ticket_messages" }, scheduleLiveReload)
      .subscribe((status) => {
        setLiveState(status === "SUBSCRIBED" ? "live" : status === "CHANNEL_ERROR" ? "fallback" : "connecting");
      });

    const fallback = window.setInterval(() => load(selectedRef.current, true), 4000);

    const onFocus = () => load(selectedRef.current, true);
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(fallback);
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      window.removeEventListener("focus", onFocus);
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredTickets = useMemo(() => {
    const tickets = data?.tickets || [];

    if (ticketFilter === "all") return tickets;
    if (ticketFilter === "urgent") return tickets.filter((item) => item.priority === "urgent");
    if (ticketFilter === "important") return tickets.filter((item) => item.priority === "important");
    if (ticketFilter === "waiting") return tickets.filter((item) => ["waiting", "waiting_user"].includes(String(item.status || "").toLowerCase()));
    if (ticketFilter === "in_progress") return tickets.filter((item) => String(item.status || "").toLowerCase() === "in_progress");
    if (ticketFilter === "open") return tickets.filter((item) => String(item.status || "").toLowerCase() === "open");
    if (ticketFilter === "resolved") return tickets.filter((item) => String(item.status || "").toLowerCase() === "resolved");
    if (ticketFilter === "closed") return tickets.filter((item) => String(item.status || "").toLowerCase() === "closed");

    return tickets;
  }, [data, ticketFilter]);

  const ticket = useMemo(
    () => data?.tickets?.find((item) => item.id === selected) || null,
    [data, selected]
  );

  const normalizedStatus = String(ticket?.status || "").trim().toLowerCase();
  const isClosed = normalizedStatus === "closed";
  const isResolved = normalizedStatus === "resolved";

  return (
    <main style={s.page}>
      <div style={s.head}>
        <div>
          <h1 style={s.h1}>Support Center</h1>
          <p style={s.sub}>Complaints, help requests, escalations and FAQ management.</p>
        </div>
        <div style={s.headActions}>
          <span style={{ ...s.live, ...(liveState === "live" ? s.liveOn : {}) }}>
            {liveState === "live" ? "● Live" : "● Auto refresh"}
          </span>
          <a href="/admin/notifications" style={s.linkBtn}>Notifications{unreadNotifications > 0 ? ` (${unreadNotifications})` : ""}</a>
        </div>
      </div>

      {error && <div style={s.err}>{error}</div>}
      {success && <div style={s.ok}>{success}</div>}

      <div style={s.cards}>
        <Card l="Open Tickets" v={data?.summary?.open || 0} />
        <Card l="Urgent" v={data?.summary?.urgent || 0} />
        <Card l="Important" v={data?.summary?.important || 0} />
        <Card l="Waiting" v={data?.summary?.waiting || 0} />
      </div>

      <div style={s.tabs}>
        <button style={{ ...s.tab, ...(tab === "tickets" ? s.tabOn : {}) }} onClick={() => setTab("tickets")}>Support Tickets</button>
        <button style={{ ...s.tab, ...(tab === "faqs" ? s.tabOn : {}) }} onClick={() => setTab("faqs")}>FAQs</button>
      </div>

      {tab === "tickets" && (
        <div style={s.layout}>
          <section style={s.list}>
            <div style={s.filterWrap}>
              <div style={s.filterLabel}>Filter Tickets</div>
              <select
                style={s.filterSelect}
                value={ticketFilter}
                onChange={(e) => setTicketFilter(e.target.value)}
              >
                <option value="all">All Tickets</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting">Waiting</option>
                <option value="urgent">Urgent</option>
                <option value="important">Important</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <small style={s.filterCount}>Showing {filteredTickets.length} of {data?.tickets?.length || 0}</small>
            </div>

            {filteredTickets.length === 0 ? (
              <div style={s.noFilterResults}>No tickets found for this filter.</div>
            ) : filteredTickets.map((item) => (
              <button
                onClick={() => choose(item.id)}
                key={item.id}
                style={{ ...s.ticket, ...(selected === item.id ? s.ticketOn : {}) }}
              >
                <div style={s.ticketTop}>
                  <b>{item.ticket_code}</b>
                  <span>{item.priority}</span>
                </div>
                <strong>{item.subject}</strong>
                <small>{item.requester_name || item.requester_type} · {item.status} · {dt(item.last_message_at)}</small>
              </button>
            ))}
          </section>

          <section style={s.detail}>
            {!ticket ? (
              <div style={s.empty}>Select a support ticket.</div>
            ) : (
              <>
                <div style={s.detailHead}>
                  <div>
                    <div style={s.titleRow}>
                      <h2 style={s.h2}>{ticket.subject}</h2>
                      <span style={{ ...s.statusBadge, ...(isClosed ? s.statusClosed : isResolved ? s.statusResolved : s.statusOpen) }}>
                        {normalizedStatus.replaceAll("_", " ") || "open"}
                      </span>
                    </div>
                    <p>{ticket.ticket_code} · {ticket.requester_type} · {ticket.requester_name || "User"}</p>
                  </div>

                  <div style={s.controls}>
                    <label style={s.controlLabel}>
                      Priority
                      <select
                        value={ticket.priority}
                        disabled={Boolean(busy)}
                        onChange={(e) => updateTicket(ticket.id, "priority", e.target.value)}
                      >
                        {["normal", "important", "urgent"].map((value) => <option key={value}>{value}</option>)}
                      </select>
                    </label>

                    <label style={s.controlLabel}>
                      Status
                      <select
                        value={ticket.status}
                        disabled={Boolean(busy)}
                        onChange={(e) => updateTicket(ticket.id, "status", e.target.value)}
                      >
                        {["open", "in_progress", "waiting", "resolved", "closed"].map((value) => (
                          <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                {busy && <div style={s.saving}>Saving change… please wait.</div>}
                {isClosed && (
                  <div style={s.closed}>
                    <div><b>Ticket Closed</b> — no further replies can be sent unless you reopen it.</div>
                    <div style={s.closedTimeRow}>
                      <span>Closed at: <b>{dt(ticket.closed_at)}</b></span>
                      <span>Closed in: <b>{elapsed(ticket.created_at, ticket.closed_at)}</b></span>
                    </div>
                  </div>
                )}
                {isResolved && <div style={s.resolved}>Ticket Resolved — change status to Open or In Progress if more action is required.</div>}

                <div style={s.meta}>
                  <span>Category: <b>{ticket.category}</b></span>
                  <span>Created: <b>{dt(ticket.created_at)}</b></span>
                  {ticket.requester_email && <span>Email: <b>{ticket.requester_email}</b></span>}
                </div>

                <div style={s.description}>{ticket.description}</div>

                {ticket.category === "promotion" && ticket.subject?.startsWith("Free Boost Request") && !["resolved", "closed"].includes(ticket.status) && (
                  <div style={s.freeBoost}>
                    <b>Free Boost Request</b>
                    <div>
                      <button
                        style={s.approve}
                        disabled={Boolean(busy)}
                        onClick={() => postAction({ action: "approve_free_boost", ticketId: ticket.id }, `boost:${ticket.id}`)}
                      >
                        {busy === `boost:${ticket.id}` ? "Approving…" : "Approve 30-Day Boost"}
                      </button>
                      <button
                        style={s.reject}
                        disabled={Boolean(busy)}
                        onClick={() => {
                          const reason = window.prompt("Reason for declining");
                          if (reason?.trim()) postAction({ action: "reject_free_boost", ticketId: ticket.id, reason }, `reject:${ticket.id}`);
                        }}
                      >Decline</button>
                    </div>
                  </div>
                )}

                <div style={s.messages}>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      style={{
                        ...s.msg,
                        marginLeft: message.sender_type === "admin" ? "12%" : 0,
                        marginRight: message.sender_type === "admin" ? 0 : "12%",
                        background: message.sender_type === "admin" ? "#eef5fb" : "#f8fafc",
                      }}
                    >
                      <b>{message.sender_name || message.sender_type}</b>
                      <p style={s.messageText}>{message.message_text}</p>
                      <small>{dt(message.created_at)}</small>
                    </div>
                  ))}
                </div>

                {!isClosed ? (
                  <div style={s.replyBox}>
                    <textarea
                      placeholder="Reply to Host or Guest..."
                      value={reply}
                      disabled={Boolean(busy)}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendReply(ticket);
                        }
                      }}
                    />
                    <button
                      style={{ ...s.btn, ...((!reply.trim() || busy) ? s.btnDisabled : {}) }}
                      disabled={!reply.trim() || Boolean(busy)}
                      onClick={() => sendReply(ticket)}
                    >
                      {busy === `reply:${ticket.id}` ? "Sending…" : "Send Reply"}
                    </button>
                    <small style={s.hint}>Enter sends. Shift + Enter adds a new line. The button locks while sending to prevent duplicate messages.</small>
                  </div>
                ) : (
                  <div style={s.closedActions}>
                    <div>
                      <b>This ticket is closed.</b>
                      <div style={s.closedHelp}>Reopen the ticket before sending any further reply.</div>
                    </div>
                    <button
                      style={s.reopenBtn}
                      disabled={Boolean(busy)}
                      onClick={() => updateTicket(ticket.id, "status", "open")}
                    >
                      {busy === `status:${ticket.id}` ? "Reopening…" : "Reopen Ticket"}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {tab === "faqs" && (
        <>
          <section style={s.panel}>
            <h2 style={s.h2}>Add FAQ</h2>
            <div style={s.form}>
              <input placeholder="Category" value={faq.category} onChange={(e) => setFaq({ ...faq, category: e.target.value })} />
              <input placeholder="Question" value={faq.question} onChange={(e) => setFaq({ ...faq, question: e.target.value })} />
              <textarea placeholder="Approved answer" value={faq.answer} onChange={(e) => setFaq({ ...faq, answer: e.target.value })} />
              <input placeholder="Keywords, comma separated" value={faq.keywords} onChange={(e) => setFaq({ ...faq, keywords: e.target.value })} />
              <button
                style={s.btn}
                disabled={Boolean(busy)}
                onClick={async () => {
                  const ok = await postAction({ action: "create_faq", ...faq }, "create-faq");
                  if (ok) setFaq({ category: "general", question: "", answer: "", keywords: "", sortOrder: 0 });
                }}
              >{busy === "create-faq" ? "Adding…" : "Add FAQ"}</button>
            </div>
          </section>

          <section style={s.panel}>
            {(data?.faqs || []).map((item) => (
              <article key={item.id} style={s.faq}>
                <div>
                  <b>{item.question}</b>
                  <small style={s.faqCategory}>{item.category}</small>
                  <p>{item.answer}</p>
                </div>
                <div style={s.faqActions}>
                  <button disabled={Boolean(busy)} onClick={() => postAction({ action: "toggle_faq", id: item.id, isActive: !item.is_active }, `faq:${item.id}`)}>
                    {item.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button disabled={Boolean(busy)} onClick={() => window.confirm("Delete this FAQ?") && postAction({ action: "delete_faq", id: item.id }, `faq-delete:${item.id}`)}>Delete</button>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}

function Card({ l, v }) {
  return <div style={s.card}><span>{l}</span><strong>{v}</strong></div>;
}

const s = {
  page: { maxWidth: 1500, margin: "auto", padding: 28, background: "#f6f8fb", minHeight: "100vh", fontFamily: "Arial", color: "#17324d" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 },
  headActions: { display: "flex", alignItems: "center", gap: 10 },
  h1: { fontSize: 34, margin: 0, color: "#082f5a" },
  h2: { color: "#082f5a", margin: "0 0 8px" },
  titleRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  statusBadge: { textTransform: "capitalize", fontSize: 12, fontWeight: 800, borderRadius: 999, padding: "6px 10px", border: "1px solid" },
  statusClosed: { color: "#991b1b", background: "#fff1f2", borderColor: "#fecdd3" },
  statusResolved: { color: "#166534", background: "#ecfdf5", borderColor: "#bbf7d0" },
  statusOpen: { color: "#1d4ed8", background: "#eff6ff", borderColor: "#bfdbfe" },
  sub: { color: "#6b7c8e" },
  live: { fontSize: 12, fontWeight: 800, color: "#6b7280", background: "#fff", border: "1px solid #d8e0e8", borderRadius: 999, padding: "8px 10px" },
  liveOn: { color: "#166534", background: "#f0fdf4", borderColor: "#bbf7d0" },
  linkBtn: { background: "#fff", border: "1px solid #cbd5e1", color: "#082f5a", borderRadius: 9, padding: "10px 14px", textDecoration: "none", fontWeight: 700 },
  cards: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, margin: "20px 0" },
  card: { background: "#fff", border: "1px solid #dfe6ee", borderRadius: 14, padding: 17, display: "flex", justifyContent: "space-between" },
  tabs: { display: "flex", gap: 8, marginBottom: 14 },
  tab: { background: "#fff", border: "1px solid #ccd7e2", padding: "10px 14px", borderRadius: 9, fontWeight: 700, color: "#315b85", cursor: "pointer" },
  tabOn: { background: "#082f5a", color: "#fff" },
  layout: { display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 },
  list: { background: "#fff", border: "1px solid #e1e7ee", borderRadius: 14, padding: 8, maxHeight: "72vh", overflow: "auto" },
  filterWrap: { position: "sticky", top: 0, zIndex: 2, background: "#fff", padding: "8px 6px 12px", borderBottom: "1px solid #e5e7eb" },
  filterLabel: { fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 },
  filterSelect: { width: "100%", padding: "10px 11px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", color: "#17324d", fontWeight: 700, cursor: "pointer" },
  filterCount: { display: "block", marginTop: 6, color: "#64748b" },
  noFilterResults: { padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 },
  ticket: { width: "100%", textAlign: "left", border: 0, borderBottom: "1px solid #edf1f4", background: "#fff", padding: 13, cursor: "pointer", display: "grid", gap: 5, color: "#17324d" },
  ticketOn: { background: "#edf5fc" },
  ticketTop: { display: "flex", justifyContent: "space-between" },
  detail: { background: "#fff", border: "1px solid #e1e7ee", borderRadius: 14, padding: 18 },
  detailHead: { display: "flex", justifyContent: "space-between", gap: 12 },
  controls: { display: "flex", gap: 8, alignItems: "flex-end" },
  controlLabel: { display: "grid", gap: 5, fontSize: 11, color: "#64748b", fontWeight: 700 },
  saving: { marginTop: 10, background: "#eff6ff", color: "#1d4ed8", padding: 10, borderRadius: 8, fontWeight: 700 },
  closed: { marginTop: 10, background: "#f1f5f9", color: "#334155", padding: 12, borderRadius: 9 },
  closedTimeRow: { display: "flex", gap: 18, flexWrap: "wrap", marginTop: 7, fontSize: 12, color: "#475569" },
  resolved: { marginTop: 10, background: "#ecfdf5", color: "#166534", padding: 12, borderRadius: 9, fontWeight: 800 },
  meta: { display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "#607487", margin: "12px 0" },
  description: { padding: 14, background: "#f8fafc", borderRadius: 10, lineHeight: 1.5 },
  freeBoost: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: 12, marginTop: 12 },
  approve: { background: "#166534", color: "#fff", border: 0, borderRadius: 8, padding: "9px 11px", fontWeight: 700, marginRight: 7, cursor: "pointer" },
  reject: { background: "#fff", color: "#991b1b", border: "1px solid #f0b5b5", borderRadius: 8, padding: "9px 11px", fontWeight: 700, cursor: "pointer" },
  messages: { display: "grid", gap: 9, margin: "16px 0", maxHeight: "45vh", overflowY: "auto" },
  msg: { padding: 12, borderRadius: 10, maxWidth: "88%" },
  messageText: { whiteSpace: "pre-wrap", lineHeight: 1.45 },
  replyBox: { display: "grid", gap: 8 },
  closedActions: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "#fff7f7", border: "1px solid #fecaca", borderRadius: 10, padding: 14 },
  closedHelp: { marginTop: 4, fontSize: 12, color: "#7f1d1d" },
  reopenBtn: { background: "#082f5a", color: "#fff", border: 0, borderRadius: 9, padding: "10px 14px", fontWeight: 800, cursor: "pointer" },
  btn: { background: "#082f5a", color: "#fff", border: 0, borderRadius: 9, padding: "11px 14px", fontWeight: 800, cursor: "pointer" },
  btnDisabled: { opacity: 0.55, cursor: "not-allowed" },
  hint: { color: "#728397" },
  panel: { background: "#fff", border: "1px solid #e1e7ee", borderRadius: 14, padding: 18, marginBottom: 14 },
  form: { display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 },
  faq: { display: "flex", justifyContent: "space-between", gap: 18, borderBottom: "1px solid #edf1f4", padding: "14px 0" },
  faqCategory: { display: "block", marginTop: 4, color: "#728397" },
  faqActions: { display: "flex", gap: 7 },
  err: { background: "#fff1f2", color: "#991b1b", padding: 12, borderRadius: 10, marginTop: 12 },
  ok: { background: "#ecfdf5", color: "#166534", padding: 12, borderRadius: 10, marginTop: 12 },
  empty: { padding: 35, textAlign: "center", color: "#728397" },
};
