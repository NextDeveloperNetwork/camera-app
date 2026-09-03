"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { CameraConfig } from "@/lib/types";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Camera,
  Volume2,
  VolumeX,
  RotateCw,
  Check,
  Radio,
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
  const [isMuted, setIsMuted] = useState(true);
  const [snapshotTaken, setSnapshotTaken] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setCurrentTime(
        `${d.toISOString().slice(0, 10)} ${d.toLocaleTimeString("en-GB")}`
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const stop = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

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
    } catch (err) {
      console.error("Fullscreen WebRTC connect error:", err);
    }
  }, [camera.streamName, stop]);

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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 animate-fadeIn">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between bg-white px-4 py-3 border-b border-slate-200 z-20">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-lime-50 px-2 py-0.5 text-[11px] font-bold text-lime-700 border border-lime-200">
            <Radio className="h-2.5 w-2.5 animate-pulse" /> LIVE
          </span>
          <h2 className="text-sm font-bold text-slate-900">{camera.name}</h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-500 hidden sm:inline">
            {currentTime}
          </span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition-all"
            title="Close Fullscreen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Video Surface */}
      <div className="relative flex flex-1 items-center justify-center bg-black overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          className="h-full w-full object-contain pointer-events-none"
        />

        {/* Previous Camera Button */}
        {allCameras.length > 1 && (
          <button
            onClick={handlePrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-md backdrop-blur-xs hover:bg-white active:scale-95 transition-all"
            title="Previous Camera"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* Next Camera Button */}
        {allCameras.length > 1 && (
          <button
            onClick={handleNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-md backdrop-blur-xs hover:bg-white active:scale-95 transition-all"
            title="Next Camera"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {/* Snapshot feedback pill */}
        {snapshotTaken && (
          <div className="absolute top-4 inset-x-0 flex justify-center pointer-events-none z-30">
            <div className="flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1 text-xs font-semibold text-slate-900 shadow-lg border border-slate-200">
              <Check className="h-3.5 w-3.5 text-lime-600" /> Snapshot Saved
            </div>
          </div>
        )}
      </div>

      {/* Floating Bottom Action Toolbar */}
      <div className="bg-white border-t border-slate-200 py-2.5 px-6 flex items-center justify-center gap-4 z-20">
        <button
          onClick={() => {
            if (videoRef.current) {
              videoRef.current.muted = !isMuted;
              setIsMuted(!isMuted);
            }
          }}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition-all"
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <VolumeX className="h-5 w-5" />
          ) : (
            <Volume2 className="h-5 w-5 text-lime-600" />
          )}
        </button>

        <button
          onClick={handleSnapshot}
          className="flex items-center gap-2 rounded-xl bg-[#84cc16] px-5 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 active:scale-95 transition-all"
        >
          <Camera className="h-4 w-4" />
          <span>Snapshot</span>
        </button>

        <button
          onClick={start}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition-all"
          title="Reconnect"
        >
          <RotateCw className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
