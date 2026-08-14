import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CompletionPayload = {
  call_id?: string;
  external_call_id?: string;
  call_status?: "completed" | "failed" | "cancelled" | "in_progress";
  call_outcome?: string;
  recording_url?: string;
  transcript?: string;
  summary?: string;
  appointment_booked?: boolean;
  qualification?: Record<string, unknown>;
  appointment?: { appointment_datetime?: string; status?: string; notes?: string };
};

function validDate(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function getCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") || "";
  for (const entry of cookieHeader.split(";")) {
    const [key, ...parts] = entry.trim().split("=");
    if (key === name) return decodeURIComponent(parts.join("="));
  }
  return null;
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function isSameOriginBrowserRequest(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (origin && origin !== requestOrigin) return false;
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) return false;
  return Boolean(origin || fetchSite);
}

function hasValidBrowserToken(request: Request, callId?: string) {
  if (!callId) return false;
  const secret = process.env.CALL_COMPLETION_SECRET || process.env.N8N_WEBHOOK_SECRET;

  if (!secret) return isSameOriginBrowserRequest(request);

  const cookie = getCookie(request, "solar_call_token");
  if (!cookie) return false;
  const [cookieCallId, signature] = cookie.split(".");
  if (!cookieCallId || !signature || cookieCallId !== callId) return false;

  const expected = createHmac("sha256", secret).update(callId).digest("hex");
  return safeEqual(signature, expected);
}

function safeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

export async function POST(request: Request) {
  let body: CompletionPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.call_id && !body.external_call_id) {
    return NextResponse.json({ error: "call_id or external_call_id is required" }, { status: 400 });
  }

  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
  const suppliedWebhookSecret = request.headers.get("x-webhook-secret");
  const validWebhookSecret = Boolean(
    webhookSecret && suppliedWebhookSecret && safeEqual(suppliedWebhookSecret, webhookSecret)
  );

  if (!validWebhookSecret && !hasValidBrowserToken(request, body.call_id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getSupabaseAdmin();
    const lookup = body.call_id
      ? db.from("calls").select("id, lead_id, appointment_booked").eq("id", body.call_id).single()
      : db.from("calls").select("id, lead_id, appointment_booked").eq("external_call_id", body.external_call_id).single();

    const { data: existing, error: lookupError } = await lookup;
    if (lookupError || !existing) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const status = body.call_status || "completed";
    const appointment = body.appointment;
    const shouldBookAppointment = Boolean(
      body.appointment_booked && appointment && validDate(appointment.appointment_datetime)
    );

    if (shouldBookAppointment && appointment?.appointment_datetime) {
      const { data: existingAppointment, error: appointmentLookupError } = await db
        .from("appointments")
        .select("id")
        .eq("lead_id", existing.lead_id)
        .eq("appointment_datetime", appointment.appointment_datetime)
        .maybeSingle();

      if (appointmentLookupError) {
        console.error("appointment lookup error:", appointmentLookupError);
      }

      if (!existingAppointment) {
        const { error: appointmentError } = await db.from("appointments").insert({
          lead_id: existing.lead_id,
          appointment_datetime: appointment.appointment_datetime,
          status: safeText(appointment.status, 50) || "confirmed",
          notes: safeText(appointment.notes, 5000) || "Booked via Solar AI Voice Agent call"
        });

        if (appointmentError) {
          return NextResponse.json({ error: "Appointment could not be saved" }, { status: 500 });
        }
      }
    }

    const qualification = body.qualification;
    if (qualification) {
      const { error: qualificationError } = await db.from("lead_qualifications").upsert({
        lead_id: existing.lead_id,
        average_electric_bill: typeof qualification.average_electric_bill === "number" ? qualification.average_electric_bill : null,
        homeowner_confirmed: typeof qualification.homeowner_confirmed === "boolean" ? qualification.homeowner_confirmed : null,
        home_type: safeText(qualification.home_type, 120),
        electricity_provider: safeText(qualification.electricity_provider, 200),
        credit_above_650: typeof qualification.credit_above_650 === "boolean" ? qualification.credit_above_650 : null,
        roof_shading: safeText(qualification.roof_shading, 500),
        decision_maker: typeof qualification.decision_maker === "boolean" ? qualification.decision_maker : null,
        qualification_status: safeText(qualification.qualification_status, 80) || "Pending",
        notes: safeText(qualification.notes, 5000)
      }, { onConflict: "lead_id" });

      if (qualificationError) {
        console.error("qualification save error:", qualificationError);
      }
    }

    const recording = typeof body.recording_url === "string" && body.recording_url.length <= 1_500_000
      ? body.recording_url
      : null;

    const { error: callError } = await db.from("calls").update({
      external_call_id: safeText(body.external_call_id, 500) || undefined,
      call_status: status,
      call_outcome: safeText(body.call_outcome, 500) || (shouldBookAppointment ? "Appointment Booked" : "Completed"),
      recording_url: recording,
      transcript: safeText(body.transcript, 200_000),
      summary: safeText(body.summary, 10_000),
      appointment_booked: shouldBookAppointment || Boolean(existing.appointment_booked)
    }).eq("id", existing.id);

    if (callError) {
      return NextResponse.json({ error: "Could not save call" }, { status: 500 });
    }

    const { error: leadStatusError } = await db.from("leads").update({
      lead_status: shouldBookAppointment || existing.appointment_booked ? "appointment_booked" : status
    }).eq("id", existing.lead_id);

    if (leadStatusError) {
      console.error("lead status update error:", leadStatusError);
    }

    const response = NextResponse.json({
      success: true,
      call_id: existing.id,
      appointment_booked: shouldBookAppointment || Boolean(existing.appointment_booked),
      recording_saved: Boolean(recording)
    });
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set("solar_call_token", "", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/api/voice-completion",
      maxAge: 0
    });
    return response;
  } catch (error) {
    console.error("voice-completion error:", error);
    return NextResponse.json({ error: "Unable to complete call. Check database configuration and server logs." }, { status: 500 });
  }
}
