"use client";

import React, { useState } from "react";
import { CameraConfig, GridLayout } from "@/lib/types";
import { CameraPlayer } from "./CameraPlayer";

interface CameraGridProps {
  cameras: CameraConfig[];
  layout: GridLayout;
  refreshTrigger: number;
}

export function CameraGrid({
  cameras,
  layout,
  refreshTrigger,
}: CameraGridProps) {
  const [fullscreenCameraId, setFullscreenCameraId] = useState<string | null>(
    null
  );

  const activeCameras = cameras.filter((cam) => cam.enabled);

  if (activeCameras.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-12 text-center text-slate-400">
        <p className="text-sm font-mono">NO ACTIVE CAMERAS CONFIGURED</p>
        <p className="mt-1 text-xs text-slate-500">
          Open Settings to add or enable camera channels.
        </p>
      </div>
    );
  }

  // Handle single camera fullscreen view
  if (fullscreenCameraId) {
    const activeCam = activeCameras.find((c) => c.id === fullscreenCameraId);
    if (activeCam) {
      return (
        <div className="fixed inset-0 z-50 flex bg-black p-2">
          <CameraPlayer
            camera={activeCam}
            isFullscreen={true}
            onToggleFullscreen={() => setFullscreenCameraId(null)}
            refreshTrigger={refreshTrigger}
          />
        </div>
      );
    }
  }

  // Determine grid classes based on layout mode and camera count
  const getGridClasses = () => {
    const count = activeCameras.length;
    switch (layout) {
      case "1x1":
        return "grid-cols-1 max-w-5xl mx-auto";
      case "1x2":
        return "grid-cols-1 md:grid-cols-2";
      case "2x2":
        return "grid-cols-1 md:grid-cols-2";
      case "auto":
      default:
        if (count === 1) return "grid-cols-1 max-w-5xl mx-auto";
        if (count === 2) return "grid-cols-1 md:grid-cols-2";
        return "grid-cols-1 md:grid-cols-2";
    }
  };

  return (
    <div
      className={`grid w-full flex-1 gap-4 p-4 transition-all duration-300 ${getGridClasses()}`}
    >
      {activeCameras.map((camera) => (
        <CameraPlayer
          key={camera.id}
          camera={camera}
          onToggleFullscreen={() => setFullscreenCameraId(camera.id)}
          refreshTrigger={refreshTrigger}
        />
      ))}
    </div>
  );
}
