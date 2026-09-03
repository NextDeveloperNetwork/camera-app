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
  AlertCircle,
} from "lucide-react";
import { CameraConfig, ConnectionStatus } from "@/lib/types";

interface CameraPlayerProps {
  camera: CameraConfig;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  refreshTrigger?: number;
}

export function CameraPlayer({
  camera,
  isFullscreen = false,
  onToggleFullscreen,
  refreshTrigger = 0,
}: CameraPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [isMuted, setIsMuted] = useState(true);
  const [snapshotTaken, setSnapshotTaken] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Live timestamp overlay
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setCurrentTime(
        `${d.toISOString().slice(0, 10)} ${d.toLocaleTimeString("en-GB")}`
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup WebRTC
  const stopStream = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start WebRTC stream (WHEP standard)
  const startStream = useCallback(async () => {
    stopStream();
    setStatus("connecting");
    setErrorMessage("");

    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });
      pcRef.current = pc;

      // Add transceivers for receiving video and audio
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          videoRef.current.play().catch(() => {
            // Autoplay with muted is allowed by all browsers
          });
          setStatus("connected");
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (
          pc.iceConnectionState === "failed" ||
          pc.iceConnectionState === "disconnected"
        ) {
          setStatus("error");
          setErrorMessage("WebRTC connection lost.");
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const endpoint = `/api/stream/webrtc?src=${encodeURIComponent(
        camera.streamName
      )}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const answerSdp = await response.text();
      await pc.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setStatus("error");
      setErrorMessage(msg);
    }
  }, [camera.streamName, stopStream]);

  // Connect on mount or when refreshTrigger changes
  useEffect(() => {
    startStream();
    return () => {
      stopStream();
    };
  }, [camera.streamName, refreshTrigger, startStream, stopStream]);

  // Snapshot capture & download
  const handleSnapshot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        // CCTV watermark
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(10, canvas.height - 38, 480, 28);
        ctx.fillStyle = "#22d3ee";
        ctx.font = "bold 14px monospace";
        ctx.fillText(
          `${camera.name}  |  ${currentTime}`,
          18,
          canvas.height - 18
        );

        const link = document.createElement("a");
        const safeName = camera.name.replace(/[^a-zA-Z0-9]/g, "_");
        link.download = `Snap_${safeName}_${Date.now()}.jpg`;
        link.href = canvas.toDataURL("image/jpeg", 0.93);
        link.click();

        setSnapshotTaken(true);
        setTimeout(() => setSnapshotTaken(false), 2000);
      }
    } catch (err) {
      console.error("Snapshot failed:", err);
    }
  };

  const chId = camera.streamName.includes("4")
    ? "04"
    : camera.streamName.includes("3")
    ? "03"
    : camera.streamName.includes("2")
    ? "02"
    : "01";

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-black shadow-2xl transition-all duration-300 hover:border-cyan-500/40 ${
        isFullscreen ? "h-full w-full" : "aspect-video w-full"
      }`}
    >
      {/* Video surface */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        className="h-full w-full object-contain"
      />

      {/* Scanlines effect */}
      <div className="pointer-events-none absolute inset-0 scanlines opacity-20" />

      {/* Connecting overlay */}
      {status === "connecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm">
          <div className="relative flex h-12 w-12 items-center justify-center">
            <div className="absolute h-12 w-12 animate-spin rounded-full border-2 border-cyan-500/20 border-t-cyan-400" />
            <Wifi className="h-5 w-5 text-cyan-400" />
          </div>
          <p className="mt-3 font-mono text-xs tracking-widest text-cyan-300">
            CONNECTING TO FEED…
          </p>
          <p className="mt-1 text-[11px] text-slate-500">{camera.streamName}</p>
        </div>
      )}

      {/* Error overlay */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 p-4 text-center">
          <AlertCircle className="h-8 w-8 text-amber-400" />
          <p className="font-mono text-sm font-bold text-slate-200">
            STREAM UNAVAILABLE
          </p>
          <p className="max-w-xs text-xs text-slate-400">
            {errorMessage || "WebRTC connection failed. Verify go2rtc is active."}
          </p>
          <button
            onClick={startStream}
            className="mt-1 flex items-center gap-1.5 rounded border border-cyan-500/40 bg-cyan-950/50 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/60"
          >
            <RotateCw className="h-3 w-3" /> Retry Connection
          </button>
        </div>
      )}

      {/* Snapshot saved alert */}
      {snapshotTaken && (
        <div className="absolute inset-0 flex items-center justify-center bg-cyan-950/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-slate-900/90 px-4 py-2 font-mono text-xs font-semibold text-emerald-300 shadow-xl">
            <Check className="h-4 w-4 text-emerald-400" /> SNAPSHOT SAVED
          </div>
        </div>
      )}

      {/* Top Telemetry HUD */}
      <div className="pointer-events-none absolute top-0 inset-x-0 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-2.5 text-xs font-mono">
        <span className="flex items-center gap-1.5 rounded bg-slate-900/80 px-2 py-0.5 font-bold text-cyan-300 border border-cyan-500/30">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === "connected"
                ? "bg-emerald-400"
                : "bg-amber-400 animate-pulse"
            }`}
          />
          {camera.name}
        </span>
        <div className="flex items-center gap-1.5">
          {status === "connected" && (
            <span className="flex items-center gap-1 rounded bg-rose-950/80 px-2 py-0.5 text-[10px] font-bold tracking-wider text-rose-400 border border-rose-500/40">
              <Radio className="h-2.5 w-2.5 animate-pulse" /> LIVE
            </span>
          )}
          <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-300">
            WEBRTC
          </span>
          <span className="hidden tracking-wider text-slate-300 sm:inline">
            {currentTime}
          </span>
        </div>
      </div>

      {/* Bottom timecode */}
      <div className="pointer-events-none absolute bottom-11 left-3 font-mono text-[10px] text-cyan-400/70 tracking-widest">
        REC &bull; CH:{chId} &bull; {currentTime}
      </div>

      {/* Hover Controls */}
      <div className="absolute bottom-0 inset-x-0 flex items-center justify-between bg-gradient-to-t from-black/90 to-transparent px-2.5 py-2 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => {
            if (videoRef.current) {
              videoRef.current.muted = !isMuted;
              setIsMuted(!isMuted);
            }
          }}
          className="hud-btn"
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <VolumeX className="h-3.5 w-3.5" />
          ) : (
            <Volume2 className="h-3.5 w-3.5 text-cyan-400" />
          )}
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={handleSnapshot}
            className="hud-btn px-2 gap-1 text-[10px]"
            title="Save Snapshot"
          >
            <Camera className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Snap</span>
          </button>
          <button onClick={startStream} className="hud-btn" title="Reconnect">
            <RotateCw className="h-3.5 w-3.5" />
          </button>
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="hud-btn"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize className="h-3.5 w-3.5" />
              ) : (
                <Maximize className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
