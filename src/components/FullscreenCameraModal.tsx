"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { CameraConfig } from "@/lib/types";
import {
  X,
  Camera,
  ChevronLeft,
  ChevronRight,
  Radio,
  Check,
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
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [snapshotTaken, setSnapshotTaken] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Auto-hide controls after 4 seconds of inactivity
  useEffect(() => {
    if (!showControls) return;
    const timer = setTimeout(() => setShowControls(false), 4000);
    return () => clearTimeout(timer);
  }, [showControls]);

  const toggleControls = () => {
    setShowControls((prev) => !prev);
  };

  const stop = useCallback(() => {
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

  const startMp4Stream = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      const streamUrl = `/api/stream/stream.mp4?src=${encodeURIComponent(
        camera.streamName
      )}`;
      videoRef.current.src = streamUrl;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(() => {});
      };
    }
  }, [camera.streamName]);

  const start = useCallback(async () => {
    stop();

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
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (
          pc.iceConnectionState === "failed" ||
          pc.iceConnectionState === "disconnected"
        ) {
          startMp4Stream();
        }
      };

      // Watchdog: If WebRTC has no video frames after 3.5s (UDP blocked), fallback to MP4 stream
      fallbackTimerRef.current = setTimeout(() => {
        if (videoRef.current && videoRef.current.videoWidth === 0) {
          startMp4Stream();
        }
      }, 3500);

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

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const answerSdp = await response.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch {
      startMp4Stream();
    }
  }, [camera.streamName, startMp4Stream, stop]);

  useEffect(() => {
    start();
    return () => {
      stop();
    };
  }, [camera.streamName, refreshTrigger, start, stop]);

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
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur-md border border-white/10 active:scale-95 transition-all"
            title="Back to Grid"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1.5 bg-black/50 px-3 py-1 rounded-full border border-white/10 backdrop-blur-md">
            <Radio className="h-3 w-3 text-[#84cc16] fill-current animate-pulse" />
            <span className="text-xs font-bold text-white tracking-wide">
              {camera.name}
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur-md border border-white/10 active:scale-95 transition-all"
          title="Close Fullscreen"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Main Video Surface */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-contain pointer-events-none"
        />

        {/* Snapshot feedback pill */}
        {snapshotTaken && (
          <div className="absolute top-16 inset-x-0 flex justify-center pointer-events-none z-30">
            <div className="flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-1.5 text-xs font-bold text-slate-900 shadow-xl border border-slate-200">
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
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white/80 border border-white/10 backdrop-blur-md active:scale-90 transition-all"
              title="Previous Camera"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white/80 border border-white/10 backdrop-blur-md active:scale-90 transition-all"
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
        <div className="flex items-center gap-3 bg-black/60 px-5 py-2 rounded-full border border-white/15 backdrop-blur-md shadow-2xl">
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
