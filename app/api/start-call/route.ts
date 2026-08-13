import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const db = getSupabaseAdmin();

    // 1. Fetch all leads and existing calls from Supabase
    const [leadsRes, callsRes] = await Promise.all([
      db.from("leads").select("*"),
      db.from("calls").select("lead_id, created_at").order("created_at", { ascending: false })
    ]);

    if (leadsRes.error) throw leadsRes.error;
    const leads = leadsRes.data || [];
    if (!leads.length) {
      return NextResponse.json({ error: "No leads available in Supabase" }, { status: 404 });
    }

    // 2. Identify which leads have already been called
    const calledLeadIdSet = new Set((callsRes.data || []).map(c => c.lead_id));
    const uncalledLeads = leads.filter(l => !calledLeadIdSet.has(l.id));

    // 3. Pick a random UNCALLED lead first until all leads are done.
    // If all leads have been called, cycle through all leads randomly.
    const pool = uncalledLeads.length > 0 ? uncalledLeads : leads;
    const lead = pool[Math.floor(Math.random() * pool.length)];
    const address = lead.property_address || lead.address || "101 Solar Way";

    // 4. Update lead status in Supabase
    await db.from("leads").update({ lead_status: "in_progress" }).eq("id", lead.id);

    // 5. Insert call record
    const { data: call, error: callError } = await db
      .from("calls")
      .insert({ lead_id: lead.id, call_status: "in_progress", call_outcome: "Call initiated" })
      .select("id, lead_id, call_status")
      .single();

    if (callError) throw callError;

    const webhookUrl = process.env.N8N_START_CALL_WEBHOOK_URL;
    let n8nTriggered = false;

    // 6. Optional n8n Webhook trigger
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

        const n8nRes = await fetch(webhookUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000)
        });
        if (n8nRes.ok) n8nTriggered = true;
      } catch (err) {
        console.warn("n8n webhook call notice:", err);
      }
    }

    const remainingUncalledCount = Math.max(0, uncalledLeads.length - 1);

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
      remaining_uncalled: remainingUncalledCount,
      message: `Started call with ${lead.first_name} ${lead.last_name}. (${remainingUncalledCount} uncalled leads remaining)`
    });
  } catch (error) {
    console.error("start-call route error:", error);
    return NextResponse.json({ error: "Unable to start AI call" }, { status: 500 });
  }
}
