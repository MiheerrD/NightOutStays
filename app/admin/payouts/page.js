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

export default function AdminPayoutsPage() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [hold, setHold] = useState("all");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;

      if (!token) {
        window.location.href = "/admin/login";
        return;
      }

      const response = await fetch("/api/admin/payouts", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const result = await response.json();

      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }

      if (!response.ok) {
        throw new Error(result?.error || "Unable to load payouts.");
      }

      setRows(result.settlements || []);
      setSummary(result.summary || {});
    } catch (e) {
      setError(e?.message || "Unable to load payouts.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const searchable = [
        row.booking_code,
        row.host_name,
        row.host_business_name,
        row.property_name,
        row.razorpay_payment_id,
        row.razorpay_transfer_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!q || searchable.includes(q)) &&
        (status === "all" || row.payout_status === status) &&
        (hold === "all" ||
          (hold === "hold" ? row.is_on_hold : !row.is_on_hold))
      );
    });
  }, [rows, search, status, hold]);

  const cards = [
    ["Total Host Payable", summary.total_host_payable],
    ["On Hold", summary.on_hold],
    ["Eligible", summary.eligible],
    ["Processing", summary.processing],
    ["Settled", summary.settled],
  ];

  return (
    <main style={styles.page}>
      <div style={styles.top}>
        <div>
          <h1 style={styles.h1}>Host Payouts</h1>
          <p style={styles.sub}>
            Financial settlement control for paid NightOutStays bookings.
          </p>
        </div>
        <button style={styles.refresh} onClick={load}>Refresh</button>
      </div>

      <div style={styles.cards}>
        {cards.map(([label, value]) => (
          <div style={styles.card} key={label}>
            <div style={styles.cardLabel}>{label}</div>
            <div style={styles.cardValue}>{money(value)}</div>
          </div>
        ))}
      </div>

      <div style={styles.panel}>
        <div style={styles.filters}>
          <input
            style={styles.input}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search booking, host, property or Razorpay ID"
          />

          <select style={styles.select} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All payout statuses</option>
            <option value="pending_calculation">Pending Calculation</option>
            <option value="calculated">Calculated</option>
            <option value="on_hold">On Hold</option>
            <option value="eligible">Eligible</option>
            <option value="processing">Processing</option>
            <option value="transferred">Transferred</option>
            <option value="settled">Settled</option>
            <option value="failed">Failed</option>
            <option value="reversed">Reversed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select style={styles.select} value={hold} onChange={(e) => setHold(e.target.value)}>
            <option value="all">All hold states</option>
            <option value="hold">On Hold</option>
            <option value="released">Released</option>
          </select>
        </div>

        {error ? <div style={styles.error}>{error}</div> : null}

        {loading ? (
          <div style={styles.empty}>Loading payouts...</div>
        ) : filtered.length === 0 ? (
          <div style={styles.empty}>
            No Host settlements found. New settlements will appear after successful guest payments.
          </div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {[
                    "Booking / Property",
                    "Host",
                    "Guest Paid",
                    "Host Gross",
                    "Gateway Fee",
                    "Fee GST",
                    "Transfer Charges",
                    "Other Deductions",
                    "Total Deductions",
                    "Net Host Payout",
                    "Status",
                    "Hold",
                  ].map((x) => <th style={styles.th} key={x}>{x}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td style={styles.td}>
                      <strong>{row.booking_code || "Booking"}</strong>
                      <div style={styles.small}>{row.property_name || "Property"}</div>
                    </td>
                    <td style={styles.td}>
                      <strong>{row.host_business_name || row.host_name || "Host"}</strong>
                      {row.host_business_name && row.host_name ? (
                        <div style={styles.small}>{row.host_name}</div>
                      ) : null}
                    </td>
                    <td style={styles.td}>{money(row.guest_paid_amount)}</td>
                    <td style={styles.td}>{money(row.host_gross_amount)}</td>
                    <td style={styles.td}>{money(row.guest_payment_gateway_fee)}</td>
                    <td style={styles.td}>{money(row.guest_payment_gateway_fee_gst)}</td>
                    <td style={styles.td}>
                      {money(Number(row.host_transfer_fee || 0) + Number(row.host_transfer_fee_gst || 0))}
                    </td>
                    <td style={styles.td}>
                      {money(Number(row.platform_fee || 0) + Number(row.platform_fee_gst || 0) + Number(row.other_deductions || 0))}
                    </td>
                    <td style={styles.td}>{money(row.total_host_deductions)}</td>
                    <td style={{...styles.td, fontWeight: 800}}>{money(row.net_host_payout)}</td>
                    <td style={styles.td}>
                      <span style={styles.badge}>{pretty(row.payout_status)}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={row.is_on_hold ? styles.holdBadge : styles.releaseBadge}>
                        {row.is_on_hold ? "On Hold" : "Released"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

const styles = {
  page: { padding: "28px", background: "#f6f8fb", minHeight: "100vh", color: "#13213c" },
  top: { display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", marginBottom: 22 },
  h1: { margin: 0, fontSize: 34, fontWeight: 800 },
  sub: { margin: "7px 0 0", color: "#667085", fontSize: 15 },
  refresh: { background: "#10264b", color: "white", border: 0, borderRadius: 9, padding: "11px 18px", fontWeight: 700, cursor: "pointer" },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 20 },
  card: { background: "white", border: "1px solid #e4e8ef", borderRadius: 14, padding: 18 },
  cardLabel: { color: "#667085", fontSize: 13, fontWeight: 700 },
  cardValue: { marginTop: 8, fontSize: 25, fontWeight: 800 },
  panel: { background: "white", border: "1px solid #e4e8ef", borderRadius: 14, overflow: "hidden" },
  filters: { padding: 16, display: "flex", gap: 10, flexWrap: "wrap", borderBottom: "1px solid #edf0f4" },
  input: { flex: "1 1 320px", minWidth: 220, padding: "11px 12px", border: "1px solid #d8dee8", borderRadius: 9, fontSize: 14 },
  select: { padding: "11px 12px", border: "1px solid #d8dee8", borderRadius: 9, background: "white" },
  error: { margin: 16, padding: 13, borderRadius: 9, background: "#fff1f1", color: "#a61b1b" },
  empty: { padding: 42, textAlign: "center", color: "#667085" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 1500 },
  th: { textAlign: "left", padding: "13px 12px", background: "#f8fafc", color: "#475467", fontSize: 12, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" },
  td: { padding: "14px 12px", borderBottom: "1px solid #edf0f4", fontSize: 13, verticalAlign: "top", whiteSpace: "nowrap" },
  small: { marginTop: 4, color: "#667085", fontSize: 12 },
  badge: { display: "inline-block", padding: "5px 9px", borderRadius: 999, background: "#eef2f7", fontWeight: 700, fontSize: 11 },
  holdBadge: { display: "inline-block", padding: "5px 9px", borderRadius: 999, background: "#fff3cd", color: "#7a5200", fontWeight: 800, fontSize: 11 },
  releaseBadge: { display: "inline-block", padding: "5px 9px", borderRadius: 999, background: "#e8f7ee", color: "#166534", fontWeight: 800, fontSize: 11 },
};
