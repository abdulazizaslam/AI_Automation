"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Lead } from "@/lib/types";
import { GeminiLiveClient } from "@/lib/gemini-live-client";

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
  const [micVolume, setMicVolume] = useState<number>(0);
  const [isGeminiLiveStreaming, setIsGeminiLiveStreaming] = useState<boolean>(false);

  const recognitionRef = useRef<any>(null);
  const geminiLiveRef = useRef<GeminiLiveClient | null>(null);
  const historyRef = useRef<Array<{ role: "assistant" | "user"; content: string }>>([]);
  const isSpeakingRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(false);
  const callEndedRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpokenTextRef = useRef<string>("");
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

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

  // Helper to compile recorded audio blob to Base64 data URL
  const getAudioRecordingUrl = useCallback(async (): Promise<string> => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      await new Promise(r => setTimeout(r, 200));

      if (recordedChunksRef.current.length > 0) {
        const audioBlob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        if (audioBlob.size > 500) {
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve(reader.result as string);
            };
            reader.readAsDataURL(audioBlob);
          });
        }
      }
    } catch (err) {
      console.warn("Could not encode audio recording:", err);
    }
    return "https://actions.google.com/sounds/v1/ambiences/office_voices.ogg";
  }, []);

  // Natural Human Voice Selector
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    function selectNaturalVoice() {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;

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

      const enVoice = voices.find(v => v.lang === "en-US" && !v.name.toLowerCase().includes("david")) ||
                      voices.find(v => v.lang.startsWith("en"));
      if (enVoice) {
        setBestVoice(enVoice);
      }
    }

    selectNaturalVoice();
    window.speechSynthesis.onvoiceschanged = selectNaturalVoice;
  }, []);

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

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
      recognitionRef.current = null;
    }
  }, []);

  // Natural Voice Speech Output
  const speakVoice = useCallback((text: string, isClosingTurn: boolean = false) => {
    if (callEndedRef.current) return;

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.04;
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
        if (isClosingTurn || callEndedRef.current) {
          setStatus("ended");
          stopListening();
        } else {
          setStatus("listening");
        }
      };

      utterance.onerror = () => {
        isSpeakingRef.current = false;
        if (isClosingTurn || callEndedRef.current) {
          setStatus("ended");
          stopListening();
        } else {
          setStatus("listening");
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
      }
    }
  }, [bestVoice, stopListening]);

  // Send turn to backend
  const sendVoiceTurn = useCallback(async (userUtterance?: string) => {
    if (callEndedRef.current) return;
    setStatus("processing");

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

      if (isClosing) {
        setCallEnded(true);
        callEndedRef.current = true;
        setSummaryNote(data.summary || "Call completed & appointment booked");
        stopListening();

        const finalRecordingUrl = await getAudioRecordingUrl();

        await fetch("/api/voice-completion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            call_id,
            call_status: "completed",
            call_outcome: data.appointment?.booked ? "Appointment Booked" : "Completed",
            recording_url: finalRecordingUrl,
            transcript: newHistory.map(h => `${h.role === "assistant" ? "Alex (AI Agent)" : lead.first_name}: ${h.content}`).join("\n"),
            summary: data.summary,
            appointment_booked: Boolean(data.appointment?.booked),
            qualification: data.qualification,
            appointment: data.appointment
          })
        });
      }

      speakVoice(agentMsg, isClosing);
    } catch (err) {
      console.error("Call turn error:", err);
      if (!callEndedRef.current) {
        setStatus("listening");
      }
    }
  }, [lead, call_id, speakVoice, stopListening, getAudioRecordingUrl]);

  // Speech Recognition (Duplex Fallback)
  const startListening = useCallback(() => {
    if (callEndedRef.current || isMutedRef.current) return;
    if (typeof window === "undefined") return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
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
        if (isMutedRef.current || callEndedRef.current) return;

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

        if (isSpeakingRef.current && recognizedText.length > 0) {
          if (typeof window !== "undefined" && "speechSynthesis" in window) {
            window.speechSynthesis.cancel();
          }
          if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
          }
          isSpeakingRef.current = false;
          setStatus("listening");
        }

        if (recognizedText) {
          setLiveTranscript(recognizedText);
          lastSpokenTextRef.current = recognizedText;

          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (lastSpokenTextRef.current && !callEndedRef.current) {
              const textToSend = lastSpokenTextRef.current;
              lastSpokenTextRef.current = "";
              setLiveTranscript("");
              sendVoiceTurn(textToSend);
            }
          }, 550);
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error !== "no-speech") {
          console.warn("Speech recognition notice:", e.error);
        }
      };

      recognition.onend = () => {
        if (!callEndedRef.current && !isMutedRef.current) {
          try {
            recognition.start();
          } catch (e) {}
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.warn("Speech recognition init notice:", e);
    }
  }, [sendVoiceTurn]);

  // Main Call Initializer
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    if (typeof window !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      }).then((stream) => {
        mediaStreamRef.current = stream;
        activeStream = stream;

        // Start call recorder for Supabase audio save
        try {
          recordedChunksRef.current = [];
          const mimeType = (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm")) ? "audio/webm" : "";
          const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              recordedChunksRef.current.push(e.data);
            }
          };
          recorder.start(400);
          mediaRecorderRef.current = recorder;
        } catch (err) {
          console.warn("MediaRecorder start notice:", err);
        }

        // Live AudioContext Volume Analyser
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            analyserRef.current = analyser;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const checkVolume = () => {
              if (callEndedRef.current) return;
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
              animFrameRef.current = requestAnimationFrame(checkVolume);
            };
            checkVolume();
          }
        } catch (err) {
          console.warn("Audio analyser notice:", err);
        }

        // Start listening & immediately trigger Agent's Step 1 Opening Hook!
        startListening();
        sendVoiceTurn();
      }).catch((err) => {
        console.warn("Microphone access notice:", err);
        startListening();
        sendVoiceTurn();
      });
    } else {
      startListening();
      sendVoiceTurn();
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
      }
      stopListening();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, []);

  async function handleEndCallByUser() {
    setCallEnded(true);
    callEndedRef.current = true;
    if (geminiLiveRef.current) geminiLiveRef.current.stop();
    stopListening();

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    const finalRecordingUrl = await getAudioRecordingUrl();

    fetch("/api/voice-completion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        call_id,
        call_status: "completed",
        call_outcome: "Call Ended by User",
        recording_url: finalRecordingUrl,
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
      <div className="voice-agent-modal">
        {/* Header */}
        <div className="call-header">
          <div className="lead-title">
            <div className="call-badge-live">
              <span className="pulse-dot" />
              <span>{callEnded ? "SESSION TERMINATED" : isGeminiLiveStreaming ? `GEMINI LIVE STREAMING · ${formatDuration(callDuration)}` : `REALTIME VOICE CALL · ${formatDuration(callDuration)}`}</span>
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
              {isGeminiLiveStreaming ? "Engine: Google Gemini Multimodal Live API (Aoede)" : bestVoice ? `Voice: ${bestVoice.name.replace(/(Microsoft|Google|Desktop|Online \(Natural\))/g, "").trim()}` : "Gemini 2.0 Flash Fast Streaming"}
            </p>
          </div>

          {/* Dynamic Soundwave (Reacts to live mic volume) */}
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
                  <span style={{ color: "#34d399", fontWeight: 700 }}>“{liveTranscript}”</span>
                ) : latestUserMessage ? (
                  `“${latestUserMessage}”`
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
