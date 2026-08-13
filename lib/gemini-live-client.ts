/**
 * Google Gemini Multimodal Live Client
 * Real-time bidirectional streaming over WebSocket with raw 16kHz PCM input and 24kHz PCM audio output.
 */

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private nextPlayTime: number = 0;
  private isConnected: boolean = false;
  private apiKey: string;
  private systemInstruction: string;
  private voiceName: string;

  public onStatusChange?: (status: "connecting" | "speaking" | "listening" | "processing" | "ended") => void;
  public onAgentTranscript?: (text: string) => void;
  public onVolumeChange?: (volume: number) => void;
  public onError?: (error: Error) => void;

  constructor(apiKey: string, systemInstruction: string, voiceName: string = "Aoede") {
    this.apiKey = apiKey;
    this.systemInstruction = systemInstruction;
    this.voiceName = voiceName;
  }

  public async start(stream: MediaStream) {
    this.mediaStream = stream;
    this.onStatusChange?.("connecting");

    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.isConnected = true;
      this.sendSetup();
      this.initAudioCapture(stream);
      this.onStatusChange?.("listening");
    };

    this.ws.onmessage = async (event) => {
      try {
        let data: any;
        if (event.data instanceof Blob) {
          const text = await event.data.text();
          data = JSON.parse(text);
        } else {
          data = JSON.parse(event.data);
        }
        this.handleServerMessage(data);
      } catch (err) {
        console.warn("Gemini Live message parsing error:", err);
      }
    };

    this.ws.onerror = (err) => {
      console.error("Gemini Live WebSocket error:", err);
      this.onError?.(new Error("Gemini Live connection error"));
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      this.stop();
    };
  }

  private sendSetup() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const setupMsg = {
      setup: {
        model: "models/gemini-2.0-flash-exp",
        generationConfig: {
          responseModalities: ["AUDIO", "TEXT"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: this.voiceName || "Aoede" // Aoede, Puck, Charon, Kore, Fenrir
              }
            }
          }
        },
        systemInstruction: {
          parts: [{ text: this.systemInstruction }]
        }
      }
    };

    this.ws.send(JSON.stringify(setupMsg));

    // Send initial greeting trigger to start the phone call
    setTimeout(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          clientContent: {
            turns: [
              {
                role: "user",
                parts: [{ text: "(User answered the phone call. Start with Step 1 Opening Hook now in under 20 words)" }]
              }
            ],
            turnComplete: true
          }
        }));
      }
    }, 300);
  }

  private initAudioCapture(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtx({ sampleRate: 16000 });
      this.inputSource = this.audioCtx.createMediaStreamSource(stream);

      // ScriptProcessor to capture raw 16kHz linear PCM
      this.processor = this.audioCtx.createScriptProcessor(2048, 1, 1);
      this.inputSource.connect(this.processor);
      this.processor.connect(this.audioCtx.destination);

      this.processor.onaudioprocess = (e) => {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Calculate volume for HUD meter
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += Math.abs(inputData[i]);
        }
        const volume = Math.min(100, Math.round((sum / inputData.length) * 400));
        this.onVolumeChange?.(volume);

        // Convert Float32 to 16-bit PCM Linear
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Base64 encode PCM buffer
        const base64Audio = this.arrayBufferToBase64(pcm16.buffer);

        // Stream real-time audio chunk to Gemini
        this.ws.send(JSON.stringify({
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: "audio/pcm;rate=16000",
                data: base64Audio
              }
            ]
          }
        }));
      };
    } catch (err) {
      console.warn("Audio capture init notice:", err);
    }
  }

  private handleServerMessage(data: any) {
    if (data.serverContent) {
      const parts = data.serverContent.modelTurn?.parts || [];
      for (const part of parts) {
        // 1. Text transcript from Gemini Live
        if (part.text) {
          this.onAgentTranscript?.(part.text);
        }

        // 2. Real-time 24kHz PCM Audio Stream from Gemini Live
        if (part.inlineData && part.inlineData.data) {
          this.onStatusChange?.("speaking");
          this.playPCMChunk(part.inlineData.data);
        }
      }

      if (data.serverContent.turnComplete) {
        this.onStatusChange?.("listening");
      }

      // Handle user interruption event from Gemini
      if (data.serverContent.interrupted) {
        this.onStatusChange?.("listening");
        this.nextPlayTime = 0;
      }
    }
  }

  private playPCMChunk(base64Data: string) {
    try {
      if (!this.audioCtx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AudioCtx();
      }

      // Resume context if suspended
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }

      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
      }

      // Gemini Live outputs 24,000 Hz mono audio
      const audioBuffer = this.audioCtx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioCtx.destination);

      const currentTime = this.audioCtx.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
      }

      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;
    } catch (err) {
      console.warn("PCM audio playback error:", err);
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  public sendTextMessage(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        clientContent: {
          turns: [
            {
              role: "user",
              parts: [{ text }]
            }
          ],
          turnComplete: true
        }
      }));
    }
  }

  public stop() {
    this.isConnected = false;
    if (this.processor) {
      try { this.processor.disconnect(); } catch (e) {}
      this.processor = null;
    }
    if (this.inputSource) {
      try { this.inputSource.disconnect(); } catch (e) {}
      this.inputSource = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    this.onStatusChange?.("ended");
  }
}
