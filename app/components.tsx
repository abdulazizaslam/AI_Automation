"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Lead } from "@/lib/types";

export interface CallSession {
  call_id: string;
  lead: Lead;
  n8n_triggered?: boolean;
}

export function DashboardAutoRefresher() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 4000);

    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [router]);

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
      <button
        className="button"
        onClick={startCall}
        disabled={busy}
        style={{
          gap: "8px",
          height: "44px",
          padding: "0 18px",
          display: "inline-flex",
          alignItems: "center",
          whiteSpace: "nowrap",
          boxSizing: "border-box"
        }}
      >
        <span style={{ fontSize: "15px" }}>📞</span>
        <span>{busy ? "Connecting Live Agent…" : "Start Real-Time Voice Call"}</span>
      </button>
      {message && <span className="alert" style={{ margin: 0, padding: "8px 12px", fontSize: "12px" }}>{message}</span>}

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

      setStatus({ type: "success", text: "Reset!" });
      router.refresh();
      setTimeout(() => setStatus(null), 3500);
    } catch (err) {
      setStatus({ type: "error", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div suppressHydrationWarning style={{ display: "inline-flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}>
      <button
        className="button danger"
        onClick={handleReset}
        disabled={loading}
        style={{
          background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
          border: "1px solid #b91c1c",
          color: "#ffffff",
          fontWeight: 700,
          fontSize: "13.5px",
          height: "44px",
          padding: "0 16px",
          display: "inline-flex",
          alignItems: "center",
          gap: "7px",
          whiteSpace: "nowrap",
          boxSizing: "border-box",
          boxShadow: "0 4px 14px rgba(239, 68, 68, 0.35)"
        }}
        title="Clears calls, qualifications, and appointments while preserving all leads"
      >
        <span>🔄</span>
        <span>{loading ? "Resetting…" : "Clean & Reset DB"}</span>
      </button>
      {status && (
        <span
          className={`badge ${status.type === "success" ? "completed" : "failed"}`}
          style={{ fontSize: "11px", padding: "4px 8px" }}
        >
          {status.text}
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  REALTIME VOICE CALL MODAL — Simple Sequential Flow
//  Agent speaks → User listens → User speaks → Agent responds
// ═══════════════════════════════════════════════════════

function RealtimeVoiceCallModal({ session, onClose }: { session: CallSession; onClose: () => void }) {
  const { lead, call_id } = session;
  const [history, setHistory] = useState<Array<{ role: "assistant" | "user"; content: string }>>([]);
  const [status, setStatus] = useState<"connecting" | "speaking" | "listening" | "processing" | "ended">("connecting");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callEnded, setCallEnded] = useState(false);
  const [summaryNote, setSummaryNote] = useState("");
  const [micVolume, setMicVolume] = useState(0);

  const historyRef = useRef<Array<{ role: "assistant" | "user"; content: string }>>([]);
  const callEndedRef = useRef(false);
  const isMutedRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Sync refs
  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { callEndedRef.current = callEnded; }, [callEnded]);

  // Call timer
  useEffect(() => {
    if (callEnded) return;
    const interval = setInterval(() => setCallDuration(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [callEnded]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // ─── SPEAK: Agent speaks text using browser TTS (returns a Promise) ───
  const speakText = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (callEndedRef.current || typeof window === "undefined" || !("speechSynthesis" in window)) {
        resolve();
        return;
      }
      window.speechSynthesis.cancel();

      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 1.05;
      utt.pitch = 1.0;
      utt.lang = "en-US";

      // Pick the best available English voice
      const voices = window.speechSynthesis.getVoices();
      const preferred = ["Microsoft Jenny Online", "Microsoft Guy Online", "Google US English", "Samantha", "Daniel"];
      for (const name of preferred) {
        const v = voices.find(v => v.name.includes(name) && v.lang.startsWith("en"));
        if (v) { utt.voice = v; break; }
      }
      if (!utt.voice) {
        const en = voices.find(v => v.lang === "en-US") || voices.find(v => v.lang.startsWith("en"));
        if (en) utt.voice = en;
      }

      utt.onend = () => resolve();
      utt.onerror = () => resolve();
      window.speechSynthesis.speak(utt);
    });
  }, []);

  // ─── LISTEN: Wait for user speech via SpeechRecognition (returns a Promise<string>) ───
  const listenOnce = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      if (callEndedRef.current || isMutedRef.current || typeof window === "undefined") {
        resolve("");
        return;
      }

      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) {
        resolve("");
        return;
      }

      // Clean up any previous instance
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
        recognitionRef.current = null;
      }

      let resolved = false;
      const safeResolve = (val: string) => {
        if (!resolved) {
          resolved = true;
          resolve(val);
        }
      };

      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognitionRef.current = recognition;

      let accumulated = "";

      recognition.onresult = (event: any) => {
        if (callEndedRef.current || isMutedRef.current) return;

        let interim = "";
        let finalPart = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalPart += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (finalPart) accumulated += " " + finalPart;
        const display = (accumulated + " " + interim).trim();
        setLiveTranscript(display);

        // Reset silence timer — resolve after 1.5s of silence
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          const result = display.trim();
          try { recognition.stop(); } catch (e) {}
          recognitionRef.current = null;
          safeResolve(result);
        }, 1500);
      };

      recognition.onerror = (e: any) => {
        if (e.error === "no-speech") {
          // No speech detected — restart after a brief delay
          try { recognition.stop(); } catch (e) {}
          recognitionRef.current = null;
          if (!callEndedRef.current && !isMutedRef.current) {
            setTimeout(() => {
              if (!callEndedRef.current && !isMutedRef.current) {
                listenOnce().then(safeResolve);
              } else {
                safeResolve("");
              }
            }, 300);
          } else {
            safeResolve("");
          }
          return;
        }
        if (e.error !== "aborted") {
          console.warn("SpeechRecognition error:", e.error);
        }
        safeResolve(accumulated.trim());
      };

      recognition.onend = () => {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        // If not yet resolved and we have text, resolve it
        if (!resolved && accumulated.trim()) {
          safeResolve(accumulated.trim());
        }
      };

      try {
        recognition.start();
      } catch (e) {
        console.warn("Could not start recognition:", e);
        safeResolve("");
      }
    });
  }, []);

  // ─── CONVERSATION LOOP: Agent speaks → User speaks → repeat ───
  const runConversationLoop = useCallback(async (userText?: string) => {
    if (callEndedRef.current) return;

    // 1. Add user message to history (if any)
    let currentHistory = [...historyRef.current];
    if (userText) {
      currentHistory.push({ role: "user", content: userText });
      setHistory(currentHistory);
      historyRef.current = currentHistory;
    }

    // 2. Get agent response from API
    setStatus("processing");
    setLiveTranscript("");

    try {
      const res = await fetch("/api/ai-agent-speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead,
          conversationHistory: currentHistory,
          userUtterance: userText || ""
        })
      });

      const data = await res.json();
      const agentMsg = data.agent_message || "Thank you for your time!";
      const isClosing = Boolean(data.call_completed || data.appointment?.booked);

      // Add agent reply to history
      const newHistory = [...currentHistory, { role: "assistant" as const, content: agentMsg }];
      setHistory(newHistory);
      historyRef.current = newHistory;

      // 3. Agent speaks the response
      setStatus("speaking");
      await speakText(agentMsg);

      // 4. If call is done, save and exit
      if (isClosing || callEndedRef.current) {
        setCallEnded(true);
        callEndedRef.current = true;
        setStatus("ended");
        setSummaryNote(data.summary || "Call completed");

        const recordingUrl = await getRecordingUrl();
        await fetch("/api/voice-completion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            call_id,
            call_status: "completed",
            call_outcome: data.appointment?.booked ? "Appointment Booked" : "Completed",
            recording_url: recordingUrl,
            transcript: newHistory.map(h => `${h.role === "assistant" ? "Alex (AI Agent)" : lead.first_name}: ${h.content}`).join("\n"),
            summary: data.summary,
            appointment_booked: Boolean(data.appointment?.booked),
            qualification: data.qualification,
            appointment: data.appointment
          })
        });
        return;
      }

      // 5. Listen for user's reply
      if (!callEndedRef.current && !isMutedRef.current) {
        setStatus("listening");
        const userReply = await listenOnce();

        if (userReply && !callEndedRef.current) {
          // Got speech — do another conversation turn
          await runConversationLoop(userReply);
        } else if (!callEndedRef.current && !isMutedRef.current) {
          // No speech — try listening again
          setStatus("listening");
          const retry = await listenOnce();
          if (retry && !callEndedRef.current) {
            await runConversationLoop(retry);
          }
        }
      }
    } catch (err) {
      console.error("Conversation loop error:", err);
      if (!callEndedRef.current) {
        setStatus("listening");
      }
    }
  }, [lead, call_id, speakText, listenOnce]);

  // Get audio recording as data URL
  const getRecordingUrl = useCallback(async (): Promise<string> => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      await new Promise(r => setTimeout(r, 200));
      if (recordedChunksRef.current.length > 0) {
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        if (blob.size > 500) {
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        }
      }
    } catch (e) {}
    return "";
  }, []);

  // ─── INIT: Get microphone, start recording, kick off agent ───
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function init() {
      // 1. Get microphone access
      try {
        if (typeof window !== "undefined" && navigator.mediaDevices?.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          });
          mediaStreamRef.current = stream;

          // Start recording for Supabase
          try {
            recordedChunksRef.current = [];
            const mt = (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm")) ? "audio/webm" : "";
            const recorder = mt ? new MediaRecorder(stream, { mimeType: mt }) : new MediaRecorder(stream);
            recorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
            };
            recorder.start(400);
            mediaRecorderRef.current = recorder;
          } catch (e) {}

          // Volume meter
          try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) {
              const ctx = new AudioCtx();
              audioContextRef.current = ctx;
              const source = ctx.createMediaStreamSource(stream);
              const analyser = ctx.createAnalyser();
              analyser.fftSize = 64;
              source.connect(analyser);
              const dataArr = new Uint8Array(analyser.frequencyBinCount);
              const pump = () => {
                if (callEndedRef.current) return;
                analyser.getByteFrequencyData(dataArr);
                let sum = 0;
                for (let i = 0; i < dataArr.length; i++) sum += dataArr[i];
                setMicVolume(Math.min(100, Math.round((sum / dataArr.length / 128) * 100)));
                animFrameRef.current = requestAnimationFrame(pump);
              };
              pump();
            }
          } catch (e) {}
        }
      } catch (e) {
        console.warn("Microphone access error:", e);
      }

      // 2. Wait for TTS voices to load
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.getVoices();
        await new Promise(r => setTimeout(r, 400));
      }

      // 3. Start the conversation — agent speaks first (no user input)
      runConversationLoop();
    }

    init();

    return () => {
      callEndedRef.current = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // ─── End call manually ───
  async function handleEndCallByUser() {
    setCallEnded(true);
    callEndedRef.current = true;
    setStatus("ended");

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
    }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    const recordingUrl = await getRecordingUrl();
    fetch("/api/voice-completion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        call_id,
        call_status: "completed",
        call_outcome: "Call Ended by User",
        recording_url: recordingUrl,
        transcript: historyRef.current.map(h => `${h.role === "assistant" ? "Alex (AI Agent)" : lead.first_name}: ${h.content}`).join("\n"),
        summary: `Call ended with ${lead.first_name} ${lead.last_name}. Duration: ${formatDuration(callDuration)}.`
      })
    }).finally(() => onClose());
  }

  function toggleMute() {
    const next = !isMuted;
    setIsMuted(next);
    isMutedRef.current = next;
    if (next) {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
      setStatus("processing");
    } else {
      setStatus("listening");
      listenOnce().then(text => {
        if (text && !callEndedRef.current) {
          runConversationLoop(text);
        }
      });
    }
  }

  const latestAssistantMessage = [...history].reverse().find(h => h.role === "assistant")?.content;
  const latestUserMessage = [...history].reverse().find(h => h.role === "user")?.content;

  return (
    <div className="modal-overlay">
      <div className="voice-agent-modal">
        {/* Header */}
        <div className="call-header">
          <div className="lead-title">
            <div className="call-badge-live">
              <span className="pulse-dot" />
              <span>{callEnded ? "SESSION TERMINATED" : `REALTIME VOICE CALL · ${formatDuration(callDuration)}`}</span>
            </div>
            <h3>{lead.first_name} {lead.last_name}</h3>
            <p>📞 {lead.phone} · 📍 {lead.property_address || lead.address}</p>
          </div>

          <div className="status-indicator">
            {callEnded ? (
              <span className="badge completed" style={{ fontSize: "12px", padding: "6px 12px" }}>
                ✓ Completed
              </span>
            ) : status === "speaking" ? (
              <span className="badge" style={{ background: "rgba(6, 182, 212, 0.15)", borderColor: "rgba(6, 182, 212, 0.4)", color: "#38bdf8", fontSize: "12px", padding: "6px 12px" }}>
                🔊 Alex Speaking...
              </span>
            ) : status === "processing" ? (
              <span className="badge pending" style={{ fontSize: "12px", padding: "6px 12px" }}>
                ⚡ Thinking...
              </span>
            ) : (
              <span className="badge completed" style={{ fontSize: "12px", padding: "6px 12px" }}>
                🎙️ Mic Active & Listening...
              </span>
            )}
          </div>
        </div>

        {/* Screen */}
        <div className="voice-call-screen">
          <div className={`caller-avatar ${status === "speaking" ? "speaking" : status === "listening" ? "listening" : ""}`}>
            <span style={{ fontSize: "32px" }}>⚡</span>
            <div className="sound-ripples">
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="call-agent-identity">
            <h4>Alex · Solar AI Voice Consultant</h4>
            <p className="muted" style={{ margin: "4px 0 10px", fontSize: "12px" }}>
              Engine: Gemini 2.0 Flash · Browser Speech Recognition
            </p>
          </div>

          {/* Soundwave */}
          {!callEnded && (
            <div className={`sound-wave ${status === "speaking" ? "active-agent" : "active-user"}`} style={{ height: "36px" }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
                const heightVal = status === "speaking"
                  ? Math.max(6, (i % 3 + 1) * 8)
                  : Math.max(6, Math.min(32, Math.round((micVolume / 100) * 32 + (i % 2) * 6)));
                return (
                  <div
                    key={i}
                    className={`bar bar${i}`}
                    style={{ height: `${heightVal}px`, transition: "height 0.1s ease" }}
                  />
                );
              })}
            </div>
          )}

          {/* Live Captions */}
          <div className="live-caption-box">
            {status === "speaking" && latestAssistantMessage && (
              <div className="caption agent-caption">
                <strong>🤖 Alex:</strong> &ldquo;{latestAssistantMessage}&rdquo;
              </div>
            )}

            {(status === "listening" || status === "processing") && !callEnded && (
              <div className="caption user-caption">
                <strong>🎙️ {lead.first_name} (You):</strong>{" "}
                {liveTranscript ? (
                  <span style={{ color: "#34d399", fontWeight: 700 }}>"{liveTranscript}"</span>
                ) : latestUserMessage ? (
                  `"${latestUserMessage}"`
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>Speak into your microphone naturally...</span>
                )}
              </div>
            )}

            {callEnded && (
              <div className="caption completed-caption" style={{ width: "100%" }}>
                <div style={{ fontSize: "14px", fontWeight: 700 }}>✅ Call Concluded & Saved</div>
                <div style={{ fontSize: "12.5px", marginTop: "4px", color: "var(--text-secondary)" }}>
                  {summaryNote || "Qualification data and consultation logged into Supabase."}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
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
                style={{ minWidth: "160px", padding: "10px 24px" }}
              >
                <span style={{ fontSize: "20px" }}>📞</span>
                <small style={{ fontSize: "13px" }}>End Call</small>
              </button>
            </>
          ) : (
            <button
              className="button"
              onClick={onClose}
              style={{ width: "100%", height: "48px", fontSize: "14px" }}
            >
              ✓ Close Terminal & Review Records →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
