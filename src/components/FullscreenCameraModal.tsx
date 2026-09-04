"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import Hls from "hls.js";
import { CameraConfig, ConnectionStatus } from "@/lib/types";
import {
  X,
  Camera,
  ChevronLeft,
  ChevronRight,
  Radio,
  Check,
  RotateCw,
  AlertCircle,
  Wifi,
} from "lucide-react";

interface FullscreenCameraModalProps {
  camera: CameraConfig;
  allCameras: CameraConfig[];
  onClose: () => void;
  onSelectCamera: (id: string) => void;
  refreshTrigger: number;
}

export function FullscreenCameraModal({
  camera,
  allCameras,
  onClose,
  onSelectCamera,
  refreshTrigger,
}: FullscreenCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [errorMessage, setErrorMessage] = useState("");
  const [snapshotTaken, setSnapshotTaken] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Auto-hide controls after 4 seconds of inactivity
  useEffect(() => {
    if (!showControls) return;
    const timer = setTimeout(() => setShowControls(false), 4000);
    return () => clearTimeout(timer);
  }, [showControls]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const toggleControls = () => {
    setShowControls((prev) => !prev);
  };

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

  const startStream = useCallback(
    (retryCount = 0) => {
      stopStream();
      if (!mountedRef.current) return;

      setStatus("connecting");
      setErrorMessage("");

      const v = videoRef.current;
      if (!v) return;

      // In fullscreen we prioritize high quality mainstream
      const streamName = camera.streamName;
      const hlsUrl = `/api/hls/${encodeURIComponent(streamName)}/index.m3u8`;

      const scheduleRetry = (delayMs: number) => {
        if (!mountedRef.current) return;
        retryTimerRef.current = setTimeout(() => {
          if (mountedRef.current) startStream(retryCount + 1);
        }, delayMs);
      };

      const onFatalError = (msg: string) => {
        if (!mountedRef.current) return;
        console.warn(`[FullscreenCamera] ${camera.name}: ${msg}. Retry #${retryCount + 1}`);
        if (retryCount < 8) {
          scheduleRetry(3000);
        } else {
          setStatus("error");
          setErrorMessage(msg);
        }
      };

      // ── A) HLS.js (Chrome, Firefox, Edge, Safari Desktop, Android) ──
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
          fragLoadingTimeOut: 15000,
        });

        hlsRef.current = hls;
        hls.loadSource(hlsUrl);
        hls.attachMedia(v);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!mountedRef.current) return;
          setStatus("connected");
          v.muted = true;
          v.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (!data.fatal) return;
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

      // ── B) Native HLS (iOS Safari) ──
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
          v.play().catch(() => {});
        };

        v.onloadedmetadata = onReady;
        v.oncanplay = onReady;

        v.onerror = () => {
          clearTimeouts();
          onFatalError("Stream unavailable — retrying");
        };

        retryTimerRef.current = setTimeout(() => {
          if (v.readyState < 1) {
            onFatalError("Stream timeout — retrying");
          }
        }, 15000);
        return;
      }

      setStatus("error");
      setErrorMessage("HLS video playback is not supported in this browser.");
    },
    [camera.name, camera.streamName, stopStream]
  );

  useEffect(() => {
    startStream();
    return stopStream;
  }, [startStream, stopStream]);

  useEffect(() => {
    if (refreshTrigger > 0) startStream();
  }, [refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // Previous & Next camera cycle
  const currentIndex = allCameras.findIndex((c) => c.id === camera.id);
  const handlePrev = () => {
    const prevIdx = (currentIndex - 1 + allCameras.length) % allCameras.length;
    onSelectCamera(allCameras[prevIdx].id);
  };
  const handleNext = () => {
    const nextIdx = (currentIndex + 1) % allCameras.length;
    onSelectCamera(allCameras[nextIdx].id);
  };

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

  return (
    <div
      onClick={toggleControls}
      className="fixed inset-0 z-50 flex flex-col bg-black select-none"
    >
      {/* Top Floating Control Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-none bg-black/60 text-white/90 backdrop-blur-md border border-white/20 active:scale-95 transition-all"
            title="Back to Grid"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1.5 bg-black/60 px-3 py-1 rounded-none border border-white/20 backdrop-blur-md">
            <Radio
              className={`h-3 w-3 ${
                status === "connected"
                  ? "text-[#84cc16] fill-current animate-pulse"
                  : "text-amber-400 fill-current"
              }`}
            />
            <span className="text-xs font-bold text-white tracking-wide">
              {camera.name}
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-400 ml-1">
              HD
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-none bg-black/60 text-white/90 backdrop-blur-md border border-white/20 active:scale-95 transition-all"
          title="Close Fullscreen"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Main Video Surface */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover pointer-events-none rounded-none"
        />

        {/* Connecting state */}
        {status === "connecting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 text-white pointer-events-none rounded-none">
            <div className="relative flex h-10 w-10 items-center justify-center mb-2">
              <div className="absolute h-10 w-10 animate-spin border-2 border-zinc-700 border-t-emerald-400 rounded-none" />
              <Wifi className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-white">Opening HD Stream…</p>
            <p className="text-xs text-zinc-400 mt-1">{camera.name}</p>
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-4 text-center text-white z-20 rounded-none">
            <AlertCircle className="h-8 w-8 text-amber-400 mb-2" />
            <p className="text-sm font-semibold">Feed Unavailable</p>
            <p className="text-xs text-zinc-400 max-w-sm mt-1 mb-4">
              {errorMessage || "Unable to establish live HLS feed."}
            </p>
            <button
              onClick={() => startStream(0)}
              className="flex items-center gap-2 rounded-none bg-white px-4 py-2 text-xs font-semibold text-slate-900 shadow-md hover:bg-slate-100 active:scale-95 transition-all"
            >
              <RotateCw className="h-4 w-4" /> Reconnect
            </button>
          </div>
        )}

        {/* Snapshot feedback pill */}
        {snapshotTaken && (
          <div className="absolute top-16 inset-x-0 flex justify-center pointer-events-none z-30">
            <div className="flex items-center gap-1.5 rounded-none bg-white/95 px-4 py-1.5 text-xs font-bold text-slate-900 shadow-xl border border-slate-300">
              <Check className="h-4 w-4 text-emerald-600" /> Snapshot Saved
            </div>
          </div>
        )}

        {/* Left / Right Camera Switchers */}
        {showControls && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-none bg-black/60 text-white/90 border border-white/20 backdrop-blur-md active:scale-90 transition-all"
              title="Previous Camera"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-none bg-black/60 text-white/90 border border-white/20 backdrop-blur-md active:scale-90 transition-all"
              title="Next Camera"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {/* Bottom Floating Action Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute bottom-6 inset-x-0 z-30 flex items-center justify-center gap-4 px-4 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-3 bg-black/70 px-5 py-2 rounded-none border border-white/20 backdrop-blur-md shadow-2xl">
          <button
            onClick={handleSnapshot}
            className="flex items-center gap-1.5 text-xs font-bold text-white/90 hover:text-white active:scale-95 transition-all"
            title="Take Snapshot"
          >
            <Camera className="h-4 w-4 text-[#84cc16]" />
            <span>Snapshot</span>
          </button>
        </div>
      </div>
    </div>
  );
}
