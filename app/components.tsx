"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
        <button className="button" onClick={startCall} disabled={busy} style={{ gap: "10px" }}>
          <span style={{ fontSize: "16px" }}>📞</span>
          {busy ? "Connecting Voice Agent…" : "Start Real-Time Voice Call"}
        </button>
        {message && <div className="alert">{message}</div>}
      </div>

      {session && (
        <RealtimeVoiceCallModal session={session} onClose={handleCloseCall} />
      )}
    </>
  );
}

function RealtimeVoiceCallModal({ session, onClose }: { session: CallSession; onClose: () => void }) {
  const { lead, call_id } = session;
  const [history, setHistory] = useState<Array<{ role: "assistant" | "user"; content: string }>>([]);
  const [status, setStatus] = useState<"connecting" | "speaking" | "listening" | "processing" | "ended">("connecting");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callEnded, setCallEnded] = useState(false);
  const [summaryNote, setSummaryNote] = useState("");
  const [micSupported, setMicSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const historyRef = useRef<Array<{ role: "assistant" | "user"; content: string }>>([]);
  const isSpeakingRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(false);
  const callEndedRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpokenTextRef = useRef<string>("");

  // Sync ref
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    callEndedRef.current = callEnded;
  }, [callEnded]);

  // Call timer
  useEffect(() => {
    if (callEnded) return;
    const interval = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callEnded]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Safe Speech Synthesis with Natural Voice
  const speakVoice = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setStatus("listening");
      startListening();
      return;
    }

    window.speechSynthesis.cancel();
    // Stop recognition while AI speaks to avoid feedback loop
    stopListening();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    // Pick best English voice
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Samantha") || v.name.includes("Daniel") || v.name.includes("Alex")) && v.lang.startsWith("en")) || voices.find(v => v.lang.startsWith("en"));
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    utterance.onstart = () => {
      isSpeakingRef.current = true;
      setStatus("speaking");
    };

    utterance.onend = () => {
      isSpeakingRef.current = false;
      if (!callEndedRef.current) {
        setStatus("listening");
        startListening();
      }
    };

    utterance.onerror = () => {
      isSpeakingRef.current = false;
      if (!callEndedRef.current) {
        setStatus("listening");
        startListening();
      }
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  // Send turn to backend
  const sendVoiceTurn = useCallback(async (userUtterance?: string) => {
    if (callEndedRef.current) return;
    setStatus("processing");
    stopListening();

    let updatedHistory = [...historyRef.current];
    if (userUtterance) {
      updatedHistory.push({ role: "user", content: userUtterance });
      setHistory(updatedHistory);
      historyRef.current = updatedHistory;
    }

    try {
      const res = await fetch("/api/ai-agent-speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead,
          conversationHistory: updatedHistory,
          userUtterance: userUtterance || ""
        })
      });

      const data = await res.json();
      const agentMsg = data.agent_message || "Thank you for your time!";

      const newHistory = [...updatedHistory, { role: "assistant" as const, content: agentMsg }];
      setHistory(newHistory);
      historyRef.current = newHistory;

      // Speak agent response
      speakVoice(agentMsg);

      if (data.call_completed || data.appointment?.booked) {
        setCallEnded(true);
        callEndedRef.current = true;
        setSummaryNote(data.summary || "Call completed");

        // Save completed call payload to backend
        await fetch("/api/voice-completion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            call_id,
            call_status: "completed",
            call_outcome: data.appointment?.booked ? "Appointment Booked" : "Completed",
            recording_url: "https://actions.google.com/sounds/v1/ambiences/office_voices.ogg",
            transcript: newHistory.map(h => `${h.role === "assistant" ? "Alex (AI Agent)" : lead.first_name}: ${h.content}`).join("\n"),
            summary: data.summary,
            appointment_booked: Boolean(data.appointment?.booked),
            qualification: data.qualification,
            appointment: data.appointment
          })
        });
      }
    } catch (err) {
      console.error("Call turn processing error:", err);
      if (!callEndedRef.current) {
        setStatus("listening");
        startListening();
      }
    }
  }, [lead, call_id, speakVoice]);

  // Speech Recognition (Microphone listening)
  const startListening = useCallback(() => {
    if (isSpeakingRef.current || isMutedRef.current || callEndedRef.current) return;
    if (typeof window === "undefined") return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicSupported(false);
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        if (!isSpeakingRef.current) setStatus("listening");
      };

      recognition.onresult = (event: any) => {
        if (isSpeakingRef.current || isMutedRef.current) return;

        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        const recognizedText = (final || interim).trim();
        if (recognizedText) {
          setLiveTranscript(recognizedText);
          lastSpokenTextRef.current = recognizedText;

          // Debounce / silence detection to trigger AI turn
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (lastSpokenTextRef.current && !isSpeakingRef.current) {
              const textToSend = lastSpokenTextRef.current;
              lastSpokenTextRef.current = "";
              setLiveTranscript("");
              sendVoiceTurn(textToSend);
            }
          }, 1400);
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error !== "no-speech") {
          console.warn("Speech recognition notice:", e.error);
        }
      };

      recognition.onend = () => {
        // Automatically restart listening if call is active and AI is not speaking
        if (!isSpeakingRef.current && !isMutedRef.current && !callEndedRef.current) {
          try {
            recognition.start();
          } catch (e) {}
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.warn("Could not start speech recognition:", e);
    }
  }, [sendVoiceTurn]);

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }
  }, []);

  // Initialize call with opening greeting
  useEffect(() => {
    const timer = setTimeout(() => {
      sendVoiceTurn();
    }, 600);

    return () => {
      clearTimeout(timer);
      stopListening();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function toggleMute() {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (nextMute) {
      stopListening();
      setStatus("processing");
    } else {
      setStatus("listening");
      startListening();
    }
  }

  function handleManualSpeakPrompt(utterance: string) {
    if (callEnded) return;
    setLiveTranscript("");
    sendVoiceTurn(utterance);
  }

  const latestAssistantMessage = [...history].reverse().find(h => h.role === "assistant")?.content;
  const latestUserMessage = [...history].reverse().find(h => h.role === "user")?.content;

  return (
    <div className="modal-overlay">
      <div className="modal-card voice-agent-modal">
        {/* Call Header */}
        <div className="call-header">
          <div className="lead-title">
            <div className="call-badge-live">
              <span className="pulse-dot"></span>
              {callEnded ? "CALL ENDED" : `LIVE SOLAR CALL · ${formatDuration(callDuration)}`}
            </div>
            <h3 style={{ marginTop: "4px", fontSize: "22px" }}>{lead.first_name} {lead.last_name}</h3>
            <p>📞 {lead.phone} · 📍 {lead.property_address || lead.address}</p>
          </div>

          <div className="status-indicator">
            {callEnded ? (
              <span className="badge completed" style={{ fontSize: "13px", padding: "6px 14px" }}>
                ✓ Completed
              </span>
            ) : status === "speaking" ? (
              <span className="badge" style={{ background: "#e0f2fe", color: "#0369a1", fontSize: "13px", padding: "6px 14px" }}>
                🔊 AI Agent Speaking
              </span>
            ) : status === "processing" ? (
              <span className="badge pending" style={{ fontSize: "13px", padding: "6px 14px" }}>
                ⏳ Processing Response...
              </span>
            ) : (
              <span className="badge completed" style={{ fontSize: "13px", padding: "6px 14px" }}>
                🎙️ Listening to You...
              </span>
            )}
          </div>
        </div>

        {/* Live Audio Visualizer / Calling Interface */}
        <div className="voice-call-screen">
          <div className={`caller-avatar ${status === "speaking" ? "speaking" : status === "listening" ? "listening" : ""}`}>
            <span className="avatar-icon">☀️</span>
            <div className="sound-ripples">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>

          <div className="call-agent-identity">
            <h4>Alex (Solar AI Voice Consultant)</h4>
            <p className="muted">8-Step Script & Live Objection Intelligence Active</p>
          </div>

          {/* Sound Wave Equalizer */}
          {!callEnded && (
            <div className={`sound-wave ${status === "speaking" ? "active-agent" : status === "listening" ? "active-user" : ""}`}>
              <div className="bar bar1"></div>
              <div className="bar bar2"></div>
              <div className="bar bar3"></div>
              <div className="bar bar4"></div>
              <div className="bar bar5"></div>
              <div className="bar bar6"></div>
              <div className="bar bar7"></div>
              <div className="bar bar8"></div>
              <div className="bar bar9"></div>
            </div>
          )}

          {/* Live Subtitle / Transcript Banner */}
          <div className="live-caption-box">
            {status === "speaking" && latestAssistantMessage && (
              <div className="caption agent-caption">
                <strong>🤖 Alex:</strong> &ldquo;{latestAssistantMessage}&rdquo;
              </div>
            )}

            {(status === "listening" || status === "processing") && (
              <div className="caption user-caption">
                <strong>🎙️ {lead.first_name} (You):</strong>{" "}
                {liveTranscript ? `“${liveTranscript}”` : latestUserMessage ? `“${latestUserMessage}”` : "Speak into your microphone naturally..."}
              </div>
            )}

            {callEnded && (
              <div className="caption completed-caption">
                <strong>✅ Call Completed:</strong> {summaryNote || "Lead qualification data & appointment saved to database."}
              </div>
            )}
          </div>
        </div>

        {/* Quick Voice Shortcuts for Testing Without Voice if No Mic */}
        {!micSupported && (
          <div className="alert info" style={{ margin: "0" }}>
            Microphone access is not supported in this browser window. Click below to test responses:
            <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
              <button className="chip-btn" onClick={() => handleManualSpeakPrompt("Yes I own the home and my bill is $220")}>
                "I own the home, bill $220/mo"
              </button>
              <button className="chip-btn" onClick={() => handleManualSpeakPrompt("I'm not interested")}>
                "I'm not interested" (AIR test)
              </button>
              <button className="chip-btn" onClick={() => handleManualSpeakPrompt("Friday 3 PM works")}>
                "Friday 3 PM works" (Book)
              </button>
            </div>
          </div>
        )}

        {/* Call Controls HUD */}
        <div className="call-controls-hud">
          <button
            className={`hud-btn ${isMuted ? "muted" : ""}`}
            onClick={toggleMute}
            disabled={callEnded}
            title={isMuted ? "Unmute Mic" : "Mute Mic"}
          >
            <span>{isMuted ? "🔇" : "🎙️"}</span>
            <small>{isMuted ? "Unmute" : "Mute"}</small>
          </button>

          <button
            className="hud-btn danger"
            onClick={onClose}
            style={{ minWidth: "160px" }}
          >
            <span>{callEnded ? "✓" : "📞"}</span>
            <small>{callEnded ? "Close & View Dashboard" : "End Call"}</small>
          </button>
        </div>
      </div>
    </div>
  );
}
