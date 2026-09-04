"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import Hls from "hls.js";
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
  Gauge,
} from "lucide-react";

// StreamProtocol is kept for any external references (MobileQuickToolbar etc.)
export type StreamProtocol = "hls" | "mp4" | "webrtc" | "mjpeg";

interface CameraPlayerProps {
  camera: CameraConfig;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  refreshTrigger?: number;
  initialProtocol?: StreamProtocol; // kept for API compat; always uses HLS internally
}

export function CameraPlayer({
  camera,
  isFullscreen = false,
  onToggleFullscreen,
  refreshTrigger = 0,
}: CameraPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [quality, setQuality] = useState<"fast" | "hd">(
    isFullscreen ? "hd" : "fast"
  );
  const [isMuted, setIsMuted] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [snapshotTaken, setSnapshotTaken] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  // Active stream name based on quality
  const activeStreamName =
    quality === "fast" && camera.subStreamName
      ? camera.subStreamName
      : camera.streamName;

  // Clock
  useEffect(() => {
    const tick = () => {
      setCurrentTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ─────────────────────────────────────────────────────
  //  STOP: clean up HLS.js + video element
  // ─────────────────────────────────────────────────────
  const stopStream = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.removeAttribute("src");
      v.load();
    }
  }, []);

  // ─────────────────────────────────────────────────────
  //  START: HLS-only streaming via MediaMTX proxy
  //  URL: /api/hls/{streamName}/index.m3u8
  // ─────────────────────────────────────────────────────
  const startStream = useCallback(
    (retryCount = 0) => {
      stopStream();
      if (!mountedRef.current) return;

      setStatus("connecting");
      setErrorMessage("");

      const v = videoRef.current;
      if (!v) return;

      const hlsUrl = `/api/hls/${encodeURIComponent(activeStreamName)}/index.m3u8`;

      const scheduleRetry = (delayMs: number) => {
        if (!mountedRef.current) return;
        retryTimerRef.current = setTimeout(() => {
          if (mountedRef.current) startStream(retryCount + 1);
        }, delayMs);
      };

      const onFatalError = (msg: string) => {
        if (!mountedRef.current) return;
        console.warn(`[CameraPlayer] ${camera.name}: ${msg}. Retry #${retryCount + 1} in 4s`);
        // Auto-retry up to 10 times, then show error
        if (retryCount < 10) {
          scheduleRetry(4000);
        } else {
          setStatus("error");
          setErrorMessage(msg);
        }
      };

      // ── A) HLS.js: Chrome, Firefox, Edge, Safari Desktop, Android ──
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 4,
          maxBufferLength: 8,
          liveSyncDurationCount: 2,
          liveMaxLatencyDurationCount: 4,
          manifestLoadingTimeOut: 15000,
          manifestLoadingMaxRetry: 4,
          manifestLoadingRetryDelay: 1000,
          levelLoadingTimeOut: 15000,
          levelLoadingMaxRetry: 4,
          fragLoadingTimeOut: 15000,
          fragLoadingMaxRetry: 3,
        });

        hlsRef.current = hls;
        hls.loadSource(hlsUrl);
        hls.attachMedia(v);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!mountedRef.current) return;
          setStatus("connected");
          v.muted = true;
          v.play().catch(() => {
            v.muted = true;
            v.play().catch(() => {});
          });
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (!data.fatal) return;
          console.warn(`[CameraPlayer] ${camera.name} HLS fatal error:`, data.type, data.details);

          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (retryCount < 4) {
                hls.loadSource(hlsUrl);
                hls.startLoad();
              } else {
                hls.destroy();
                hlsRef.current = null;
                onFatalError("Network error — retrying");
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              hlsRef.current = null;
              onFatalError("Stream error — retrying");
              break;
          }
        });

        return;
      }

      // ── B) Native HLS: iOS Safari (where MSE is not supported) ──
      if (v.canPlayType("application/vnd.apple.mpegurl")) {
        v.src = hlsUrl;
        v.muted = true;
        v.setAttribute("playsinline", "true");
        v.setAttribute("webkit-playsinline", "true");

        const clearTimeouts = () => {
          if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
          }
        };

        const onReady = () => {
          if (!mountedRef.current) return;
          clearTimeouts();
          setStatus("connected");
          v.play().catch(() => {
            v.muted = true;
            v.play().catch(() => {});
          });
        };

        v.onloadedmetadata = onReady;
        v.oncanplay = onReady;

        v.onerror = () => {
          clearTimeouts();
          onFatalError("Stream unavailable — retrying");
        };

        // If metadata hasn't loaded in 15s (DVR slow to respond), retry
        retryTimerRef.current = setTimeout(() => {
          if (v.readyState < 1) {
            onFatalError("Stream timeout — retrying");
          }
        }, 15000);
        return;
      }

      // ── C) Fallback: no HLS support at all ──
      setStatus("error");
      setErrorMessage("Your browser does not support HLS video playback.");
    },
    [activeStreamName, camera.name, stopStream]
  );

  // Start stream on mount and when dependencies change
  useEffect(() => {
    startStream();
    return stopStream;
  }, [startStream, stopStream]);

  // Re-start when quality or refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger > 0) startStream();
  }, [refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // Time update for fullscreen HUD
  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (v && isFinite(v.currentTime)) {
      // already showing real clock above
    }
  }, []);

  // Snapshot
  const handleSnapshot = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const v = videoRef.current;
      if (v && v.videoWidth > 0) {
        const canvas = document.createElement("canvas");
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        canvas.getContext("2d")?.drawImage(v, 0, 0);
        const link = document.createElement("a");
        link.download = `${camera.name}-${Date.now()}.png`;
        link.href = canvas.toDataURL("image/png");
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
    startStream(0);
  };

  const toggleAudio = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleQuality = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setQuality((prev) => (prev === "fast" ? "hd" : "fast"));
  };

  const channelNum = camera.streamName.replace(/\D/g, "").slice(-1) || "1";

  return (
    <div
      onClick={!isFullscreen ? onToggleFullscreen : undefined}
      className={`group relative flex w-full h-full overflow-hidden bg-black select-none rounded-none transition-all ${
        isFullscreen
          ? "fixed inset-0 z-50 bg-black"
          : "cursor-pointer border-0 shadow-none"
      }`}
    >
      {/* ── Full Bleed Video ── */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        onTimeUpdate={handleTimeUpdate}
        className="h-full w-full object-cover pointer-events-none rounded-none"
      />

      {/* ── Floating Top OSD Overlay (Always Visible on CCTV) ── */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-2 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none">
        {/* Top-Left: Status Dot + Camera Name + Channel */}
        <div className="flex items-center gap-1.5 bg-black/60 px-2 py-1 text-[11px] font-bold text-white border border-white/15 backdrop-blur-xs rounded-none shadow-sm pointer-events-auto">
          <span
            className={`h-2 w-2 shrink-0 rounded-none ${
              status === "connected"
                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]"
                : status === "connecting"
                ? "bg-amber-400 animate-pulse"
                : "bg-rose-500"
            }`}
          />
          <span className="truncate max-w-[110px] tracking-tight">{camera.name}</span>
          <span className="text-[9px] font-mono text-white/50 border-l border-white/20 pl-1">
            CH{channelNum}
          </span>
        </div>

        {/* Top-Right: Fast/HD + Maximize (or Close if Fullscreen) */}
        <div className="flex items-center gap-1 pointer-events-auto opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button
            onClick={toggleQuality}
            className={`px-1.5 py-0.5 text-[10px] font-bold border transition-colors rounded-none ${
              quality === "fast"
                ? "bg-black/70 text-emerald-400 border-emerald-500/50"
                : "bg-black/70 text-cyan-300 border-cyan-500/50"
            }`}
            title="Toggle Fast (Smooth) vs HD (1080p)"
          >
            {quality === "fast" ? "FAST" : "HD"}
          </button>

          {!isFullscreen ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleFullscreen) onToggleFullscreen();
              }}
              className="p-1 bg-black/70 text-white border border-white/20 hover:bg-white/20 transition-colors rounded-none"
              title="Expand Camera"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleFullscreen) onToggleFullscreen();
              }}
              className="p-1 bg-black/70 text-white border border-white/20 hover:bg-white/20 transition-colors rounded-none"
              title="Close Fullscreen"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Floating Bottom OSD Overlay ── */}
      <div className="absolute bottom-0 inset-x-0 z-20 flex items-center justify-between p-2 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none">
        {/* Live Clock HUD */}
        <div className="bg-black/60 px-2 py-0.5 text-[10px] font-mono text-white/80 border border-white/10 backdrop-blur-xs rounded-none pointer-events-auto">
          {currentTime || "LIVE"}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 pointer-events-auto opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button
            onClick={toggleAudio}
            className="p-1 bg-black/70 text-white/80 hover:text-white border border-white/15 transition-colors rounded-none"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX className="h-3.5 w-3.5" />
            ) : (
              <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
            )}
          </button>
          <button
            onClick={handleSnapshot}
            className="p-1 bg-black/70 text-white/80 hover:text-white border border-white/15 transition-colors rounded-none"
            title="Snapshot"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleReconnect}
            className="p-1 bg-black/70 text-white/80 hover:text-white border border-white/15 transition-colors rounded-none"
            title="Refresh Stream"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Connecting State Overlay */}
      {status === "connecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-xs text-white z-10 rounded-none pointer-events-none">
          <div className="relative flex h-8 w-8 items-center justify-center mb-1.5">
            <div className="absolute h-8 w-8 animate-spin border-2 border-zinc-700 border-t-emerald-400 rounded-none" />
            <Wifi className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <p className="font-semibold text-[11px] text-white">Opening Feed…</p>
          <p className="text-[9px] text-zinc-400 mt-0.5">{camera.name}</p>
        </div>
      )}

      {/* Error State Overlay */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-4 text-center text-white z-20 rounded-none">
          <AlertCircle className="h-6 w-6 text-amber-400 mb-1" />
          <p className="text-xs font-semibold">Feed Offline</p>
          <p className="text-[10px] text-zinc-400 max-w-xs mt-0.5">
            {errorMessage || "Unable to connect to stream"}
          </p>
          <button
            onClick={handleReconnect}
            className="mt-2.5 flex items-center gap-1.5 bg-zinc-800 border border-zinc-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-zinc-700 rounded-none"
          >
            <RotateCw className="h-3 w-3" /> Reconnect
          </button>
        </div>
      )}

      {/* Snapshot Feedback Toast */}
      {snapshotTaken && (
        <div className="absolute inset-x-0 top-10 flex justify-center pointer-events-none z-30">
          <div className="flex items-center gap-1.5 bg-white/95 px-3 py-1 text-xs font-bold text-slate-900 shadow-xl border border-slate-300 rounded-none">
            <Check className="h-3.5 w-3.5 text-emerald-600" /> Snapshot Saved
          </div>
        </div>
      )}
    </div>
  );
}
