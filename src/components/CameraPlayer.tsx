"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { CameraConfig, ConnectionStatus } from "@/lib/types";
import {
  Wifi,
  Maximize2,
  Volume2,
  VolumeX,
  RotateCw,
  Camera,
  Check,
  AlertCircle,
  X,
  Expand,
  Zap,
  Gauge,
} from "lucide-react";

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
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [streamProtocol, setStreamProtocol] = useState<"webrtc" | "mp4">("webrtc");
  // In grid view, default to fast substream for instant, smooth playback. In fullscreen, default to HD.
  const [quality, setQuality] = useState<"fast" | "hd">(isFullscreen ? "hd" : "fast");
  const [isMuted, setIsMuted] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [snapshotTaken, setSnapshotTaken] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  // Determine active stream name based on quality setting
  const activeStreamName =
    quality === "fast" && camera.subStreamName
      ? camera.subStreamName
      : camera.streamName;

  // Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup WebRTC & Video
  const stopStream = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
  }, []);

  // Buffer sync: Keep video pinned to real-time live edge (prevents lag accumulation)
  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v || v.buffered.length === 0) return;
    try {
      const liveEdge = v.buffered.end(v.buffered.length - 1);
      const lag = liveEdge - v.currentTime;
      if (lag > 2.0) {
        // Jump directly to live edge
        v.currentTime = liveEdge - 0.15;
      } else if (lag > 0.6) {
        // Slight lag: speed up temporarily
        v.playbackRate = 1.15;
      } else {
        v.playbackRate = 1.0;
      }
    } catch {}
  }, []);

  // Start Stream (WebRTC with instant MP4 HTTP fallback)
  const startStream = useCallback(
    async (forcedProtocol?: "webrtc" | "mp4") => {
      stopStream();
      setStatus("connecting");
      setErrorMessage("");

      const activeProtocol = forcedProtocol || streamProtocol;

      // ── PROTOCOL: MP4 Progressive HTTP Stream (100% Cloudflare Tunnel Compatible) ──
      if (activeProtocol === "mp4") {
        setStreamProtocol("mp4");
        if (videoRef.current) {
          const streamUrl = `/api/stream/stream.mp4?src=${encodeURIComponent(
            activeStreamName
          )}`;
          videoRef.current.src = streamUrl;
          videoRef.current.onloadedmetadata = () => {
            setStatus("connected");
            videoRef.current?.play().catch(() => {});
          };
          videoRef.current.onerror = () => {
            setStatus("error");
            setErrorMessage("Feed stream error");
          };
        }
        return;
      }

      // ── PROTOCOL: WebRTC WHEP ──
      setStreamProtocol("webrtc");
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
            console.warn("WebRTC UDP failed, switching to fast MP4 stream");
            startStream("mp4");
          }
        };

        // Watchdog: If WebRTC has no video frames after 3s (UDP blocked), auto-fallback to MP4
        fallbackTimerRef.current = setTimeout(() => {
          if (videoRef.current && videoRef.current.videoWidth === 0) {
            console.warn("WebRTC has no video frames, falling back to MP4 stream");
            startStream("mp4");
          }
        }, 3000);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const endpoint = `/api/stream/webrtc?src=${encodeURIComponent(
          activeStreamName
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
        console.warn("WebRTC handshake failed, falling back to MP4 stream:", err);
        startStream("mp4");
      }
    },
    [activeStreamName, stopStream, streamProtocol]
  );

  useEffect(() => {
    startStream();
    return () => {
      stopStream();
    };
  }, [activeStreamName, refreshTrigger, startStream, stopStream]);

  // Snapshot capture
  const handleSnapshot = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
        const link = document.createElement("a");
        link.download = `Snapshot_${camera.name}_${Date.now()}.jpg`;
        link.href = dataUrl;
        link.click();

        setSnapshotTaken(true);
        setTimeout(() => setSnapshotTaken(false), 2500);
      }
    } catch (err) {
      console.error("Snapshot error:", err);
    }
  };

  const handleReconnect = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    startStream();
  };

  const toggleAudio = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Toggle protocol explicitly
  const toggleProtocol = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = streamProtocol === "webrtc" ? "mp4" : "webrtc";
    startStream(next);
  };

  // Toggle quality explicitly (Fast Substream vs HD Mainstream)
  const toggleQuality = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setQuality((prev) => (prev === "fast" ? "hd" : "fast"));
  };

  const channelNum = camera.streamName.slice(-1) || "1";

  return (
    <div
      onClick={!isFullscreen ? onToggleFullscreen : undefined}
      className={`group relative flex flex-col overflow-hidden bg-white transition-all ${
        isFullscreen
          ? "h-full w-full fixed inset-0 z-50 rounded-none bg-black"
          : "rounded-2xl border border-slate-200 shadow-xs hover:shadow-md cursor-pointer"
      }`}
    >
      {/* ── Top Camera Header ── */}
      {!isFullscreen && (
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-100 bg-white z-10">
          <div className="flex items-center gap-2 truncate">
            <span
              className={`h-2.5 w-2.5 rounded-full shrink-0 transition-all ${
                status === "connected"
                  ? "bg-emerald-500 shadow-xs ring-2 ring-emerald-100"
                  : status === "connecting"
                  ? "bg-amber-400 animate-pulse"
                  : "bg-rose-500"
              }`}
            />
            <span className="text-xs font-bold text-slate-800 truncate tracking-tight">
              {camera.name}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Quality pill: Fast vs HD */}
            <button
              onClick={toggleQuality}
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold border transition-colors ${
                quality === "fast"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              }`}
              title="Click to toggle Fast (Smooth) vs HD (1080p)"
            >
              <Gauge className="h-2.5 w-2.5" />
              <span>{quality === "fast" ? "FAST" : "HD"}</span>
            </button>

            {status === "connected" && (
              <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                LIVE
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleFullscreen) onToggleFullscreen();
              }}
              className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Expand Camera"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Video Viewport Area ── */}
      <div className="relative flex-1 w-full bg-slate-950 flex items-center justify-center overflow-hidden aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          onTimeUpdate={handleTimeUpdate}
          className="h-full w-full object-contain pointer-events-none"
        />

        {/* Connecting indicator */}
        {status === "connecting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xs text-white">
            <div className="relative flex h-10 w-10 items-center justify-center mb-2">
              <div className="absolute h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
              <Wifi className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="font-medium text-xs text-white">Connecting live feed…</p>
            <p className="text-[10px] text-slate-400">{camera.name}</p>
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 p-4 text-center text-white">
            <AlertCircle className="h-7 w-7 text-amber-400 mb-1.5" />
            <p className="text-xs font-semibold">Feed Interrupted</p>
            <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
              {errorMessage || "Unable to establish stream connection"}
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
          <div className="absolute inset-x-0 top-3 flex justify-center pointer-events-none z-30">
            <div className="flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1 text-xs font-semibold text-slate-900 shadow-lg border border-slate-200">
              <Check className="h-3.5 w-3.5 text-emerald-600" /> Snapshot Saved
            </div>
          </div>
        )}

        {/* "Tap to Expand" hint pill */}
        {!isFullscreen && (
          <div className="absolute bottom-2.5 right-2.5 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            <span className="flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold text-white shadow-xs backdrop-blur-xs border border-white/10">
              <Expand className="h-3 w-3" /> Tap to expand
            </span>
          </div>
        )}

        {/* Fullscreen Overlay Controls (when expanded) */}
        {isFullscreen && (
          <>
            <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between bg-black/80 px-4 py-3 border-b border-white/10 shadow-sm backdrop-blur-md text-white">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-sm font-bold text-white">
                  {camera.name}
                </span>
                <button
                  onClick={toggleQuality}
                  className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold border transition-colors ${
                    quality === "fast"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                  }`}
                  title="Toggle Fast vs HD Quality"
                >
                  <Gauge className="h-3 w-3" />
                  <span>{quality === "fast" ? "FAST (Smooth)" : "HD (1080p)"}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onToggleFullscreen) onToggleFullscreen();
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors shadow-xs"
                  title="Close Fullscreen"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Bottom Fullscreen Floating Action Bar */}
            <div className="absolute bottom-5 inset-x-0 z-20 flex justify-center px-4 pointer-events-none">
              <div className="flex items-center gap-2 rounded-2xl bg-black/80 px-4 py-2 shadow-xl border border-white/10 backdrop-blur-md pointer-events-auto text-white">
                <button
                  onClick={toggleAudio}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 transition-colors"
                  title={isMuted ? "Unmute Audio" : "Mute Audio"}
                >
                  {isMuted ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5 text-emerald-400" />
                  )}
                </button>

                <button
                  onClick={handleSnapshot}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 transition-colors"
                  title="Take Snapshot"
                >
                  <Camera className="h-5 w-5" />
                </button>

                <button
                  onClick={handleReconnect}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 transition-colors"
                  title="Reconnect"
                >
                  <RotateCw className="h-5 w-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Bottom Card Toolbar ── */}
      {!isFullscreen && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-100 bg-white text-slate-500 text-[11px] font-mono z-10">
          {/* Stream protocol indicator / switcher */}
          <div className="flex items-center gap-1.5">
            <span>CH:{channelNum}</span>
            <span>&bull;</span>
            <button
              onClick={toggleProtocol}
              className="flex items-center gap-1 font-bold text-[10px] text-slate-700 hover:text-slate-950 transition-colors bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
              title="Click to switch between WebRTC and MP4 stream"
            >
              <Zap className="h-3 w-3 text-amber-500" />
              <span>{streamProtocol === "webrtc" ? "WebRTC" : "MP4 Stream"}</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleAudio}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
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
              className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              title="Take Snapshot"
            >
              <Camera className="h-3.5 w-3.5" />
              <span className="text-[10px]">Snap</span>
            </button>

            <button
              onClick={handleReconnect}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              title="Refresh Stream"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
