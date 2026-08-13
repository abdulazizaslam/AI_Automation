import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const db = getSupabaseAdmin();

    // 1. Delete all appointments, qualifications, and calls
    const [aptRes, qualRes, callRes] = await Promise.all([
      db.from("appointments").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      db.from("lead_qualifications").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      db.from("calls").delete().neq("id", "00000000-0000-0000-0000-000000000000")
    ]);

    // 2. Reset lead statuses back to 'new' (preserving all leads in the table)
    await db.from("leads").update({ lead_status: "new" }).neq("id", "00000000-0000-0000-0000-000000000000");

    // 3. Clear local in-memory fallback stores
    const globalAny = globalThis as any;
    if (globalAny.mockStore) {
      globalAny.mockStore.calls = [];
      globalAny.mockStore.qualifications = [];
      globalAny.mockStore.appointments = [];
      if (globalAny.mockStore.leads) {
        globalAny.mockStore.leads.forEach((l: any) => { l.lead_status = "new"; });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Database cleaned and reset successfully. All leads are preserved."
    });
  } catch (error) {
    console.error("reset-db error:", error);
    return NextResponse.json({ error: "Failed to reset database" }, { status: 500 });
  }
}
