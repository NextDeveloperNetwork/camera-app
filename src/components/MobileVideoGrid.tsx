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
  const [isConnected, setIsConnected] = useState(false);
  const [isError, setIsError] = useState(false);
  const lastTapRef = useRef<number>(0);

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
          setIsConnected(false);
          setIsError(true);
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
    } catch {
      setIsConnected(false);
      setIsError(true);
    }
  }, [camera.streamName, isPaused, stop]);

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
  const handleTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      onDoubleTap();
    } else {
      onSelect();
    }
    lastTapRef.current = now;
  };

  return (
    <div
      onClick={handleTap}
      className={`relative flex items-center justify-center bg-black cursor-pointer select-none overflow-hidden transition-all ${
        isSelected ? "ring-2 ring-inset ring-lime-500" : ""
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        className="h-full w-full object-cover pointer-events-none"
      />

      {/* Top Camera Label Badge matching screenshot */}
      <div className="absolute top-1.5 left-1.5 pointer-events-none z-10">
        <span
          className={`inline-block rounded-xs px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold tracking-tight shadow-xs ${
            isSelected
              ? "bg-[#84cc16] text-white"
              : "bg-black/55 text-slate-100 backdrop-blur-xs"
          }`}
        >
          {camera.name.split(" - ")[0]}
        </span>
      </div>

      {/* Connecting status */}
      {!isConnected && !isError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white backdrop-blur-xs">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-400 border-t-white" />
        </div>
      )}

      {/* Error status */}
      {isError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white p-2 text-center">
          <div className="flex flex-col items-center">
            <AlertCircle className="h-5 w-5 text-amber-400 mb-1" />
            <span className="text-[10px] text-slate-300">Offline</span>
          </div>
        </div>
      )}
    </div>
  );
}
