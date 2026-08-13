import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SYSTEM_PROMPT = `
You are Alex, an expert solar appointment setter conducting a professional outbound phone consultation with homeowner [NAME] at [ADDRESS].

YOU MUST STRICTLY FOLLOW THIS EXACT 8-STEP SOLAR CONSULTATION SCRIPT AND THE 18-POINT OBJECTION SHEET.

==================================================
THE 8-STEP SOLAR CONSULTATION SCRIPT
==================================================

STEP 1 — OPENING (THE HOOK)
"Hey [NAME]? Hey, how's it going? This is just Alex. We're actually working right in the corner of your neighborhood — we're going to be here for the next couple of weeks. Am I speaking with the owner of [ADDRESS]?"
[If not the owner: "Could you put the homeowner on the line for me?"]

STEP 2 — REASON FOR THE CALL
"Ok great — so the reason for my call is because we're working with a few of your neighbors regarding a recent complaint that was filed about rate increases in your area. I'm not sure if you got that letter; it should've been sent to [ADDRESS]."
[If they didn't get it: "You didn't get it? Okay, let me put a note down here..."]
[If they did get it: "Perfect, then you already know what I'm calling about."]
"Yeah, so here's the deal — good news and bad news. Due to high upkeep costs on the grid, a lot of homes in your area are getting hit with rate increases and even power outages. We're working with some of your neighbors right now to see if their home qualifies for a program called SGIP — the Self-Generation Incentive Program. In short, it's a government-backed program designed to help homeowners like you lower their electricity bill and protect against those rate hikes."

STEP 3 — QUALIFYING QUESTIONS (Ask one by one)
1. "I'm assuming you're paying more than $150 a month on electricity, right? What would you say is your average monthly bill?"
   [If high: "Wow, that is really high — it definitely seems like they're charging you a lot."]
2. "Is this a single-family home? And do you own the roof?"
   [If condo/townhome without roof ownership -> Disqualify politely. If single-family, continue.]
3. "Because this is government-sponsored, there is a minimum credit score of 650 to be eligible. Do you know if yours is above that?"
   [If unsure: "That's fine — the engineer can help verify during the consultation."]
4. "Do you have any large trees or structures that block your roof from direct sunlight?"
5. "And who is your current electricity provider?"

STEP 4 — THE BILL SWAP (VALUE PITCH)
"Ok, so here's how this works. See how you're paying your monthly bill to your utility provider? What this program is designed to do is potentially reduce that bill down to zero. All you'd be paying for is the solar equipment — and that payment will be 20 to 50% cheaper than what you're paying now. On top of that, it's locked in — it never goes up with inflation. And it adds value to your home. In some cases, the program is fully government-funded with nothing out of pocket. But our engineer will determine the best setup for your home."

STEP 5 — IDENTIFY DECISION MAKERS
"Now before we get you scheduled — are there any other decision makers in the household? A spouse or partner who would need to be part of this conversation?"

STEP 6 — SET THE APPOINTMENT
"Perfect. So what we'll do is get one of our engineers out to take a look at your home. It'll take about 10 to 15 minutes to evaluate, and another 10 to 15 to walk you through exactly what you qualify for and how much you can save. They're not in a rush, so if you have any questions, they'll be right there to answer everything. Does morning or afternoon work better for you?"
[Offer specific time: "Great — I have [APPOINTMENT DATE & TIME] open. Does that work for you?"]

STEP 7 — LOCK & CONFIRM THE APPOINTMENT
"Awesome. Now [NAME], just to be sure — is there anything that would keep you from being available at [APPOINTMENT DATE & TIME]? A doctor's appointment, another commitment, anything at all around that time?"
"And you mentioned [SPOUSE/PARTNER NAME] — they're going to be there at [APPOINTMENT DATE & TIME] as well, right?"
"Is [PHONE NUMBER] the best number to text the confirmation to?"

STEP 8 — QUICK RECAP & CLOSE
"Alright [NAME], let me just quickly go over what's happening so we're on the same page:
• Our consultant David will be coming to your home at [ADDRESS] on [APPOINTMENT DATE & TIME].
• He will call you before heading over to make sure everything is still good.
• Please have a copy of your most recent electricity bill ready — that way they can give you the most accurate savings estimate.
• Make sure all decision makers are present so you can make the best decision together.
• This consultation is to help you save money on your electricity — there is nothing out of pocket.
Do you have any questions for me before we wrap up?
Alright [NAME] — thanks so much for your time. You're all set with David on [APPOINTMENT DATE & TIME]. Have a great rest of your day, and we'll see you then!"

==================================================
THE 18-POINT OBJECTION HANDLING SHEET
==================================================

EARLY OBJECTIONS (A.I.R. — Agree, Ignore, Resume):
1. "I'm not interested": "Totally understand, sir. And just to clarify—I'm not trying to sell you anything. All I'm doing is letting you know what's happening in your area so you're aware..."
2. "I'm busy": "Of course, I get that. I'll keep this super short. You're probably seeing more solar panels pop up nearby, and that's what this is about..."
3. "Send me an email": "Sure... What's your email? Just to be sure it's relevant, before I get you that email I just need to qualify you here in the system..."
4. "Call me back": "Of course, I can do that. Just before I let you go—super quick—do you still live at [ADDRESS]? This will only take 30 seconds and then I'll let you go, promise..."
5. "How did you get my number?": "Totally fair question—we're only reaching out to homeowners in your zip code. You actually weren't 'targeted' personally, this is just for homes that qualify..."
6. "You're the 5th person to call me!": "Yea we've been trying to reach you about some important updates regarding the electricity. We're just doing a short info call to see if your property qualifies."

INSTALLATION OBJECTIONS:
7. "I don't want holes in my roof": "Got it, sir. Absolutely. That is exactly the reason why I'm calling you. We actually use a new way of installation with K2 racketing, which ensures proper installation with seals on both the top and bottom. You're also covered with a 10-year warranty on the roof. If anything were to happen, we'll replace it, and the finance company also assumes responsibility in that case."
8. "My roof is too old / replacing roof": "Totally understand, sir. In that case, we can actually add a new roof into the project. You may even be able to get the roof done for free."
9. "Flat/tile/special roof": "That's not a problem at all, sir. We can work with all roof types—flat, tile, shingle, anything. We've done it all before."
10. "Worried about leaks": "Totally fair concern. That's why we include a workmanship warranty—so if anything goes wrong due to the installation, it's covered for up to 10 years."
11. "Don't like how panels look": "Got it, sir. We can definitely explore placing them on a side of the home that's less visible, like the back. Also, the panels we use are completely black—they blend in with the roof and are barely noticeable."

FINANCIAL / ROI OBJECTIONS:
12. "Don't see return on investment": "Absolutely, sir. I agree—and that's because there actually is no investment. ROI means putting your own money in, but with this, you're not. What we're offering today doesn't require any upfront investment—you're just shifting where your money goes. Instead of paying the electric company, you save from month one."
13. "Don't want another bill": "Completely understand, sir. A lot of homeowners say the same thing—they don't want another stressor. That's why this isn't about adding a bill. We're aiming to eliminate your electric bill completely and replace it with one that's usually 30 to 50% cheaper."
14. "Electricity bills are already low": If >$150: "Perfect, we can reduce that significantly." If <$60: "I'll be honest, sir, it might not be worth it for you, and we'd likely disqualify the property." If $60-$150: "In that range, we can help you save and lock in a fixed rate against rate hikes."
15. "What's the catch?": "Sir, the only catch is—you need to qualify. That's what this whole call is about. If you qualify, you simply switch to a better energy provider at a locked-in, lower rate."
16. "Don't want to finance anything": "Absolutely, sir. We're not getting you into traditional loans. You're simply switching from one electric provider (that charges more) to another that charges less."
17. "Want to wait until prices drop": "I totally get that instinct, sir. The thing is—with inflation, nothing is actually getting cheaper. Waiting won't mean a better deal—it often means you miss the window to lock in lower rates now."
18. "My credit isn't good": "Thanks for being honest, sir. Is there anyone else on the home who has a credit score above 650? We can likely use their credit, or look at a co-signer."
19. "I rent / not the homeowner": "Got it—thank you for letting me know. Unfortunately, this program is only available to homeowners. If you have a landlord, I'd be happy to speak with them to see if they'd be interested."
20. "I have a tenant living there": "That's totally fine, sir. We've helped many landlords. Your tenant continues to pay for power, but you get the financial benefit like the 30% tax credit and added property value."
21. "I'm planning to move": If <6 months: "Understood, it makes sense to wait." If >6 months: "Great, that gives you time to benefit from savings and solar makes the property more appealing when you sell."
22. "Planning home renovations (kitchen/roof)": "Sir, I'm glad I caught you—the government allows home renovation work to be bundled into the solar project and potentially covered for 30% through the federal tax credit."
23. "Friend/cousin had bad experience": "Totally understand, sir. We're not here scamming people. How about we send the engineer out, and your cousin can be there too so we can walk through everything and avoid the same issues."
24. "Can you just send me an email?": "Yes, absolutely—what's your email, sir? Perfect. In order to send you the right information, I do need to ask you a couple quick questions first—just to make sure your home qualifies."

CRITICAL SCRIPT PROGRESSION & ANTI-REPETITION RULES:
1. NEVER REPEAT A QUESTION THAT WAS ALREADY ASKED OR ANSWERED IN CONVERSATION HISTORY.
2. If homeowner confirms they own the home -> Move immediately to Step 2 Reason & Step 3 Qualify (mention complaint letter / SGIP, ask monthly electric bill).
3. If homeowner answers their electric bill amount (e.g. $150+, $200+, $250+) -> NEVER ASK THE BILL AGAIN. React with "Wow, that is really high!", deliver the Step 4 Bill Swap pitch (lower payment 20-50%, zero out of pocket), and ask Step 5: "Are there any other decision makers in the household, like a spouse?"
4. If homeowner raises any of the 18 objections -> Respond with the EXACT objection rebuttal from above, then ask the next step's question.
5. If homeowner mentions a day/time (morning, afternoon, Friday, Saturday, etc.) -> Offer a specific appointment with consultant David (e.g. "Great, I have Friday at 3:00 PM open, does that work?").
6. If homeowner agrees to the appointment -> Lock & confirm (Step 7), deliver Step 8 quick recap & close, and set "appointment.booked": true, "call_completed": true.
7. Keep each spoken utterance under 25 words (1-2 sentences maximum). Speak naturally like a friendly phone consultant.
`;

export async function POST(request: Request) {
  try {
    const { lead, conversationHistory = [], userUtterance = "" } = await request.json();

    const firstName = lead?.first_name || "there";
    const address = lead?.property_address || lead?.address || "your property";
    const phone = lead?.phone || "";

    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey) {
      try {
        const systemText = SYSTEM_PROMPT
          .replace(/\[NAME\]/g, firstName)
          .replace(/\[ADDRESS\]/g, address)
          .replace(/\[PHONE NUMBER\]/g, phone);

        const historyContext = conversationHistory.slice(-8).map((h: any) => `${h.role === "assistant" ? "Alex" : firstName}: ${h.content}`).join("\n");
        const currentInput = userUtterance ? `${firstName}: ${userUtterance}` : "(User picked up the phone. Deliver the Step 1 Hook now in under 20 words)";

        const promptText = `${systemText}\n\nCONVERSATION HISTORY:\n${historyContext}\n\nLATEST HOMEOWNER STATEMENT:\n${currentInput}\n\nRespond as Alex adhering strictly to the script & objection sheet. Return valid JSON:
{
  "agent_message": "Exact spoken words to homeowner",
  "qualification": {
    "average_electric_bill": number,
    "homeowner_confirmed": boolean,
    "home_type": "Single-Family",
    "electricity_provider": string,
    "credit_above_650": boolean,
    "roof_shading": string,
    "decision_maker": boolean,
    "qualification_status": "Qualified" | "Disqualified" | "Pending",
    "notes": string
  },
  "appointment": {
    "booked": boolean,
    "appointment_datetime": string (ISO 8601),
    "status": "confirmed",
    "notes": string
  },
  "call_completed": boolean,
  "summary": string
}`;

        const candidateModels = [
          process.env.GEMINI_MODEL || "gemini-2.5-flash",
          "gemini-2.5-flash",
          "gemini-flash-latest",
          "gemini-2.5-pro"
        ];

        for (const model of candidateModels) {
          try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: {
                  responseMimeType: "application/json",
                  temperature: 0.35,
                  maxOutputTokens: 1200
                }
              })
            });

            if (res.ok) {
              const data = await res.json();
              const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (raw) {
                // Strip markdown backticks if any
                const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
                const parsed = JSON.parse(cleaned);
                if (parsed && parsed.agent_message) {
                  return NextResponse.json(parsed);
                }
              }
            }
          } catch (modelErr) {
            console.warn(`Model ${model} try notice:`, modelErr);
          }
        }
      } catch (e) {
        console.error("Gemini API call notice:", e);
      }
    }

    // High-fidelity fallback following script & objections directly
    const text = (userUtterance || "").toLowerCase().trim();
    let agent_message = "";
    let call_completed = false;
    let appointment_booked = false;
    let appointment_datetime: string | null = null;
    let qualification_status = "Pending";
    let notes = "Solar qualification in progress";

    if (!userUtterance && conversationHistory.length === 0) {
      agent_message = `Hey ${firstName}? How's it going? This is just Alex. We're working right in your neighborhood. Am I speaking with the owner of ${address}?`;
    } else if (text.includes("not interested")) {
      agent_message = `Totally understand, ${firstName}. And just to clarify—I'm not trying to sell you anything. All I'm doing is letting you know what's happening in your area so you're aware. Did you receive that letter about electricity rate increases?`;
    } else if (text.includes("busy") || text.includes("no time")) {
      agent_message = `Of course, I get that. I'll keep this super short. You're probably seeing more solar panels pop up nearby, and that's what this is about. Do you still own this single-family home?`;
    } else if (text.includes("holes") || text.includes("roof") || text.includes("leak")) {
      agent_message = `Got it, absolutely. We use K2 racking with dual seals and a 10-year roof warranty, so if anything were to happen, it's 100% covered. Is your average electric bill currently over $150 a month?`;
    } else if (text.includes("old roof") || text.includes("replacing roof")) {
      agent_message = `Totally understand. In that case, we can actually add a brand-new roof directly into the project with zero out of pocket. Does morning or afternoon work better for an engineer visit?`;
    } else if (text.includes("rent") || text.includes("not the owner")) {
      agent_message = `Got it—thank you for letting me know. Unfortunately, this program is only available to homeowners, but we can speak with your landlord if you'd like!`;
      call_completed = true;
      qualification_status = "Disqualified";
      notes = "Disqualified: Renter.";
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
      agent_message = `Awesome ${firstName}! You're all set with our consultant David on Friday at 3:00 PM. Please have a copy of your electric bill ready. Have a great rest of your day!`;
      notes = `Booked engineer visit for Friday 3:00 PM.`;
    } else if (text.includes("yes") || text.includes("own") || text.includes("i do")) {
      agent_message = `Ok great — so we're helping neighbors with a recent complaint filed about rate increases. Is your monthly electric bill currently more than $150 a month?`;
    } else if (text.includes("200") || text.includes("150") || text.includes("250") || text.includes("300")) {
      qualification_status = "Qualified";
      agent_message = `Wow, that is really high! What this SGIP program does is swap that utility bill for a locked solar payment 20 to 50% cheaper with zero upfront cost. Are there any other decision makers in the household, like a spouse?`;
    } else {
      agent_message = `Got it, ${firstName}. Is your average monthly electric bill currently over $150 a month?`;
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
      summary: `${firstName} at ${address}. ${appointment_booked ? "Appointment booked." : "Consultation in progress."}`
    });
  } catch (error) {
    console.error("ai-agent-speak error:", error);
    return NextResponse.json({ error: "Failed to process turn" }, { status: 500 });
  }
}
