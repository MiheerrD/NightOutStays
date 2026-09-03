import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gxwemplbykjxhezefykh.supabase.co";

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");

  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function n(value) {
  const x = Number(value || 0);
  return Number.isFinite(x) ? x : 0;
}

export async function GET(request) {
  try {
    const supabase = adminClient();
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: userData, error: userError } =
      await supabase.auth.getUser(token);

    const user = userData?.user;

    if (userError || !user) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: admin, error: adminError } = await supabase
      .from("admin_profiles")
      .select("user_id, role, is_active, full_access")
      .eq("user_id", user.id)
      .maybeSingle();

    if (
      adminError ||
      !admin ||
      !admin.is_active ||
      !["super_admin", "admin"].includes(admin.role)
    ) {
      return Response.json({ error: "Access denied." }, { status: 403 });
    }

    // Super Admin and full-access Admins may view payouts.
    // Limited Admins require explicit payouts view permission.
    if (admin.role !== "super_admin" && !admin.full_access) {
      const { data: permission, error: permissionError } = await supabase
        .from("admin_permissions")
        .select("can_view")
        .eq("admin_user_id", user.id)
        .eq("module", "payouts")
        .maybeSingle();

      if (permissionError || !permission?.can_view) {
        return Response.json(
          { error: "You do not have permission to view payouts." },
          { status: 403 }
        );
      }
    }

    const { data: settlements, error: settlementError } = await supabase
      .from("host_settlements")
      .select(`
        id,
        booking_id,
        property_id,
        host_id,
        guest_paid_amount,
        booking_value_before_gst,
        gst_collected,
        security_deposit,
        host_gross_amount,
        guest_payment_gateway_fee,
        guest_payment_gateway_fee_gst,
        host_transfer_fee,
        host_transfer_fee_gst,
        platform_fee,
        platform_fee_gst,
        other_deductions,
        other_deduction_note,
        total_host_deductions,
        net_host_payout,
        payout_status,
        is_on_hold,
        hold_reason,
        eligible_at,
        razorpay_payment_id,
        razorpay_transfer_id,
        razorpay_transfer_status,
        razorpay_settlement_id,
        created_at,
        updated_at
      `)
      .order("created_at", { ascending: false });

    if (settlementError) {
      console.error("Admin payouts settlement error:", settlementError);
      return Response.json({ error: "Unable to load Host settlements." }, { status: 500 });
    }

    const bookingIds = [...new Set((settlements || []).map((x) => x.booking_id).filter(Boolean))];
    const propertyIds = [...new Set((settlements || []).map((x) => x.property_id).filter(Boolean))];
    const hostIds = [...new Set((settlements || []).map((x) => x.host_id).filter(Boolean))];

    const [bookingsResult, propertiesResult, hostsResult] = await Promise.all([
      bookingIds.length
        ? supabase.from("bookings").select("id, booking_code").in("id", bookingIds)
        : Promise.resolve({ data: [], error: null }),
      propertyIds.length
        ? supabase.from("properties").select("id, name").in("id", propertyIds)
        : Promise.resolve({ data: [], error: null }),
      hostIds.length
        ? supabase.from("host_profiles").select("id, full_name, business_name").in("id", hostIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (bookingsResult.error || propertiesResult.error || hostsResult.error) {
      console.error("Admin payouts related data error:", {
        bookings: bookingsResult.error,
        properties: propertiesResult.error,
        hosts: hostsResult.error,
      });
      return Response.json({ error: "Unable to load payout details." }, { status: 500 });
    }

    const bookings = new Map((bookingsResult.data || []).map((x) => [x.id, x]));
    const properties = new Map((propertiesResult.data || []).map((x) => [x.id, x]));
    const hosts = new Map((hostsResult.data || []).map((x) => [x.id, x]));

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
      };
    });

    const summary = rows.reduce(
      (acc, row) => {
        const amount = n(row.net_host_payout);

        acc.total_host_payable += amount;

        if (row.is_on_hold || row.payout_status === "on_hold") {
          acc.on_hold += amount;
        }

        if (row.payout_status === "eligible") {
          acc.eligible += amount;
        }

        if (["processing", "transferred"].includes(row.payout_status)) {
          acc.processing += amount;
        }

        if (row.payout_status === "settled") {
          acc.settled += amount;
        }

        return acc;
      },
      {
        total_host_payable: 0,
        on_hold: 0,
        eligible: 0,
        processing: 0,
        settled: 0,
      }
    );

    return Response.json({
      success: true,
      summary,
      settlements: rows,
    });
  } catch (error) {
    console.error("Admin payouts API error:", error);

    return Response.json(
      { error: error?.message || "Server error while loading payouts." },
      { status: 500 }
    );
  }
}
