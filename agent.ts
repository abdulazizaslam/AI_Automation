import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

if (!process.env.GOOGLE_API_KEY && process.env.GEMINI_API_KEY) {
  process.env.GOOGLE_API_KEY = process.env.GEMINI_API_KEY;
}

import { defineAgent, WorkerOptions, cli, type JobContext, voice } from "@livekit/agents";
import * as google from "@livekit/agents-plugin-google";
import { fileURLToPath } from "node:url";
import { OBJECTIONS, SOLAR_SYSTEM_PROMPT } from "./lib/solar-script";

const objectionInstructions = OBJECTIONS
  .map((item, index) => {
    const triggers = item.patterns.map(pattern => pattern.source).join(" | ");
    return `${index + 1}. Trigger: ${triggers}\nEXACT RESPONSE: ${item.response}`;
  })
  .join("\n\n");

const SOLAR_SCRIPT_INSTRUCTIONS = `${SOLAR_SYSTEM_PROMPT}

FULL OBJECTION HANDLING SHEET — EXACT WORDING REQUIRED
When a caller raises any matching objection below, use the EXACT RESPONSE verbatim. Do not shorten, paraphrase, or combine it with invented claims. After the rebuttal, resume the next unanswered script step on the following conversational turn.

${objectionInstructions}

LIVE VOICE RULES:
- Start immediately with Step 1 Opening.
- Ask qualification questions one at a time and remember every answer for the full call.
- Do not assume homeowner status, bill amount, home type, roof ownership, credit, shading, utility provider, or decision-maker status.
- Do not book merely because the caller says morning, afternoon, or a weekday. Offer a specific slot first and get explicit acceptance.
- Complete Step 7 confirmation before Step 8 recap and close.
- If the caller is not the homeowner or otherwise clearly disqualified, close politely without booking.
- Exact objection wording takes priority over the short-response rule.
- For ordinary turns, speak naturally and briefly.`;

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();

    console.log("LiveKit Solar Voice Agent connected to room:", ctx.room.name);

    const session = new voice.AgentSession({
      llm: new google.beta.realtime.RealtimeModel({
        model: process.env.GEMINI_LIVE_MODEL || "gemini-2.5-flash-native-audio-preview-12-2025",
        voice: "Aoede",
        temperature: 0.2,
        instructions: SOLAR_SCRIPT_INSTRUCTIONS,
      }),
    });

    const agent = new voice.Agent();
    await session.start({ agent, room: ctx.room });
    await session.generateReply();

    console.log("Solar Voice Agent is live and speaking in room:", ctx.room.name);
  },
});

cli.runApp(new WorkerOptions({
  agent: fileURLToPath(import.meta.url),
  wsUrl: process.env.LIVEKIT_URL,
  apiKey: process.env.LIVEKIT_API_KEY,
  apiSecret: process.env.LIVEKIT_API_SECRET,
}));
