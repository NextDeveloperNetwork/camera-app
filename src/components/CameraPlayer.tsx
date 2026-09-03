"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Camera,
  RotateCw,
  Check,
  Wifi,
  AlertCircle,
  Expand,
  X,
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

  // Live clock overlay
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

  // WebRTC Cleanup
  const stopStream = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // WebRTC Connect via WHEP
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

      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          videoRef.current.play().catch(() => {});
          setStatus("connected");
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (
          pc.iceConnectionState === "failed" ||
          pc.iceConnectionState === "disconnected"
        ) {
          setStatus("error");
          setErrorMessage("Feed interrupted");
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const endpoint = `/api/stream/webrtc?src=${encodeURIComponent(
        camera.streamName
      )}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
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

  useEffect(() => {
    startStream();
    return () => {
      stopStream();
    };
  }, [camera.streamName, refreshTrigger, startStream, stopStream]);

  // Snapshot capture
  const handleSnapshot = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        // Clean white/black CCTV badge on capture
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.fillRect(14, canvas.height - 44, 460, 30);
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 14px monospace";
        ctx.fillText(
          `${camera.name} | ${currentTime}`,
          24,
          canvas.height - 24
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
      console.error("Snapshot error:", err);
    }
  };

  const toggleAudio = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleReconnect = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    startStream();
  };

  // Handle tap to expand
  const handleCardClick = () => {
    if (onToggleFullscreen && !isFullscreen) {
      onToggleFullscreen();
    }
  };

  return (
    <div
      className={`group relative flex flex-col rounded-2xl border border-slate-200/90 bg-white shadow-xs transition-all overflow-hidden ${
        isFullscreen
          ? "fixed inset-0 z-50 rounded-none border-none h-screen w-screen bg-slate-950"
          : "hover:shadow-md hover:border-slate-300"
      }`}
    >
      {/* Top Header Bar on Card (Light style: White with black text) */}
      {!isFullscreen && (
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-white border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                status === "connected"
                  ? "bg-emerald-500"
                  : "bg-amber-400 animate-pulse"
              }`}
            />
            <span className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[180px] sm:max-w-xs">
              {camera.name}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {status === "connected" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                LIVE
              </span>
            )}
            {onToggleFullscreen && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFullscreen();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                title="Tap to Expand"
              >
                <Expand className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Video Viewport: Tap to Expand */}
      <div
        onClick={handleCardClick}
        className={`relative flex flex-1 items-center justify-center bg-black cursor-pointer overflow-hidden ${
          isFullscreen ? "h-full w-full" : "aspect-video w-full"
        }`}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          className="h-full w-full object-contain pointer-events-none"
        />

        {/* Connecting indicator */}
        {status === "connecting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-xs text-slate-800">
            <div className="relative flex h-10 w-10 items-center justify-center mb-2">
              <div className="absolute h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
              <Wifi className="h-4 w-4 text-slate-900" />
            </div>
            <p className="font-medium text-xs text-slate-900">Loading feed…</p>
            <p className="text-[10px] text-slate-500">{camera.name}</p>
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 p-4 text-center text-white">
            <AlertCircle className="h-7 w-7 text-amber-400 mb-1.5" />
            <p className="text-xs font-semibold">Feed Unavailable</p>
            <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
              {errorMessage || "Connection failed. Tap to reconnect."}
            </p>
            <button
              onClick={handleReconnect}
              className="mt-3 flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
            >
              <RotateCw className="h-3.5 w-3.5" /> Reconnect
            </button>
          </div>
        )}

        {/* Snapshot feedback pill */}
        {snapshotTaken && (
          <div className="absolute inset-x-0 top-3 flex justify-center pointer-events-none">
            <div className="flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1 text-xs font-semibold text-slate-900 shadow-lg border border-slate-200">
              <Check className="h-3.5 w-3.5 text-emerald-600" /> Snapshot Saved
            </div>
          </div>
        )}

        {/* "Tap to Expand" hint pill on mobile/small screen (shows briefly on hover) */}
        {!isFullscreen && (
          <div className="absolute bottom-2.5 right-2.5 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity pointer-events-none">
            <span className="flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-800 shadow-xs backdrop-blur-xs border border-slate-200">
              <Expand className="h-3 w-3" /> Tap to expand
            </span>
          </div>
        )}

        {/* Fullscreen Overlay Controls (when expanded) */}
        {isFullscreen && (
          <>
            {/* Top Fullscreen Bar (Light Header Overlay) */}
            <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between bg-white/95 px-4 py-3 border-b border-slate-200 shadow-sm backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-sm font-bold text-slate-900">
                  {camera.name}
                </span>
                <span className="text-xs text-slate-500 hidden sm:inline">
                  [{camera.location || "Live"}]
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-600 hidden sm:inline">
                  {currentTime}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onToggleFullscreen) onToggleFullscreen();
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors shadow-xs"
                  title="Close Fullscreen"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Bottom Fullscreen Floating Action Bar */}
            <div className="absolute bottom-5 inset-x-0 z-20 flex justify-center px-4 pointer-events-none">
              <div className="flex items-center gap-2 rounded-2xl bg-white/95 px-4 py-2 shadow-xl border border-slate-200 backdrop-blur-md pointer-events-auto">
                <button
                  onClick={toggleAudio}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors"
                  title={isMuted ? "Unmute Audio" : "Mute Audio"}
                >
                  {isMuted ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5 text-emerald-600" />
                  )}
                </button>

                <button
                  onClick={handleSnapshot}
                  className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
                  title="Take High-Res Snapshot"
                >
                  <Camera className="h-4 w-4" />
                  <span>Snapshot</span>
                </button>

                <button
                  onClick={handleReconnect}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors"
                  title="Refresh Feed"
                >
                  <RotateCw className="h-4 w-4" />
                </button>

                {onToggleFullscreen && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFullscreen();
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors"
                    title="Exit Fullscreen"
                  >
                    <Minimize2 className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quick Action Footer on Card (Light style: White with black text) */}
      {!isFullscreen && (
        <div className="flex items-center justify-between px-3 py-2 bg-white border-t border-slate-100">
          <span className="font-mono text-[11px] text-slate-500">
            CH:{camera.streamName.slice(-1)} &bull; WebRTC
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleAudio}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5 text-emerald-600" />
              )}
            </button>

            <button
              onClick={handleSnapshot}
              className="flex h-7 items-center gap-1 px-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors"
              title="Snapshot"
            >
              <Camera className="h-3.5 w-3.5" />
              <span className="text-[11px]">Snap</span>
            </button>

            <button
              onClick={handleReconnect}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              title="Reconnect"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
