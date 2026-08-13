"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Lead } from "@/lib/types";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useVoiceAssistant,
  BarVisualizer,
} from "@livekit/components-react";
import "@livekit/components-styles";

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
        <LiveKitVoiceCallModal session={session} onClose={handleCloseCall} />
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
//  LIVEKIT VOICE CALL MODAL — Real-time Voice Agent
// ═══════════════════════════════════════════════════════

function LiveKitVoiceCallModal({ session, onClose }: { session: CallSession; onClose: () => void }) {
  const { lead, call_id } = session;
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string>("");
  const [roomName, setRoomName] = useState<string>("");
  const [callEnded, setCallEnded] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState("");

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

  // Get LiveKit token on mount
  useEffect(() => {
    async function getToken() {
      try {
        const res = await fetch("/api/livekit-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lead, roomName: `solar-call-${call_id}` })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Token generation failed");

        setLivekitToken(data.token);
        setLivekitUrl(data.url);
        setRoomName(data.room);
      } catch (err) {
        console.error("LiveKit token error:", err);
        setError(err instanceof Error ? err.message : "Failed to connect to LiveKit");
      }
    }
    getToken();
  }, [lead, call_id]);

  async function handleEndCall() {
    setCallEnded(true);

    // Save call data to Supabase
    try {
      await fetch("/api/voice-completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_id,
          call_status: "completed",
          call_outcome: "Call Ended",
          recording_url: "",
          transcript: `LiveKit voice call with ${lead.first_name} ${lead.last_name}`,
          summary: `LiveKit call ended with ${lead.first_name} ${lead.last_name}. Duration: ${formatDuration(callDuration)}.`
        })
      });
    } catch (e) {
      console.warn("Save call error:", e);
    }

    onClose();
  }

  if (error) {
    return (
      <div className="modal-overlay">
        <div className="voice-agent-modal">
          <div className="call-header">
            <div className="lead-title">
              <h3>Connection Error</h3>
              <p style={{ color: "#ef4444" }}>{error}</p>
            </div>
          </div>
          <div className="call-controls-hud">
            <button className="button" onClick={onClose} style={{ width: "100%", height: "48px" }}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!livekitToken || !livekitUrl) {
    return (
      <div className="modal-overlay">
        <div className="voice-agent-modal">
          <div className="voice-call-screen" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "300px" }}>
            <div style={{ textAlign: "center" }}>
              <div className="pulse-dot" style={{ width: "16px", height: "16px", margin: "0 auto 16px" }} />
              <p style={{ color: "var(--text-secondary)" }}>Connecting to LiveKit Cloud...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="voice-agent-modal">
        <LiveKitRoom
          serverUrl={livekitUrl}
          token={livekitToken}
          connect={true}
          audio={true}
          video={false}
          style={{ display: "flex", flexDirection: "column", height: "100%" }}
          onDisconnected={() => {
            if (!callEnded) handleEndCall();
          }}
        >
          <RoomAudioRenderer />
          <LiveCallUI
            lead={lead}
            callDuration={callDuration}
            callEnded={callEnded}
            formatDuration={formatDuration}
            onEndCall={handleEndCall}
          />
        </LiveKitRoom>
      </div>
    </div>
  );
}

// Inner component that uses LiveKit hooks (must be inside LiveKitRoom)
function LiveCallUI({
  lead,
  callDuration,
  callEnded,
  formatDuration,
  onEndCall,
}: {
  lead: Lead;
  callDuration: number;
  callEnded: boolean;
  formatDuration: (secs: number) => string;
  onEndCall: () => void;
}) {
  const connectionState = useConnectionState();
  const voiceAssistant = useVoiceAssistant();

  const isConnected = connectionState === "connected";
  const agentState = voiceAssistant.state;

  // Determine status display
  let statusLabel = "Connecting...";
  let statusIcon = "⚡";
  let statusClass = "pending";

  if (callEnded) {
    statusLabel = "Session Terminated";
    statusIcon = "✓";
    statusClass = "completed";
  } else if (agentState === "speaking") {
    statusLabel = "Alex Speaking...";
    statusIcon = "🔊";
    statusClass = "";
  } else if (agentState === "listening") {
    statusLabel = "Mic Active & Listening...";
    statusIcon = "🎙️";
    statusClass = "completed";
  } else if (agentState === "thinking") {
    statusLabel = "Thinking...";
    statusIcon = "⚡";
    statusClass = "pending";
  } else if (isConnected) {
    statusLabel = "Connected — Waiting for Agent...";
    statusIcon = "⏳";
    statusClass = "pending";
  }

  return (
    <>
      {/* Header */}
      <div className="call-header">
        <div className="lead-title">
          <div className="call-badge-live">
            <span className="pulse-dot" />
            <span>
              {callEnded
                ? "SESSION TERMINATED"
                : `LIVEKIT VOICE · ${formatDuration(callDuration)}`}
            </span>
          </div>
          <h3>{lead.first_name} {lead.last_name}</h3>
          <p>📞 {lead.phone} · 📍 {lead.property_address || lead.address}</p>
        </div>

        <div className="status-indicator">
          <span
            className={`badge ${statusClass}`}
            style={{
              fontSize: "12px",
              padding: "6px 12px",
              ...(agentState === "speaking"
                ? { background: "rgba(6, 182, 212, 0.15)", borderColor: "rgba(6, 182, 212, 0.4)", color: "#38bdf8" }
                : {})
            }}
          >
            {statusIcon} {statusLabel}
          </span>
        </div>
      </div>

      {/* Screen */}
      <div className="voice-call-screen">
        <div className={`caller-avatar ${agentState === "speaking" ? "speaking" : agentState === "listening" ? "listening" : ""}`}>
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
            Engine: LiveKit Cloud + Gemini 2.0 Flash Realtime (Aoede)
          </p>
        </div>

        {/* LiveKit Voice Assistant Visualizer */}
        {voiceAssistant.audioTrack && !callEnded && (
          <div style={{ height: "36px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BarVisualizer
              state={agentState}
              trackRef={voiceAssistant.audioTrack}
              barCount={9}
              style={{ height: "36px", width: "120px" }}
            />
          </div>
        )}

        {/* Fallback soundwave when no audio track yet */}
        {!voiceAssistant.audioTrack && !callEnded && (
          <div className="sound-wave active-user" style={{ height: "36px" }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <div
                key={i}
                className={`bar bar${i}`}
                style={{ height: `${Math.max(6, (i % 3 + 1) * 4)}px`, transition: "height 0.1s ease" }}
              />
            ))}
          </div>
        )}

        {/* Live Captions */}
        <div className="live-caption-box">
          {agentState === "speaking" && (
            <div className="caption agent-caption">
              <strong>🤖 Alex:</strong> Speaking to {lead.first_name}...
            </div>
          )}

          {agentState === "listening" && !callEnded && (
            <div className="caption user-caption">
              <strong>🎙️ {lead.first_name} (You):</strong>{" "}
              <span style={{ color: "var(--text-muted)" }}>Speak into your microphone naturally...</span>
            </div>
          )}

          {agentState === "thinking" && !callEnded && (
            <div className="caption agent-caption">
              <strong>⚡ Alex:</strong> Processing your response...
            </div>
          )}

          {callEnded && (
            <div className="caption completed-caption" style={{ width: "100%" }}>
              <div style={{ fontSize: "14px", fontWeight: 700 }}>✅ Call Concluded & Saved</div>
              <div style={{ fontSize: "12.5px", marginTop: "4px", color: "var(--text-secondary)" }}>
                Qualification data and consultation logged into Supabase.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="call-controls-hud">
        {!callEnded ? (
          <button
            className="hud-btn danger"
            onClick={onEndCall}
            style={{ minWidth: "200px", padding: "10px 24px" }}
          >
            <span style={{ fontSize: "20px" }}>📞</span>
            <small style={{ fontSize: "13px" }}>End Call</small>
          </button>
        ) : (
          <button
            className="button"
            onClick={onEndCall}
            style={{ width: "100%", height: "48px", fontSize: "14px" }}
          >
            ✓ Close Terminal & Review Records →
          </button>
        )}
      </div>
    </>
  );
}
