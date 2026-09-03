"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Camera,
  RotateCw,
  AlertTriangle,
  Radio,
  Layers,
  Check,
} from "lucide-react";
import { CameraConfig, ConnectionStatus, StreamMode } from "@/lib/types";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [isMuted, setIsMuted] = useState(true);
  const [streamMode, setStreamMode] = useState<StreamMode>("webrtc");
  const [snapshotUrl, setSnapshotUrl] = useState<string>("");
  const [snapshotTaken, setSnapshotTaken] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [currentTime, setCurrentTime] = useState<string>("");

  // Live timestamp overlay
  useEffect(() => {
    const updateTimer = () => {
      const d = new Date();
      setCurrentTime(
        `${d.toISOString().slice(0, 10)} ${d.toLocaleTimeString("en-GB")}`
      );
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup WebRTC connection
  const cleanupWebRTC = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Initialize WebRTC stream via go2rtc WHEP
  const startWebRTC = useCallback(async () => {
    cleanupWebRTC();
    setStatus("connecting");
    setErrorMessage("");

    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });
      peerConnectionRef.current = pc;

      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setStatus("connected");
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (
          pc.iceConnectionState === "failed" ||
          pc.iceConnectionState === "disconnected"
        ) {
          // If WebRTC fails, provide option to switch to Snapshot mode
          setStatus("error");
          setErrorMessage("WebRTC stream disconnected. Retrying...");
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
        throw new Error(
          `Stream server response ${response.status}: ${response.statusText}`
        );
      }

      const answerSdp = await response.text();
      await pc.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Connection failed";
      console.warn(`[${camera.name}] WebRTC connection notice:`, message);
      setStatus("error");
      setErrorMessage(
        "Direct WebRTC connecting or waiting for stream. Tap Snapshot mode or Reconnect."
      );
    }
  }, [camera.streamName, camera.name, cleanupWebRTC]);

  // Snapshot live refresh loop (fallback mode)
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (streamMode === "mjpeg") {
      cleanupWebRTC();
      setStatus("connected");
      const refreshSnapshot = () => {
        setSnapshotUrl(
          `/api/stream/frame.jpeg?src=${encodeURIComponent(
            camera.streamName
          )}&t=${Date.now()}`
        );
      };
      refreshSnapshot();
      intervalId = setInterval(refreshSnapshot, 1000);
    } else {
      startWebRTC();
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      cleanupWebRTC();
    };
  }, [streamMode, camera.streamName, refreshTrigger, startWebRTC, cleanupWebRTC]);

  // Snapshot capture & download handler
  const handleCaptureSnapshot = () => {
    try {
      let dataUrl = "";
      if (streamMode === "webrtc" && videoRef.current) {
        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          // Add CCTV watermark to capture
          ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
          ctx.fillRect(10, canvas.height - 40, 450, 30);
          ctx.fillStyle = "#22d3ee";
          ctx.font = "bold 16px monospace";
          ctx.fillText(
            `${camera.name} | ${currentTime}`,
            20,
            canvas.height - 20
          );
          dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        }
      }

      if (!dataUrl) {
        dataUrl = `/api/stream/frame.jpeg?src=${encodeURIComponent(
          camera.streamName
        )}&download=1`;
      }

      const link = document.createElement("a");
      const safeName = camera.name.replace(/[^a-zA-Z0-9]/g, "_");
      const timeStamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.download = `Snapshot_${safeName}_${timeStamp}.jpg`;
      link.href = dataUrl;
      link.click();

      setSnapshotTaken(true);
      setTimeout(() => setSnapshotTaken(false), 2000);
    } catch (err) {
      console.error("Snapshot error:", err);
    }
  };

  // Toggle audio
  const handleToggleAudio = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`group relative flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl transition-all duration-300 hover:border-cyan-500/50 ${
        isFullscreen ? "h-full w-full" : "aspect-video w-full"
      }`}
    >
      {/* Video stream container */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
        {streamMode === "webrtc" ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isMuted}
            className="h-full w-full object-contain"
          />
        ) : (
          <img
            src={
              snapshotUrl ||
              `/api/stream/frame.jpeg?src=${encodeURIComponent(
                camera.streamName
              )}`
            }
            alt={camera.name}
            className="h-full w-full object-contain"
            onError={() => setStatus("error")}
          />
        )}

        {/* Scanlines overlay effect */}
        <div className="pointer-events-none absolute inset-0 scanlines opacity-30"></div>

        {/* Top telemetry overlay */}
        <div className="pointer-events-none absolute top-0 inset-x-0 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent p-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded bg-slate-900/80 px-2 py-0.5 font-bold text-cyan-300 border border-cyan-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
              {camera.name}
            </span>
            {camera.location && (
              <span className="hidden text-slate-400 sm:inline">
                [{camera.location}]
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Live Indicator */}
            {status === "connected" && (
              <span className="flex items-center gap-1 rounded bg-rose-950/80 px-2 py-0.5 text-[11px] font-bold tracking-wider text-rose-400 border border-rose-500/40">
                <Radio className="h-2.5 w-2.5 animate-pulse text-rose-500" />
                LIVE
              </span>
            )}

            {/* Stream Mode Badge */}
            <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-300 uppercase">
              {streamMode}
            </span>

            {/* Live Timecode */}
            <span className="hidden tracking-wider text-slate-300 sm:inline">
              {currentTime}
            </span>
          </div>
        </div>

        {/* Bottom CCTV timestamp on stream */}
        <div className="pointer-events-none absolute bottom-12 left-3 font-mono text-[11px] text-cyan-400/80 tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          REC &bull; CH:{camera.streamName.includes("4") ? "04" : "03"} &bull;{" "}
          {currentTime}
        </div>

        {/* Connecting / Loading Overlay */}
        {status === "connecting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="relative flex h-12 w-12 items-center justify-center">
                <div className="absolute h-12 w-12 animate-spin rounded-full border-2 border-cyan-500/20 border-t-cyan-400"></div>
                <Radio className="h-5 w-5 text-cyan-400 animate-pulse" />
              </div>
              <p className="font-mono text-xs text-cyan-300 tracking-wider">
                CONNECTING TO RTSP STREAM...
              </p>
              <p className="text-[11px] text-slate-500 max-w-xs text-center">
                Tunneling via go2rtc bridge at 192.168.1.10
              </p>
            </div>
          </div>
        )}

        {/* Error / Offline Overlay */}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-4 text-center">
            <AlertTriangle className="mb-2 h-8 w-8 text-amber-400 animate-bounce" />
            <h4 className="font-mono text-sm font-bold text-slate-200">
              STREAM OFFLINE OR STANDBY
            </h4>
            <p className="mt-1 max-w-sm text-xs text-slate-400">
              {errorMessage ||
                "Unable to establish WebRTC connection. Ensure Docker is running on Proxmox with camera access."}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={startWebRTC}
                className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/60 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/60"
              >
                <RotateCw className="h-3 w-3" />
                Retry WebRTC
              </button>
              <button
                onClick={() =>
                  setStreamMode((prev) =>
                    prev === "webrtc" ? "mjpeg" : "webrtc"
                  )
                }
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
              >
                <Layers className="h-3 w-3" />
                Switch to {streamMode === "webrtc" ? "Snapshot" : "WebRTC"} Mode
              </button>
            </div>
          </div>
        )}

        {/* Snapshot flash notice */}
        {snapshotTaken && (
          <div className="absolute inset-0 flex items-center justify-center bg-cyan-950/50 backdrop-blur-sm transition-opacity">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-slate-900/90 px-4 py-2 font-mono text-xs font-semibold text-emerald-300 shadow-xl">
              <Check className="h-4 w-4 text-emerald-400" />
              SNAPSHOT DOWNLOADED
            </div>
          </div>
        )}

        {/* Hover / Interactive HUD Controls Bar */}
        <div className="absolute bottom-0 inset-x-0 flex items-center justify-between bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2.5 opacity-90 transition-opacity group-hover:opacity-100">
          <div className="flex items-center gap-1">
            {/* Audio Toggle */}
            <button
              onClick={handleToggleAudio}
              title={isMuted ? "Unmute Audio" : "Mute Audio"}
              className="flex h-7 w-7 items-center justify-center rounded border border-slate-700 bg-slate-900/80 text-slate-300 transition-colors hover:border-cyan-500/50 hover:text-cyan-400"
            >
              {isMuted ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5 text-cyan-400" />
              )}
            </button>

            {/* Protocol Switcher */}
            <button
              onClick={() =>
                setStreamMode((prev) => (prev === "webrtc" ? "mjpeg" : "webrtc"))
              }
              title={`Toggle Protocol (Current: ${streamMode.toUpperCase()})`}
              className="flex h-7 items-center gap-1 rounded border border-slate-700 bg-slate-900/80 px-2 text-[10px] font-mono text-slate-300 transition-colors hover:border-cyan-500/50 hover:text-cyan-400"
            >
              <Layers className="h-3 w-3" />
              <span>{streamMode === "webrtc" ? "RTC" : "JPG"}</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            {/* Take Snapshot */}
            <button
              onClick={handleCaptureSnapshot}
              title="Save Snapshot Image"
              className="flex h-7 items-center gap-1 rounded border border-slate-700 bg-slate-900/80 px-2 text-xs text-slate-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-400"
            >
              <Camera className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-[10px]">Snapshot</span>
            </button>

            {/* Reconnect / Refresh */}
            <button
              onClick={() => {
                if (streamMode === "webrtc") {
                  startWebRTC();
                } else {
                  setSnapshotUrl(
                    `/api/stream/frame.jpeg?src=${encodeURIComponent(
                      camera.streamName
                    )}&t=${Date.now()}`
                  );
                }
              }}
              title="Reconnect Stream"
              className="flex h-7 w-7 items-center justify-center rounded border border-slate-700 bg-slate-900/80 text-slate-300 transition-colors hover:border-cyan-500/50 hover:text-cyan-400"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>

            {/* Fullscreen Button */}
            {onToggleFullscreen && (
              <button
                onClick={onToggleFullscreen}
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
                className="flex h-7 w-7 items-center justify-center rounded border border-slate-700 bg-slate-900/80 text-slate-300 transition-colors hover:border-cyan-500/50 hover:text-cyan-400"
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
    </div>
  );
}
