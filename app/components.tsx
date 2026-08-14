"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Lead } from "@/lib/types";

export interface CallSession {
  call_id: string;
  lead: Lead;
  n8n_triggered?: boolean;
}

type Turn = { role: "assistant" | "user"; content: string };
type CallStatus = "connecting" | "speaking" | "listening" | "processing" | "ended";

const MAX_INLINE_RECORDING_BYTES = 900_000;

export function DashboardAutoRefresher() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const interval = setInterval(refresh, 10_000);
    window.addEventListener("focus", refresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
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
      const response = await fetch("/api/start-call", {
        method: "POST",
        cache: "no-store"
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to start call");
      if (!body.call_id || !body.lead) throw new Error("Call session was not created correctly");

      setSession({
        call_id: body.call_id,
        lead: body.lead,
        n8n_triggered: body.n8n_triggered
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start AI call");
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

      {message && (
        <span className="alert failed" style={{ margin: 0, padding: "8px 12px", fontSize: "12px" }}>
          {message}
        </span>
      )}

      {session && <RealtimeVoiceCallModal session={session} onClose={handleCloseCall} />}
    </>
  );
}

export function ResetDatabaseButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  async function handleReset() {
    if (!window.confirm("Clean all test calls, qualifications, and appointments? Lead records will be preserved.")) return;

    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/reset-db", {
        method: "POST",
        cache: "no-store"
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Reset failed");

      setStatus({ type: "success", text: "Reset complete" });
      router.refresh();
      setTimeout(() => setStatus(null), 3500);
    } catch (error) {
      setStatus({ type: "error", text: error instanceof Error ? error.message : "Reset failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}>
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
        title="Clears test calls, qualifications, and appointments while preserving leads"
      >
        <span>🔄</span>
        <span>{loading ? "Resetting…" : "Clean & Reset DB"}</span>
      </button>

      {status && (
        <span className={`badge ${status.type === "success" ? "completed" : "failed"}`} style={{ fontSize: "11px", padding: "4px 8px" }}>
          {status.text}
        </span>
      )}
    </div>
  );
}

function RealtimeVoiceCallModal({ session, onClose }: { session: CallSession; onClose: () => void }) {
  const { lead, call_id } = session;
  const [history, setHistory] = useState<Turn[]>([]);
  const [status, setStatus] = useState<CallStatus>("connecting");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callEnded, setCallEnded] = useState(false);
  const [summaryNote, setSummaryNote] = useState("");
  const [micVolume, setMicVolume] = useState(0);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [micNotice, setMicNotice] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  const historyRef = useRef<Turn[]>([]);
  const callEndedRef = useRef(false);
  const isMutedRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const conversationBusyRef = useRef(false);

  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { callEndedRef.current = callEnded; }, [callEnded]);

  useEffect(() => {
    if (callEnded) return;
    const interval = setInterval(() => setCallDuration(value => value + 1), 1000);
    return () => clearInterval(interval);
  }, [callEnded]);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${secs}`;
  };

  const browserSpeak = useCallback((text: string) => new Promise<void>((resolve) => {
    if (callEndedRef.current || typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.03;
    utterance.pitch = 1;
    utterance.lang = "en-US";

    const voices = window.speechSynthesis.getVoices();
    const preferred = ["Microsoft Jenny Online", "Microsoft Guy Online", "Google US English", "Samantha", "Daniel", "Zira"];
    for (const name of preferred) {
      const match = voices.find(voice => voice.name.includes(name) && voice.lang.startsWith("en"));
      if (match) {
        utterance.voice = match;
        break;
      }
    }

    if (!utterance.voice) {
      utterance.voice = voices.find(voice => voice.lang === "en-US") || voices.find(voice => voice.lang.startsWith("en")) || null;
    }

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  }), []);

  const speakText = useCallback(async (text: string) => {
    if (callEndedRef.current) return;

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        cache: "no-store"
      });

      const contentType = response.headers.get("content-type") || "";
      if (response.ok && contentType.startsWith("audio/")) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentAudioRef.current = audio;

        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
        });

        URL.revokeObjectURL(url);
        currentAudioRef.current = null;
        return;
      }
    } catch (error) {
      console.warn("Premium TTS unavailable, using browser voice:", error);
    }

    await browserSpeak(text);
  }, [browserSpeak]);

  const listenOnce = useCallback(() => new Promise<string>((resolve) => {
    if (callEndedRef.current || isMutedRef.current || typeof window === "undefined") {
      resolve("");
      return;
    }

    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setSpeechSupported(false);
      setMicNotice("Speech recognition is not supported in this browser. Type your reply below or use Chrome/Edge.");
      resolve("");
      return;
    }

    setSpeechSupported(true);
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }

    let settled = false;
    let accumulated = "";
    const settle = (value: string) => {
      if (!settled) {
        settled = true;
        resolve(value.trim());
      }
    };

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      if (callEndedRef.current || isMutedRef.current) return;

      let interim = "";
      let finalPart = "";
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal) finalPart += ` ${result[0].transcript}`;
        else interim += ` ${result[0].transcript}`;
      }

      if (finalPart) accumulated += finalPart;
      const display = `${accumulated} ${interim}`.trim();
      setLiveTranscript(display);

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        try { recognition.stop(); } catch {}
        recognitionRef.current = null;
        settle(display);
      }, 1200);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setMicNotice("Microphone/speech permission was blocked. Type your reply below or allow microphone access.");
        setSpeechSupported(false);
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        setMicNotice(`Speech recognition issue: ${event.error}. You can type your reply below.`);
      }
      settle(accumulated);
    };

    recognition.onend = () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (!settled) settle(accumulated);
    };

    try {
      recognition.start();
    } catch (error) {
      console.warn("Recognition start notice:", error);
      settle("");
    }
  }), []);

  const stopAndGetRecording = useCallback(async (): Promise<string | null> => {
    try {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        await new Promise<void>((resolve) => {
          const done = () => resolve();
          recorder.addEventListener("stop", done, { once: true });
          try { recorder.stop(); } catch { resolve(); }
          setTimeout(resolve, 1000);
        });
      }

      if (!recordedChunksRef.current.length) return null;
      const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
      if (blob.size < 500 || blob.size > MAX_INLINE_RECORDING_BYTES) return null;

      return await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn("Recording finalize notice:", error);
      return null;
    }
  }, []);

  const saveCompletion = useCallback(async (payload: Record<string, unknown>) => {
    setSaveState("saving");
    const response = await fetch("/api/voice-completion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
      cache: "no-store"
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setSaveState("failed");
      throw new Error(body.error || "Call could not be saved");
    }
    setSaveState("saved");
    return body;
  }, []);

  const runConversationLoop = useCallback(async (userText?: string) => {
    if (callEndedRef.current || conversationBusyRef.current) return;
    conversationBusyRef.current = true;

    let currentHistory = [...historyRef.current];
    if (userText?.trim()) {
      currentHistory = [...currentHistory, { role: "user", content: userText.trim() }];
      historyRef.current = currentHistory;
      setHistory(currentHistory);
    }

    setStatus("processing");
    setLiveTranscript("");

    try {
      const response = await fetch("/api/ai-agent-speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead,
          conversationHistory: currentHistory,
          userUtterance: userText?.trim() || ""
        }),
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The conversation engine failed");

      const agentMessage = typeof data.agent_message === "string" && data.agent_message.trim()
        ? data.agent_message.trim()
        : "Could you repeat that for me?";

      const newHistory: Turn[] = [...currentHistory, { role: "assistant", content: agentMessage }];
      historyRef.current = newHistory;
      setHistory(newHistory);

      setStatus("speaking");
      await speakText(agentMessage);

      const isClosing = Boolean(data.call_completed || data.appointment?.booked);
      if (isClosing || callEndedRef.current) {
        setCallEnded(true);
        callEndedRef.current = true;
        setStatus("ended");
        setSummaryNote(data.summary || "Call completed");

        const recordingUrl = await stopAndGetRecording();
        try {
          await saveCompletion({
            call_id,
            call_status: "completed",
            call_outcome: data.appointment?.booked ? "Appointment Booked" : "Completed",
            recording_url: recordingUrl || undefined,
            transcript: newHistory.map(turn => `${turn.role === "assistant" ? "Alex (AI Agent)" : lead.first_name}: ${turn.content}`).join("\n"),
            summary: data.summary,
            appointment_booked: Boolean(data.appointment?.booked),
            qualification: data.qualification,
            appointment: data.appointment
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Call save failed";
          setSummaryNote(`${data.summary || "Call completed"} Save issue: ${message}`);
        }
        return;
      }

      setStatus("listening");
      conversationBusyRef.current = false;
      const reply = await listenOnce();
      if (reply && !callEndedRef.current) {
        await runConversationLoop(reply);
      }
    } catch (error) {
      console.error("Conversation error:", error);
      setMicNotice(error instanceof Error ? error.message : "Conversation error. Try typing a reply below.");
      if (!callEndedRef.current) setStatus("listening");
    } finally {
      conversationBusyRef.current = false;
    }
  }, [call_id, lead, listenOnce, saveCompletion, speakText, stopAndGetRecording]);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function initialize() {
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          });
          mediaStreamRef.current = stream;

          try {
            recordedChunksRef.current = [];
            const mimeType = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
            const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            recorder.ondataavailable = event => {
              if (event.data?.size) recordedChunksRef.current.push(event.data);
            };
            recorder.start(500);
            mediaRecorderRef.current = recorder;
          } catch (error) {
            console.warn("MediaRecorder unavailable:", error);
          }

          try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
              const context = new AudioContextClass();
              audioContextRef.current = context;
              const source = context.createMediaStreamSource(stream);
              const analyser = context.createAnalyser();
              analyser.fftSize = 64;
              source.connect(analyser);
              const data = new Uint8Array(analyser.frequencyBinCount);

              const pump = () => {
                if (callEndedRef.current) return;
                analyser.getByteFrequencyData(data);
                const average = data.reduce((sum, value) => sum + value, 0) / Math.max(1, data.length);
                setMicVolume(Math.min(100, Math.round((average / 128) * 100)));
                animFrameRef.current = requestAnimationFrame(pump);
              };
              pump();
            }
          } catch (error) {
            console.warn("Audio analyser unavailable:", error);
          }
        }
      } catch (error) {
        console.warn("Microphone access notice:", error);
        setMicNotice("Microphone access is unavailable. You can still test the agent by typing replies below.");
      }

      if (!("SpeechRecognition" in window) && !("webkitSpeechRecognition" in window)) {
        setSpeechSupported(false);
        setMicNotice("Speech recognition is unavailable in this browser. Type replies below or use Chrome/Edge.");
      }

      if ("speechSynthesis" in window) {
        window.speechSynthesis.getVoices();
      }

      runConversationLoop();
    }

    initialize();

    return () => {
      callEndedRef.current = true;
      conversationBusyRef.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => undefined);
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (mediaRecorderRef.current?.state !== "inactive") {
        try { mediaRecorderRef.current?.stop(); } catch {}
      }
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [runConversationLoop]);

  async function handleEndCallByUser() {
    if (callEndedRef.current) return;
    setCallEnded(true);
    callEndedRef.current = true;
    setStatus("ended");

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (currentAudioRef.current) currentAudioRef.current.pause();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();

    const recordingUrl = await stopAndGetRecording();
    const summary = `Call ended with ${lead.first_name} ${lead.last_name}. Duration: ${formatDuration(callDuration)}.`;
    setSummaryNote(summary);

    try {
      await saveCompletion({
        call_id,
        call_status: "completed",
        call_outcome: "Call Ended by User",
        recording_url: recordingUrl || undefined,
        transcript: historyRef.current.map(turn => `${turn.role === "assistant" ? "Alex (AI Agent)" : lead.first_name}: ${turn.content}`).join("\n"),
        summary
      });
    } catch (error) {
      setSummaryNote(`${summary} Save issue: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  function toggleMute() {
    const next = !isMuted;
    setIsMuted(next);
    isMutedRef.current = next;

    if (next) {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
      setStatus("processing");
      return;
    }

    setStatus("listening");
    if (speechSupported) {
      listenOnce().then(text => {
        if (text && !callEndedRef.current) runConversationLoop(text);
      });
    }
  }

  function submitManualReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = manualInput.trim();
    if (!text || callEnded || status === "processing" || status === "speaking") return;
    setManualInput("");
    runConversationLoop(text);
  }

  const latestAssistantMessage = [...history].reverse().find(turn => turn.role === "assistant")?.content;
  const latestUserMessage = [...history].reverse().find(turn => turn.role === "user")?.content;

  return (
    <div className="modal-overlay">
      <div className="voice-agent-modal">
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
              <span className={`badge ${saveState === "failed" ? "failed" : "completed"}`} style={{ fontSize: "12px", padding: "6px 12px" }}>
                {saveState === "saving" ? "Saving…" : saveState === "failed" ? "⚠ Save Issue" : "✓ Completed"}
              </span>
            ) : status === "speaking" ? (
              <span className="badge" style={{ background: "rgba(6, 182, 212, 0.15)", borderColor: "rgba(6, 182, 212, 0.4)", color: "#38bdf8", fontSize: "12px", padding: "6px 12px" }}>
                🔊 Alex Speaking...
              </span>
            ) : status === "processing" ? (
              <span className="badge pending" style={{ fontSize: "12px", padding: "6px 12px" }}>⚡ Thinking...</span>
            ) : (
              <span className="badge completed" style={{ fontSize: "12px", padding: "6px 12px" }}>🎙️ Listening...</span>
            )}
          </div>
        </div>

        <div className="voice-call-screen">
          <div className={`caller-avatar ${status === "speaking" ? "speaking" : status === "listening" ? "listening" : ""}`}>
            <span style={{ fontSize: "32px" }}>⚡</span>
            <div className="sound-ripples"><span /><span /><span /></div>
          </div>

          <div className="call-agent-identity">
            <h4>Alex · Solar AI Voice Consultant</h4>
            <p className="muted" style={{ margin: "4px 0 10px", fontSize: "12px" }}>
              Script-controlled conversation · Gemini optional · Browser/premium voice
            </p>
          </div>

          {!callEnded && (
            <div className={`sound-wave ${status === "speaking" ? "active-agent" : "active-user"}`} style={{ height: "36px" }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(index => {
                const height = status === "speaking"
                  ? Math.max(6, (index % 3 + 1) * 8)
                  : Math.max(6, Math.min(32, Math.round((micVolume / 100) * 32 + (index % 2) * 6)));
                return <div key={index} className={`bar bar${index}`} style={{ height: `${height}px`, transition: "height 0.1s ease" }} />;
              })}
            </div>
          )}

          <div className="live-caption-box">
            {status === "speaking" && latestAssistantMessage && (
              <div className="caption agent-caption"><strong>🤖 Alex:</strong> &ldquo;{latestAssistantMessage}&rdquo;</div>
            )}

            {(status === "listening" || status === "processing") && !callEnded && (
              <div className="caption user-caption">
                <strong>🎙️ {lead.first_name} (You):</strong>{" "}
                {liveTranscript ? (
                  <span style={{ color: "#34d399", fontWeight: 700 }}>&ldquo;{liveTranscript}&rdquo;</span>
                ) : latestUserMessage ? (
                  `"${latestUserMessage}"`
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>Speak naturally or type your reply below...</span>
                )}
              </div>
            )}

            {micNotice && !callEnded && (
              <div className="caption" style={{ color: "#fbbf24", fontSize: "12px" }}>⚠ {micNotice}</div>
            )}

            {callEnded && (
              <div className={`caption ${saveState === "failed" ? "failed" : "completed-caption"}`} style={{ width: "100%" }}>
                <div style={{ fontSize: "14px", fontWeight: 700 }}>
                  {saveState === "failed" ? "⚠ Call Concluded — Save Needs Attention" : "✅ Call Concluded & Saved"}
                </div>
                <div style={{ fontSize: "12.5px", marginTop: "4px", color: "var(--text-secondary)" }}>
                  {summaryNote || "Qualification data and consultation logged."}
                </div>
              </div>
            )}
          </div>

          {!callEnded && (
            <form onSubmit={submitManualReply} style={{ display: "flex", gap: "8px", width: "100%", marginTop: "12px" }}>
              <input
                value={manualInput}
                onChange={event => setManualInput(event.target.value)}
                placeholder={speechSupported ? "Optional: type a reply instead of speaking" : "Type your reply here"}
                disabled={status === "processing" || status === "speaking"}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  color: "inherit"
                }}
              />
              <button className="button secondary" type="submit" disabled={!manualInput.trim() || status === "processing" || status === "speaking"}>
                Send
              </button>
            </form>
          )}
        </div>

        <div className="call-controls-hud">
          {!callEnded ? (
            <>
              <button className={`hud-btn ${isMuted ? "muted" : ""}`} onClick={toggleMute} title={isMuted ? "Unmute Mic" : "Mute Mic"}>
                <span>{isMuted ? "🔇" : "🎙️"}</span>
                <small>{isMuted ? "Unmute" : "Mute"}</small>
              </button>

              <button className="hud-btn danger" onClick={handleEndCallByUser} style={{ minWidth: "160px", padding: "10px 24px" }}>
                <span style={{ fontSize: "20px" }}>📞</span>
                <small style={{ fontSize: "13px" }}>End Call</small>
              </button>
            </>
          ) : (
            <button className="button" onClick={onClose} style={{ width: "100%", height: "48px", fontSize: "14px" }}>
              ✓ Close & Review Records →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
