"use client";

import React from "react";
import { CameraConfig } from "@/lib/types";
import { CameraPlayer, StreamProtocol } from "./CameraPlayer";

interface MobileVideoGridProps {
  cameras: CameraConfig[];
  selectedCameraId: string | null;
  onSelectCamera: (id: string) => void;
  onDoubleTapCamera: (id: string) => void;
  refreshTrigger: number;
  isPaused?: boolean;
  isMuted?: boolean;
  layoutMode: "2x2" | "1x1";
  streamProtocol?: StreamProtocol;
}

export function MobileVideoGrid({
  cameras,
  selectedCameraId,
  onSelectCamera,
  onDoubleTapCamera,
  refreshTrigger,
  layoutMode,
  streamProtocol = "hls",
}: MobileVideoGridProps) {
  const displayedCameras =
    layoutMode === "1x1" && selectedCameraId
      ? cameras.filter((c) => c.id === selectedCameraId)
      : cameras.slice(0, 4);

  return (
    <div
      className={`grid w-full bg-slate-100 gap-1.5 p-1.5 border-b border-slate-200 overflow-hidden ${
        displayedCameras.length === 1
          ? "grid-cols-1"
          : "grid-cols-2"
      }`}
    >
      {displayedCameras.map((camera) => (
        <div
          key={camera.id}
          onClick={() => onSelectCamera(camera.id)}
          className={`relative transition-all rounded-xl overflow-hidden ${
            selectedCameraId === camera.id
              ? "ring-2 ring-lime-500 shadow-md"
              : ""
          }`}
        >
          <CameraPlayer
            camera={camera}
            isFullscreen={false}
            onToggleFullscreen={() => onDoubleTapCamera(camera.id)}
            refreshTrigger={refreshTrigger}
            initialProtocol={streamProtocol}
          />
        </div>
      ))}
    </div>
  );
}
