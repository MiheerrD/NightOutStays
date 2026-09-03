import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gxwemplbykjxhezefykh.supabase.co";

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return createClient(SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function requireAdmin(request, supabase, action = "view") {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return { error: Response.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);

  const user = userData?.user;

  if (userError || !user) {
    return { error: Response.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  const { data: admin, error: adminError } = await supabase
    .from("admin_profiles")
    .select("user_id, full_name, email, role, is_active, full_access")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    adminError ||
    !admin ||
    !admin.is_active ||
    !["super_admin", "admin"].includes(admin.role)
  ) {
    return { error: Response.json({ error: "Access denied." }, { status: 403 }) };
  }

  if (admin.role !== "super_admin" && !admin.full_access) {
    const { data: permission, error: permissionError } = await supabase
      .from("admin_permissions")
      .select("can_view, can_edit, can_approve")
      .eq("admin_user_id", user.id)
      .eq("module", "payment_holds")
      .maybeSingle();

    if (permissionError) {
      return {
        error: Response.json(
          { error: "Unable to verify Admin permissions." },
          { status: 500 }
        ),
      };
    }

    const allowed =
      action === "view"
        ? permission?.can_view
        : Boolean(permission?.can_edit || permission?.can_approve);

    if (!allowed) {
      return {
        error: Response.json(
          { error: "You do not have permission for Payment Holds." },
          { status: 403 }
        ),
      };
    }
  }

  return { user, admin };
}

function n(value) {
  const x = Number(value || 0);
  return Number.isFinite(x) ? x : 0;
}

export async function GET(request) {
  try {
    const supabase = adminClient();
    const auth = await requireAdmin(request, supabase, "view");

    if (auth.error) return auth.error;

    const { data: settlements, error: settlementError } = await supabase
      .from("host_settlements")
      .select(`
        id,
        booking_id,
        property_id,
        host_id,
        host_gross_amount,
        total_host_deductions,
        net_host_payout,
        payout_status,
        is_on_hold,
        hold_reason,
        eligible_at,
        created_at
      `)
      .order("created_at", { ascending: false });

    if (settlementError) {
      console.error("Payment Holds settlement fetch error:", settlementError);

      return Response.json(
        { error: "Unable to load settlements." },
        { status: 500 }
      );
    }

    const bookingIds = [
      ...new Set((settlements || []).map((x) => x.booking_id).filter(Boolean)),
    ];
    const propertyIds = [
      ...new Set((settlements || []).map((x) => x.property_id).filter(Boolean)),
    ];
    const hostIds = [
      ...new Set((settlements || []).map((x) => x.host_id).filter(Boolean)),
    ];
    const settlementIds = (settlements || []).map((x) => x.id);

    const [
      bookingsResult,
      propertiesResult,
      hostsResult,
      historyResult,
    ] = await Promise.all([
      bookingIds.length
        ? supabase
            .from("bookings")
            .select("id, booking_code")
            .in("id", bookingIds)
        : Promise.resolve({ data: [], error: null }),

      propertyIds.length
        ? supabase
            .from("properties")
            .select("id, name")
            .in("id", propertyIds)
        : Promise.resolve({ data: [], error: null }),

      hostIds.length
        ? supabase
            .from("host_profiles")
            .select("id, full_name, business_name")
            .in("id", hostIds)
        : Promise.resolve({ data: [], error: null }),

      settlementIds.length
        ? supabase
            .from("host_payment_hold_history")
            .select("id, settlement_id, action, reason, action_by, created_at")
            .in("settlement_id", settlementIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (
      bookingsResult.error ||
      propertiesResult.error ||
      hostsResult.error ||
      historyResult.error
    ) {
      console.error("Payment Holds related-data fetch error:", {
        bookings: bookingsResult.error,
        properties: propertiesResult.error,
        hosts: hostsResult.error,
        history: historyResult.error,
      });

      return Response.json(
        { error: "Unable to load payment hold details." },
        { status: 500 }
      );
    }

    const actionByIds = [
      ...new Set(
        (historyResult.data || []).map((x) => x.action_by).filter(Boolean)
      ),
    ];

    let adminMap = new Map();

    if (actionByIds.length) {
      const { data: admins, error: adminsError } = await supabase
        .from("admin_profiles")
        .select("user_id, full_name, email")
        .in("user_id", actionByIds);

      if (adminsError) {
        console.warn("Unable to load Admin names for hold history:", adminsError);
      } else {
        adminMap = new Map((admins || []).map((x) => [x.user_id, x]));
      }
    }

    const bookings = new Map(
      (bookingsResult.data || []).map((x) => [x.id, x])
    );
    const properties = new Map(
      (propertiesResult.data || []).map((x) => [x.id, x])
    );
    const hosts = new Map(
      (hostsResult.data || []).map((x) => [x.id, x])
    );

    const historyBySettlement = new Map();

    for (const item of historyResult.data || []) {
      const admin = adminMap.get(item.action_by) || {};

      const enriched = {
        ...item,
        admin_name: admin.full_name || null,
        admin_email: admin.email || null,
      };

      if (!historyBySettlement.has(item.settlement_id)) {
        historyBySettlement.set(item.settlement_id, []);
      }

      historyBySettlement.get(item.settlement_id).push(enriched);
    }

    const rows = (settlements || []).map((s) => {
      const b = bookings.get(s.booking_id) || {};
      const p = properties.get(s.property_id) || {};
      const h = hosts.get(s.host_id) || {};

      return {
        ...s,
        booking_code: b.booking_code || null,
        property_name: p.name || null,
        host_name: h.full_name || null,
        host_business_name: h.business_name || null,
        history: historyBySettlement.get(s.id) || [],
      };
    });

    const summary = rows.reduce(
      (acc, row) => {
        const value = n(row.net_host_payout);

        acc.total_settlements += 1;

        if (row.is_on_hold) {
          acc.on_hold_count += 1;
          acc.on_hold_value += value;
        }

        if (row.payout_status === "eligible") {
          acc.eligible_count += 1;
          acc.eligible_value += value;
        }

        return acc;
      },
      {
        total_settlements: 0,
        on_hold_count: 0,
        eligible_count: 0,
        on_hold_value: 0,
        eligible_value: 0,
      }
    );

    return Response.json({
      success: true,
      summary,
      settlements: rows,
    });
  } catch (error) {
    console.error("Admin Payment Holds GET error:", error);

    return Response.json(
      {
        error:
          error?.message ||
          "Server error while loading Payment Holds.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const supabase = adminClient();
    const auth = await requireAdmin(request, supabase, "edit");

    if (auth.error) return auth.error;

    const body = await request.json();

    const settlementId = String(body?.settlementId || "").trim();
    const action = String(body?.action || "").trim().toLowerCase();
    const reason = String(body?.reason || "").trim();

    if (!settlementId) {
      return Response.json(
        { error: "Settlement ID is required." },
        { status: 400 }
      );
    }

    if (!["hold", "release"].includes(action)) {
      return Response.json(
        { error: "Invalid payment-hold action." },
        { status: 400 }
      );
    }

    if (action === "hold" && !reason) {
      return Response.json(
        { error: "Hold reason is required." },
        { status: 400 }
      );
    }

    const { data: settlement, error: settlementError } = await supabase
      .from("host_settlements")
      .select("id, payout_status, is_on_hold")
      .eq("id", settlementId)
      .maybeSingle();

    if (settlementError || !settlement) {
      return Response.json(
        { error: "Settlement not found." },
        { status: 404 }
      );
    }

    if (["settled", "reversed", "cancelled"].includes(settlement.payout_status)) {
      return Response.json(
        { error: "This settlement can no longer be changed." },
        { status: 400 }
      );
    }

    if (action === "hold") {
      if (settlement.is_on_hold) {
        return Response.json(
          { error: "Settlement is already on hold." },
          { status: 400 }
        );
      }

      const { data, error } = await supabase.rpc(
        "hold_host_settlement",
        {
          p_settlement_id: settlementId,
          p_reason: reason,
          p_admin_user_id: auth.user.id,
        }
      );

      if (error) {
        console.error("Hold settlement RPC error:", error);

        return Response.json(
          { error: error.message || "Unable to place settlement on hold." },
          { status: 500 }
        );
      }

      return Response.json({
        success: true,
        action: "hold",
        result: data,
      });
    }

    if (!settlement.is_on_hold) {
      return Response.json(
        { error: "Settlement is already released." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc(
      "release_host_settlement",
      {
        p_settlement_id: settlementId,
        p_admin_user_id: auth.user.id,
      }
    );

    if (error) {
      console.error("Release settlement RPC error:", error);

      return Response.json(
        { error: error.message || "Unable to release settlement." },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      action: "release",
      result: data,
    });
  } catch (error) {
    console.error("Admin Payment Holds POST error:", error);

    return Response.json(
      {
        error:
          error?.message ||
          "Server error while updating Payment Holds.",
      },
      { status: 500 }
    );
  }
}
