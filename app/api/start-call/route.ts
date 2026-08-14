import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function createCallToken(callId: string) {
  const secret = process.env.CALL_COMPLETION_SECRET || process.env.N8N_WEBHOOK_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(callId).digest("hex");
}

function getRequestOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";

  if (host) return `${forwardedProto}://${host}`;
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    const db = getSupabaseAdmin();

    const [leadsRes, callsRes] = await Promise.all([
      db.from("leads").select("*"),
      db.from("calls").select("lead_id, created_at").order("created_at", { ascending: false })
    ]);

    if (leadsRes.error) throw leadsRes.error;
    if (callsRes.error) throw callsRes.error;

    const leads = leadsRes.data || [];
    if (!leads.length) {
      return NextResponse.json({ error: "No leads available. Check your Supabase configuration and leads table." }, { status: 404 });
    }

    const calledLeadIdSet = new Set((callsRes.data || []).map((c: { lead_id: string }) => c.lead_id));
    const uncalledLeads = leads.filter((lead: { id: string }) => !calledLeadIdSet.has(lead.id));
    const pool = uncalledLeads.length > 0 ? uncalledLeads : leads;
    const lead = pool[Math.floor(Math.random() * pool.length)];
    const address = lead.property_address || lead.address || "101 Solar Way";

    const { error: leadUpdateError } = await db
      .from("leads")
      .update({ lead_status: "in_progress" })
      .eq("id", lead.id);
    if (leadUpdateError) throw leadUpdateError;

    const { data: call, error: callError } = await db
      .from("calls")
      .insert({ lead_id: lead.id, call_status: "in_progress", call_outcome: "Call initiated" })
      .select("id, lead_id, call_status")
      .single();

    if (callError || !call) {
      await db.from("leads").update({ lead_status: "new" }).eq("id", lead.id);
      throw callError || new Error("Call record was not created");
    }

    const webhookUrl = process.env.N8N_START_CALL_WEBHOOK_URL?.trim();
    let n8nTriggered = false;
    let n8nStatus: number | null = null;

    if (webhookUrl) {
      try {
        const publicOrigin = getRequestOrigin(request);
        const payload = {
          call_id: call.id,
          lead: {
            id: lead.id,
            first_name: lead.first_name,
            last_name: lead.last_name,
            phone: lead.phone,
            email: lead.email,
            property_address: address
          },
          callback_url: `${publicOrigin}/api/voice-completion`
        };

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (process.env.N8N_WEBHOOK_SECRET) headers["x-webhook-secret"] = process.env.N8N_WEBHOOK_SECRET;

        const n8nRes = await fetch(webhookUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
          cache: "no-store"
        });

        n8nStatus = n8nRes.status;
        n8nTriggered = n8nRes.ok;
        if (!n8nRes.ok) {
          console.warn("n8n webhook returned non-success status:", n8nRes.status);
        }
      } catch (err) {
        console.warn("n8n webhook call notice:", err);
      }
    }

    const remainingUncalledCount = Math.max(0, uncalledLeads.length - 1);
    const response = NextResponse.json({
      success: true,
      call_id: call.id,
      lead: {
        id: lead.id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        phone: lead.phone,
        email: lead.email,
        property_address: address
      },
      n8n_triggered: n8nTriggered,
      n8n_status: n8nStatus,
      remaining_uncalled: remainingUncalledCount,
      message: `Started call with ${lead.first_name} ${lead.last_name}. (${remainingUncalledCount} uncalled leads remaining)`
    });

    response.headers.set("Cache-Control", "no-store");

    const callToken = createCallToken(call.id);
    if (callToken) {
      response.cookies.set("solar_call_token", `${call.id}.${callToken}`, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/api/voice-completion",
        maxAge: 60 * 60
      });
    }

    return response;
  } catch (error) {
    console.error("start-call route error:", error);
    return NextResponse.json({ error: "Unable to start AI call. Check database configuration and server logs." }, { status: 500 });
  }
}
