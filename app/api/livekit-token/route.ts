import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { lead, roomName } = await request.json();

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: "LiveKit credentials not configured" }, { status: 500 });
    }

    const participantName = `${lead?.first_name || "User"} ${lead?.last_name || ""}`.trim();
    const room = roomName || `solar-call-${Date.now()}`;

    // Create access token for the user participant
    const token = new AccessToken(apiKey, apiSecret, {
      identity: `user-${lead?.id || Date.now()}`,
      name: participantName,
    });

    token.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();

    return NextResponse.json({
      token: jwt,
      room,
      url: process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL,
    });
  } catch (error) {
    console.error("LiveKit token generation error:", error);
    return NextResponse.json({ error: "Failed to generate LiveKit token" }, { status: 500 });
  }
}
