"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Lead } from "@/lib/types";

type CallSession = {
  call_id: string;
  lead: Lead;
  n8n_triggered?: boolean;
};

export function DashboardAutoRefresher({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, intervalMs);

    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [router, intervalMs]);

  return null;
}

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

export function ResetDatabaseButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  async function handleReset() {
    if (!window.confirm("Are you sure you want to clean and reset all test calls and appointments? Leads in your leads table will be preserved.")) {
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/reset-db", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");

      setStatus({ type: "success", text: "Database cleaned! Leads preserved." });
      router.refresh();
      setTimeout(() => setStatus(null), 4000);
    } catch (err) {
      setStatus({ type: "error", text: err instanceof Error ? err.message : "Reset failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
      <button
        className="button secondary"
        onClick={handleReset}
        disabled={loading}
        style={{
          border: "1px solid #d0ded4",
          color: "#4a5d52",
          fontSize: "13px",
          padding: "11px 16px"
        }}
        title="Clears calls, qualifications, and appointments while preserving all leads"
      >
        {loading ? "Cleaning Database…" : "🔄 Clean & Reset DB"}
      </button>
      {status && (
        <span
          className={`badge ${status.type === "success" ? "completed" : "failed"}`}
          style={{ fontSize: "12px", padding: "6px 12px" }}
        >
          {status.text}
        </span>
      )}
    </div>
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
  const [bestVoice, setBestVoice] = useState<SpeechSynthesisVoice | null>(null);

  const recognitionRef = useRef<any>(null);
  const historyRef = useRef<Array<{ role: "assistant" | "user"; content: string }>>([]);
  const isSpeakingRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(false);
  const callEndedRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpokenTextRef = useRef<string>("");
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Sync state refs
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    callEndedRef.current = callEnded;
  }, [callEnded]);

  // Load and select the most natural, human-sounding English voice available
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    function selectNaturalVoice() {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;

      // Priority list of high-definition, neural, and natural sounding voices
      const priorityNames = [
        "Microsoft Jenny Online (Natural)",
        "Microsoft Guy Online (Natural)",
        "Microsoft Aria Online (Natural)",
        "Microsoft Christopher Online (Natural)",
        "Google US English",
        "Samantha (Enhanced)",
        "Daniel (Enhanced)",
        "Ava (Premium)",
        "Natural",
        "Neural"
      ];

      for (const name of priorityNames) {
        const found = voices.find(v => v.name.includes(name) && v.lang.startsWith("en"));
        if (found) {
          setBestVoice(found);
          return;
        }
      }

      // Fallback to any en-US voice that isn't robotic David if possible
      const enVoice = voices.find(v => v.lang === "en-US" && !v.name.toLowerCase().includes("david")) ||
                      voices.find(v => v.lang.startsWith("en"));
      if (enVoice) {
        setBestVoice(enVoice);
      }
    }

    selectNaturalVoice();
    window.speechSynthesis.onvoiceschanged = selectNaturalVoice;
  }, []);

  // Call timer (stops strictly when callEnded is true)
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

  // Stop all microphone listening and clear pending timers
  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }
  }, []);

  // Natural Voice Speech Output with Strict End-of-Call Handling
  const speakVoice = useCallback(async (text: string, isClosingTurn: boolean = false) => {
    // 1. If call is ended by user, do not speak
    if (callEndedRef.current && !isClosingTurn) return;

    // 2. Immediately stop listening while AI speaks
    stopListening();
    isSpeakingRef.current = true;
    setStatus("speaking");

    // 3. Try Server-Side HD Audio TTS first (OpenAI / ElevenLabs if key exists)
    try {
      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "alloy" })
      });

      const contentType = ttsRes.headers.get("Content-Type") || "";
      if (ttsRes.ok && contentType.includes("audio")) {
        const blob = await ttsRes.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audioPlayerRef.current = audio;

        audio.onended = () => {
          isSpeakingRef.current = false;
          URL.revokeObjectURL(audioUrl);
          if (isClosingTurn || callEndedRef.current) {
            setStatus("ended");
            stopListening();
          } else {
            setStatus("listening");
            startListening();
          }
        };

        audio.onerror = () => {
          isSpeakingRef.current = false;
          if (isClosingTurn || callEndedRef.current) {
            setStatus("ended");
            stopListening();
          } else {
            setStatus("listening");
            startListening();
          }
        };

        await audio.play();
        return;
      }
    } catch (e) {
      // Fallback to client browser synthesis
    }

    // 4. Client-side Natural Voice Web Speech Synthesis Fallback
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.98; // Warm conversational pacing
      utterance.pitch = 1.0;

      if (bestVoice) {
        utterance.voice = bestVoice;
      }

      utterance.onstart = () => {
        isSpeakingRef.current = true;
        setStatus("speaking");
      };

      utterance.onend = () => {
        isSpeakingRef.current = false;
        // If this is the final closing line or appointment booked, permanently stop listening!
        if (isClosingTurn || callEndedRef.current) {
          setStatus("ended");
          stopListening();
        } else {
          setStatus("listening");
          startListening();
        }
      };

      utterance.onerror = () => {
        isSpeakingRef.current = false;
        if (isClosingTurn || callEndedRef.current) {
          setStatus("ended");
          stopListening();
        } else {
          setStatus("listening");
          startListening();
        }
      };

      window.speechSynthesis.speak(utterance);
    } else {
      isSpeakingRef.current = false;
      if (isClosingTurn || callEndedRef.current) {
        setStatus("ended");
        stopListening();
      } else {
        setStatus("listening");
        startListening();
      }
    }
  }, [bestVoice, stopListening]);

  // Speech Recognition (Microphone listening)
  const startListening = useCallback(() => {
    // Strictly do NOT start listening if call has ended, muted, or AI is currently speaking
    if (callEndedRef.current || isMutedRef.current || isSpeakingRef.current) return;
    if (typeof window === "undefined") return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        if (!isSpeakingRef.current && !callEndedRef.current) {
          setStatus("listening");
        }
      };

      recognition.onresult = (event: any) => {
        if (isSpeakingRef.current || isMutedRef.current || callEndedRef.current) return;

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
            if (lastSpokenTextRef.current && !isSpeakingRef.current && !callEndedRef.current) {
              const textToSend = lastSpokenTextRef.current;
              lastSpokenTextRef.current = "";
              setLiveTranscript("");
              sendVoiceTurn(textToSend);
            }
          }, 1300);
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error !== "no-speech") {
          console.warn("Speech recognition notice:", e.error);
        }
      };

      recognition.onend = () => {
        // Only restart if call is actively ongoing and agent is not speaking
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
      const isClosing = Boolean(data.call_completed || data.appointment?.booked);

      const newHistory = [...updatedHistory, { role: "assistant" as const, content: agentMsg }];
      setHistory(newHistory);
      historyRef.current = newHistory;

      // If call is finished (appointment booked or disqualified), mark callEnded immediately
      if (isClosing) {
        setCallEnded(true);
        callEndedRef.current = true;
        setSummaryNote(data.summary || "Call completed & appointment booked");
        stopListening();

        // Save completed call data to Supabase/backend
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

      // Speak agent response (with closing flag so it doesn't restart mic if finished)
      speakVoice(agentMsg, isClosing);
    } catch (err) {
      console.error("Call turn processing error:", err);
      if (!callEndedRef.current) {
        setStatus("listening");
        startListening();
      }
    }
  }, [lead, call_id, speakVoice, stopListening, startListening]);

  // Initial call connection
  useEffect(() => {
    const timer = setTimeout(() => {
      sendVoiceTurn();
    }, 500);

    return () => {
      clearTimeout(timer);
      stopListening();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, []);

  // Strict End Call function for user button
  function handleEndCallByUser() {
    setCallEnded(true);
    callEndedRef.current = true;
    stopListening();

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    // Save whatever was discussed so far
    fetch("/api/voice-completion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        call_id,
        call_status: "completed",
        call_outcome: "Call Ended by User",
        recording_url: "https://actions.google.com/sounds/v1/ambiences/office_voices.ogg",
        transcript: historyRef.current.map(h => `${h.role === "assistant" ? "Alex (AI Agent)" : lead.first_name}: ${h.content}`).join("\n"),
        summary: `Call ended with ${lead.first_name} ${lead.last_name}. Duration: ${formatDuration(callDuration)}.`
      })
    }).finally(() => {
      onClose();
    });
  }

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
              {callEnded ? "CALL COMPLETED" : `LIVE SOLAR CALL · ${formatDuration(callDuration)}`}
            </div>
            <h3 style={{ marginTop: "4px", fontSize: "22px" }}>{lead.first_name} {lead.last_name}</h3>
            <p>📞 {lead.phone} · 📍 {lead.property_address || lead.address}</p>
          </div>

          <div className="status-indicator">
            {callEnded ? (
              <span className="badge completed" style={{ fontSize: "13px", padding: "6px 14px" }}>
                ✓ Call Ended
              </span>
            ) : status === "speaking" ? (
              <span className="badge" style={{ background: "#e0f2fe", color: "#0369a1", fontSize: "13px", padding: "6px 14px" }}>
                🔊 Alex Speaking...
              </span>
            ) : status === "processing" ? (
              <span className="badge pending" style={{ fontSize: "13px", padding: "6px 14px" }}>
                ⏳ Processing...
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
            <p className="muted" style={{ margin: "4px 0 10px", fontSize: "12px" }}>
              {bestVoice ? `Voice: ${bestVoice.name.replace(/(Microsoft|Google|Desktop|Online \(Natural\))/g, "").trim() || "Natural Human"}` : "Natural Human Voice"}
            </p>
          </div>

          {/* Sound Wave Equalizer (stops strictly when call ends) */}
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

            {(status === "listening" || status === "processing") && !callEnded && (
              <div className="caption user-caption">
                <strong>🎙️ {lead.first_name} (You):</strong>{" "}
                {liveTranscript ? `“${liveTranscript}”` : latestUserMessage ? `“${latestUserMessage}”` : "Speak into your microphone naturally..."}
              </div>
            )}

            {callEnded && (
              <div className="caption completed-caption" style={{ width: "100%" }}>
                <div style={{ fontSize: "15px", marginBottom: "4px" }}>✅ <strong>Call Finished & Saved</strong></div>
                <div style={{ fontSize: "13px", color: "#166534", fontWeight: "normal" }}>
                  {summaryNote || "Appointment and qualification data recorded."}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Call Controls HUD */}
        <div className="call-controls-hud">
          {!callEnded ? (
            <>
              <button
                className={`hud-btn ${isMuted ? "muted" : ""}`}
                onClick={toggleMute}
                title={isMuted ? "Unmute Mic" : "Mute Mic"}
              >
                <span>{isMuted ? "🔇" : "🎙️"}</span>
                <small>{isMuted ? "Unmute" : "Mute"}</small>
              </button>

              <button
                className="hud-btn danger"
                onClick={handleEndCallByUser}
                style={{ minWidth: "150px" }}
              >
                <span>📞</span>
                <small>End Call</small>
              </button>
            </>
          ) : (
            <button
              className="button"
              onClick={onClose}
              style={{ width: "100%", padding: "14px", fontSize: "15px" }}
            >
              ✓ Close & View Saved Data in Dashboard →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
