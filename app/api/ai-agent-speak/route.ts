import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SYSTEM_PROMPT = `
You are Alex, an expert, natural, human-sounding Solar AI Voice Agent on a live phone call with homeowner [NAME] at [ADDRESS].

CRITICAL REALTIME VOICE RULES:
1. Speak in SHORT, natural human dialogue (1 to 2 sentences max, 10-25 words).
2. Never deliver long paragraphs or monologues. Real people talk in quick conversational turns.
3. Ask ONE clear question at a time and wait for their response.
4. Follow the 8-Step Solar Consultation Script and disarm objections using the A.I.R. (Agree, Ignore, Resume) framework.

8-STEP SCRIPT FLOW:
1. Hook: "Hey [NAME]? How's it going? This is Alex. We're working right in the neighborhood. Are you the owner of [ADDRESS]?"
2. Reason: "We're notifying neighbors about rate hikes and the SGIP savings program. Is your monthly electric bill over $150?"
3. Qualifying: Confirm single-family home, roof ownership, 650+ credit score, no heavy tree shading.
4. Bill Swap: "We swap that high utility bill for a locked solar payment 20 to 50% lower with zero upfront cost."
5. Decision Makers: Confirm spouse/partner will be present.
6. Set Appointment: Offer morning or afternoon (e.g., Friday 3:00 PM).
7. Lock & Confirm: Check conflicts and confirm phone number.
8. Recap & Close: Confirm appointment date/time, have bill ready, all decision makers present.

OBJECTIONS (A.I.R. - Agree, Ignore, Resume):
- "Not interested": "Totally understand, [NAME]. I'm not trying to sell you anything today. We're just checking if your home qualifies for the SGIP rate reduction. Is your bill over $150 a month?"
- "Busy / driving": "Got it, I'll keep this under 20 seconds. Do you own this single-family home?"
- "Send email": "Sure! What's your email? Quick question first—is your average electric bill over $150?"
- "Call back": "No problem! Before I let you go—do you still live at [ADDRESS]?"
- "Holes in roof": "We use K2 racking with dual seals and a 10-year roof warranty. Is your bill currently over $150/mo?"
- "Old roof": "We can actually bundle a new roof directly into the project for zero out of pocket. Does morning or afternoon work better?"
- "ROI / cost": "There's zero upfront investment—it's a direct bill swap so you save from month one."
- "Renters": "Got it. This program is for homeowners, but we can speak with your landlord if you'd like!"

JSON OUTPUT FORMAT:
{
  "agent_message": "Short 1-2 sentence spoken reply",
  "qualification": {
    "average_electric_bill": 220,
    "homeowner_confirmed": true,
    "home_type": "Single-Family",
    "electricity_provider": "Local Utility",
    "credit_above_650": true,
    "roof_shading": "None",
    "decision_maker": true,
    "qualification_status": "Qualified" | "Disqualified" | "Pending",
    "notes": "Brief qualification note"
  },
  "appointment": {
    "booked": true | false,
    "appointment_datetime": "2026-08-17T15:00:00.000Z",
    "status": "confirmed",
    "notes": "Consultation details"
  },
  "call_completed": true | false,
  "summary": "Short 2-sentence call summary"
}
`;

export async function POST(request: Request) {
  try {
    const { lead, conversationHistory = [], userUtterance = "" } = await request.json();

    const firstName = lead?.first_name || "there";
    const address = lead?.property_address || lead?.address || "your property";

    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    // 1. Google Gemini 2.0 Flash Realtime Call (Ultra-low latency streaming)
    if (geminiKey) {
      try {
        const systemText = SYSTEM_PROMPT.replace(/\[NAME\]/g, firstName).replace(/\[ADDRESS\]/g, address);
        const historyContext = conversationHistory.slice(-6).map((h: any) => `${h.role === "assistant" ? "Alex" : firstName}: ${h.content}`).join("\n");
        const currentInput = userUtterance ? `${firstName}: ${userUtterance}` : "(User picked up the phone. Deliver the Step 1 Hook now in under 20 words)";

        const promptText = `SYSTEM INSTRUCTIONS:\n${systemText}\n\nCONVERSATION SO FAR:\n${historyContext}\n\nLATEST USER STATEMENT:\n${currentInput}\n\nProvide the brief 1-2 sentence conversational response in strict JSON:`;

        const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2,
              maxOutputTokens: 300
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (raw) {
            const parsed = JSON.parse(raw);
            return NextResponse.json(parsed);
          }
        }
      } catch (e) {
        console.error("Gemini API call notice:", e);
      }
    }

    // 2. OpenAI Fallback (if configured)
    if (openaiKey) {
      try {
        const messages = [
          { role: "system", content: SYSTEM_PROMPT.replace(/\[NAME\]/g, firstName).replace(/\[ADDRESS\]/g, address) },
          ...conversationHistory.slice(-6).map((h: any) => ({ role: h.role, content: h.content }))
        ];
        if (userUtterance) messages.push({ role: "user", content: userUtterance });

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages,
            max_tokens: 250,
            temperature: 0.3
          })
        });
        if (res.ok) {
          const json = await res.json();
          return NextResponse.json(JSON.parse(json.choices[0].message.content));
        }
      } catch (e) {
        console.error("OpenAI call notice:", e);
      }
    }

    // 3. Ultra-Fast Built-in Conversational Heuristics (Instant <50ms response)
    const text = (userUtterance || "").toLowerCase().trim();
    let agent_message = "";
    let call_completed = false;
    let appointment_booked = false;
    let appointment_datetime: string | null = null;
    let qualification_status = "Pending";
    let notes = "Call in progress";

    if (!userUtterance && conversationHistory.length === 0) {
      agent_message = `Hey ${firstName}? How's it going? This is Alex. Are you the homeowner at ${address}?`;
    } else if (text.includes("not interested") || text.includes("don't want")) {
      agent_message = `Totally understand, ${firstName}. I'm not selling anything today—we're just notifying neighbors about SGIP utility savings. Is your electric bill over $150 a month?`;
    } else if (text.includes("busy") || text.includes("no time") || text.includes("driving")) {
      agent_message = `Got it, I'll keep this under 20 seconds. Do you own this single-family home?`;
    } else if (text.includes("email") || text.includes("send me")) {
      agent_message = `Sure! What's your email address? And roughly what is your average monthly electric bill?`;
    } else if (text.includes("call me back") || text.includes("call later")) {
      agent_message = `Of course! Just before I let you go—do you still live at ${address}?`;
    } else if (text.includes("holes") || text.includes("roof") || text.includes("leak")) {
      agent_message = `We use K2 racking with dual seals and a 10-year roof warranty, so you're 100% covered. Is your bill currently over $150 a month?`;
    } else if (text.includes("old roof") || text.includes("replace roof")) {
      agent_message = `We can actually bundle a brand-new roof directly into the project with zero out of pocket. Does morning or afternoon work better for an engineer visit?`;
    } else if (text.includes("rent") || text.includes("tenant")) {
      agent_message = `Got it! This program is for homeowners, but we can speak with your landlord so they get the tax credit.`;
      call_completed = true;
      qualification_status = "Disqualified";
      notes = "Renter.";
    } else if (
      text.includes("friday") || text.includes("saturday") || text.includes("tomorrow") ||
      text.includes("morning") || text.includes("afternoon") || text.includes("3 pm") ||
      text.includes("book") || text.includes("schedule") || text.includes("sounds good")
    ) {
      appointment_booked = true;
      call_completed = true;
      qualification_status = "Qualified";
      const nextDate = new Date(Date.now() + 86400000 * 2);
      nextDate.setHours(15, 0, 0, 0);
      appointment_datetime = nextDate.toISOString();
      agent_message = `Awesome ${firstName}! I have this Friday at 3:00 PM locked in for our engineer David to stop by. Please keep your electric bill handy. Have a great day!`;
      notes = `Booked consultation for Friday 3:00 PM.`;
    } else if (text.includes("yes") || text.includes("own") || text.includes("i do") || text.includes("150") || text.includes("200")) {
      qualification_status = "Qualified";
      agent_message = `Fantastic. We swap that high electric bill for a locked solar payment 20 to 50% cheaper with zero upfront cost. Does morning or afternoon work better for a quick 10-minute review?`;
    } else {
      agent_message = `Got it, ${firstName}. Is your average electric bill currently over $150 a month?`;
    }

    const scheduledDate = appointment_datetime || new Date(Date.now() + 86400000 * 2).toISOString();

    return NextResponse.json({
      agent_message,
      qualification: {
        average_electric_bill: 220,
        homeowner_confirmed: true,
        home_type: "Single-Family",
        electricity_provider: "Local Utility",
        credit_above_650: true,
        roof_shading: "None",
        decision_maker: true,
        qualification_status,
        notes
      },
      appointment: {
        booked: appointment_booked,
        appointment_datetime: scheduledDate,
        status: "confirmed",
        notes: appointment_booked ? `Confirmed consultation on ${new Date(scheduledDate).toLocaleString()}` : "Pending confirmation"
      },
      call_completed,
      summary: `${firstName} at ${address}. ${appointment_booked ? "Appointment booked for Friday." : "Consultation in progress."}`
    });
  } catch (error) {
    console.error("ai-agent-speak error:", error);
    return NextResponse.json({ error: "Failed to process turn" }, { status: 500 });
  }
}
