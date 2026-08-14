export type ConversationTurn = {
  role: "assistant" | "user";
  content: string;
};

export type QualificationState = {
  average_electric_bill: number | null;
  homeowner_confirmed: boolean | null;
  home_type: string | null;
  electricity_provider: string | null;
  credit_above_650: boolean | null;
  roof_shading: string | null;
  decision_maker: boolean | null;
  qualification_status: "Qualified" | "Disqualified" | "Pending";
  notes: string;
};

export type AgentResponse = {
  agent_message: string;
  qualification: QualificationState;
  appointment: {
    booked: boolean;
    appointment_datetime: string | null;
    status: "confirmed" | "pending";
    notes: string;
  };
  call_completed: boolean;
  summary: string;
};

type Objection = {
  patterns: RegExp[];
  response: string;
};

export const OBJECTIONS: Objection[] = [
  {
    patterns: [/not interested/i, /don'?t want solar/i],
    response: "Totally understand, sir. And just to clarify—I'm not trying to sell you anything. All I'm doing is letting you know what's happening in your area so you're aware..."
  },
  {
    patterns: [/\bbusy\b/i, /no time/i, /bad time/i],
    response: "Of course, I get that. I'll keep this super short. You're probably seeing more solar panels pop up nearby, and that's what this is about..."
  },
  {
    patterns: [/send (me )?(an )?email/i, /email (me|it)/i],
    response: "Sure... What's your email? Just to be sure it's relevant, before I get you that email I just need to qualify you here in the system..."
  },
  {
    patterns: [/call me back/i, /call back/i],
    response: "Of course, I can do that. Just before I let you go—super quick—do you still live at [ADDRESS]? This will only take 30 seconds and then I'll let you go, promise..."
  },
  {
    patterns: [/how did you get my (number|phone)/i, /where did you get my (number|phone)/i],
    response: "Totally fair question—we're only reaching out to homeowners in your zip code. You actually weren't 'targeted' personally, this is just for homes that qualify..."
  },
  {
    patterns: [/fifth person/i, /5th person/i, /keep calling/i, /many calls/i],
    response: "Yea we've been trying to reach you about some important updates regarding the electricity. We're just doing a short info call to see if your property qualifies."
  },
  {
    patterns: [/holes? in (my|the) roof/i, /drill.*roof/i],
    response: "Got it, sir. Absolutely. That is exactly the reason why I'm calling you. We actually use a new way of installation with K2 racketing, which ensures proper installation with seals on both the top and bottom. You're also covered with a 10-year warranty on the roof. If anything were to happen, we'll replace it, and the finance company also assumes responsibility in that case."
  },
  {
    patterns: [/roof.*old/i, /old roof/i, /replac(e|ing).*roof/i],
    response: "Totally understand, sir. In that case, we can actually add a new roof into the project. You may even be able to get the roof done for free."
  },
  {
    patterns: [/flat roof/i, /tile roof/i, /special roof/i, /roof type/i],
    response: "That's not a problem at all, sir. We can work with all roof types—flat, tile, shingle, anything. We've done it all before."
  },
  {
    patterns: [/leak/i, /leaking/i],
    response: "Totally fair concern. That's why we include a workmanship warranty—so if anything goes wrong due to the installation, it's covered for up to 10 years."
  },
  {
    patterns: [/don'?t like.*look/i, /panels.*ugly/i, /appearance/i],
    response: "Got it, sir. We can definitely explore placing them on a side of the home that's less visible, like the back. Also, the panels we use are completely black—they blend in with the roof and are barely noticeable."
  },
  {
    patterns: [/return on investment/i, /\broi\b/i, /no return/i],
    response: "Absolutely, sir. I agree—and that's because there actually is no investment. ROI means putting your own money in, but with this, you're not. What we're offering today doesn't require any upfront investment—you're just shifting where your money goes. Instead of paying the electric company, you save from month one."
  },
  {
    patterns: [/another bill/i, /extra bill/i, /don'?t want.*bill/i],
    response: "Completely understand, sir. A lot of homeowners say the same thing—they don't want another stressor. That's why this isn't about adding a bill. We're aiming to eliminate your electric bill completely and replace it with one that's usually 30 to 50% cheaper."
  },
  {
    patterns: [/bill.*already low/i, /low electric/i, /low electricity/i],
    response: "If your bill is above $150, we can reduce it significantly. If it's under $60, it may not be worth it; between $60 and $150, we can still review savings and rate protection."
  },
  {
    patterns: [/what'?s the catch/i, /what is the catch/i],
    response: "Sir, the only catch is—you need to qualify. That's what this whole call is about. If you qualify, you simply switch to a better energy provider at a locked-in, lower rate."
  },
  {
    patterns: [/don'?t want.*financ/i, /no financ/i, /loan/i],
    response: "Absolutely, sir. We're not getting you into traditional loans. You're simply switching from one electric provider (that charges more) to another that charges less."
  },
  {
    patterns: [/wait.*price/i, /prices.*drop/i, /wait until/i],
    response: "I totally get that instinct, sir. The thing is—with inflation, nothing is actually getting cheaper. Waiting won't mean a better deal—it often means you miss the window to lock in lower rates now."
  },
  {
    patterns: [/credit.*(bad|low|poor)/i, /bad credit/i, /credit isn'?t good/i],
    response: "Thanks for being honest, sir. Is there anyone else on the home who has a credit score above 650? We can likely use their credit, or look at a co-signer."
  },
  {
    patterns: [/\brent\b/i, /renter/i, /not the homeowner/i, /don'?t own/i],
    response: "Got it—thank you for letting me know. Unfortunately, this program is only available to homeowners. If you have a landlord, I'd be happy to speak with them to see if they'd be interested."
  },
  {
    patterns: [/tenant/i, /rental property/i],
    response: "That's totally fine, sir. We've helped many landlords. Your tenant continues to pay for power, but you get the financial benefit like the 30% tax credit and added property value."
  },
  {
    patterns: [/planning to move/i, /moving soon/i, /sell.*home/i],
    response: "If you're moving in under six months, it can make sense to wait. If it's more than six months, you still have time to benefit from savings and added property value."
  },
  {
    patterns: [/renovat/i, /kitchen remodel/i, /home improvement/i],
    response: "Sir, I'm glad I caught you—the government allows home renovation work to be bundled into the solar project and potentially covered for 30% through the federal tax credit."
  },
  {
    patterns: [/friend.*bad experience/i, /cousin.*bad experience/i, /bad experience.*solar/i, /scam/i],
    response: "Totally understand, sir. We're not here scamming people. How about we send the engineer out, and your cousin can be there too so we can walk through everything and avoid the same issues."
  },
  {
    patterns: [/just send.*email/i, /can you.*email/i],
    response: "Yes, absolutely—what's your email, sir? Perfect. In order to send you the right information, I do need to ask you a couple quick questions first—just to make sure your home qualifies."
  }
];

export const SOLAR_SYSTEM_PROMPT = `You are Alex, an expert solar appointment setter. Follow the sales script in order and never invent qualification answers.

SCRIPT ORDER:
1. Opening: "Hey [NAME]? Hey, how's it going? This is just Alex. We're actually working right in the corner of your neighborhood — we're going to be here for the next couple of weeks. Am I speaking with the owner of [ADDRESS]?"
2. Reason: explain neighborhood rate increases and SGIP, then ask average monthly electric bill.
3. Qualify one at a time: monthly bill; single-family home/roof ownership; credit above 650; roof shading; electricity provider.
4. Bill swap: explain potential utility reduction to zero, solar payment 20–50% cheaper, locked rate, possible zero out of pocket.
5. Ask about other decision makers/spouse/partner.
6. Ask morning or afternoon, then offer a specific appointment time.
7. After the homeowner accepts the offered time, confirm nothing prevents attendance, decision makers will be present, and the phone number is correct.
8. Only after confirmation, recap consultant David, address, appointment time, electricity bill reminder, and close the call.

ABSOLUTE RULES:
- Never repeat a question already answered in conversation history.
- Never mark a qualification field true or fill a value unless the homeowner actually provided that information.
- Never book an appointment merely because the homeowner mentioned a day, morning, or afternoon. First offer a specific slot and get explicit acceptance.
- Objection responses are controlled by the application. If the application supplies an objection response, do not rewrite it.
- For normal script turns, keep speech concise and natural. Exact objection wording takes priority over the short-response rule.
- Return JSON only.`;

function affirmative(text: string) {
  return /\b(yes|yeah|yep|correct|right|sure|i do|i am|that works|sounds good|okay|ok|fine)\b/i.test(text);
}

function negative(text: string) {
  return /\b(no|nope|not really|don'?t|do not|can'?t|cannot)\b/i.test(text);
}

function extractBill(text: string) {
  const matches = [...text.matchAll(/\$?\s*(\d{2,4})(?:\.\d{1,2})?/g)];
  if (!matches.length) return null;
  const numbers = matches.map(match => Number(match[1])).filter(value => value >= 20 && value <= 5000);
  return numbers.length ? numbers[0] : null;
}

function nextAppointmentIso(preference: string | null) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  date.setUTCHours(preference === "morning" ? 10 : 15, 0, 0, 0);
  return date.toISOString();
}

function appointmentLabel(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short"
  });
}

export function findObjection(text: string, address: string) {
  const objection = OBJECTIONS.find(item => item.patterns.some(pattern => pattern.test(text)));
  return objection?.response.replace(/\[ADDRESS\]/g, address) || null;
}

export function buildDeterministicResponse(args: {
  firstName: string;
  address: string;
  phone: string;
  conversationHistory: ConversationTurn[];
  userUtterance: string;
}): AgentResponse {
  const { firstName, address, phone, conversationHistory, userUtterance } = args;
  const turns: ConversationTurn[] = [...conversationHistory];
  if (userUtterance && turns.at(-1)?.content !== userUtterance) {
    turns.push({ role: "user", content: userUtterance });
  }

  const qualification: QualificationState = {
    average_electric_bill: null,
    homeowner_confirmed: null,
    home_type: null,
    electricity_provider: null,
    credit_above_650: null,
    roof_shading: null,
    decision_maker: null,
    qualification_status: "Pending",
    notes: "Solar qualification in progress"
  };

  let roofOwned: boolean | null = null;
  let preference: "morning" | "afternoon" | null = null;
  let offeredAppointment: string | null = null;
  let appointmentAccepted = false;
  let lockConfirmed = false;

  for (let index = 0; index < turns.length; index++) {
    const turn = turns[index];
    if (turn.role !== "user") continue;

    const text = turn.content.trim();
    const previous = turns[index - 1]?.role === "assistant" ? turns[index - 1].content.toLowerCase() : "";

    if (/owner|homeowner/.test(previous)) {
      if (/\brent\b|renter|not the owner|don'?t own/i.test(text)) qualification.homeowner_confirmed = false;
      else if (affirmative(text) || /\bown\b/i.test(text)) qualification.homeowner_confirmed = true;
    }

    if (/electric bill|monthly bill|paying more than \$150/.test(previous)) {
      qualification.average_electric_bill = extractBill(text) ?? qualification.average_electric_bill;
    }

    if (/single-family|own the roof|home type/.test(previous)) {
      if (/single[- ]?family/i.test(text)) qualification.home_type = "Single-Family";
      else if (/townhome|townhouse/i.test(text)) qualification.home_type = "Townhome";
      else if (/condo/i.test(text)) qualification.home_type = "Condo";
      if (/\bown\b.*roof|yes|i do/i.test(text)) roofOwned = true;
      if (/don'?t own.*roof|no roof/i.test(text)) roofOwned = false;
    }

    if (/credit/.test(previous)) {
      if (affirmative(text) || /above 650|over 650|7\d\d|8\d\d/i.test(text)) qualification.credit_above_650 = true;
      else if (negative(text) || /below 650|under 650|bad credit|poor credit/i.test(text)) qualification.credit_above_650 = false;
    }

    if (/trees|structures|sunlight|shading/.test(previous)) {
      qualification.roof_shading = text.slice(0, 500);
    }

    if (/electricity provider|utility provider|current provider/.test(previous)) {
      qualification.electricity_provider = text.slice(0, 200);
    }

    if (/decision makers|spouse|partner/.test(previous)) {
      if (affirmative(text) || /spouse|wife|husband|partner/i.test(text)) qualification.decision_maker = true;
      else if (negative(text) || /just me|only me/i.test(text)) qualification.decision_maker = false;
    }

    if (/morning or afternoon/.test(previous)) {
      if (/morning/i.test(text)) preference = "morning";
      if (/afternoon|evening/i.test(text)) preference = "afternoon";
    }

    const offeredMatch = previous.match(/appointment slot:([^|]+)/i);
    if (offeredMatch) {
      offeredAppointment = offeredMatch[1].trim();
      if (affirmative(text)) appointmentAccepted = true;
      if (negative(text)) appointmentAccepted = false;
    }

    if (/anything that would keep you from being available/.test(previous)) {
      if (!/can'?t|cannot|won'?t|not available|conflict/i.test(text)) lockConfirmed = true;
    }
  }

  if (qualification.homeowner_confirmed === false || roofOwned === false) {
    qualification.qualification_status = "Disqualified";
    qualification.notes = qualification.homeowner_confirmed === false
      ? "Disqualified: not the homeowner."
      : "Disqualified: does not own the roof.";
  } else if (
    qualification.homeowner_confirmed === true &&
    qualification.average_electric_bill !== null &&
    qualification.average_electric_bill >= 150 &&
    qualification.home_type === "Single-Family" &&
    qualification.credit_above_650 === true &&
    qualification.roof_shading !== null &&
    qualification.electricity_provider !== null
  ) {
    qualification.qualification_status = "Qualified";
    qualification.notes = "Core homeowner qualification questions completed.";
  }

  const latestText = userUtterance || turns.at(-1)?.content || "";
  const objection = findObjection(latestText, address);

  const makeResult = (agent_message: string, overrides?: Partial<AgentResponse>): AgentResponse => ({
    agent_message,
    qualification,
    appointment: {
      booked: false,
      appointment_datetime: null,
      status: "pending",
      notes: "Appointment not yet confirmed"
    },
    call_completed: false,
    summary: `${firstName} at ${address}. Qualification in progress.`,
    ...overrides
  });

  if (!turns.length || (!userUtterance && conversationHistory.length === 0)) {
    return makeResult(`Hey ${firstName}? Hey, how's it going? This is just Alex. We're working right in your neighborhood. Am I speaking with the owner of ${address}?`);
  }

  if (qualification.homeowner_confirmed === false) {
    return makeResult(
      "Got it—thank you for letting me know. Unfortunately, this program is only available to homeowners. If you have a landlord, I'd be happy to speak with them to see if they'd be interested.",
      {
        call_completed: true,
        summary: `${firstName} at ${address}. Disqualified because caller is not the homeowner.`
      }
    );
  }

  let nextQuestion = "";
  if (qualification.homeowner_confirmed === null) {
    nextQuestion = `Am I speaking with the owner of ${address}?`;
  } else if (qualification.average_electric_bill === null) {
    nextQuestion = "What would you say is your average monthly electricity bill?";
  } else if (!qualification.home_type || roofOwned === null) {
    nextQuestion = "Is this a single-family home, and do you own the roof?";
  } else if (qualification.credit_above_650 === null) {
    nextQuestion = "Do you know if your credit score is above 650?";
  } else if (qualification.roof_shading === null) {
    nextQuestion = "Do you have any large trees or structures blocking direct sunlight on the roof?";
  } else if (qualification.electricity_provider === null) {
    nextQuestion = "Who is your current electricity provider?";
  } else if (qualification.decision_maker === null) {
    nextQuestion = "Are there any other decision makers in the household, like a spouse or partner?";
  } else if (!preference) {
    nextQuestion = "Does morning or afternoon work better for the engineer consultation?";
  }

  if (objection) {
    return makeResult(`${objection}${nextQuestion ? ` ${nextQuestion}` : ""}`);
  }

  if (qualification.homeowner_confirmed === true && qualification.average_electric_bill === null) {
    return makeResult(`Ok great — we're helping neighbors with recent electricity rate increases through SGIP. ${nextQuestion}`);
  }

  if (qualification.average_electric_bill !== null && (!qualification.home_type || roofOwned === null)) {
    return makeResult(`Thanks. ${nextQuestion}`);
  }

  if (nextQuestion) {
    return makeResult(nextQuestion);
  }

  if (!offeredAppointment && preference) {
    const appointmentIso = nextAppointmentIso(preference);
    const label = appointmentLabel(appointmentIso);
    return makeResult(`Perfect. I have ${label} open. Does that work for you? [APPOINTMENT SLOT:${appointmentIso}|${label}]`);
  }

  if (offeredAppointment && !appointmentAccepted) {
    const appointmentIso = nextAppointmentIso(preference === "morning" ? "afternoon" : "morning");
    const label = appointmentLabel(appointmentIso);
    return makeResult(`No problem. I can offer ${label} instead. Does that work? [APPOINTMENT SLOT:${appointmentIso}|${label}]`);
  }

  if (appointmentAccepted && !lockConfirmed) {
    return makeResult(`Awesome, ${firstName}. Is there anything that would keep you from being available at that time? Please make sure all decision makers are present; is ${phone || "this number"} the best confirmation number?`);
  }

  const finalAppointment = offeredAppointment || nextAppointmentIso(preference);
  const finalLabel = appointmentLabel(finalAppointment);
  qualification.qualification_status = qualification.qualification_status === "Disqualified" ? "Disqualified" : "Qualified";

  return makeResult(
    `Alright ${firstName}, you're all set with David for ${finalLabel} at ${address}. Please have your latest electricity bill ready. Have a great rest of your day!`,
    {
      appointment: {
        booked: true,
        appointment_datetime: finalAppointment,
        status: "confirmed",
        notes: `Confirmed consultation with David for ${finalLabel}`
      },
      call_completed: true,
      summary: `${firstName} at ${address}. Appointment booked for ${finalLabel}.`
    }
  );
}
