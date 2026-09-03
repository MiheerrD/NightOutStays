"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://gxwemplbykjxhezefykh.supabase.co",
  "sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS"
);

const dt = (v) =>
  v
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(v))
    : "—";

export default function AdminSupport() {
  const [data, setData] = useState(null),
    [tab, setTab] = useState("tickets"),
    [selected, setSelected] = useState(""),
    [messages, setMessages] = useState([]),
    [reply, setReply] = useState(""),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");

  const [faq, setFaq] = useState({
    category: "general",
    question: "",
    answer: "",
    keywords: "",
    sortOrder: 0,
  });

  async function token() {
    const { data } = await sb.auth.getSession();
    return data?.session?.access_token;
  }

  async function load(ticket = selected) {
    try {
      const t = await token();

      if (!t) {
        location.href = "/admin/login";
        return;
      }

      const r = await fetch(
        `/api/admin/support${ticket ? `?ticket=${ticket}` : ""}`,
        {
          headers: {
            Authorization: `Bearer ${t}`,
          },
          cache: "no-store",
        }
      );

      const j = await r.json();

      if (!r.ok) throw new Error(j.error);

      setData(j);
      setMessages(j.messages || []);
    } catch (e) {
      setError(e.message);
    }
  }

  async function act(payload) {
    setError("");
    setSuccess("");

    const t = await token();

    const r = await fetch("/api/admin/support", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`,
      },
      body: JSON.stringify(payload),
    });

    const j = await r.json();

    if (!r.ok) {
      setError(j.error);
      return false;
    }

    setSuccess(j.message || "Saved.");
    await load();
    return true;
  }

  useEffect(() => {
    const q = new URLSearchParams(location.search).get("ticket") || "";
    setSelected(q);
    load(q);
  }, []);

  const ticket = useMemo(
    () => data?.tickets?.find((x) => x.id === selected) || null,
    [data, selected]
  );

  async function choose(id) {
    setSelected(id);
    history.replaceState(null, "", `/admin/support?ticket=${id}`);
    await load(id);
  }

  return (
    <main style={s.page}>
      <div style={s.head}>
        <div>
          <h1 style={s.h1}>Support Center</h1>
          <p style={s.sub}>
            Complaints, Help requests, escalations and FAQ management.
          </p>
        </div>

        <a href="/admin/notifications" style={s.linkBtn}>
          Notifications
        </a>
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
        <button
          style={{
            ...s.tab,
            ...(tab === "tickets" ? s.tabOn : {}),
          }}
          onClick={() => setTab("tickets")}
        >
          Support Tickets
        </button>

        <button
          style={{
            ...s.tab,
            ...(tab === "faqs" ? s.tabOn : {}),
          }}
          onClick={() => setTab("faqs")}
        >
          FAQs
        </button>
      </div>

      {tab === "tickets" && (
        <div style={s.layout}>
          <section style={s.list}>
            {(data?.tickets || []).map((t) => (
              <button
                onClick={() => choose(t.id)}
                key={t.id}
                style={{
                  ...s.ticket,
                  ...(selected === t.id ? s.ticketOn : {}),
                }}
              >
                <div style={s.ticketTop}>
                  <b>{t.ticket_code}</b>
                  <span>{t.priority}</span>
                </div>

                <strong>{t.subject}</strong>

                <small>
                  {t.requester_name || t.requester_type} · {t.status} ·{" "}
                  {dt(t.last_message_at)}
                </small>
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
                    <h2 style={s.h2}>{ticket.subject}</h2>
                    <p>
                      {ticket.ticket_code} · {ticket.requester_type} ·{" "}
                      {ticket.requester_name || "User"}
                    </p>
                  </div>

                  <div style={s.controls}>
                    <select
                      value={ticket.priority}
                      onChange={(e) =>
                        act({
                          action: "update_ticket",
                          ticketId: ticket.id,
                          priority: e.target.value,
                        })
                      }
                    >
                      {["normal", "important", "urgent"].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>

                    <select
                      value={ticket.status}
                      onChange={(e) =>
                        act({
                          action: "update_ticket",
                          ticketId: ticket.id,
                          status: e.target.value,
                        })
                      }
                    >
                      {[
                        "open",
                        "in_progress",
                        "waiting",
                        "resolved",
                        "closed",
                      ].map((x) => (
                        <option key={x} value={x}>
                          {x.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={s.meta}>
                  <span>
                    Category: <b>{ticket.category}</b>
                  </span>

                  <span>
                    Created: <b>{dt(ticket.created_at)}</b>
                  </span>

                  {ticket.requester_email && (
                    <span>
                      Email: <b>{ticket.requester_email}</b>
                    </span>
                  )}
                </div>

                <div style={s.description}>{ticket.description}</div>

                {ticket.category === "promotion" &&
                  ticket.subject?.startsWith("Free Boost Request") &&
                  !["resolved", "closed"].includes(ticket.status) && (
                    <div style={s.freeBoost}>
                      <b>Free Boost Request</b>

                      <div>
                        <button
                          style={s.approve}
                          onClick={() =>
                            act({
                              action: "approve_free_boost",
                              ticketId: ticket.id,
                            })
                          }
                        >
                          Approve 30-Day Boost
                        </button>

                        <button
                          style={s.reject}
                          onClick={() => {
                            const reason = prompt("Reason for declining");

                            if (reason)
                              act({
                                action: "reject_free_boost",
                                ticketId: ticket.id,
                                reason,
                              });
                          }}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  )}

                <div style={s.messages}>
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        ...s.msg,
                        marginLeft: m.sender_type === "admin" ? "12%" : 0,
                        background:
                          m.sender_type === "admin" ? "#eef5fb" : "#f8fafc",
                      }}
                    >
                      <b>{m.sender_name || m.sender_type}</b>
                      <p>{m.message_text}</p>
                      <small>{dt(m.created_at)}</small>
                    </div>
                  ))}
                </div>
                <div style={s.reply}>
                  <textarea
                    placeholder="Reply to Host or Guest..."
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />

                  <button
                    style={s.btn}
                    onClick={async () => {
                      if (
                        await act({
                          action: "reply",
                          ticketId: ticket.id,
                          message: reply,
                        })
                      )
                        setReply("");
                    }}
                  >
                    Send Reply
                  </button>
                </div>
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
              <input
                placeholder="Category"
                value={faq.category}
                onChange={(e) =>
                  setFaq({
                    ...faq,
                    category: e.target.value,
                  })
                }
              />

              <input
                placeholder="Question"
                value={faq.question}
                onChange={(e) =>
                  setFaq({
                    ...faq,
                    question: e.target.value,
                  })
                }
              />

              <textarea
                placeholder="Approved answer"
                value={faq.answer}
                onChange={(e) =>
                  setFaq({
                    ...faq,
                    answer: e.target.value,
                  })
                }
              />

              <input
                placeholder="Keywords, comma separated"
                value={faq.keywords}
                onChange={(e) =>
                  setFaq({
                    ...faq,
                    keywords: e.target.value,
                  })
                }
              />

              <button
                style={s.btn}
                onClick={async () => {
                  if (
                    await act({
                      action: "create_faq",
                      ...faq,
                    })
                  )
                    setFaq({
                      category: "general",
                      question: "",
                      answer: "",
                      keywords: "",
                      sortOrder: 0,
                    });
                }}
              >
                Add FAQ
              </button>
            </div>
          </section>

          <section style={s.panel}>
            {(data?.faqs || []).map((f) => (
              <article key={f.id} style={s.faq}>
                <div>
                  <b>{f.question}</b>
                  <small>{f.category}</small>
                  <p>{f.answer}</p>
                </div>

                <div style={s.faqActions}>
                  <button
                    onClick={() =>
                      act({
                        action: "toggle_faq",
                        id: f.id,
                        isActive: !f.is_active,
                      })
                    }
                  >
                    {f.is_active ? "Deactivate" : "Activate"}
                  </button>

                  <button
                    onClick={() =>
                      confirm("Delete this FAQ?") &&
                      act({
                        action: "delete_faq",
                        id: f.id,
                      })
                    }
                  >
                    Delete
                  </button>
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
  return (
    <div style={s.card}>
      <span>{l}</span>
      <strong>{v}</strong>
    </div>
  );
}

const s = {
  page: {
    maxWidth: 1500,
    margin: "auto",
    padding: 28,
    background: "#f6f8fb",
    minHeight: "100vh",
    fontFamily: "Arial",
    color: "#17324d",
  },

  head: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  h1: {
    fontSize: 34,
    margin: 0,
    color: "#082f5a",
  },

  h2: {
    color: "#082f5a",
    margin: "0 0 8px",
  },

  sub: {
    color: "#6b7c8e",
  },

  linkBtn: {
    background: "#fff",
    border: "1px solid #cbd5e1",
    color: "#082f5a",
    borderRadius: 9,
    padding: "10px 14px",
    textDecoration: "none",
    fontWeight: 700,
  },

  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    gap: 12,
    margin: "20px 0",
  },

  card: {
    background: "#fff",
    border: "1px solid #dfe6ee",
    borderRadius: 14,
    padding: 17,
  },

  tabs: {
    display: "flex",
    gap: 8,
    marginBottom: 14,
  },

  tab: {
    background: "#fff",
    border: "1px solid #ccd7e2",
    padding: "10px 14px",
    borderRadius: 9,
    fontWeight: 700,
    color: "#315b85",
  },

  tabOn: {
    background: "#082f5a",
    color: "#fff",
  },

  layout: {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: 16,
  },

  list: {
    background: "#fff",
    border: "1px solid #e1e7ee",
    borderRadius: 14,
    padding: 8,
    maxHeight: "72vh",
    overflow: "auto",
  },

  ticket: {
    width: "100%",
    textAlign: "left",
    border: 0,
    borderBottom: "1px solid #edf1f4",
    background: "#fff",
    padding: 13,
    cursor: "pointer",
    display: "grid",
    gap: 5,
  },

  ticketOn: {
    background: "#edf5fc",
  },

  ticketTop: {
    display: "flex",
    justifyContent: "space-between",
  },

  detail: {
    background: "#fff",
    border: "1px solid #e1e7ee",
    borderRadius: 14,
    padding: 18,
  },

  detailHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
  },

  controls: {
    display: "flex",
    gap: 8,
  },

  meta: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
    fontSize: 12,
    color: "#607487",
    margin: "12px 0",
  },

  description: {
    padding: 14,
    background: "#f8fafc",
    borderRadius: 10,
    lineHeight: 1.5,
  },

  freeBoost: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },

  approve: {
    background: "#166534",
    color: "#fff",
    border: 0,
    borderRadius: 8,
    padding: "9px 11px",
    fontWeight: 700,
    marginRight: 7,
  },

  reject: {
    background: "#fff",
    color: "#991b1b",
    border: "1px solid #f0b5b5",
    borderRadius: 8,
    padding: "9px 11px",
    fontWeight: 700,
  },

  messages: {
    display: "grid",
    gap: 9,
    margin: "16px 0",
  },

  msg: {
    padding: 12,
    borderRadius: 10,
    maxWidth: "88%",
  },

  reply: {
    display: "grid",
    gap: 8,
  },

  btn: {
    background: "#082f5a",
    color: "#fff",
    border: 0,
    borderRadius: 9,
    padding: "11px 14px",
    fontWeight: 800,
  },

  panel: {
    background: "#fff",
    border: "1px solid #e1e7ee",
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
  },

  form: {
    display: "grid",
    gridTemplateColumns: "1fr 2fr",
    gap: 10,
  },

  faq: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    borderBottom: "1px solid #edf1f4",
    padding: "14px 0",
  },

  faqActions: {
    display: "flex",
    gap: 7,
  },

  err: {
    background: "#fff1f2",
    color: "#991b1b",
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },

  ok: {
    background: "#ecfdf5",
    color: "#166534",
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },

  empty: {
    padding: 35,
    textAlign: "center",
    color: "#728397",
  },
};