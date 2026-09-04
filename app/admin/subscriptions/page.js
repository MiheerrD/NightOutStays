"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://gxwemplbykjxhezefykh.supabase.co",
  "sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS"
);

const money = (v) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(v || 0));

const dt = (v) =>
  v
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(v))
    : "—";

const label = (v) =>
  String(v || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());

export default function AdminSubscriptionsPage() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("subscriptions");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const [rule, setRule] = useState({
    ruleName: "",
    scopeType: "global",
    city: "",
    propertyType: "",
    hostId: "",
    minNightlyRate: 0,
    maxNightlyRate: "",
    monthlyFee: "",
    priority: 0,
    validFrom: "",
    validUntil: "",
    notes: "",
  });

  const [discount, setDiscount] = useState({
    hostId: "",
    propertyId: "",
    discountName: "",
    discountType: "percentage",
    discountValue: "",
    maxDiscountAmount: "",
    validFrom: "",
    validUntil: "",
    maxUses: "",
    reason: "",
  });

  useEffect(() => {
    load();
  }, []);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const t = await token();
      if (!t) {
        window.location.href = "/admin/login";
        return;
      }
      const res = await fetch("/api/admin/subscriptions", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${t}` },
      });
      const json = await res.json();
      if (res.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      if (!res.ok) throw new Error(json.error || "Unable to load subscriptions.");
      setData(json);
    } catch (e) {
      setError(e.message || "Unable to load subscriptions.");
    } finally {
      setLoading(false);
    }
  }

  async function action(payload) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const t = await token();
      const res = await fetch("/api/admin/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to save.");
      setSuccess(json.message || "Saved successfully.");
      await load();
      return true;
    } catch (e) {
      setError(e.message || "Unable to save.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function createRule(e) {
    e.preventDefault();
    const ok = await action({ action: "create_rule", ...rule });
    if (ok) {
      setRule({
        ruleName: "",
        scopeType: "global",
        city: "",
        propertyType: "",
        hostId: "",
        minNightlyRate: 0,
        maxNightlyRate: "",
        monthlyFee: "",
        priority: 0,
        validFrom: "",
        validUntil: "",
        notes: "",
      });
    }
  }

  async function createDiscount(e) {
    e.preventDefault();
    const ok = await action({ action: "create_discount", ...discount });
    if (ok) {
      setDiscount({
        hostId: "",
        propertyId: "",
        discountName: "",
        discountType: "percentage",
        discountValue: "",
        maxDiscountAmount: "",
        validFrom: "",
        validUntil: "",
        maxUses: "",
        reason: "",
      });
    }
  }

  const subscriptions = useMemo(() => {
    const rows = data?.subscriptions || [];
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      const text = `${r.property_name || ""} ${r.host_name || ""} ${r.host_business_name || ""} ${r.razorpay_payment_id || ""}`.toLowerCase();
      return (!q || text.includes(q)) && (status === "all" || r.status === status);
    });
  }, [data, search, status]);

  if (loading) {
    return <main style={styles.page}><div style={styles.panel}>Loading subscriptions...</div></main>;
  }

  const s = data?.summary || {};

  return (
    <main style={styles.page}>
      <div style={styles.head}>
        <div>
          <h1 style={styles.h1}>Subscriptions</h1>
          <p style={styles.sub}>
            Manage subscriptions, monthly pricing rules and Host-specific discounts.
          </p>
        </div>
        <button style={styles.primary} onClick={load}>Refresh</button>
      </div>

      <div style={styles.cards}>
        <Card label="Active Subscriptions" value={s.active || 0} />
        <Card label="Expiring in 30 Days" value={s.expiring || 0} />
        <Card label="Expired" value={s.expired || 0} />
        <Card label="Subscription Revenue" value={money(s.revenue)} />
        <Card label="Active Pricing Rules" value={s.active_rules || 0} />
      </div>

      <div style={styles.tabs}>
        <Tab active={tab === "subscriptions"} onClick={() => setTab("subscriptions")}>Subscriptions</Tab>
        <Tab active={tab === "pricing"} onClick={() => setTab("pricing")}>Pricing Rules</Tab>
        <Tab active={tab === "discounts"} onClick={() => setTab("discounts")}>Host Discounts</Tab>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      {tab === "subscriptions" && (
        <section style={styles.panel}>
          <div style={styles.filters}>
            <input
              style={styles.input}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Host, property or payment ID"
            />
            <select style={styles.select} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Property / Host</th>
                  <th style={styles.th}>Plan</th>
                  <th style={styles.th}>Price Rule</th>
                  <th style={styles.th}>Discount</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Period</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((r) => (
                  <tr key={r.id}>
                    <td style={styles.td}>
                      <strong>{r.property_name || "Property"}</strong>
                      <small style={styles.small}>{r.host_business_name || r.host_name || "Host"}</small>
                    </td>
                    <td style={styles.td}>{r.plan_months || 1} month{Number(r.plan_months || 1) === 1 ? "" : "s"}</td>
                    <td style={styles.td}>
                      {r.pricing_rule_name_snapshot || "Legacy pricing"}
                      <small style={styles.small}>{r.pricing_scope_snapshot ? label(r.pricing_scope_snapshot) : "—"}</small>
                    </td>
                    <td style={styles.td}>
                      {r.discount_name_snapshot || "—"}
                      {Number(r.discount_amount_snapshot || 0) > 0 && (
                        <small style={styles.small}>-{money(r.discount_amount_snapshot)}</small>
                      )}
                    </td>
                    <td style={styles.td}>
                      <strong>{money(r.total_amount)}</strong>
                      <small style={styles.small}>GST {money(r.gst_amount)}</small>
                    </td>
                    <td style={styles.td}>{dt(r.starts_at)}<small style={styles.small}>to {dt(r.expires_at)}</small></td>
                    <td style={styles.td}><span style={styles.badge}>{label(r.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!subscriptions.length && <div style={styles.empty}>No subscriptions found.</div>}
          </div>
        </section>
      )}

      {tab === "pricing" && (
        <>
          <section style={styles.panel}>
            <h2 style={styles.h2}>Create Pricing Rule</h2>
            <p style={styles.help}>Priority order is Host → City + Property Type → City → Property Type → Global.</p>
            <form onSubmit={createRule} style={styles.formGrid}>
              <Field label="Rule Name">
                <input style={styles.input} required value={rule.ruleName} onChange={(e) => setRule({ ...rule, ruleName: e.target.value })} />
              </Field>

              <Field label="Scope">
                <select style={styles.select} value={rule.scopeType} onChange={(e) => setRule({ ...rule, scopeType: e.target.value })}>
                  <option value="global">Global</option>
                  <option value="city">City</option>
                  <option value="property_type">Property Type</option>
                  <option value="city_property_type">City + Property Type</option>
                  <option value="host">Specific Host</option>
                </select>
              </Field>

              {(rule.scopeType === "city" || rule.scopeType === "city_property_type") && (
                <Field label="City">
                  <input style={styles.input} required value={rule.city} onChange={(e) => setRule({ ...rule, city: e.target.value })} />
                </Field>
              )}

              {(rule.scopeType === "property_type" || rule.scopeType === "city_property_type") && (
                <Field label="Property Type">
                  <input style={styles.input} required value={rule.propertyType} onChange={(e) => setRule({ ...rule, propertyType: e.target.value })} placeholder="Villa, Apartment, Studio..." />
                </Field>
              )}

              {rule.scopeType === "host" && (
                <Field label="Host">
                  <select style={styles.select} required value={rule.hostId} onChange={(e) => setRule({ ...rule, hostId: e.target.value })}>
                    <option value="">Select Host</option>
                    {(data.hosts || []).map((h) => (
                      <option key={h.id} value={h.id}>{h.business_name || h.full_name || h.email}</option>
                    ))}
                  </select>
                </Field>
              )}

              <Field label="Minimum Nightly Rate">
                <input style={styles.input} type="number" min="0" value={rule.minNightlyRate} onChange={(e) => setRule({ ...rule, minNightlyRate: e.target.value })} />
              </Field>
              <Field label="Maximum Nightly Rate">
                <input style={styles.input} type="number" min="0" value={rule.maxNightlyRate} onChange={(e) => setRule({ ...rule, maxNightlyRate: e.target.value })} placeholder="Leave blank for no maximum" />
              </Field>
              <Field label="Monthly Fee Before GST">
                <input style={styles.input} type="number" min="0" required value={rule.monthlyFee} onChange={(e) => setRule({ ...rule, monthlyFee: e.target.value })} />
              </Field>
              <Field label="Priority">
                <input style={styles.input} type="number" value={rule.priority} onChange={(e) => setRule({ ...rule, priority: e.target.value })} />
              </Field>
              <Field label="Valid From">
                <input style={styles.input} type="date" value={rule.validFrom} onChange={(e) => setRule({ ...rule, validFrom: e.target.value })} />
              </Field>
              <Field label="Valid Until">
                <input style={styles.input} type="date" value={rule.validUntil} onChange={(e) => setRule({ ...rule, validUntil: e.target.value })} />
              </Field>
              <Field label="Notes">
                <input style={styles.input} value={rule.notes} onChange={(e) => setRule({ ...rule, notes: e.target.value })} />
              </Field>

              <div style={{ alignSelf: "end" }}>
                <button disabled={saving} style={styles.primary} type="submit">{saving ? "Saving..." : "Create Rule"}</button>
              </div>
            </form>
          </section>

          <section style={styles.panel}>
            <h2 style={styles.h2}>Pricing Rules</h2>
            <div style={styles.ruleGrid}>
              {(data.rules || []).map((r) => (
                <div key={r.id} style={styles.ruleCard}>
                  <div style={styles.ruleTop}>
                    <div>
                      <strong>{r.rule_name}</strong>
                      <small style={styles.small}>{label(r.scope_type)}</small>
                    </div>
                    <button
                      style={r.is_active ? styles.dangerOutline : styles.primarySmall}
                      disabled={saving}
                      onClick={() => action({ action: "toggle_rule", id: r.id, isActive: !r.is_active })}
                    >
                      {r.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                  <div style={styles.ruleInfo}>
                    <span>{r.city || "All cities"}</span>
                    <span>{r.property_type || "All property types"}</span>
                    <span>{r.host_name || r.host_business_name || (r.scope_type === "host" ? "Selected Host" : "All Hosts")}</span>
                    <span>Nightly {money(r.min_nightly_rate)}{r.max_nightly_rate !== null ? ` – ${money(r.max_nightly_rate)}` : "+"}</span>
                  </div>
                  <div style={styles.rulePrice}>{money(r.monthly_fee)} <small>/ month + GST</small></div>
                  <small style={styles.small}>{r.is_active ? "Active" : "Inactive"} · Priority {r.priority || 0}</small>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {tab === "discounts" && (
        <>
          <section style={styles.panel}>
            <h2 style={styles.h2}>Create Host Discount</h2>
            <form onSubmit={createDiscount} style={styles.formGrid}>
              <Field label="Host">
                <select style={styles.select} required value={discount.hostId} onChange={(e) => setDiscount({ ...discount, hostId: e.target.value, propertyId: "" })}>
                  <option value="">Select Host</option>
                  {(data.hosts || []).map((h) => (
                    <option key={h.id} value={h.id}>{h.business_name || h.full_name || h.email}</option>
                  ))}
                </select>
              </Field>

              <Field label="Property (Optional)">
                <select style={styles.select} value={discount.propertyId} onChange={(e) => setDiscount({ ...discount, propertyId: e.target.value })}>
                  <option value="">All Properties of Host</option>
                  {(data.properties || []).filter((p) => !discount.hostId || p.host_id === discount.hostId).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Discount Name">
                <input style={styles.input} required value={discount.discountName} onChange={(e) => setDiscount({ ...discount, discountName: e.target.value })} />
              </Field>

              <Field label="Discount Type">
                <select style={styles.select} value={discount.discountType} onChange={(e) => setDiscount({ ...discount, discountType: e.target.value })}>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed ₹ Amount</option>
                  <option value="free">Free Subscription</option>
                </select>
              </Field>

              {discount.discountType !== "free" && (
                <Field label={discount.discountType === "percentage" ? "Discount %" : "Discount ₹"}>
                  <input style={styles.input} type="number" min="0" required value={discount.discountValue} onChange={(e) => setDiscount({ ...discount, discountValue: e.target.value })} />
                </Field>
              )}

              {discount.discountType === "percentage" && (
                <Field label="Maximum Discount ₹ (Optional)">
                  <input style={styles.input} type="number" min="0" value={discount.maxDiscountAmount} onChange={(e) => setDiscount({ ...discount, maxDiscountAmount: e.target.value })} />
                </Field>
              )}

              <Field label="Valid From">
                <input style={styles.input} type="date" value={discount.validFrom} onChange={(e) => setDiscount({ ...discount, validFrom: e.target.value })} />
              </Field>
              <Field label="Valid Until">
                <input style={styles.input} type="date" value={discount.validUntil} onChange={(e) => setDiscount({ ...discount, validUntil: e.target.value })} />
              </Field>
              <Field label="Maximum Uses">
                <input style={styles.input} type="number" min="1" value={discount.maxUses} onChange={(e) => setDiscount({ ...discount, maxUses: e.target.value })} />
              </Field>
              <Field label="Reason / Notes">
                <input style={styles.input} value={discount.reason} onChange={(e) => setDiscount({ ...discount, reason: e.target.value })} />
              </Field>

              <div style={{ alignSelf: "end" }}>
                <button disabled={saving} style={styles.primary} type="submit">{saving ? "Saving..." : "Create Discount"}</button>
              </div>
            </form>
          </section>

          <section style={styles.panel}>
            <h2 style={styles.h2}>Host Discounts</h2>
            <div style={styles.ruleGrid}>
              {(data.discounts || []).map((d) => (
                <div key={d.id} style={styles.ruleCard}>
                  <div style={styles.ruleTop}>
                    <div>
                      <strong>{d.discount_name}</strong>
                      <small style={styles.small}>{d.host_business_name || d.host_name || "Host"}</small>
                    </div>
                    <button
                      style={d.is_active ? styles.dangerOutline : styles.primarySmall}
                      disabled={saving}
                      onClick={() => action({ action: "toggle_discount", id: d.id, isActive: !d.is_active })}
                    >
                      {d.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                  <div style={styles.rulePrice}>
                    {d.discount_type === "free"
                      ? "FREE"
                      : d.discount_type === "percentage"
                      ? `${Number(d.discount_value)}% OFF`
                      : `${money(d.discount_value)} OFF`}
                  </div>
                  <div style={styles.ruleInfo}>
                    <span>{d.property_name || "All Host Properties"}</span>
                    <span>Used {d.used_count || 0}{d.max_uses ? ` / ${d.max_uses}` : ""}</span>
                    <span>{dt(d.valid_from)} – {dt(d.valid_until)}</span>
                  </div>
                  <small style={styles.small}>{d.is_active ? "Active" : "Inactive"}{d.reason ? ` · ${d.reason}` : ""}</small>
                </div>
              ))}
              {!data.discounts?.length && <div style={styles.empty}>No Host discounts created yet.</div>}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Card({ label, value }) {
  return <div style={styles.card}><span style={styles.cardLabel}>{label}</span><strong style={styles.cardValue}>{value}</strong></div>;
}

function Tab({ active, children, onClick }) {
  return <button onClick={onClick} style={{ ...styles.tab, ...(active ? styles.tabActive : {}) }}>{children}</button>;
}

function Field({ label, children }) {
  return <label style={styles.field}><span>{label}</span>{children}</label>;
}

const styles = {
  page: { maxWidth: 1550, margin: "0 auto", padding: 28, background: "#f6f8fb", minHeight: "100vh", color: "#303a44", fontFamily: "Arial,sans-serif" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, marginBottom: 20 },
  h1: { fontSize: 34, margin: 0, color: "#303a44" },
  h2: { margin: "0 0 6px", color: "#303a44" },
  sub: { margin: "7px 0 0", color: "#66788a" },
  help: { color: "#66788a", margin: "0 0 18px", fontSize: 13 },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 13, marginBottom: 18 },
  card: { background: "white", border: "1px solid #dfe6ee", borderRadius: 14, padding: 18 },
  cardLabel: { display: "block", fontSize: 12, color: "#718396", marginBottom: 8 },
  cardValue: { fontSize: 23, color: "#303a44" },
  tabs: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 },
  tab: { border: "1px solid #d5dee8", background: "white", color: "#214e78", borderRadius: 10, padding: "10px 15px", fontWeight: 700, cursor: "pointer" },
  tabActive: { background: "#303a44", color: "white", borderColor: "#303a44" },
  panel: { background: "white", border: "1px solid #dfe6ee", borderRadius: 15, padding: 20, marginBottom: 18 },
  filters: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 },
  input: { width: "100%", boxSizing: "border-box", padding: "11px 12px", border: "1px solid #cfd9e4", borderRadius: 9, background: "white" },
  select: { width: "100%", boxSizing: "border-box", padding: "11px 12px", border: "1px solid #cfd9e4", borderRadius: 9, background: "white" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 13 },
  field: { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#53687b" },
  primary: { border: 0, background: "#303a44", color: "white", borderRadius: 9, padding: "11px 16px", fontWeight: 800, cursor: "pointer" },
  primarySmall: { border: 0, background: "#303a44", color: "white", borderRadius: 8, padding: "8px 11px", fontWeight: 700, cursor: "pointer" },
  dangerOutline: { border: "1px solid #d99", background: "white", color: "#9b1c1c", borderRadius: 8, padding: "8px 11px", fontWeight: 700, cursor: "pointer" },
  error: { background: "#fff0f0", border: "1px solid #f0c9c9", color: "#9b1c1c", borderRadius: 10, padding: 12, marginBottom: 14 },
  success: { background: "#eef9f1", border: "1px solid #cde8d4", color: "#166534", borderRadius: 10, padding: 12, marginBottom: 14 },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 1050 },
  th: { textAlign: "left", padding: 11, background: "#f8fafc", borderBottom: "1px solid #e5ebf1", fontSize: 12, color: "#607487" },
  td: { padding: 12, borderBottom: "1px solid #edf1f4", verticalAlign: "top", fontSize: 13 },
  small: { display: "block", marginTop: 5, fontSize: 11, color: "#748698", fontWeight: 400 },
  badge: { display: "inline-block", background: "#eaf2fb", color: "#214e78", borderRadius: 999, padding: "6px 9px", fontSize: 11, fontWeight: 700 },
  empty: { padding: 30, textAlign: "center", color: "#748698" },
  ruleGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 13, marginTop: 15 },
  ruleCard: { border: "1px solid #e0e7ef", borderRadius: 13, padding: 15 },
  ruleTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  ruleInfo: { display: "grid", gap: 4, fontSize: 12, color: "#617588", marginTop: 12 },
  rulePrice: { fontSize: 22, fontWeight: 800, color: "#303a44", marginTop: 13 },
};

