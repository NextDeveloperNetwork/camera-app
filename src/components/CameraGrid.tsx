"use client";

import React, { useState, useEffect } from "react";
import { CameraConfig, GridLayout } from "@/lib/types";
import { CameraPlayer } from "./CameraPlayer";
import { ChevronLeft, ChevronRight, X, Cctv } from "lucide-react";

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

  // Keyboard navigation for fullscreen (Esc to exit, Arrow keys to switch)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFullscreenCameraId(null);
      } else if (fullscreenCameraId) {
        const currentIndex = activeCameras.findIndex(
          (c) => c.id === fullscreenCameraId
        );
        if (currentIndex === -1) return;

        if (e.key === "ArrowRight") {
          const nextIndex = (currentIndex + 1) % activeCameras.length;
          setFullscreenCameraId(activeCameras[nextIndex].id);
        } else if (e.key === "ArrowLeft") {
          const prevIndex =
            (currentIndex - 1 + activeCameras.length) % activeCameras.length;
          setFullscreenCameraId(activeCameras[prevIndex].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fullscreenCameraId, activeCameras]);

  if (activeCameras.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-12 text-center text-slate-500">
        <Cctv className="h-10 w-10 text-slate-300 mb-2" />
        <p className="text-sm font-semibold text-slate-700">No cameras configured</p>
        <p className="mt-1 text-xs text-slate-400">
          Open Settings to add or enable camera channels.
        </p>
      </div>
    );
  }

  // Handle single camera fullscreen view with swipe/navigation
  if (fullscreenCameraId) {
    const currentIndex = activeCameras.findIndex(
      (c) => c.id === fullscreenCameraId
    );
    const activeCam = activeCameras[currentIndex] || activeCameras[0];

    const handleNext = () => {
      const nextIndex = (currentIndex + 1) % activeCameras.length;
      setFullscreenCameraId(activeCameras[nextIndex].id);
    };

    const handlePrev = () => {
      const prevIndex =
        (currentIndex - 1 + activeCameras.length) % activeCameras.length;
      setFullscreenCameraId(activeCameras[prevIndex].id);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950">
        {/* Next / Previous camera buttons on small & large screens */}
        {activeCameras.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-md backdrop-blur-xs hover:bg-white transition-all active:scale-95"
              title="Previous Camera"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-md backdrop-blur-xs hover:bg-white transition-all active:scale-95"
              title="Next Camera"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        <CameraPlayer
          key={activeCam.id}
          camera={activeCam}
          isFullscreen={true}
          onToggleFullscreen={() => setFullscreenCameraId(null)}
          refreshTrigger={refreshTrigger}
        />
      </div>
    );
  }

  // Determine grid classes based on layout mode and camera count
  const getGridClasses = () => {
    const count = activeCameras.length;
    switch (layout) {
      case "1x1":
        return "grid-cols-1 max-w-4xl mx-auto";
      case "1x2":
        return "grid-cols-1 md:grid-cols-2";
      case "2x2":
        return "grid-cols-1 sm:grid-cols-2";
      case "auto":
      default:
        if (count === 1) return "grid-cols-1 max-w-4xl mx-auto";
        return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2";
    }
  };

  return (
    <div
      className={`grid w-full flex-1 gap-3 sm:gap-4 p-3 sm:p-5 transition-all duration-300 ${getGridClasses()}`}
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
