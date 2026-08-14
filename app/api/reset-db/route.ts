import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DB_RESET !== "true") {
    return NextResponse.json(
      { error: "Database reset is disabled in production" },
      { status: 403 }
    );
  }

  try {
    const db = getSupabaseAdmin();

    const [aptRes, qualRes, callRes] = await Promise.all([
      db.from("appointments").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      db.from("lead_qualifications").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      db.from("calls").delete().neq("id", "00000000-0000-0000-0000-000000000000")
    ]);

    const deleteError = aptRes.error || qualRes.error || callRes.error;
    if (deleteError) throw deleteError;

    const { error: leadResetError } = await db
      .from("leads")
      .update({ lead_status: "new" })
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (leadResetError) throw leadResetError;

    return NextResponse.json({
      success: true,
      message: "Database cleaned and reset successfully. All leads are preserved."
    });
  } catch (error) {
    console.error("reset-db error:", error);
    return NextResponse.json({ error: "Failed to reset database" }, { status: 500 });
  }
}
