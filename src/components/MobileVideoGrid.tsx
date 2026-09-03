"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { CameraConfig } from "@/lib/types";
import { Wifi, Radio, AlertCircle } from "lucide-react";

interface MobileVideoGridProps {
  cameras: CameraConfig[];
  selectedCameraId: string | null;
  onSelectCamera: (id: string) => void;
  onDoubleTapCamera: (id: string) => void;
  refreshTrigger: number;
  isPaused: boolean;
  isMuted: boolean;
  layoutMode: "2x2" | "1x1";
}

export function MobileVideoGrid({
  cameras,
  selectedCameraId,
  onSelectCamera,
  onDoubleTapCamera,
  refreshTrigger,
  isPaused,
  isMuted,
  layoutMode,
}: MobileVideoGridProps) {
  // If in 1x1 mode or a single camera view is active, filter to only that camera
  const displayedCameras =
    layoutMode === "1x1" && selectedCameraId
      ? cameras.filter((c) => c.id === selectedCameraId)
      : cameras.slice(0, 4);

  return (
    <div
      className={`grid w-full bg-black gap-[1.5px] border-b border-slate-200 overflow-hidden ${
        displayedCameras.length === 1
          ? "grid-cols-1 aspect-video"
          : "grid-cols-2 aspect-[4/3] sm:aspect-video"
      }`}
    >
      {displayedCameras.map((camera) => (
        <SingleCameraCell
          key={camera.id}
          camera={camera}
          isSelected={selectedCameraId === camera.id}
          onSelect={() => onSelectCamera(camera.id)}
          onDoubleTap={() => onDoubleTapCamera(camera.id)}
          refreshTrigger={refreshTrigger}
          isPaused={isPaused}
          isMuted={isMuted}
        />
      ))}
    </div>
  );
}

interface SingleCameraCellProps {
  camera: CameraConfig;
  isSelected: boolean;
  onSelect: () => void;
  onDoubleTap: () => void;
  refreshTrigger: number;
  isPaused: boolean;
  isMuted: boolean;
}

function SingleCameraCell({
  camera,
  isSelected,
  onSelect,
  onDoubleTap,
  refreshTrigger,
  isPaused,
  isMuted,
}: SingleCameraCellProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isError, setIsError] = useState(false);
  const lastTapRef = useRef<number>(0);

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

  // Start HTTP MP4 stream fallback
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
        setIsConnected(true);
        setIsError(false);
        if (!isPaused) {
          videoRef.current?.play().catch(() => {});
        }
      };
      videoRef.current.onerror = () => {
        setIsError(true);
        setIsConnected(false);
      };
    }
  }, [camera.streamName, isPaused]);

  const start = useCallback(async () => {
    stop();
    setIsConnected(false);
    setIsError(false);

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
          if (!isPaused) {
            videoRef.current.play().catch(() => {});
          }
          setIsConnected(true);
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (
          pc.iceConnectionState === "failed" ||
          pc.iceConnectionState === "disconnected"
        ) {
          console.warn(`[MobileGrid] WebRTC failed for ${camera.streamName}, switching to MP4 stream`);
          startMp4Stream();
        }
      };

      // Watchdog: If WebRTC has no video frames after 3.5s (UDP blocked by Cloudflare Tunnel), auto-fallback to MP4
      fallbackTimerRef.current = setTimeout(() => {
        if (videoRef.current && videoRef.current.videoWidth === 0) {
          console.warn(`[MobileGrid] No WebRTC frames for ${camera.streamName}, falling back to MP4 stream`);
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

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const answerSdp = await response.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch {
      // Fallback to MP4 immediately if WebRTC fails
      startMp4Stream();
    }
  }, [camera.streamName, isPaused, startMp4Stream, stop]);

  useEffect(() => {
    start();
    return () => {
      stop();
    };
  }, [camera.streamName, refreshTrigger, start, stop]);

  useEffect(() => {
    if (videoRef.current) {
      if (isPaused) {
        videoRef.current.pause();
      } else if (isConnected) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isPaused, isConnected]);

  // Tap & Double Tap Handler
  const handleClick = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      onDoubleTap();
    } else {
      onSelect();
    }
    lastTapRef.current = now;
  };

  const channelNumber = camera.streamName.slice(-1);

  return (
    <div
      onClick={handleClick}
      className={`relative h-full w-full bg-black overflow-hidden cursor-pointer select-none transition-all ${
        isSelected
          ? "ring-2 ring-[#84cc16] ring-inset z-10"
          : "hover:opacity-95"
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        className="h-full w-full object-cover pointer-events-none"
      />

      {/* Top Left Camera Pill Badge */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5 z-20 pointer-events-none">
        <span
          className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide shadow-md transition-colors ${
            isSelected
              ? "bg-[#84cc16] text-black"
              : "bg-black/65 text-white/90 backdrop-blur-xs"
          }`}
        >
          {isSelected && (
            <Radio className="h-2.5 w-2.5 fill-current animate-pulse" />
          )}
          <span>{camera.name.split(" - ")[0]}</span>
        </span>
      </div>

      {/* Channel Number Overlay (bottom-left) */}
      <div className="absolute bottom-1.5 left-2 z-10 pointer-events-none">
        <span className="font-mono text-[9px] font-semibold text-white/70 bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-xs">
          CH{channelNumber}
        </span>
      </div>

      {/* Connection Loading State */}
      {!isConnected && !isError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-[#84cc16] mb-1.5" />
          <span className="text-[10px] font-medium text-white/80">
            Connecting…
          </span>
        </div>
      )}

      {/* Connection Error State */}
      {isError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-2 text-center text-white/80">
          <AlertCircle className="h-5 w-5 text-amber-400 mb-1" />
          <span className="text-[10px] font-bold text-white">No Feed</span>
          <span className="text-[8px] text-white/50 mt-0.5 font-mono">
            Tap to retry
          </span>
        </div>
      )}
    </div>
  );
}
