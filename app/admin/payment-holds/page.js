"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gxwemplbykjxhezefykh.supabase.co";
const SUPABASE_KEY = "sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const pretty = (value) =>
  String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());

const dateText = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

export default function AdminPaymentHoldsPage() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState("");
  const [reason, setReason] = useState({});
  const [historyOpen, setHistoryOpen] = useState({});

  useEffect(() => {
    load();
  }, []);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  }

  async function load() {
    setLoading(true);
    setError("");

    try {
      const token = await getToken();

      if (!token) {
        window.location.href = "/admin/login";
        return;
      }

      const response = await fetch("/api/admin/payment-holds", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const result = await response.json();

      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }

      if (!response.ok) {
        throw new Error(result?.error || "Unable to load payment holds.");
      }

      setRows(result.settlements || []);
      setSummary(result.summary || {});
    } catch (e) {
      setError(e?.message || "Unable to load payment holds.");
    } finally {
      setLoading(false);
    }
  }

  async function act(settlementId, action) {
    try {
      setBusyId(settlementId);
      setError("");

      const token = await getToken();

      if (!token) {
        window.location.href = "/admin/login";
        return;
      }

      const holdReason = String(reason[settlementId] || "").trim();

      if (action === "hold" && !holdReason) {
        throw new Error("Please enter a hold reason.");
      }

      const response = await fetch("/api/admin/payment-holds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          settlementId,
          action,
          reason: holdReason || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Unable to update payment hold.");
      }

      setReason((old) => ({ ...old, [settlementId]: "" }));
      await load();
    } catch (e) {
      setError(e?.message || "Unable to update payment hold.");
    } finally {
      setBusyId("");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const searchable = [
        row.booking_code,
        row.property_name,
        row.host_name,
        row.host_business_name,
        row.hold_reason,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const filterOk =
        filter === "all" ||
        (filter === "on_hold" && row.is_on_hold) ||
        (filter === "released" && !row.is_on_hold) ||
        (filter === "eligible" && row.payout_status === "eligible");

      return (!q || searchable.includes(q)) && filterOk;
    });
  }, [rows, search, filter]);

  return (
    <main style={styles.page}>
      <div style={styles.top}>
        <div>
          <h1 style={styles.h1}>Payment Holds</h1>
          <p style={styles.sub}>
            Review, hold and release Host settlements before payout processing.
          </p>
        </div>
        <button style={styles.refresh} onClick={load}>
          Refresh
        </button>
      </div>

      <div style={styles.cards}>
        <SummaryCard label="Settlements" value={summary.total_settlements || 0} />
        <SummaryCard label="On Hold" value={summary.on_hold_count || 0} />
        <SummaryCard label="Eligible" value={summary.eligible_count || 0} />
        <SummaryCard label="On Hold Value" value={money(summary.on_hold_value)} />
        <SummaryCard label="Eligible Value" value={money(summary.eligible_value)} />
      </div>

      <section style={styles.panel}>
        <div style={styles.filters}>
          <input
            style={styles.input}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search booking, host, property or hold reason"
          />

          <select
            style={styles.select}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All settlements</option>
            <option value="on_hold">On Hold</option>
            <option value="released">Released</option>
            <option value="eligible">Eligible</option>
          </select>
        </div>

        {error ? <div style={styles.error}>{error}</div> : null}

        {loading ? (
          <div style={styles.empty}>Loading payment holds...</div>
        ) : filtered.length === 0 ? (
          <div style={styles.empty}>
            No settlement hold records found yet.
          </div>
        ) : (
          <div style={styles.list}>
            {filtered.map((row) => {
              const disabled =
                busyId === row.id ||
                ["settled", "reversed", "cancelled"].includes(row.payout_status);

              return (
                <article key={row.id} style={styles.item}>
                  <div style={styles.itemTop}>
                    <div>
                      <div style={styles.booking}>
                        {row.booking_code || "Booking"}
                      </div>
                      <div style={styles.meta}>
                        {row.property_name || "Property"} ·{" "}
                        {row.host_business_name || row.host_name || "Host"}
                      </div>
                    </div>

                    <div style={styles.badges}>
                      <span style={styles.statusBadge}>
                        {pretty(row.payout_status)}
                      </span>
                      <span
                        style={
                          row.is_on_hold
                            ? styles.holdBadge
                            : styles.releaseBadge
                        }
                      >
                        {row.is_on_hold ? "On Hold" : "Released"}
                      </span>
                    </div>
                  </div>

                  <div style={styles.moneyGrid}>
                    <MoneyBox label="Host Gross" value={row.host_gross_amount} />
                    <MoneyBox
                      label="Total Deductions"
                      value={row.total_host_deductions}
                    />
                    <MoneyBox
                      label="Net Host Payout"
                      value={row.net_host_payout}
                    />
                  </div>

                  <div style={styles.details}>
                    <div>
                      <span style={styles.detailLabel}>Current Hold Reason</span>
                      <strong>{row.hold_reason || "—"}</strong>
                    </div>
                    <div>
                      <span style={styles.detailLabel}>Eligible At</span>
                      <strong>{dateText(row.eligible_at)}</strong>
                    </div>
                    <div>
                      <span style={styles.detailLabel}>Created</span>
                      <strong>{dateText(row.created_at)}</strong>
                    </div>
                  </div>

                  <div style={styles.actions}>
                    {row.is_on_hold ? (
                      <button
                        style={styles.releaseButton}
                        disabled={disabled}
                        onClick={() => act(row.id, "release")}
                      >
                        {busyId === row.id ? "Please wait..." : "Release Hold"}
                      </button>
                    ) : (
                      <>
                        <input
                          style={styles.reasonInput}
                          value={reason[row.id] || ""}
                          onChange={(e) =>
                            setReason((old) => ({
                              ...old,
                              [row.id]: e.target.value,
                            }))
                          }
                          placeholder="Reason for placing payout on hold"
                        />
                        <button
                          style={styles.holdButton}
                          disabled={disabled}
                          onClick={() => act(row.id, "hold")}
                        >
                          {busyId === row.id ? "Please wait..." : "Place On Hold"}
                        </button>
                      </>
                    )}

                    <button
                      style={styles.historyButton}
                      onClick={() =>
                        setHistoryOpen((old) => ({
                          ...old,
                          [row.id]: !old[row.id],
                        }))
                      }
                    >
                      {historyOpen[row.id] ? "Hide History" : "View History"}
                    </button>
                  </div>

                  {historyOpen[row.id] ? (
                    <div style={styles.history}>
                      <div style={styles.historyTitle}>Hold / Release History</div>

                      {row.history?.length ? (
                        row.history.map((h) => (
                          <div key={h.id} style={styles.historyRow}>
                            <div>
                              <strong>{pretty(h.action)}</strong>
                              <span style={styles.historyDate}>
                                {dateText(h.created_at)}
                              </span>
                            </div>
                            <div style={styles.historyReason}>
                              {h.reason || "No reason recorded"}
                            </div>
                            <div style={styles.historyAdmin}>
                              {h.admin_name || h.admin_email || "Admin"}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={styles.noHistory}>No history recorded yet.</div>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardLabel}>{label}</div>
      <div style={styles.cardValue}>{value}</div>
    </div>
  );
}

function MoneyBox({ label, value }) {
  return (
    <div style={styles.moneyBox}>
      <span>{label}</span>
      <strong>{money(value)}</strong>
    </div>
  );
}

const styles = {
  page: {
    padding: "28px",
    background: "#f6f8fb",
    minHeight: "100vh",
    color: "#13213c",
  },
  top: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    alignItems: "center",
    marginBottom: 22,
  },
  h1: { margin: 0, fontSize: 34, fontWeight: 800 },
  sub: { margin: "7px 0 0", color: "#667085", fontSize: 15 },
  refresh: {
    background: "#10264b",
    color: "white",
    border: 0,
    borderRadius: 9,
    padding: "11px 18px",
    fontWeight: 700,
    cursor: "pointer",
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: 14,
    marginBottom: 20,
  },
  card: {
    background: "white",
    border: "1px solid #e4e8ef",
    borderRadius: 14,
    padding: 18,
  },
  cardLabel: { color: "#667085", fontSize: 13, fontWeight: 700 },
  cardValue: { marginTop: 8, fontSize: 25, fontWeight: 800 },
  panel: {
    background: "white",
    border: "1px solid #e4e8ef",
    borderRadius: 14,
    overflow: "hidden",
  },
  filters: {
    padding: 16,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    borderBottom: "1px solid #edf0f4",
  },
  input: {
    flex: "1 1 320px",
    minWidth: 220,
    padding: "11px 12px",
    border: "1px solid #d8dee8",
    borderRadius: 9,
    fontSize: 14,
  },
  select: {
    padding: "11px 12px",
    border: "1px solid #d8dee8",
    borderRadius: 9,
    background: "white",
  },
  error: {
    margin: 16,
    padding: 13,
    borderRadius: 9,
    background: "#fff1f1",
    color: "#a61b1b",
  },
  empty: { padding: 42, textAlign: "center", color: "#667085" },
  list: { padding: 16, display: "grid", gap: 14 },
  item: {
    border: "1px solid #e1e7ef",
    borderRadius: 14,
    padding: 18,
    background: "#fff",
  },
  itemTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 15,
    alignItems: "flex-start",
  },
  booking: { fontSize: 18, fontWeight: 800 },
  meta: { marginTop: 5, fontSize: 13, color: "#667085" },
  badges: { display: "flex", gap: 8, flexWrap: "wrap" },
  statusBadge: {
    padding: "6px 9px",
    borderRadius: 999,
    background: "#eef2f7",
    fontWeight: 800,
    fontSize: 11,
  },
  holdBadge: {
    padding: "6px 9px",
    borderRadius: 999,
    background: "#fff3cd",
    color: "#7a5200",
    fontWeight: 800,
    fontSize: 11,
  },
  releaseBadge: {
    padding: "6px 9px",
    borderRadius: 999,
    background: "#e8f7ee",
    color: "#166534",
    fontWeight: 800,
    fontSize: 11,
  },
  moneyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: 10,
    marginTop: 16,
  },
  moneyBox: {
    background: "#f8fafc",
    borderRadius: 10,
    padding: 13,
  },
  details: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
    gap: 12,
    marginTop: 15,
  },
  detailLabel: {
    display: "block",
    color: "#667085",
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 5,
  },
  actions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 16,
  },
  reasonInput: {
    flex: "1 1 320px",
    minWidth: 240,
    padding: "11px 12px",
    border: "1px solid #d8dee8",
    borderRadius: 9,
  },
  holdButton: {
    border: 0,
    borderRadius: 9,
    padding: "11px 15px",
    background: "#9b1c1c",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  },
  releaseButton: {
    border: 0,
    borderRadius: 9,
    padding: "11px 15px",
    background: "#166534",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  },
  historyButton: {
    border: "1px solid #cfd8e3",
    borderRadius: 9,
    padding: "10px 14px",
    background: "white",
    color: "#13213c",
    fontWeight: 700,
    cursor: "pointer",
  },
  history: {
    marginTop: 16,
    borderTop: "1px solid #edf0f4",
    paddingTop: 14,
  },
  historyTitle: { fontWeight: 800, marginBottom: 10 },
  historyRow: {
    display: "grid",
    gridTemplateColumns: "180px 1fr 180px",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid #f0f2f5",
    fontSize: 13,
  },
  historyDate: {
    display: "block",
    color: "#667085",
    fontSize: 11,
    marginTop: 3,
  },
  historyReason: { color: "#344054" },
  historyAdmin: { color: "#667085" },
  noHistory: { color: "#667085", fontSize: 13 },
};
