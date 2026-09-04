"use client";

import React from "react";
import { CameraConfig } from "@/lib/types";
import { CameraPlayer } from "./CameraPlayer";

interface MobileVideoGridProps {
  cameras: CameraConfig[];
  selectedCameraId: string | null;
  onSelectCamera: (id: string) => void;
  onDoubleTapCamera: (id: string) => void;
  refreshTrigger: number;
  isPaused?: boolean;
  isMuted?: boolean;
  layoutMode: "2x2" | "1x1";
}

export function MobileVideoGrid({
  cameras,
  selectedCameraId,
  onSelectCamera,
  onDoubleTapCamera,
  refreshTrigger,
  layoutMode,
}: MobileVideoGridProps) {
  const displayedCameras =
    layoutMode === "1x1" && selectedCameraId
      ? cameras.filter((c) => c.id === selectedCameraId)
      : cameras.slice(0, 4);

  return (
    <div
      className={`grid w-full bg-black gap-[1px] p-0 m-0 overflow-hidden border-b border-black select-none ${
        displayedCameras.length === 1 ? "grid-cols-1" : "grid-cols-2"
      }`}
    >
      {displayedCameras.map((camera) => (
        <div
          key={camera.id}
          onClick={() => onSelectCamera(camera.id)}
          className={`relative aspect-video w-full bg-black overflow-hidden rounded-none transition-all ${
            selectedCameraId === camera.id
              ? "outline outline-2 outline-lime-500 z-10"
              : ""
          }`}
        >
          <CameraPlayer
            camera={camera}
            isFullscreen={false}
            onToggleFullscreen={() => onDoubleTapCamera(camera.id)}
            refreshTrigger={refreshTrigger}
          />
        </div>
      ))}
    </div>
  );
}
