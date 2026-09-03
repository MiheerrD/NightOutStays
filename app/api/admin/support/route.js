import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gxwemplbykjxhezefykh.supabase.co";

function db() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function clean(value) {
  return String(value ?? "").trim();
}

async function requireAdmin(req, sb, mode = "view") {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { error: Response.json({ error: "Unauthorized." }, { status: 401 }) };

  const { data: userData } = await sb.auth.getUser(token);
  const user = userData?.user;
  if (!user) return { error: Response.json({ error: "Unauthorized." }, { status: 401 }) };

  const { data: profile } = await sb
    .from("admin_profiles")
    .select("user_id,full_name,email,role,is_active,full_access")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.is_active) return { error: Response.json({ error: "Access denied." }, { status: 403 }) };

  if (profile.role !== "super_admin" && !profile.full_access) {
    const { data: permission } = await sb
      .from("admin_permissions")
      .select("can_view,can_add,can_edit,can_approve")
      .eq("admin_user_id", user.id)
      .eq("module", "messages")
      .maybeSingle();

    const ok = mode === "view" ? permission?.can_view : mode === "add" ? permission?.can_add : mode === "approve" ? permission?.can_approve : permission?.can_edit;
    if (!ok) return { error: Response.json({ error: "You do not have permission for Support/Notifications." }, { status: 403 }) };
  }

  return { user, profile };
}

async function notifyRequester(sb, ticket, title, body, actionUrl) {
  const recipientType = ticket.requester_type;
  const recipientUserId = ticket.requester_user_id || null;
  const recipientGuestId = ticket.requester_guest_id || null;
  const hostId = ticket.requester_host_id || null;

  const { data: notification, error } = await sb
    .from("notifications")
    .insert({
      recipient_type: recipientType,
      recipient_user_id: recipientUserId,
      recipient_guest_id: recipientGuestId,
      host_id: hostId,
      support_ticket_id: ticket.id,
      property_id: ticket.property_id || null,
      booking_id: ticket.booking_id || null,
      promotion_id: ticket.promotion_id || null,
      type: "support_reply",
      title,
      body,
      priority: "important",
      action_url: actionUrl,
      email_status: ticket.requester_email ? "pending" : "skipped",
    })
    .select("id")
    .single();

  if (error) throw error;

  if (ticket.requester_email) {
    await sb.from("email_outbox").insert({
      notification_id: notification.id,
      support_ticket_id: ticket.id,
      recipient_type: recipientType,
      recipient_email: ticket.requester_email,
      recipient_name: ticket.requester_name,
      template_key: "support_reply",
      subject: title,
      body_text: body,
      priority: "important",
      status: "pending",
    });
  }
}

export async function GET(req) {
  try {
    const sb = db();
    const admin = await requireAdmin(req, sb, "view");
    if (admin.error) return admin.error;

    const requestUrl = new URL(req.url);
    const ticketId = requestUrl.searchParams.get("ticket");

    const [ticketsResult, faqsResult, adminsResult] = await Promise.all([
      sb.from("support_tickets").select("*").order("last_message_at", { ascending: false }).limit(300),
      sb.from("support_faqs").select("*").order("sort_order").order("created_at"),
      sb.from("admin_profiles").select("user_id,full_name,email,role,is_active").eq("is_active", true).order("full_name"),
    ]);

    if (ticketsResult.error) throw ticketsResult.error;
    if (faqsResult.error) throw faqsResult.error;
    if (adminsResult.error) throw adminsResult.error;

    let messages = [];
    if (ticketId) {
      const messagesResult = await sb
        .from("support_ticket_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (messagesResult.error) throw messagesResult.error;
      messages = messagesResult.data || [];
    }

    const tickets = ticketsResult.data || [];
    const openTickets = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status));

    return Response.json({
      success: true,
      tickets,
      faqs: faqsResult.data || [],
      admins: adminsResult.data || [],
      messages,
      summary: {
        open: openTickets.length,
        urgent: openTickets.filter((ticket) => ticket.priority === "urgent").length,
        important: openTickets.filter((ticket) => ticket.priority === "important").length,
        waiting: openTickets.filter((ticket) => ticket.status === "waiting").length,
      },
    });
  } catch (error) {
    return Response.json({ error: error?.message || "Unable to load support." }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const sb = db();
    const body = await req.json();
    const action = clean(body.action);
    const mode = ["approve_free_boost", "reject_free_boost"].includes(action)
      ? "approve"
      : ["reply", "create_faq"].includes(action)
        ? "add"
        : "edit";

    const admin = await requireAdmin(req, sb, mode);
    if (admin.error) return admin.error;
    const now = new Date().toISOString();

    if (action === "reply") {
      const text = clean(body.message);
      if (!text) return Response.json({ error: "Reply cannot be empty." }, { status: 400 });

      const { data: ticket, error: ticketError } = await sb.from("support_tickets").select("*").eq("id", body.ticketId).maybeSingle();
      if (ticketError) throw ticketError;
      if (!ticket) return Response.json({ error: "Ticket not found." }, { status: 404 });
      if (ticket.status === "closed") return Response.json({ error: "This ticket is closed. Reopen it before replying." }, { status: 409 });

      const { data: message, error: messageError } = await sb
        .from("support_ticket_messages")
        .insert({
          ticket_id: ticket.id,
          sender_type: "admin",
          sender_user_id: admin.user.id,
          sender_name: admin.profile.full_name || "Admin",
          message_text: text,
          message_type: "message",
          is_internal: false,
        })
        .select("*")
        .single();
      if (messageError) throw messageError;

      const nextStatus = ticket.status === "resolved" ? "in_progress" : ticket.status === "open" ? "in_progress" : ticket.status;
      const { data: updatedTicket, error: updateError } = await sb
        .from("support_tickets")
        .update({
          status: nextStatus,
          last_message_at: now,
          first_admin_response_at: ticket.first_admin_response_at || now,
          resolved_at: nextStatus === "in_progress" ? null : ticket.resolved_at,
          closed_at: null,
          updated_at: now,
        })
        .eq("id", ticket.id)
        .select("*")
        .single();
      if (updateError) throw updateError;

      await notifyRequester(sb, updatedTicket, "NightOutStays Support replied", text, ticket.requester_type === "host" ? "/host/help" : "/account/help");
      return Response.json({ success: true, message: "Reply sent.", ticket: updatedTicket, supportMessage: message });
    }

    if (action === "update_ticket") {
      const allowedStatus = ["open", "in_progress", "waiting", "resolved", "closed"];
      const allowedPriority = ["normal", "important", "urgent"];
      const patch = { updated_at: now };

      if (allowedStatus.includes(body.status)) {
        patch.status = body.status;
        if (body.status === "resolved") {
          patch.resolved_at = now;
          patch.closed_at = null;
        } else if (body.status === "closed") {
          patch.closed_at = now;
        } else {
          patch.resolved_at = null;
          patch.closed_at = null;
        }
      }

      if (allowedPriority.includes(body.priority)) patch.priority = body.priority;
      if ("assignedAdminUserId" in body) patch.assigned_admin_user_id = body.assignedAdminUserId || null;

      const { data: updatedTicket, error } = await sb
        .from("support_tickets")
        .update(patch)
        .eq("id", body.ticketId)
        .select("*")
        .single();
      if (error) throw error;

      return Response.json({ success: true, message: patch.status === "closed" ? "Ticket closed." : "Ticket updated.", ticket: updatedTicket });
    }

    if (action === "approve_free_boost") {
      const { data: ticket, error: ticketError } = await sb.from("support_tickets").select("*").eq("id", body.ticketId).maybeSingle();
      if (ticketError) throw ticketError;
      if (!ticket) return Response.json({ error: "Ticket not found." }, { status: 404 });
      if (ticket.category !== "promotion" || !ticket.property_id || !ticket.requester_host_id) return Response.json({ error: "This is not a valid Free Boost request." }, { status: 400 });

      const { data: property } = await sb.from("properties").select("id,host_id,base_price").eq("id", ticket.property_id).eq("host_id", ticket.requester_host_id).maybeSingle();
      if (!property) return Response.json({ error: "Property not found for this Host." }, { status: 404 });

      const { data: blockers } = await sb.from("property_promotions").select("id,status").eq("property_id", property.id).in("status", ["active", "pending_approval", "pending_payment"]).limit(1);
      if (blockers?.length) return Response.json({ error: "Property already has an active or pending promotion." }, { status: 409 });

      const expires = new Date();
      expires.setUTCDate(expires.getUTCDate() + 30);

      const { data: promotion, error: promotionError } = await sb
        .from("property_promotions")
        .insert({
          property_id: property.id,
          host_id: ticket.requester_host_id,
          promotion_type: "boosted",
          plan_months: 1,
          nightly_rate_snapshot: Number(property.base_price || 0),
          subscription_fee_snapshot: 0,
          promotion_fee_before_gst: 0,
          gst_rate: 18,
          gst_amount: 0,
          total_amount: 0,
          status: "active",
          requested_at: ticket.created_at,
          approved_at: now,
          approved_by: admin.user.id,
          starts_at: now,
          expires_at: expires.toISOString(),
          duration_days: 30,
          pricing_scope_snapshot: "admin_granted",
          pricing_rule_name_snapshot: "Free Boost Approved by Admin",
          pricing_method_snapshot: "complimentary",
          standard_promotion_fee_snapshot: 0,
          discount_name_snapshot: "Admin Free Boost",
          discount_type_snapshot: "free",
          discount_value_snapshot: 0,
          discount_amount_snapshot: 0,
          pricing_quoted_at: now,
          admin_granted: true,
        })
        .select("id")
        .single();
      if (promotionError) throw promotionError;

      await sb.from("support_ticket_messages").insert({
        ticket_id: ticket.id,
        sender_type: "admin",
        sender_user_id: admin.user.id,
        sender_name: admin.profile.full_name || "Admin",
        message_text: "Your free Boost request has been approved for 30 days.",
        message_type: "system",
        is_internal: false,
      });

      await sb.from("support_tickets").update({
        status: "resolved",
        promotion_id: promotion.id,
        resolved_at: now,
        closed_at: null,
        first_admin_response_at: ticket.first_admin_response_at || now,
        last_message_at: now,
        updated_at: now,
      }).eq("id", ticket.id);

      await notifyRequester(sb, { ...ticket, promotion_id: promotion.id }, "Free Boost approved", "Your property has been Boosted for 30 days by NightOutStays Admin.", "/host/promotions");
      return Response.json({ success: true, message: "Free Boost approved for 30 days." });
    }

    if (action === "reject_free_boost") {
      const reason = clean(body.reason);
      if (!reason) return Response.json({ error: "Rejection reason is required." }, { status: 400 });

      const { data: ticket, error: ticketError } = await sb.from("support_tickets").select("*").eq("id", body.ticketId).maybeSingle();
      if (ticketError) throw ticketError;
      if (!ticket) return Response.json({ error: "Ticket not found." }, { status: 404 });

      await sb.from("support_ticket_messages").insert({
        ticket_id: ticket.id,
        sender_type: "admin",
        sender_user_id: admin.user.id,
        sender_name: admin.profile.full_name || "Admin",
        message_text: `Free Boost request declined: ${reason}`,
        message_type: "system",
        is_internal: false,
      });

      await sb.from("support_tickets").update({
        status: "resolved",
        resolved_at: now,
        closed_at: null,
        first_admin_response_at: ticket.first_admin_response_at || now,
        last_message_at: now,
        updated_at: now,
      }).eq("id", ticket.id);

      await notifyRequester(sb, ticket, "Free Boost request declined", reason, "/host/promotions");
      return Response.json({ success: true, message: "Free Boost request declined." });
    }

    if (action === "create_faq") {
      const question = clean(body.question);
      const answer = clean(body.answer);
      const category = clean(body.category) || "general";
      if (!question || !answer) return Response.json({ error: "Question and answer are required." }, { status: 400 });

      const keywords = clean(body.keywords).split(",").map((item) => item.trim()).filter(Boolean);
      const { error } = await sb.from("support_faqs").insert({
        category,
        question,
        answer,
        keywords,
        sort_order: Number(body.sortOrder || 0),
        is_active: true,
        created_by: admin.user.id,
        updated_by: admin.user.id,
      });
      if (error) throw error;
      return Response.json({ success: true, message: "FAQ created." });
    }

    if (action === "toggle_faq") {
      const { error } = await sb.from("support_faqs").update({ is_active: Boolean(body.isActive), updated_by: admin.user.id, updated_at: now }).eq("id", body.id);
      if (error) throw error;
      return Response.json({ success: true, message: "FAQ updated." });
    }

    if (action === "delete_faq") {
      const { error } = await sb.from("support_faqs").delete().eq("id", body.id);
      if (error) throw error;
      return Response.json({ success: true, message: "FAQ deleted." });
    }

    return Response.json({ error: "Unknown support action." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error?.message || "Unable to update support." }, { status: 500 });
  }
}
