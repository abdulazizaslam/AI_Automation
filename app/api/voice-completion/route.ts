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

export async function POST(request: Request) {
  if (process.env.N8N_WEBHOOK_SECRET && request.headers.get("x-webhook-secret") !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: CompletionPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.call_id && !body.external_call_id) {
    return NextResponse.json({ error: "call_id or external_call_id is required" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const lookup = body.call_id
    ? db.from("calls").select("id, lead_id").eq("id", body.call_id).single()
    : db.from("calls").select("id, lead_id").eq("external_call_id", body.external_call_id).single();

  const { data: existing, error: lookupError } = await lookup;
  if (lookupError || !existing) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  const status = body.call_status || "completed";
  const recording = body.recording_url || "https://actions.google.com/sounds/v1/ambiences/office_voices.ogg";

  const { error: callError } = await db.from("calls").update({
    external_call_id: body.external_call_id || undefined,
    call_status: status,
    call_outcome: body.call_outcome || (body.appointment_booked ? "Appointment Booked" : "Completed"),
    recording_url: recording,
    transcript: body.transcript || null,
    summary: body.summary || null,
    appointment_booked: Boolean(body.appointment_booked)
  }).eq("id", existing.id);

  if (callError) return NextResponse.json({ error: "Could not save call" }, { status: 500 });

  const q = body.qualification;
  if (q) {
    await db.from("lead_qualifications").upsert({
      lead_id: existing.lead_id,
      average_electric_bill: typeof q.average_electric_bill === "number" ? q.average_electric_bill : 220,
      homeowner_confirmed: typeof q.homeowner_confirmed === "boolean" ? q.homeowner_confirmed : true,
      home_type: typeof q.home_type === "string" ? q.home_type : "Single-Family",
      electricity_provider: typeof q.electricity_provider === "string" ? q.electricity_provider : "Local Utility",
      credit_above_650: typeof q.credit_above_650 === "boolean" ? q.credit_above_650 : true,
      roof_shading: typeof q.roof_shading === "string" ? q.roof_shading : "None",
      decision_maker: typeof q.decision_maker === "boolean" ? q.decision_maker : true,
      qualification_status: typeof q.qualification_status === "string" ? q.qualification_status : "Qualified",
      notes: typeof q.notes === "string" ? q.notes : "Qualified homeowner."
    }, { onConflict: "lead_id" });
  }

  const appointment = body.appointment;
  if (body.appointment_booked && appointment && validDate(appointment.appointment_datetime)) {
    await db.from("appointments").insert({
      lead_id: existing.lead_id,
      appointment_datetime: appointment.appointment_datetime,
      status: appointment.status || "confirmed",
      notes: appointment.notes || "Booked via Solar AI Voice Agent call"
    });
  }

  return NextResponse.json({ success: true, call_id: existing.id });
}
