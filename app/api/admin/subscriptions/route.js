import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gxwemplbykjxhezefykh.supabase.co";

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireAdmin(request, supabase, action = "view") {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { error: Response.json({ error: "Unauthorized." }, { status: 401 }) };

  const { data: userData } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (!user) return { error: Response.json({ error: "Unauthorized." }, { status: 401 }) };

  const { data: admin } = await supabase
    .from("admin_profiles")
    .select("user_id,role,is_active,full_access")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!admin?.is_active || !["super_admin", "admin"].includes(admin.role)) {
    return { error: Response.json({ error: "Access denied." }, { status: 403 }) };
  }

  if (admin.role !== "super_admin" && !admin.full_access) {
    const { data: permission } = await supabase
      .from("admin_permissions")
      .select("can_view,can_add,can_edit,can_delete")
      .eq("admin_user_id", user.id)
      .eq("module", "subscriptions")
      .maybeSingle();

    const allowed =
      action === "view"
        ? permission?.can_view
        : action === "add"
        ? permission?.can_add
        : action === "delete"
        ? permission?.can_delete
        : permission?.can_edit;

    if (!allowed) {
      return { error: Response.json({ error: "You do not have permission for Subscriptions." }, { status: 403 }) };
    }
  }

  return { user, admin };
}

const num = (v, fallback = 0) => {
  if (v === "" || v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const nullableNumber = (v) => (v === "" || v === null || v === undefined ? null : num(v));

const dateStart = (v) => (v ? new Date(`${v}T00:00:00.000Z`).toISOString() : null);
const dateEnd = (v) => (v ? new Date(`${v}T23:59:59.999Z`).toISOString() : null);

export async function GET(request) {
  try {
    const supabase = adminClient();
    const auth = await requireAdmin(request, supabase, "view");
    if (auth.error) return auth.error;

    const now = new Date();
    const next30 = new Date(now);
    next30.setDate(next30.getDate() + 30);

    const [
      subscriptionsResult,
      rulesResult,
      discountsResult,
      hostsResult,
      propertiesResult,
    ] = await Promise.all([
      supabase
        .from("property_subscriptions")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase
        .from("subscription_pricing_rules")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase
        .from("host_subscription_discounts")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase
        .from("host_profiles")
        .select("id,full_name,business_name,email,status")
        .order("business_name", { ascending: true }),

      supabase
        .from("properties")
        .select("id,name,host_id,city,property_type,base_price")
        .order("name", { ascending: true }),
    ]);

    for (const result of [subscriptionsResult, rulesResult, discountsResult, hostsResult, propertiesResult]) {
      if (result.error) throw result.error;
    }

    const hosts = hostsResult.data || [];
    const properties = propertiesResult.data || [];

    const hostMap = new Map(hosts.map((h) => [h.id, h]));
    const propertyMap = new Map(properties.map((p) => [p.id, p]));

    const subscriptions = (subscriptionsResult.data || []).map((r) => {
      const h = hostMap.get(r.host_id) || {};
      const p = propertyMap.get(r.property_id) || {};
      return {
        ...r,
        host_name: h.full_name || null,
        host_business_name: h.business_name || null,
        property_name: p.name || null,
      };
    });

    const rules = (rulesResult.data || []).map((r) => {
      const h = hostMap.get(r.host_id) || {};
      return {
        ...r,
        host_name: h.full_name || null,
        host_business_name: h.business_name || null,
      };
    });

    const discounts = (discountsResult.data || []).map((d) => {
      const h = hostMap.get(d.host_id) || {};
      const p = propertyMap.get(d.property_id) || {};
      return {
        ...d,
        host_name: h.full_name || null,
        host_business_name: h.business_name || null,
        property_name: p.name || null,
      };
    });

    const summary = {
      active: subscriptions.filter(
        (r) =>
          r.status === "active" &&
          (!r.expires_at || new Date(r.expires_at) > now)
      ).length,
      expiring: subscriptions.filter(
        (r) =>
          r.status === "active" &&
          r.expires_at &&
          new Date(r.expires_at) > now &&
          new Date(r.expires_at) <= next30
      ).length,
      expired: subscriptions.filter(
        (r) =>
          r.status === "expired" ||
          (r.expires_at && new Date(r.expires_at) <= now)
      ).length,
      revenue: subscriptions
        .filter((r) => r.status === "active" && r.paid_at)
        .reduce((sum, r) => sum + num(r.total_amount), 0),
      active_rules: rules.filter((r) => r.is_active).length,
    };

    return Response.json({
      success: true,
      summary,
      subscriptions,
      rules,
      discounts,
      hosts,
      properties,
    });
  } catch (error) {
    console.error("Admin subscriptions GET error:", error);
    return Response.json(
      { error: error?.message || "Unable to load subscriptions." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const supabase = adminClient();
    const body = await request.json();
    const action = String(body?.action || "");

    const permissionAction =
      action === "create_rule" || action === "create_discount" ? "add" : "edit";

    const auth = await requireAdmin(request, supabase, permissionAction);
    if (auth.error) return auth.error;

    if (action === "create_rule") {
      const scopeType = String(body.scopeType || "global");
      const allowedScopes = ["global", "city", "property_type", "city_property_type", "host"];
      if (!allowedScopes.includes(scopeType)) {
        return Response.json({ error: "Invalid pricing scope." }, { status: 400 });
      }

      const city =
        scopeType === "city" || scopeType === "city_property_type"
          ? String(body.city || "").trim()
          : null;

      const propertyType =
        scopeType === "property_type" || scopeType === "city_property_type"
          ? String(body.propertyType || "").trim()
          : null;

      const hostId = scopeType === "host" ? String(body.hostId || "").trim() : null;

      if ((scopeType === "city" || scopeType === "city_property_type") && !city) {
        return Response.json({ error: "City is required." }, { status: 400 });
      }
      if ((scopeType === "property_type" || scopeType === "city_property_type") && !propertyType) {
        return Response.json({ error: "Property type is required." }, { status: 400 });
      }
      if (scopeType === "host" && !hostId) {
        return Response.json({ error: "Host is required." }, { status: 400 });
      }

      const monthlyFee = num(body.monthlyFee, -1);
      const minNightlyRate = num(body.minNightlyRate, 0);
      const maxNightlyRate = nullableNumber(body.maxNightlyRate);

      if (monthlyFee < 0) {
        return Response.json({ error: "Monthly fee must be zero or more." }, { status: 400 });
      }

      if (maxNightlyRate !== null && maxNightlyRate < minNightlyRate) {
        return Response.json({ error: "Maximum nightly rate cannot be below minimum nightly rate." }, { status: 400 });
      }

      const { error } = await supabase.from("subscription_pricing_rules").insert({
        rule_name: String(body.ruleName || "").trim(),
        scope_type: scopeType,
        city,
        property_type: propertyType,
        host_id: hostId,
        min_nightly_rate: minNightlyRate,
        max_nightly_rate: maxNightlyRate,
        monthly_fee: monthlyFee,
        priority: num(body.priority, 0),
        valid_from: dateStart(body.validFrom),
        valid_until: dateEnd(body.validUntil),
        is_active: true,
        notes: String(body.notes || "").trim() || null,
        created_by: auth.user.id,
        updated_by: auth.user.id,
      });

      if (error) throw error;

      return Response.json({ success: true, message: "Pricing rule created." });
    }

    if (action === "toggle_rule") {
      const id = String(body.id || "");
      if (!id) return Response.json({ error: "Pricing rule ID is required." }, { status: 400 });

      const { error } = await supabase
        .from("subscription_pricing_rules")
        .update({
          is_active: Boolean(body.isActive),
          updated_by: auth.user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
      return Response.json({ success: true, message: "Pricing rule updated." });
    }

    if (action === "create_discount") {
      const hostId = String(body.hostId || "").trim();
      const propertyId = String(body.propertyId || "").trim() || null;
      const discountType = String(body.discountType || "percentage");

      if (!hostId) {
        return Response.json({ error: "Host is required." }, { status: 400 });
      }

      if (!["percentage", "fixed", "free"].includes(discountType)) {
        return Response.json({ error: "Invalid discount type." }, { status: 400 });
      }

      const discountValue = discountType === "free" ? 0 : num(body.discountValue, -1);

      if (discountValue < 0) {
        return Response.json({ error: "Discount value must be zero or more." }, { status: 400 });
      }

      if (discountType === "percentage" && discountValue > 100) {
        return Response.json({ error: "Percentage discount cannot exceed 100%." }, { status: 400 });
      }

      if (propertyId) {
        const { data: property } = await supabase
          .from("properties")
          .select("id")
          .eq("id", propertyId)
          .eq("host_id", hostId)
          .maybeSingle();

        if (!property) {
          return Response.json({ error: "Selected property does not belong to this Host." }, { status: 400 });
        }
      }

      const { error } = await supabase.from("host_subscription_discounts").insert({
        host_id: hostId,
        property_id: propertyId,
        discount_name: String(body.discountName || "").trim(),
        discount_type: discountType,
        discount_value: discountValue,
        max_discount_amount:
          discountType === "percentage" ? nullableNumber(body.maxDiscountAmount) : null,
        valid_from: dateStart(body.validFrom),
        valid_until: dateEnd(body.validUntil),
        max_uses: body.maxUses === "" ? null : Math.max(1, Math.floor(num(body.maxUses, 1))),
        is_active: true,
        reason: String(body.reason || "").trim() || null,
        created_by: auth.user.id,
        updated_by: auth.user.id,
      });

      if (error) throw error;

      return Response.json({ success: true, message: "Host discount created." });
    }

    if (action === "toggle_discount") {
      const id = String(body.id || "");
      if (!id) return Response.json({ error: "Discount ID is required." }, { status: 400 });

      const { error } = await supabase
        .from("host_subscription_discounts")
        .update({
          is_active: Boolean(body.isActive),
          updated_by: auth.user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
      return Response.json({ success: true, message: "Host discount updated." });
    }

    return Response.json({ error: "Unknown subscription action." }, { status: 400 });
  } catch (error) {
    console.error("Admin subscriptions POST error:", error);
    return Response.json(
      { error: error?.message || "Unable to update subscriptions." },
      { status: 500 }
    );
  }
}
