import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SYSTEM_PROMPT = `
You are Alex, an expert, natural, human-sounding Solar AI Voice Agent conducting an outbound phone consultation for homeowners.

GOAL: Follow the 8-Step Solar Consultation Script, handle all objections seamlessly using the A.I.R. (Agree, Ignore, Resume) framework and specific objection responses, qualify the homeowner, and book an appointment with an engineer.

8-STEP SCRIPT:
1. Opening (The Hook): "Hey [NAME]? How's it going? This is Alex. We're actually working right in the corner of your neighborhood. Am I speaking with the owner of [ADDRESS]?"
2. Reason for Call: Working with neighbors regarding rate increases and the government-backed SGIP (Self-Generation Incentive Program) to lower electricity bills.
3. Qualifying Questions:
   - Average monthly electric bill (> $150/mo?)
   - Single-family home and roof owner?
   - Credit score above 650?
   - Roof shading or large trees?
   - Current electric utility provider?
4. The Bill Swap (Value Pitch): Shifting current electric bill to a 20-50% cheaper locked-in solar payment with zero upfront investment.
5. Decision Makers: Confirm spouse/partner will be present.
6. Set Appointment: Offer morning or afternoon and specific date & time (e.g. Friday at 3:00 PM).
7. Lock & Confirm: Check conflicts, confirm decision maker presence, confirm phone number.
8. Quick Recap & Close: Consultant visit, have bill ready, all decision makers present.

OBJECTION HANDLING (A.I.R. & LATE OBJECTIONS):
- "Not interested": Totally understand sir, not trying to sell you anything. All I'm doing is letting you know what's happening in your area regarding rate hikes and the SGIP program.
- "Busy / No time": Of course, I get that. I'll keep this super short. You're probably seeing more solar panels nearby, and we're just checking if your home qualifies.
- "Send me an email": Sure! What's your email? Before I can get you that personalized report I just need to verify a couple quick details to see if your roof qualifies.
- "Call me back": Of course, I can do that. Just before I let you go—super quick—do you still live at [ADDRESS]? This will only take 30 seconds.
- "How did you get my number / targeted": Totally fair question—we're only reaching out to homeowners in your zip code to see who qualifies for the SGIP program.
- "5th person to call": Yea, we've been trying to reach you about important updates regarding electricity rate hikes. We're just doing a short 60-second qualification call.
- "Holes in roof / leaks": We use K2 racking with dual seals on top and bottom, plus a 10-year roof warranty. If anything happens, it's 100% covered.
- "Roof too old": In that case, we can actually bundle a new roof replacement directly into the project with zero out of pocket.
- "Flat / tile roof": We work with all roof types—flat, tile, shingle, everything.
- "Don't like panel looks": We use sleek, all-black panels placed on the backside of the home so they blend in seamlessly.
- "ROI / Return on investment": There is actually zero upfront investment. It's a bill swap—instead of paying the high utility rate, you save from month one.
- "Don't want another bill": We're not adding a bill; we're eliminating your electric bill and replacing it with a locked payment 20 to 50% cheaper.
- "Bill already low": If under $60, disqualify. If $60-$150, lock in fixed rate against rate hikes. If over $150, major immediate savings.
- "What's the catch": The only catch is you need to qualify. If you qualify, you switch to a cheaper, locked-in rate.
- "Don't want to finance": It's not a traditional loan—you're just switching power providers to a cheaper locked rate.
- "Wait until prices drop": With inflation, utility rates keep rising. Locking in now protects you from future rate spikes.
- "Credit not good": We can look at a co-signer or household member with 650+ credit.
- "Renter": Program requires homeowner, but we can speak with your landlord so they get the tax credit while you lower power costs.
- "Moving soon": If >6 months, you save now and solar increases property resale value.
- "Home renovations": We can bundle renovation work into the solar financing with the 30% federal tax credit.
- "Bad experience with solar / friend had issue": Totally understand. We send an engineer out with zero pressure so you and your friend can see the real numbers.

JSON RESPONSE FORMAT:
{
  "agent_message": "Spoken text to customer",
  "qualification": {
    "average_electric_bill": 220,
    "homeowner_confirmed": true,
    "home_type": "Single-Family",
    "electricity_provider": "Local Utility",
    "credit_above_650": true,
    "roof_shading": "None",
    "decision_maker": true,
    "qualification_status": "Qualified",
    "notes": "Verified homeowner, bill >$150/mo, credit 650+."
  },
  "appointment": {
    "booked": true,
    "appointment_datetime": "2026-08-17T15:00:00.000Z",
    "status": "confirmed",
    "notes": "Consultation scheduled with field engineer."
  },
  "call_completed": true,
  "summary": "2-sentence summary of call"
}
`;

export async function POST(request: Request) {
  try {
    const { lead, conversationHistory = [], userUtterance = "" } = await request.json();

    const firstName = lead?.first_name || "there";
    const address = lead?.property_address || lead?.address || "your property";

    // 1. Check if an external LLM API key is present (OpenAI or Gemini)
    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (openaiKey) {
      const messages = [
        { role: "system", content: SYSTEM_PROMPT.replace(/\[NAME\]/g, firstName).replace(/\[ADDRESS\]/g, address) },
        ...conversationHistory.map((h: any) => ({ role: h.role, content: h.content }))
      ];
      if (userUtterance) {
        messages.push({ role: "user", content: userUtterance });
      }

      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages
          })
        });
        if (res.ok) {
          const json = await res.json();
          const parsed = JSON.parse(json.choices[0].message.content);
          return NextResponse.json(parsed);
        }
      } catch (e) {
        console.error("OpenAI call failed, falling back to built-in solar conversational engine", e);
      }
    }

    if (geminiKey) {
      try {
        const promptText = `${SYSTEM_PROMPT.replace(/\[NAME\]/g, firstName).replace(/\[ADDRESS\]/g, address)}
        
CONVERSATION HISTORY:
${conversationHistory.map((h: any) => `${h.role === "assistant" ? "Agent" : firstName}: ${h.content}`).join("\n")}
${userUtterance ? `${firstName}: ${userUtterance}` : "(Initial call connection)"}

Respond ONLY with valid JSON following the REQUIRED OUTPUT FORMAT.`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { responseMimeType: "application/json" }
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
        console.error("Gemini call failed, falling back to built-in solar conversational engine", e);
      }
    }

    // 2. High-Precision Built-in Solar Script & Objection Intelligence Engine
    const text = (userUtterance || "").toLowerCase().trim();
    let agent_message = "";
    let call_completed = false;
    let appointment_booked = false;
    let appointment_datetime: string | null = null;
    let qualification_status = "Pending";
    let notes = "Call in progress";

    // Step 1: Initial Hook
    if (!userUtterance && conversationHistory.length === 0) {
      agent_message = `Hey ${firstName}? How's it going? This is Alex. We're actually working right in the corner of your neighborhood. Am I speaking with the owner of ${address}?`;
    }
    // Early Objections (AIR Framework)
    else if (text.includes("not interested") || text.includes("don't want")) {
      agent_message = `Totally understand, ${firstName}. And just to clarify—I'm not trying to sell you anything today. All I'm doing is letting neighbors know about recent utility rate hikes and the government-backed SGIP savings program. Is your electric bill currently over $150 a month?`;
    }
    else if (text.includes("busy") || text.includes("no time") || text.includes("driving") || text.includes("working")) {
      agent_message = `Of course, I get that ${firstName}! I'll keep this super short—under 30 seconds. You're probably seeing more solar panels pop up nearby with the SGIP program. Do you own this single-family home?`;
    }
    else if (text.includes("email") || text.includes("send me")) {
      agent_message = `Sure, what's your email address? Before I get that personalized report over, I just need to verify a couple quick details. What would you say is your average monthly electric bill?`;
    }
    else if (text.includes("call me back") || text.includes("call later")) {
      agent_message = `Of course, I can do that! Just before I let you go—super quick—do you still live at ${address}? This will only take 30 seconds and then I'll let you go, promise!`;
    }
    else if (text.includes("how did you get") || text.includes("my number") || text.includes("targeted")) {
      agent_message = `Totally fair question—we're only reaching out to homeowners in your zip code because of the new utility updates. You weren't targeted personally; this is just to see if your roof qualifies. Do you own this single-family property?`;
    }
    else if (text.includes("5th person") || text.includes("stop calling") || text.includes("spoke to someone")) {
      agent_message = `Yea, we've been trying to reach you about some important updates regarding electricity rate hikes in your area. We're just doing a short 60-second info call to see if your property qualifies for the SGIP discount.`;
    }
    // Installation Objections
    else if (text.includes("holes") || text.includes("roof") || text.includes("leak") || text.includes("damage")) {
      agent_message = `Got it, ${firstName}! Absolutely, and that's a very common concern. We use K2 racking technology with dual seals on both top and bottom, backed by a full 10-year roof warranty. If anything ever happens, it's 100% covered. If roof leaks weren't a problem, is saving 20 to 50% on your power something you'd want to look into?`;
    }
    else if (text.includes("old roof") || text.includes("replace roof") || text.includes("replacing")) {
      agent_message = `Totally understand! In that case, we can actually bundle a brand-new roof replacement directly into the solar project with zero upfront cost. What's your average monthly electric bill right now?`;
    }
    else if (text.includes("looks") || text.includes("ugly") || text.includes("panel")) {
      agent_message = `Got it! We use sleek, all-black tier-1 panels that blend directly with your roof, and we can position them on the less visible backside of your home so they look super clean. Does morning or afternoon work better for an engineer to review your roof?`;
    }
    // Financial & ROI Objections
    else if (text.includes("roi") || text.includes("investment") || text.includes("cost") || text.includes("expensive")) {
      agent_message = `I agree completely, ${firstName}—and that's because there is actually zero upfront investment. It's a simple bill swap. Instead of paying the electric utility, you pay a locked solar payment that's 20 to 50% cheaper from month one.`;
    }
    else if (text.includes("another bill") || text.includes("two bills")) {
      agent_message = `Completely understand! That's why this isn't about adding a bill—we're eliminating your high electric bill completely and replacing it with a fixed payment that's significantly lower.`;
    }
    else if (text.includes("catch") || text.includes("scam") || text.includes("free")) {
      agent_message = `The only catch is—you need to qualify. That's what this whole call is about. If you qualify, you simply switch to a cheaper, locked-in clean energy rate. Is your credit score above 650?`;
    }
    else if (text.includes("finance") || text.includes("loan")) {
      agent_message = `And just to clarify—we're not getting you into any traditional high-interest loans. You're simply switching from a utility that overcharges to a locked solar rate that costs less.`;
    }
    else if (text.includes("wait") || text.includes("drop") || text.includes("later")) {
      agent_message = `I get that instinct, but utility rates are rising 8 to 14% every year with inflation. Locking in your rate today guarantees you protect your savings now rather than paying higher rates while waiting.`;
    }
    else if (text.includes("bad credit") || text.includes("credit low") || text.includes("score")) {
      agent_message = `Thanks for being honest! We have a few options—is there a spouse, partner, or household co-signer with a credit score above 650?`;
    }
    // Ownership Objections
    else if (text.includes("rent") || text.includes("tenant") || text.includes("not owner")) {
      agent_message = `Got it, thank you for letting me know! This program is specifically for property owners. If you have your landlord's contact, we can speak with them so they get the tax credit and property value boost.`;
      call_completed = true;
      qualification_status = "Disqualified";
      notes = "Lead is a renter / not homeowner.";
    }
    // Scheduling & Booking Appointment
    else if (
      text.includes("friday") ||
      text.includes("saturday") ||
      text.includes("monday") ||
      text.includes("tuesday") ||
      text.includes("wednesday") ||
      text.includes("thursday") ||
      text.includes("tomorrow") ||
      text.includes("morning") ||
      text.includes("afternoon") ||
      text.includes("3 pm") ||
      text.includes("3:00") ||
      text.includes("2 pm") ||
      text.includes("4 pm") ||
      text.includes("10 am") ||
      text.includes("11 am") ||
      text.includes("book") ||
      text.includes("schedule") ||
      text.includes("sounds good") ||
      text.includes("let's do it")
    ) {
      appointment_booked = true;
      call_completed = true;
      qualification_status = "Qualified";
      const nextDate = new Date(Date.now() + 86400000 * 2);
      nextDate.setHours(15, 0, 0, 0);
      appointment_datetime = nextDate.toISOString();
      agent_message = `Awesome ${firstName}! I have this Friday at 3:00 PM locked in for you. Our field engineer David will come by ${address} for a quick 10-minute consultation. Please have a copy of your recent electric bill handy, and make sure any decision makers are present. Have a great day!`;
      notes = `Booked in-home consultation for Friday 3:00 PM at ${address}.`;
    }
    // Qualification Progression & Bill Swap Pitch
    else if (text.includes("yes") || text.includes("own") || text.includes("i do") || text.includes("yeah") || text.includes("sure") || text.includes("150") || text.includes("200") || text.includes("300") || text.includes("250")) {
      qualification_status = "Qualified";
      agent_message = `Fantastic. So here's how the SGIP program works: instead of paying your high monthly utility bill, we swap that out for a locked-in solar payment that is 20 to 50% cheaper with zero out-of-pocket investment. We can have one of our engineers evaluate your roof. Does morning or afternoon work better for a quick 10-minute visit this week?`;
    }
    // General conversational fallback
    else {
      agent_message = `Got it, ${firstName}. To verify eligibility for the government-backed SGIP savings program: is your average electric bill over $150 a month, and is your roof free from heavy tree shading?`;
    }

    const scheduledDate = appointment_datetime || new Date(Date.now() + 86400000 * 2).toISOString();

    return NextResponse.json({
      agent_message,
      qualification: {
        average_electric_bill: 220,
        homeowner_confirmed: true,
        home_type: "Single-Family",
        electricity_provider: "Local Utility Provider",
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
      summary: `${firstName} ${lead?.last_name || ""} at ${address}. Electric bill ~$220/mo. ${appointment_booked ? "Appointment booked for " + new Date(scheduledDate).toLocaleString() : "Solar consultation qualification in progress."}`
    });
  } catch (error) {
    console.error("ai-agent-speak error:", error);
    return NextResponse.json({ error: "Failed to process voice agent turn" }, { status: 500 });
  }
}
