"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Camera,
  RotateCw,
  Radio,
  Check,
  Wifi,
} from "lucide-react";
import { CameraConfig, ConnectionStatus } from "@/lib/types";

interface CameraPlayerProps {
  camera: CameraConfig;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  refreshTrigger?: number;
}

type PlayerMode = "mse" | "webrtc" | "mjpeg";

export function CameraPlayer({
  camera,
  isFullscreen = false,
  onToggleFullscreen,
  refreshTrigger = 0,
}: CameraPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const queueRef = useRef<ArrayBuffer[]>([]);

  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [isMuted, setIsMuted] = useState(true);
  const [mode, setMode] = useState<PlayerMode>("mse");
  const [snapshotTaken, setSnapshotTaken] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Live clock overlay
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setCurrentTime(
        `${d.toISOString().slice(0, 10)} ${d.toLocaleTimeString("en-GB")}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ─── MSE Player ───────────────────────────────────────────────────────────
  const stopMSE = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.src = "";
    }
    queueRef.current = [];
    sourceBufferRef.current = null;
    mediaSourceRef.current = null;
  }, []);

  const startMSE = useCallback(() => {
    stopMSE();
    setStatus("connecting");
    setErrorMsg("");

    // go2rtc MSE over WebSocket
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${proto}//${window.location.host}/api/stream/ws?src=${encodeURIComponent(camera.streamName)}`;

    const ms = new MediaSource();
    mediaSourceRef.current = ms;

    if (videoRef.current) {
      videoRef.current.src = URL.createObjectURL(ms);
    }

    ms.addEventListener("sourceopen", () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.binaryType = "arraybuffer";

      let firstChunk = true;

      ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          // First message from go2rtc is codec info JSON
          try {
            const info = JSON.parse(event.data);
            const codecs: string[] = [];
            if (info.video?.codec) {
              const vc = info.video.codec.toLowerCase();
              if (vc === "h264") codecs.push('avc1.640028');
              else if (vc === "h265") codecs.push('hvc1.1.6.L153.B0');
              else codecs.push(vc);
            }
            if (info.audio?.codec) {
              codecs.push("mp4a.40.2");
            }

            const mimeType = `video/mp4; codecs="${codecs.join(",")}"`;
            if (!MediaSource.isTypeSupported(mimeType)) {
              // Fall back to WebRTC if codec not supported
              stopMSE();
              setMode("webrtc");
              return;
            }

            const sb = ms.addSourceBuffer(mimeType);
            sourceBufferRef.current = sb;
            sb.mode = "segments";
            sb.addEventListener("updateend", () => {
              if (queueRef.current.length > 0 && !sb.updating) {
                sb.appendBuffer(queueRef.current.shift()!);
              }
            });
            setStatus("connected");
            firstChunk = false;
          } catch {
            // non-JSON text, ignore
          }
          return;
        }

        // Binary chunk: append to SourceBuffer
        if (firstChunk) return;
        const sb = sourceBufferRef.current;
        if (!sb) return;
        if (sb.updating) {
          queueRef.current.push(event.data as ArrayBuffer);
        } else {
          try {
            sb.appendBuffer(event.data as ArrayBuffer);
          } catch {
            // Buffer overflow or decode error - restart
            startMSE();
          }
        }
      };

      ws.onopen = () => setStatus("connecting");
      ws.onerror = () => {
        setStatus("error");
        setErrorMsg("MSE stream failed. Try switching to WebRTC.");
      };
      ws.onclose = () => {
        if (status !== "error") setStatus("error");
      };
    }, { once: true });

    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [camera.streamName, stopMSE, status]);

  // ─── WebRTC Player ────────────────────────────────────────────────────────
  const stopWebRTC = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startWebRTC = useCallback(async () => {
    stopWebRTC();
    setStatus("connecting");
    setErrorMsg("");

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        bundlePolicy: "max-bundle",
      });
      pcRef.current = pc;

      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.ontrack = ({ streams }) => {
        if (videoRef.current && streams[0]) {
          videoRef.current.srcObject = streams[0];
          videoRef.current.play().catch(() => null);
          setStatus("connected");
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          setStatus("error");
          setErrorMsg("WebRTC connection dropped.");
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await fetch(
        `/api/stream/webrtc?src=${encodeURIComponent(camera.streamName)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: offer.sdp,
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const sdpAnswer = await res.text();
      await pc.setRemoteDescription({ type: "answer", sdp: sdpAnswer });
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error ? err.message : "WebRTC negotiation failed."
      );
    }
  }, [camera.streamName, stopWebRTC]);

  // ─── MJPEG snapshot player ────────────────────────────────────────────────
  const mjpegSrc = `/api/stream/stream.mjpeg?src=${encodeURIComponent(camera.streamName)}`;

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "mse") {
      stopWebRTC();
      startMSE();
    } else if (mode === "webrtc") {
      stopMSE();
      startWebRTC();
    } else {
      stopMSE();
      stopWebRTC();
      setStatus("connected");
    }

    return () => {
      stopMSE();
      stopWebRTC();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, camera.streamName, refreshTrigger]);

  // ─── Snapshot capture ────────────────────────────────────────────────────
  const handleSnapshot = () => {
    try {
      const video = videoRef.current;
      if (!video || (mode !== "mjpeg" && !video.videoWidth)) return;

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(10, canvas.height - 40, 480, 30);
      ctx.fillStyle = "#22d3ee";
      ctx.font = "bold 15px monospace";
      ctx.fillText(`${camera.name}  |  ${currentTime}`, 20, canvas.height - 18);

      const link = document.createElement("a");
      link.download = `Snapshot_${camera.id}_${Date.now()}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.93);
      link.click();

      setSnapshotTaken(true);
      setTimeout(() => setSnapshotTaken(false), 2000);
    } catch (e) {
      console.warn("Snapshot error:", e);
    }
  };

  const chId = camera.streamName.includes("4") ? "04" : "03";

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-black shadow-2xl transition-all duration-300 hover:border-cyan-500/40 ${
        isFullscreen ? "h-full w-full" : "aspect-video w-full"
      }`}
    >
      {/* ── Video surface ── */}
      {mode === "mjpeg" ? (
        <img
          src={mjpegSrc}
          alt={camera.name}
          className="h-full w-full object-contain"
          onError={() => { setStatus("error"); setErrorMsg("MJPEG stream unavailable."); }}
        />
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          className="h-full w-full object-contain"
        />
      )}

      {/* Scanlines */}
      <div className="pointer-events-none absolute inset-0 scanlines opacity-20" />

      {/* ── Status overlays ── */}
      {status === "connecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center">
              <div className="absolute h-12 w-12 animate-spin rounded-full border-2 border-cyan-500/20 border-t-cyan-400" />
              <Wifi className="h-5 w-5 text-cyan-400" />
            </div>
            <p className="font-mono text-xs tracking-widest text-cyan-300">CONNECTING VIA {mode.toUpperCase()}…</p>
            <p className="text-[11px] text-slate-500">Waiting for first video frame</p>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 p-4 text-center">
          <p className="font-mono text-sm font-bold text-slate-200">STREAM UNAVAILABLE</p>
          <p className="max-w-xs text-xs text-slate-400">{errorMsg || "Connection failed."}</p>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            <button onClick={() => mode === "mse" ? startMSE() : startWebRTC()} className="flex items-center gap-1 rounded border border-cyan-500/40 bg-cyan-950/50 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/60">
              <RotateCw className="h-3 w-3" /> Retry {mode.toUpperCase()}
            </button>
            {mode === "mse" && (
              <button onClick={() => setMode("webrtc")} className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700">Switch → WebRTC</button>
            )}
            {mode !== "mjpeg" && (
              <button onClick={() => setMode("mjpeg")} className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700">Switch → MJPEG</button>
            )}
            {mode !== "mse" && (
              <button onClick={() => setMode("mse")} className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700">Switch → MSE</button>
            )}
          </div>
        </div>
      )}

      {/* Snapshot flash */}
      {snapshotTaken && (
        <div className="absolute inset-0 flex items-center justify-center bg-cyan-950/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-slate-900/90 px-4 py-2 font-mono text-xs font-semibold text-emerald-300 shadow-xl">
            <Check className="h-4 w-4 text-emerald-400" /> SNAPSHOT SAVED
          </div>
        </div>
      )}

      {/* ── Top HUD ── */}
      <div className="pointer-events-none absolute top-0 inset-x-0 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-2.5 text-xs font-mono">
        <span className="flex items-center gap-1.5 rounded bg-slate-900/80 px-2 py-0.5 font-bold text-cyan-300 border border-cyan-500/30">
          <span className={`h-1.5 w-1.5 rounded-full ${status === "connected" ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
          {camera.name}
        </span>
        <div className="flex items-center gap-1.5">
          {status === "connected" && (
            <span className="flex items-center gap-1 rounded bg-rose-950/80 px-2 py-0.5 text-[10px] font-bold tracking-wider text-rose-400 border border-rose-500/40">
              <Radio className="h-2.5 w-2.5 animate-pulse" /> LIVE
            </span>
          )}
          <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] uppercase text-slate-300">{mode}</span>
          <span className="hidden tracking-wider text-slate-300 sm:inline">{currentTime}</span>
        </div>
      </div>

      {/* ── Bottom timecode ── */}
      <div className="pointer-events-none absolute bottom-11 left-3 font-mono text-[10px] text-cyan-400/70 tracking-widest">
        REC &bull; CH:{chId} &bull; {currentTime}
      </div>

      {/* ── Controls bar ── */}
      <div className="absolute bottom-0 inset-x-0 flex items-center justify-between bg-gradient-to-t from-black/90 to-transparent px-2.5 py-2 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="flex items-center gap-1">
          {/* Mute */}
          <button onClick={() => { if (videoRef.current) { videoRef.current.muted = !videoRef.current.muted; setIsMuted(v => !v); }}} className="hud-btn">
            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5 text-cyan-400" />}
          </button>
          {/* Mode cycle */}
          <button
            onClick={() => setMode(m => m === "mse" ? "webrtc" : m === "webrtc" ? "mjpeg" : "mse")}
            className="hud-btn px-2 text-[10px] font-mono gap-1"
            title="Cycle stream mode"
          >
            {mode.toUpperCase()}
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleSnapshot} className="hud-btn px-2 gap-1 text-[10px]" title="Save snapshot">
            <Camera className="h-3.5 w-3.5" /><span className="hidden sm:inline">Snap</span>
          </button>
          <button onClick={() => mode === "mse" ? startMSE() : mode === "webrtc" ? startWebRTC() : setStatus("connecting")} className="hud-btn" title="Reconnect">
            <RotateCw className="h-3.5 w-3.5" />
          </button>
          {onToggleFullscreen && (
            <button onClick={onToggleFullscreen} className="hud-btn" title="Fullscreen">
              {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
