import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OPENAI_VOICES = new Set([
  "alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer", "verse", "marin", "cedar"
]);

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  return origin === new URL(request.url).origin;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const text = typeof body?.text === "string" ? body.text.trim().slice(0, 1500) : "";
    const requestedVoice = typeof body?.voice === "string" ? body.voice : "alloy";
    const voice = OPENAI_VOICES.has(requestedVoice) ? requestedVoice : "alloy";

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const elevenlabsKey = process.env.ELEVENLABS_API_KEY?.trim();
    const openaiKey = process.env.OPENAI_API_KEY?.trim();

    if (elevenlabsKey) {
      const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || "21m00Tcm4TlvDq8ikWAM";
      const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_flash_v2_5";

      try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": elevenlabsKey,
            Accept: "audio/mpeg"
          },
          body: JSON.stringify({
            text,
            model_id: modelId,
            voice_settings: { stability: 0.5, similarity_boost: 0.75 }
          }),
          signal: AbortSignal.timeout(15000),
          cache: "no-store"
        });

        if (response.ok) {
          return new NextResponse(await response.arrayBuffer(), {
            headers: {
              "Content-Type": "audio/mpeg",
              "Cache-Control": "no-store"
            }
          });
        }

        console.warn("ElevenLabs TTS returned:", response.status);
      } catch (error) {
        console.warn("ElevenLabs TTS notice:", error);
      }
    }

    if (openaiKey) {
      const model = process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts";

      try {
        const response = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model,
            input: text,
            voice,
            speed: 1.0
          }),
          signal: AbortSignal.timeout(15000),
          cache: "no-store"
        });

        if (response.ok) {
          return new NextResponse(await response.arrayBuffer(), {
            headers: {
              "Content-Type": "audio/mpeg",
              "Cache-Control": "no-store"
            }
          });
        }

        console.warn("OpenAI TTS returned:", response.status);
      } catch (error) {
        console.warn("OpenAI TTS notice:", error);
      }
    }

    return NextResponse.json({ fallback: "use_browser_natural_voice" }, { status: 200 });
  } catch (error) {
    console.error("TTS generation error:", error);
    return NextResponse.json({ fallback: "use_browser_natural_voice" }, { status: 200 });
  }
}
