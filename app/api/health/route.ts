import { NextResponse } from "next/server";
import { getSupabaseAdmin, getSupabaseConfig } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = getSupabaseConfig();
  let databaseOk = false;
  let databaseError: string | null = null;

  try {
    const db = getSupabaseAdmin();
    const { error } = await db.from("leads").select("id").limit(1);
    if (error) throw error;
    databaseOk = true;
  } catch (error) {
    databaseError = error instanceof Error ? error.message : "Database check failed";
  }

  const body = {
    ok: databaseOk,
    database: {
      ok: databaseOk,
      mode: supabase.mode,
      configured: Boolean(supabase.url && supabase.key),
      error: databaseError
    },
    services: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      n8n: Boolean(process.env.N8N_START_CALL_WEBHOOK_URL),
      livekit: Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET),
      elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
      openai_tts: Boolean(process.env.OPENAI_API_KEY)
    },
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown"
  };

  const response = NextResponse.json(body, { status: databaseOk ? 200 : 503 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
