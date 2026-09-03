"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { CameraConfig } from "@/lib/types";
import { Radio, AlertCircle } from "lucide-react";

interface MobileVideoGridProps {
  cameras: CameraConfig[];
  selectedCameraId: string | null;
  onSelectCamera: (id: string) => void;
  onDoubleTapCamera: (id: string) => void;
  refreshTrigger: number;
  isPaused: boolean;
  isMuted: boolean;
  layoutMode: "2x2" | "1x1";
  streamProtocol?: "webrtc" | "mp4";
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
  streamProtocol = "mp4",
}: MobileVideoGridProps) {
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
          streamProtocol={streamProtocol}
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
  streamProtocol: "webrtc" | "mp4";
}

function SingleCameraCell({
  camera,
  isSelected,
  onSelect,
  onDoubleTap,
  refreshTrigger,
  isPaused,
  isMuted,
  streamProtocol,
}: SingleCameraCellProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isError, setIsError] = useState(false);
  const lastTapRef = useRef<number>(0);

  // Use fast substream on mobile grid for instant connection and smooth FPS
  const streamSrc = camera.subStreamName || camera.streamName;

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

  // Latency sync: Keep playback locked to real-time live edge
  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v || v.buffered.length === 0) return;
    try {
      const liveEdge = v.buffered.end(v.buffered.length - 1);
      const lag = liveEdge - v.currentTime;
      if (lag > 2.0) {
        v.currentTime = liveEdge - 0.15;
      } else if (lag > 0.5) {
        v.playbackRate = 1.15;
      } else {
        v.playbackRate = 1.0;
      }
    } catch {}
  }, []);

  // Start HTTP MP4 stream (100% Cloudflare Tunnel compatible)
  const startMp4Stream = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      const streamUrl = `/api/stream/stream.mp4?src=${encodeURIComponent(
        streamSrc
      )}`;
      videoRef.current.src = streamUrl;
      videoRef.current.play().catch(() => {});
      setIsConnected(true);
      setIsError(false);

      videoRef.current.onloadeddata = () => {
        setIsConnected(true);
        setIsError(false);
      };
      videoRef.current.onerror = () => {
        setIsError(true);
        setIsConnected(false);
      };
    }
  }, [streamSrc]);

  const start = useCallback(async () => {
    stop();
    setIsConnected(false);
    setIsError(false);

    // If MP4 protocol requested (default for mobile), connect immediately!
    if (streamProtocol === "mp4") {
      startMp4Stream();
      return;
    }

    // WebRTC connection
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
          startMp4Stream();
        }
      };

      // Watchdog: If WebRTC has no video frames after 2.5s (UDP blocked), auto-fallback to MP4
      fallbackTimerRef.current = setTimeout(() => {
        if (videoRef.current && videoRef.current.videoWidth === 0) {
          startMp4Stream();
        }
      }, 2500);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const endpoint = `/api/stream/webrtc?src=${encodeURIComponent(
        streamSrc
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
      startMp4Stream();
    }
  }, [streamProtocol, streamSrc, isPaused, startMp4Stream, stop]);

  useEffect(() => {
    start();
    return () => {
      stop();
    };
  }, [streamProtocol, streamSrc, refreshTrigger, start, stop]);

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
        onTimeUpdate={handleTimeUpdate}
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
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs pointer-events-none">
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
