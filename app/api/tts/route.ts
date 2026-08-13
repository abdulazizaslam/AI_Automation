import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { text, voice = "alloy" } = await request.json();
    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    const elevenlabsKey = process.env.ELEVENLABS_API_KEY;

    // 1. ElevenLabs High-Definition Voice (if configured)
    if (elevenlabsKey) {
      const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Rachel / Alex
      const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": elevenlabsKey
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_monolingual_v1",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
      });
      if (elRes.ok) {
        const audioBuffer = await elRes.arrayBuffer();
        return new NextResponse(audioBuffer, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "public, max-age=3600"
          }
        });
      }
    }

    // 2. OpenAI Natural Human TTS (if configured)
    if (openaiKey) {
      const oaiRes = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: "tts-1",
          input: text,
          voice: voice || "alloy",
          speed: 1.0
        })
      });
      if (oaiRes.ok) {
        const audioBuffer = await oaiRes.arrayBuffer();
        return new NextResponse(audioBuffer, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "public, max-age=3600"
          }
        });
      }
    }

    // Fallback indicator so client uses prioritized browser Neural/Natural voices
    return NextResponse.json({ fallback: "use_browser_natural_voice" });
  } catch (error) {
    console.error("TTS generation error:", error);
    return NextResponse.json({ fallback: "use_browser_natural_voice" });
  }
}
