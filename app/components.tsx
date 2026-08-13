"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Lead } from "@/lib/types";

type CallSession = {
  call_id: string;
  lead: Lead;
  n8n_triggered?: boolean;
};

export function StartCallButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [session, setSession] = useState<CallSession | null>(null);
  const router = useRouter();

  async function startCall() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/start-call", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unable to start call");
      setSession({ call_id: body.call_id, lead: body.lead, n8n_triggered: body.n8n_triggered });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not start AI call");
    } finally {
      setBusy(false);
    }
  }

  function handleCloseCall() {
    setSession(null);
    router.refresh();
  }

  return (
    <>
      <div>
        <button className="button" onClick={startCall} disabled={busy}>
          {busy ? "Connecting Agent…" : "📞 Start AI Call"}
        </button>
        {message && <div className="alert">{message}</div>}
      </div>

      {session && (
        <RealtimeCallModal session={session} onClose={handleCloseCall} />
      )}
    </>
  );
}

function RealtimeCallModal({ session, onClose }: { session: CallSession; onClose: () => void }) {
  const { lead, call_id } = session;
  const [history, setHistory] = useState<Array<{ role: "assistant" | "user"; content: string }>>([]);
  const [status, setStatus] = useState<"connecting" | "speaking" | "listening" | "ended">("connecting");
  const [inputText, setInputText] = useState("");
  const [callEnded, setCallEnded] = useState(false);
  const [summaryNote, setSummaryNote] = useState("");
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Web Speech Synthesis
  function speakText(text: string) {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onstart = () => setStatus("speaking");
      utterance.onend = () => setStatus("listening");
      window.speechSynthesis.speak(utterance);
    } else {
      setStatus("listening");
    }
  }

  async function sendTurn(userText?: string) {
    setStatus("speaking");
    let updatedHistory = [...history];
    if (userText) {
      updatedHistory.push({ role: "user", content: userText });
      setHistory(updatedHistory);
    }

    try {
      const res = await fetch("/api/ai-agent-speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead, conversationHistory: updatedHistory, userUtterance: userText })
      });
      const data = await res.json();
      const agentMsg = data.agent_message || "Thank you for your time!";

      const newHistory = [...updatedHistory, { role: "assistant" as const, content: agentMsg }];
      setHistory(newHistory);
      speakText(agentMsg);

      if (data.call_completed || data.appointment?.booked) {
        setCallEnded(true);
        setSummaryNote(data.summary || "Call completed");

        // Save completion payload to backend
        await fetch("/api/voice-completion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            call_id,
            call_status: "completed",
            call_outcome: data.appointment?.booked ? "Appointment Booked" : "Completed",
            recording_url: "https://actions.google.com/sounds/v1/ambiences/office_voices.ogg",
            transcript: newHistory.map(h => `${h.role === "assistant" ? "Agent" : lead.first_name}: ${h.content}`).join("\n"),
            summary: data.summary,
            appointment_booked: Boolean(data.appointment?.booked),
            qualification: data.qualification,
            appointment: data.appointment
          })
        });
      }
    } catch (err) {
      console.error("Call turn error:", err);
      setStatus("listening");
    }
  }

  useEffect(() => {
    // Start initial opening turn automatically
    sendTurn();
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  function handleUserSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim() || callEnded) return;
    const txt = inputText.trim();
    setInputText("");
    sendTurn(txt);
  }

  function triggerQuickObjection(text: string) {
    if (callEnded) return;
    sendTurn(text);
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="call-header">
          <div className="lead-title">
            <h3>Solar Voice Agent Call</h3>
            <p>Customer: <strong>{lead.first_name} {lead.last_name}</strong> ({lead.phone}) · {lead.property_address || lead.address}</p>
          </div>
          <div className="live-pulse">
            <span className="pulse-dot"></span>
            {callEnded ? "Call Completed" : status === "speaking" ? "AI Agent Speaking..." : "Listening..."}
          </div>
        </div>

        <div className="transcript" style={{ minHeight: "220px" }}>
          {history.map((h, i) => (
            <div key={i} style={{ marginBottom: "12px" }}>
              <strong style={{ color: h.role === "assistant" ? "#1f6845" : "#0284c7" }}>
                {h.role === "assistant" ? "🤖 Solar AI Agent:" : `👤 ${lead.first_name}:`}
              </strong>{" "}
              <span>{h.content}</span>
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>

        {!callEnded ? (
          <div>
            <div style={{ marginBottom: "8px", fontSize: "12px", color: "#6d7b73", fontWeight: 600 }}>
              Test Objections & Script Actions:
            </div>
            <div className="quick-objections">
              <button className="chip-btn" onClick={() => triggerQuickObjection("I'm not interested")}>
                "I'm not interested" (AIR test)
              </button>
              <button className="chip-btn" onClick={() => triggerQuickObjection("I'm busy right now")}>
                "I'm busy" (AIR test)
              </button>
              <button className="chip-btn" onClick={() => triggerQuickObjection("I don't want holes in my roof")}>
                "Holes in roof" (Objection)
              </button>
              <button className="chip-btn" onClick={() => triggerQuickObjection("My electric bill is $220 a month and I own the home")}>
                "Bill is $220/mo" (Qualify)
              </button>
              <button className="chip-btn" onClick={() => triggerQuickObjection("Friday at 3:00 PM works for me!")}>
                "Book Friday 3 PM" (Book)
              </button>
            </div>

            <form onSubmit={handleUserSubmit} style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Type customer reply or speak..."
                style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid #cce0d2", fontSize: "14px" }}
              />
              <button type="submit" className="button" style={{ padding: "10px 16px" }}>
                Send
              </button>
            </form>
          </div>
        ) : (
          <div className="alert success">
            <strong>✅ Call Ended & Saved to Supabase!</strong>
            <p style={{ margin: "4px 0 0" }}>{summaryNote}</p>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className={`button ${callEnded ? "" : "secondary"}`} onClick={onClose}>
            {callEnded ? "View Saved Data in Dashboard →" : "End Call"}
          </button>
        </div>
      </div>
    </div>
  );
}
