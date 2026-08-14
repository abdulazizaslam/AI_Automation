import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isSameOriginBrowserRequest(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (origin && origin !== requestOrigin) return false;
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) return false;

  return Boolean(origin || fetchSite);
}

export async function POST(request: Request) {
  const explicitlyEnabled = process.env.ALLOW_DB_RESET === "true";
  const sameOriginRequest = isSameOriginBrowserRequest(request);

  if (process.env.NODE_ENV === "production" && !explicitlyEnabled && !sameOriginRequest) {
    return NextResponse.json(
      { error: "Database reset is only allowed from the app UI in production" },
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

    const response = NextResponse.json({
      success: true,
      message: "Database cleaned and reset successfully. All leads are preserved."
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("reset-db error:", error);
    return NextResponse.json({ error: "Failed to reset database. Check Supabase permissions and server logs." }, { status: 500 });
  }
}
