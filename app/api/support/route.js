import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gxwemplbykjxhezefykh.supabase.co";

function db() {
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

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeRequesterType(value) {
  const type = clean(value).toLowerCase();
  return type === "host" || type === "guest" ? type : "";
}

async function getAuthenticatedUser(req, sb) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token) {
    throw new Error("UNAUTHORIZED");
  }

  const { data, error } = await sb.auth.getUser(token);
  const user = data?.user;

  if (error || !user) {
    throw new Error("UNAUTHORIZED");
  }

  return user;
}

async function resolveRequester(sb, user, requesterType) {
  if (requesterType === "host") {
    const { data: host, error } = await sb
      .from("host_profiles")
      .select("id,user_id,full_name,business_name,email,status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    if (!host) {
      throw new Error("Host profile not found.");
    }

    if (["blocked", "suspended", "rejected"].includes(String(host.status || "").toLowerCase())) {
      throw new Error("Host access denied.");
    }

    return {
      requesterType: "host",
      requesterUserId: user.id,
      requesterHostId: host.id,
      requesterGuestId: null,
      requesterName: host.business_name || host.full_name || user.email || "Host",
      requesterEmail: host.email || user.email || null,
      profile: host,
    };
  }

  let guest = null;

  const { data: byUser, error: byUserError } = await sb
    .from("guests")
    .select("id,user_id,full_name,email,phone,status")
    .eq("user_id", user.id)
    .limit(1);

  if (byUserError) throw byUserError;
  guest = byUser?.[0] || null;

  if (!guest && user.email) {
    const { data: byEmail, error: byEmailError } = await sb
      .from("guests")
      .select("id,user_id,full_name,email,phone,status")
      .eq("email", user.email)
      .limit(1);

    if (byEmailError) throw byEmailError;
    guest = byEmail?.[0] || null;
  }

  if (!guest) {
    throw new Error("Guest profile not found.");
  }

  if (["blocked", "suspended"].includes(String(guest.status || "").toLowerCase())) {
    throw new Error("Guest access denied.");
  }

  return {
    requesterType: "guest",
    requesterUserId: user.id,
    requesterHostId: null,
    requesterGuestId: guest.id,
    requesterName: guest.full_name || user.email || "Guest",
    requesterEmail: guest.email || user.email || null,
    profile: guest,
  };
}

function ownsTicket(ticket, requester) {
  if (!ticket) return false;
  if (ticket.requester_type !== requester.requesterType) return false;

  if (ticket.requester_user_id && ticket.requester_user_id === requester.requesterUserId) {
    return true;
  }

  if (
    requester.requesterType === "host" &&
    ticket.requester_host_id &&
    ticket.requester_host_id === requester.requesterHostId
  ) {
    return true;
  }

  if (
    requester.requesterType === "guest" &&
    ticket.requester_guest_id &&
    ticket.requester_guest_id === requester.requesterGuestId
  ) {
    return true;
  }

  return false;
}

async function notifyAdmins(sb, ticket, requester, title, body) {
  const { data: admins, error: adminsError } = await sb
    .from("admin_profiles")
    .select("user_id")
    .eq("is_active", true);

  if (adminsError) throw adminsError;

  if (!admins?.length) return;

  const rows = admins
    .filter((admin) => admin.user_id)
    .map((admin) => ({
      recipient_type: "admin",
      recipient_user_id: admin.user_id,
      recipient_guest_id: null,
      host_id: requester.requesterHostId,
      support_ticket_id: ticket.id,
      property_id: ticket.property_id || null,
      booking_id: ticket.booking_id || null,
      promotion_id: ticket.promotion_id || null,
      type: "support_ticket",
      title,
      body,
      priority: ticket.priority || "normal",
      action_url: `/admin/support?ticket=${ticket.id}`,
      email_status: "skipped",
    }));

  if (!rows.length) return;

  const { error } = await sb.from("notifications").insert(rows);
  if (error) throw error;
}

export async function GET(req) {
  try {
    const sb = db();
    const user = await getAuthenticatedUser(req, sb);
    const requestUrl = new URL(req.url);
    const requesterType = normalizeRequesterType(requestUrl.searchParams.get("requesterType"));

    if (!requesterType) {
      return Response.json(
        { error: "requesterType must be host or guest." },
        { status: 400 }
      );
    }

    const requester = await resolveRequester(sb, user, requesterType);

    const { data: ticketRows, error: ticketError } = await sb
      .from("support_tickets")
      .select("*")
      .eq("requester_type", requesterType)
      .order("last_message_at", { ascending: false })
      .limit(200);

    if (ticketError) throw ticketError;

    const tickets = (ticketRows || []).filter((ticket) => ownsTicket(ticket, requester));
    const ticketIds = tickets.map((ticket) => ticket.id);

    let messages = [];

    if (ticketIds.length) {
      const { data: messageRows, error: messageError } = await sb
        .from("support_ticket_messages")
        .select("*")
        .in("ticket_id", ticketIds)
        .eq("is_internal", false)
        .order("created_at", { ascending: true });

      if (messageError) throw messageError;
      messages = messageRows || [];
    }

    const messagesByTicket = new Map();

    for (const message of messages) {
      if (!messagesByTicket.has(message.ticket_id)) {
        messagesByTicket.set(message.ticket_id, []);
      }
      messagesByTicket.get(message.ticket_id).push(message);
    }

    const hydratedTickets = tickets.map((ticket) => ({
      ...ticket,
      messages: messagesByTicket.get(ticket.id) || [],
    }));

    const { data: faqs, error: faqError } = await sb
      .from("support_faqs")
      .select("id,category,question,answer,keywords,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (faqError) throw faqError;

    return Response.json({
      success: true,
      requester: {
        type: requester.requesterType,
        name: requester.requesterName,
        email: requester.requesterEmail,
      },
      tickets: hydratedTickets,
      faqs: faqs || [],
    });
  } catch (error) {
    if (error?.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    return Response.json(
      { error: error?.message || "Unable to load support." },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const sb = db();
    const user = await getAuthenticatedUser(req, sb);
    const body = await req.json();
    const action = clean(body.action);
    const requesterType = normalizeRequesterType(body.requesterType);

    if (!requesterType) {
      return Response.json(
        { error: "requesterType must be host or guest." },
        { status: 400 }
      );
    }

    const requester = await resolveRequester(sb, user, requesterType);
    const now = new Date().toISOString();

    if (action === "create_ticket") {
      const subject = clean(body.subject);
      const description = clean(body.description);
      const category = clean(body.category) || "general";
      const priority = ["normal", "important", "urgent"].includes(clean(body.priority))
        ? clean(body.priority)
        : "normal";

      if (!subject) {
        return Response.json({ error: "Subject is required." }, { status: 400 });
      }

      if (!description) {
        return Response.json({ error: "Description is required." }, { status: 400 });
      }

      if (subject.length > 180) {
        return Response.json(
          { error: "Subject is too long. Maximum 180 characters." },
          { status: 400 }
        );
      }

      const { data: ticket, error: ticketError } = await sb
        .from("support_tickets")
        .insert({
          requester_type: requester.requesterType,
          requester_user_id: requester.requesterUserId,
          requester_guest_id: requester.requesterGuestId,
          requester_host_id: requester.requesterHostId,
          requester_name: requester.requesterName,
          requester_email: requester.requesterEmail,
          category,
          subject,
          description,
          priority,
          status: "open",
          escalated_to_admin: true,
          last_message_at: now,
          updated_at: now,
        })
        .select("*")
        .single();

      if (ticketError) throw ticketError;

      const { error: messageError } = await sb
        .from("support_ticket_messages")
        .insert({
          ticket_id: ticket.id,
          sender_type: requester.requesterType,
          sender_user_id: requester.requesterUserId,
          sender_guest_id: requester.requesterGuestId,
          sender_name: requester.requesterName,
          message_text: description,
          message_type: "message",
          is_internal: false,
        });

      if (messageError) throw messageError;

      await notifyAdmins(
        sb,
        ticket,
        requester,
        `New ${requester.requesterType} support request`,
        `${requester.requesterName}: ${subject}`
      );

      return Response.json({
        success: true,
        message: `Support request ${ticket.ticket_code} created successfully.`,
        ticket,
      });
    }

    if (action === "reply") {
      const ticketId = clean(body.ticketId);
      const message = clean(body.message);

      if (!ticketId) {
        return Response.json({ error: "Ticket is required." }, { status: 400 });
      }

      if (!message) {
        return Response.json({ error: "Reply cannot be empty." }, { status: 400 });
      }

      const { data: ticket, error: ticketError } = await sb
        .from("support_tickets")
        .select("*")
        .eq("id", ticketId)
        .maybeSingle();

      if (ticketError) throw ticketError;

      if (!ticket || !ownsTicket(ticket, requester)) {
        return Response.json({ error: "Support ticket not found." }, { status: 404 });
      }

      if (ticket.status === "closed") {
        return Response.json(
          { error: "This support ticket is closed." },
          { status: 409 }
        );
      }

      const { error: messageError } = await sb
        .from("support_ticket_messages")
        .insert({
          ticket_id: ticket.id,
          sender_type: requester.requesterType,
          sender_user_id: requester.requesterUserId,
          sender_guest_id: requester.requesterGuestId,
          sender_name: requester.requesterName,
          message_text: message,
          message_type: "message",
          is_internal: false,
        });

      if (messageError) throw messageError;

      const nextStatus = ticket.status === "resolved" ? "open" : ticket.status;

      const { error: updateError } = await sb
        .from("support_tickets")
        .update({
          status: nextStatus,
          escalated_to_admin: true,
          last_message_at: now,
          resolved_at: nextStatus === "open" ? null : ticket.resolved_at,
          updated_at: now,
        })
        .eq("id", ticket.id);

      if (updateError) throw updateError;

      await notifyAdmins(
        sb,
        { ...ticket, status: nextStatus },
        requester,
        `${ticket.ticket_code} has a new reply`,
        `${requester.requesterName}: ${message.slice(0, 180)}`
      );

      return Response.json({
        success: true,
        message: "Reply sent to NightOutStays Support.",
      });
    }

    return Response.json({ error: "Unknown support action." }, { status: 400 });
  } catch (error) {
    if (error?.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    return Response.json(
      { error: error?.message || "Unable to update support." },
      { status: 500 }
    );
  }
}
