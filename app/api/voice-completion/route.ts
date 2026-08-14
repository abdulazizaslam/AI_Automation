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

function hasValidBrowserToken(request: Request, callId?: string) {
  if (!callId) return false;
  const secret = process.env.CALL_COMPLETION_SECRET || process.env.N8N_WEBHOOK_SECRET;
  if (!secret) return true;

  const cookie = getCookie(request, "solar_call_token");
  if (!cookie) return false;
  const [cookieCallId, signature] = cookie.split(".");
  if (!cookieCallId || !signature || cookieCallId !== callId) return false;

  const expected = createHmac("sha256", secret).update(callId).digest("hex");
  return safeEqual(signature, expected);
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
      ? db.from("calls").select("id, lead_id").eq("id", body.call_id).single()
      : db.from("calls").select("id, lead_id").eq("external_call_id", body.external_call_id).single();

    const { data: existing, error: lookupError } = await lookup;
    if (lookupError || !existing) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const status = body.call_status || "completed";
    const recording = body.recording_url || null;

    const { error: callError } = await db.from("calls").update({
      external_call_id: body.external_call_id || undefined,
      call_status: status,
      call_outcome: body.call_outcome || (body.appointment_booked ? "Appointment Booked" : "Completed"),
      recording_url: recording,
      transcript: body.transcript || null,
      summary: body.summary || null,
      appointment_booked: Boolean(body.appointment_booked)
    }).eq("id", existing.id);

    if (callError) {
      return NextResponse.json({ error: "Could not save call" }, { status: 500 });
    }

    const qualification = body.qualification;
    if (qualification) {
      const { error: qualificationError } = await db.from("lead_qualifications").upsert({
        lead_id: existing.lead_id,
        average_electric_bill: typeof qualification.average_electric_bill === "number" ? qualification.average_electric_bill : null,
        homeowner_confirmed: typeof qualification.homeowner_confirmed === "boolean" ? qualification.homeowner_confirmed : null,
        home_type: typeof qualification.home_type === "string" ? qualification.home_type : null,
        electricity_provider: typeof qualification.electricity_provider === "string" ? qualification.electricity_provider : null,
        credit_above_650: typeof qualification.credit_above_650 === "boolean" ? qualification.credit_above_650 : null,
        roof_shading: typeof qualification.roof_shading === "string" ? qualification.roof_shading : null,
        decision_maker: typeof qualification.decision_maker === "boolean" ? qualification.decision_maker : null,
        qualification_status: typeof qualification.qualification_status === "string" ? qualification.qualification_status : "Pending",
        notes: typeof qualification.notes === "string" ? qualification.notes : null
      }, { onConflict: "lead_id" });

      if (qualificationError) {
        console.error("qualification save error:", qualificationError);
      }
    }

    const appointment = body.appointment;
    if (body.appointment_booked && appointment && validDate(appointment.appointment_datetime)) {
      const { error: appointmentError } = await db.from("appointments").insert({
        lead_id: existing.lead_id,
        appointment_datetime: appointment.appointment_datetime,
        status: appointment.status || "confirmed",
        notes: appointment.notes || "Booked via Solar AI Voice Agent call"
      });

      if (appointmentError) {
        return NextResponse.json({ error: "Call saved, but appointment could not be saved" }, { status: 500 });
      }
    }

    await db.from("leads").update({
      lead_status: body.appointment_booked ? "appointment_booked" : status
    }).eq("id", existing.lead_id);

    const response = NextResponse.json({ success: true, call_id: existing.id });
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
    return NextResponse.json({ error: "Unable to complete call" }, { status: 500 });
  }
}
