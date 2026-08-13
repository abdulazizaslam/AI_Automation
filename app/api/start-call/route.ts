import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const db = getSupabaseAdmin();
    const { data: leads, error: leadError } = await db.from("leads").select("id, first_name, last_name, phone, email, property_address, address");
    if (leadError) throw leadError;
    if (!leads || !leads.length) return NextResponse.json({ error: "No test leads available" }, { status: 404 });

    // Step 1 & 2: Read test leads from Supabase and randomly select one
    const lead = leads[Math.floor(Math.random() * leads.length)];
    const address = lead.property_address || lead.address || "101 Sunflower Ave";

    // Step 3: Insert initial call record
    const { data: call, error: callError } = await db
      .from("calls")
      .insert({ lead_id: lead.id, call_status: "in_progress", call_outcome: "Call initiated" })
      .select("id, lead_id, call_status")
      .single();

    if (callError) throw callError;

    const webhookUrl = process.env.N8N_START_CALL_WEBHOOK_URL;
    let n8nTriggered = false;

    // Step 4 & 5: If n8n webhook URL is set, send selected lead to n8n
    if (webhookUrl) {
      try {
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
          callback_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/voice-completion`
        };

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (process.env.N8N_WEBHOOK_SECRET) headers["x-webhook-secret"] = process.env.N8N_WEBHOOK_SECRET;

        const n8nRes = await fetch(webhookUrl, { method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
        if (n8nRes.ok) n8nTriggered = true;
      } catch (err) {
        console.warn("n8n webhook call notice:", err);
      }
    }

    return NextResponse.json({
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
      message: `Voice call started with random test lead: ${lead.first_name} ${lead.last_name}`
    });
  } catch (error) {
    console.error("start-call route error:", error);
    return NextResponse.json({ error: "Unable to start AI call" }, { status: 500 });
  }
}
