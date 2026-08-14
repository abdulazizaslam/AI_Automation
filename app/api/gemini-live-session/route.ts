import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      error: "Direct browser Gemini Live sessions are disabled because they expose provider credentials. Use the server-side LiveKit agent or /api/ai-agent-speak flow instead."
    },
    { status: 410 }
  );
}
