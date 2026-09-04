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

export default function HostHelpPage() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const selectedIdRef = useRef("");

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedId) || null,
    [tickets, selectedId]
  );

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  }

  async function load(preferredTicketId = "") {
    try {
      setLoading(true);
      setError("");

      const accessToken = await token();

      if (!accessToken) {
        window.location.href = "/login?redirect=/host/help";
        return;
      }

      const response = await fetch("/api/support?requesterType=host", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Unable to load support.");
      }

      const nextTickets = json.tickets || [];
      setTickets(nextTickets);
      setFaqs(json.faqs || []);

      const nextSelected =
        preferredTicketId ||
        (selectedIdRef.current && nextTickets.some((ticket) => ticket.id === selectedIdRef.current)
          ? selectedIdRef.current
          : nextTickets[0]?.id || "");

      setSelectedId(nextSelected);
      selectedIdRef.current = nextSelected;
    } catch (err) {
      setError(err?.message || "Unable to load support.");
    } finally {
      setLoading(false);
    }
  }

  async function submitTicket() {
    if (submitting) return;

    if (!subject.trim()) {
      setError("Please enter a subject.");
      return;
    }

    if (!description.trim()) {
      setError("Please describe your issue.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const accessToken = await token();

      if (!accessToken) {
        window.location.href = "/login?redirect=/host/help";
        return;
      }

      const response = await fetch("/api/support", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: "create_ticket",
          requesterType: "host",
          subject,
          category,
          description,
          priority,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Unable to create support request.");
      }

      setSubject("");
      setDescription("");
      setCategory("general");
      setPriority("normal");
      setSuccess(json.message || "Support request created.");

      await load(json.ticket?.id || "");
    } catch (err) {
      setError(err?.message || "Unable to create support request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendReply() {
    if (!selectedTicket || !reply.trim() || submitting) return;

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const accessToken = await token();

      if (!accessToken) {
        window.location.href = "/login?redirect=/host/help";
        return;
      }

      const response = await fetch("/api/support", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: "reply",
          requesterType: "host",
          ticketId: selectedTicket.id,
          message: reply,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Unable to send reply.");
      }

      setReply("");
      setSuccess(json.message || "Reply sent.");
      await load(selectedTicket.id);
    } catch (err) {
      setError(err?.message || "Unable to send reply.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    load();

    let refreshTimer = null;
    const refresh = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => load(selectedIdRef.current), 180);
    };

    const channel = supabase
      .channel("host-support-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_ticket_messages" }, refresh)
      .subscribe();

    const fallback = window.setInterval(() => load(selectedIdRef.current), 4000);
    const onFocus = () => load(selectedIdRef.current);
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(fallback);
      if (refreshTimer) window.clearTimeout(refreshTimer);
      window.removeEventListener("focus", onFocus);
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <main style={s.page}>
      <div style={s.heading}>
        <div>
          <h1 style={s.h1}>Host Support</h1>
          <p style={s.sub}>Create a request, track progress and reply directly to NightOutStays Support.</p>
        </div>
        <button style={s.refresh} onClick={() => load(selectedId)}>Refresh</button>
      </div>

      {error && <div style={s.error}>{error}</div>}
      {success && <div style={s.success}>{success}</div>}

      <section style={s.panel}>
        <h2 style={s.h2}>Create Support Request</h2>
        <div style={s.formGrid}>
          <input style={s.input} placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <select style={s.input} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="general">General</option>
            <option value="booking">Booking</option>
            <option value="payment">Payment</option>
            <option value="property">Property</option>
            <option value="promotion">Promotion</option>
            <option value="payout">Payout</option>
            <option value="technical">Technical</option>
          </select>
          <select style={s.input} value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="normal">Normal</option>
            <option value="important">Important</option>
            <option value="urgent">Urgent</option>
          </select>
          <textarea style={s.textarea} placeholder="Describe your issue..." value={description} onChange={(e) => setDescription(e.target.value)} />
          <button style={s.primary} disabled={submitting} onClick={submitTicket}>
            {submitting ? "Please wait..." : "Submit Request"}
          </button>
        </div>
      </section>

      <div style={s.supportGrid}>
        <section style={s.ticketListPanel}>
          <h2 style={s.h2}>My Requests</h2>
          {loading ? (
            <div style={s.empty}>Loading...</div>
          ) : tickets.length === 0 ? (
            <div style={s.empty}>No support requests found.</div>
          ) : (
            <div style={s.ticketList}>
              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedId(ticket.id)}
                  style={{ ...s.ticketButton, ...(selectedId === ticket.id ? s.ticketButtonActive : {}) }}
                >
                  <div style={s.ticketTop}>
                    <strong>{ticket.ticket_code}</strong>
                    <span>{String(ticket.status || "").replaceAll("_", " ")}</span>
                  </div>
                  <div style={s.ticketSubject}>{ticket.subject}</div>
                  <small>{ticket.category} · {ticket.priority} · {dt(ticket.last_message_at)}</small>
                </button>
              ))}
            </div>
          )}
        </section>

        <section style={s.conversationPanel}>
          {!selectedTicket ? (
            <div style={s.empty}>Select a support request.</div>
          ) : (
            <>
              <div style={s.conversationHead}>
                <div>
                  <h2 style={s.h2}>{selectedTicket.subject}</h2>
                  <div style={s.meta}>{selectedTicket.ticket_code} · {selectedTicket.category} · {selectedTicket.priority} · {String(selectedTicket.status || "").replaceAll("_", " ")}</div>
                </div>
              </div>

              <div style={s.messageList}>
                {(selectedTicket.messages || []).map((message) => {
                  const mine = message.sender_type === "host";
                  return (
                    <div key={message.id} style={{ ...s.message, ...(mine ? s.mine : s.adminMessage) }}>
                      <strong>{mine ? "You" : message.sender_name || "NightOutStays Support"}</strong>
                      <p style={s.messageText}>{message.message_text}</p>
                      <small>{dt(message.created_at)}</small>
                    </div>
                  );
                })}
              </div>

              {selectedTicket.status !== "closed" && (
                <div style={s.replyBox}>
                  <textarea style={s.replyArea} placeholder="Reply to support..." value={reply} onChange={(e) => setReply(e.target.value)} />
                  <button style={s.primary} disabled={submitting || !reply.trim()} onClick={sendReply}>Send Reply</button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <section style={s.panel}>
        <h2 style={s.h2}>Frequently Asked Questions</h2>
        {faqs.length === 0 ? (
          <div style={s.empty}>No FAQs available.</div>
        ) : (
          <div style={s.faqGrid}>
            {faqs.map((faq) => (
              <article key={faq.id} style={s.faq}>
                <strong>{faq.question}</strong>
                <p style={s.faqAnswer}>{faq.answer}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

const s = {
  page: { maxWidth: 1320, margin: "0 auto", padding: "30px 32px 60px", background: "#f6f8fb", minHeight: "100vh", color: "#303a44", fontFamily: "Arial, sans-serif" },
  heading: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 },
  h1: { margin: 0, color: "#303a44", fontSize: 34 },
  h2: { margin: "0 0 12px", color: "#303a44", fontSize: 20 },
  sub: { color: "#66788a", marginBottom: 0 },
  refresh: { border: "1px solid #cbd5e1", background: "#fff", color: "#303a44", borderRadius: 9, padding: "10px 14px", fontWeight: 800, cursor: "pointer" },
  panel: { background: "#fff", border: "1px solid #e0e7ef", borderRadius: 14, padding: 20, marginTop: 18 },
  formGrid: { display: "grid", gap: 10 },
  input: { width: "100%", padding: 12, border: "1px solid #ccd6e1", borderRadius: 9, background: "#fff" },
  textarea: { width: "100%", minHeight: 120, padding: 12, border: "1px solid #ccd6e1", borderRadius: 9, resize: "vertical" },
  primary: { border: 0, borderRadius: 9, background: "#303a44", color: "#fff", padding: "11px 15px", fontWeight: 800, cursor: "pointer" },
  supportGrid: { display: "grid", gridTemplateColumns: "360px minmax(0,1fr)", gap: 16, marginTop: 18 },
  ticketListPanel: { background: "#fff", border: "1px solid #e0e7ef", borderRadius: 14, padding: 14, minHeight: 420 },
  conversationPanel: { background: "#fff", border: "1px solid #e0e7ef", borderRadius: 14, padding: 18, minHeight: 420 },
  ticketList: { display: "grid", gap: 8 },
  ticketButton: { width: "100%", textAlign: "left", background: "#fff", border: "1px solid #e6ebf1", borderRadius: 10, padding: 12, cursor: "pointer", color: "#303a44" },
  ticketButtonActive: { background: "#edf5fc", borderColor: "#a9c7e5" },
  ticketTop: { display: "flex", justifyContent: "space-between", gap: 10, textTransform: "capitalize", fontSize: 12 },
  ticketSubject: { fontWeight: 800, margin: "7px 0 5px" },
  conversationHead: { borderBottom: "1px solid #edf1f4", paddingBottom: 12 },
  meta: { color: "#6b7c8e", fontSize: 12, textTransform: "capitalize" },
  messageList: { display: "grid", gap: 10, padding: "16px 0" },
  message: { maxWidth: "88%", borderRadius: 11, padding: 12 },
  mine: { marginLeft: "12%", background: "#eef5fb" },
  adminMessage: { marginRight: "12%", background: "#f7f8fa" },
  messageText: { whiteSpace: "pre-wrap", lineHeight: 1.5, margin: "7px 0" },
  replyBox: { display: "grid", gap: 8, borderTop: "1px solid #edf1f4", paddingTop: 14 },
  replyArea: { minHeight: 90, padding: 12, border: "1px solid #ccd6e1", borderRadius: 9, resize: "vertical" },
  faqGrid: { display: "grid", gap: 10 },
  faq: { borderBottom: "1px solid #edf1f4", paddingBottom: 10 },
  faqAnswer: { marginBottom: 0, lineHeight: 1.5 },
  empty: { padding: 28, textAlign: "center", color: "#728397" },
  error: { marginTop: 14, padding: 12, borderRadius: 10, background: "#fff1f2", color: "#991b1b" },
  success: { marginTop: 14, padding: 12, borderRadius: 10, background: "#ecfdf5", color: "#166534" },
};
