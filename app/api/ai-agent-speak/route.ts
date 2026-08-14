import { NextResponse } from "next/server";
import {
  SOLAR_SYSTEM_PROMPT,
  buildDeterministicResponse,
  findObjection,
  type ConversationTurn
} from "@/lib/solar-script";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LeadInput = {
  first_name?: string;
  property_address?: string | null;
  address?: string | null;
  phone?: string | null;
};

function normalizeHistory(value: unknown): ConversationTurn[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is { role: string; content: string } =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as { role?: unknown }).role === "string" &&
      typeof (item as { content?: unknown }).content === "string"
    )
    .filter(item => item.role === "assistant" || item.role === "user")
    .map(item => ({
      role: item.role as "assistant" | "user",
      content: item.content.slice(0, 5000)
    }))
    .slice(-30);
}

function cleanAgentMessage(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  return text ? text.slice(0, 3000) : null;
}

async function optionallyPolishWithGemini(args: {
  firstName: string;
  address: string;
  history: ConversationTurn[];
  userUtterance: string;
  controlledMessage: string;
}) {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const allowParaphrase = process.env.GEMINI_ALLOW_PARAPHRASE === "true";
  if (!geminiKey || !allowParaphrase) return null;

  const { firstName, address, history, userUtterance, controlledMessage } = args;
  const systemText = SOLAR_SYSTEM_PROMPT
    .replace(/\[NAME\]/g, firstName)
    .replace(/\[ADDRESS\]/g, address);

  const historyText = history
    .map(turn => `${turn.role === "assistant" ? "Alex" : firstName}: ${turn.content}`)
    .join("\n")
    .slice(-15000);

  const prompt = `${systemText}\n\nCONVERSATION HISTORY:\n${historyText}\n\nLATEST HOMEOWNER STATEMENT:\n${userUtterance || "(call just started)"}\n\nCONTROLLED NEXT TURN:\n${controlledMessage}\n\nYou may make the CONTROLLED NEXT TURN sound slightly more natural, but you MUST preserve its exact question/goal, must not add new claims, must not repeat answered questions, and must not book an appointment unless the controlled turn does. Return JSON only: {"agent_message":"..."}`;

  const models = Array.from(new Set([
    process.env.GEMINI_MODEL?.trim(),
    "gemini-2.5-flash",
    "gemini-flash-latest"
  ].filter((value): value is string => Boolean(value))));

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2,
              maxOutputTokens: 500
            }
          }),
          signal: AbortSignal.timeout(12000),
          cache: "no-store"
        }
      );

      if (!response.ok) {
        console.warn(`Gemini model ${model} returned ${response.status}`);
        continue;
      }

      const data = await response.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof raw !== "string") continue;

      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(cleaned) as { agent_message?: unknown };
      const message = cleanAgentMessage(parsed.agent_message);
      if (message) return message;
    } catch (error) {
      console.warn(`Gemini model ${model} notice:`, error);
    }
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const lead = (body?.lead || {}) as LeadInput;
    const conversationHistory = normalizeHistory(body?.conversationHistory);
    const userUtterance = typeof body?.userUtterance === "string"
      ? body.userUtterance.slice(0, 5000)
      : "";

    const firstName = lead.first_name?.trim() || "there";
    const address = lead.property_address?.trim() || lead.address?.trim() || "your property";
    const phone = lead.phone?.trim() || "";

    const controlled = buildDeterministicResponse({
      firstName,
      address,
      phone,
      conversationHistory,
      userUtterance
    });

    const objection = findObjection(userUtterance, address);
    const canParaphrase = !objection && !controlled.call_completed && !controlled.appointment.booked;

    if (canParaphrase) {
      const polished = await optionallyPolishWithGemini({
        firstName,
        address,
        history: conversationHistory,
        userUtterance,
        controlledMessage: controlled.agent_message
      });

      if (polished) controlled.agent_message = polished;
    }

    const response = NextResponse.json(controlled);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("ai-agent-speak error:", error);
    return NextResponse.json({ error: "Failed to process conversation turn" }, { status: 500 });
  }
}
