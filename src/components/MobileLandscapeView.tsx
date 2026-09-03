"use client";

import React, { useState, useEffect } from "react";
import { CameraConfig } from "@/lib/types";
import { CameraPlayer } from "./CameraPlayer";
import {
  ChevronLeft,
  ChevronRight,
  Square,
  Columns2,
  LayoutGrid,
  X,
  Radio,
} from "lucide-react";

interface MobileLandscapeViewProps {
  cameras: CameraConfig[];
  selectedCameraId: string;
  onSelectCamera: (id: string) => void;
  onClose?: () => void;
  refreshTrigger: number;
}

export function MobileLandscapeView({
  cameras,
  selectedCameraId,
  onSelectCamera,
  onClose,
  refreshTrigger,
}: MobileLandscapeViewProps) {
  // Layout mode in landscape: "2x2" (quad, like in user image), "1x2" (two cameras), "1x1" (single camera)
  const [layout, setLayout] = useState<"2x2" | "1x2" | "1x1">("2x2");
  const [primaryCamId, setPrimaryCamId] = useState<string>(selectedCameraId);
  const [secondaryCamId, setSecondaryCamId] = useState<string>(() => {
    const second = cameras.find((c) => c.id !== selectedCameraId);
    return second?.id || cameras[1]?.id || cameras[0]?.id;
  });
  const [showControls, setShowControls] = useState(true);

  // Auto-hide controls after 3.5 seconds of inactivity
  useEffect(() => {
    if (!showControls) return;
    const timer = setTimeout(() => {
      setShowControls(false);
    }, 3500);
    return () => clearTimeout(timer);
  }, [showControls, layout]);

  const toggleControls = () => {
    setShowControls((prev) => !prev);
  };

  // When a camera in 2x2 grid is clicked -> expand to 1x1
  const handleCameraClick = (id: string) => {
    if (layout === "2x2") {
      setPrimaryCamId(id);
      onSelectCamera(id);
      setLayout("1x1");
      setShowControls(true);
    }
  };

  // Back button in 1x1 or 1x2 returns to 2x2 grid. In 2x2, it closes landscape view if onClose is provided.
  const handleBack = () => {
    if (layout === "1x1" || layout === "1x2") {
      setLayout("2x2");
      setShowControls(true);
    } else if (onClose) {
      onClose();
    }
  };

  // Next / Previous camera navigation in 1x1 mode
  const currentIdx = cameras.findIndex((c) => c.id === primaryCamId);
  const handlePrevCam = (e: React.MouseEvent) => {
    e.stopPropagation();
    const prevIdx = (currentIdx - 1 + cameras.length) % cameras.length;
    const newId = cameras[prevIdx].id;
    setPrimaryCamId(newId);
    onSelectCamera(newId);
  };

  const handleNextCam = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIdx = (currentIdx + 1) % cameras.length;
    const newId = cameras[nextIdx].id;
    setPrimaryCamId(newId);
    onSelectCamera(newId);
  };

  const primaryCam = cameras.find((c) => c.id === primaryCamId) || cameras[0];
  const secondaryCam = cameras.find((c) => c.id === secondaryCamId) || cameras[1] || cameras[0];

  return (
    <div
      onClick={toggleControls}
      className="fixed inset-0 z-50 flex h-full w-full bg-black select-none overflow-hidden"
    >
      {/* ── Top Floating Overlay Header ── */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 py-2.5 bg-gradient-to-b from-black/80 via-black/40 to-transparent transition-opacity duration-300 pointer-events-auto ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Left: Back Button `<` */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleBack}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white border border-white/20 backdrop-blur-md hover:bg-white/20 active:scale-95 transition-all shadow-lg"
            title={layout === "2x2" ? "Close Landscape" : "Back to 2x2 Grid"}
          >
            <ChevronLeft className="h-6 w-6 stroke-[2.5]" />
          </button>

          {layout === "1x1" && (
            <span className="text-xs font-bold text-white tracking-wide bg-black/60 px-3 py-1 rounded-full border border-white/15 backdrop-blur-md">
              {primaryCam.name.split(" - ")[0]}
            </span>
          )}

          {layout === "2x2" && (
            <span className="text-xs font-bold text-emerald-400 bg-black/60 px-3 py-1 rounded-full border border-emerald-500/30 backdrop-blur-md flex items-center gap-1.5">
              <Radio className="h-3 w-3 animate-pulse" />
              <span>Quad Live (4 Cameras)</span>
            </span>
          )}

          {layout === "1x2" && (
            <span className="text-xs font-bold text-white bg-black/60 px-3 py-1 rounded-full border border-white/15 backdrop-blur-md">
              Dual Split View
            </span>
          )}
        </div>

        {/* Center/Right: Layout Mode Toggles: [1x1] [1x2] [2x2] */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full bg-black/60 p-1 border border-white/20 backdrop-blur-md shadow-lg">
            {/* 1x1 Single */}
            <button
              onClick={() => setLayout("1x1")}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                layout === "1x1"
                  ? "bg-white text-black shadow-sm"
                  : "text-white/70 hover:text-white"
              }`}
              title="Single Camera"
            >
              <Square className="h-3.5 w-3.5" />
              <span>1</span>
            </button>

            {/* 1x2 Dual ("select two to open") */}
            <button
              onClick={() => setLayout("1x2")}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                layout === "1x2"
                  ? "bg-white text-black shadow-sm"
                  : "text-white/70 hover:text-white"
              }`}
              title="Two Cameras Split"
            >
              <Columns2 className="h-3.5 w-3.5" />
              <span>2</span>
            </button>

            {/* 2x2 Quad (Default like in photo) */}
            <button
              onClick={() => setLayout("2x2")}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                layout === "2x2"
                  ? "bg-white text-black shadow-sm"
                  : "text-white/70 hover:text-white"
              }`}
              title="4-Camera Quad Grid"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>4</span>
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white/80 border border-white/20 backdrop-blur-md hover:bg-white/20 transition-all shadow-lg"
              title="Exit Landscape"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Secondary Camera Picker (in 1x2 Dual View) ── */}
      {layout === "1x2" && showControls && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-3 inset-x-0 z-30 flex items-center justify-center gap-2 px-4 pointer-events-auto"
        >
          <div className="flex items-center gap-1.5 bg-black/70 px-3 py-1.5 rounded-full border border-white/20 backdrop-blur-md text-xs text-white">
            <span className="text-white/60 text-[11px]">Compare with:</span>
            {cameras.map((c) => (
              <button
                key={c.id}
                onClick={() => setSecondaryCamId(c.id)}
                className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] transition-all ${
                  secondaryCamId === c.id
                    ? "bg-emerald-500 text-white shadow-xs"
                    : "bg-white/10 text-white/80 hover:bg-white/20"
                }`}
              >
                {c.name.split(" - ")[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Left & Right Arrows (in 1x1 Single View) ── */}
      {layout === "1x1" && showControls && (
        <>
          <button
            onClick={handlePrevCam}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white border border-white/20 backdrop-blur-md hover:bg-white/20 active:scale-95 transition-all shadow-xl"
            title="Previous Camera"
          >
            <ChevronLeft className="h-6 w-6 stroke-[2.5]" />
          </button>
          <button
            onClick={handleNextCam}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white border border-white/20 backdrop-blur-md hover:bg-white/20 active:scale-95 transition-all shadow-xl"
            title="Next Camera"
          >
            <ChevronRight className="h-6 w-6 stroke-[2.5]" />
          </button>
        </>
      )}

      {/* ── MAIN VIDEO GRIDS ── */}

      {/* 1. 2x2 QUAD VIEW (Exactly like user's photo!) */}
      {layout === "2x2" && (
        <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-[1px] bg-black">
          {cameras.slice(0, 4).map((camera) => (
            <div
              key={camera.id}
              onClick={(e) => {
                e.stopPropagation();
                handleCameraClick(camera.id);
              }}
              className="relative h-full w-full bg-black overflow-hidden cursor-pointer group"
            >
              <CameraPlayer
                camera={camera}
                isFullscreen={false}
                refreshTrigger={refreshTrigger}
              />

              {/* Tap hint overlay on hover/touch */}
              <div className="absolute inset-0 bg-white/0 hover:bg-white/5 transition-colors pointer-events-none" />

              {/* Camera title pill */}
              <div className="absolute top-2 left-2 z-10 pointer-events-none rounded bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                {camera.name.split(" - ")[0]}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. 1x2 DUAL SPLIT VIEW ("select two to open") */}
      {layout === "1x2" && (
        <div className="grid h-full w-full grid-cols-2 grid-rows-1 gap-[1px] bg-black">
          <div className="relative h-full w-full bg-black overflow-hidden">
            <CameraPlayer
              camera={primaryCam}
              isFullscreen={false}
              refreshTrigger={refreshTrigger}
            />
            <div className="absolute top-2 left-2 z-10 pointer-events-none rounded bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
              {primaryCam.name.split(" - ")[0]}
            </div>
          </div>

          <div className="relative h-full w-full bg-black overflow-hidden">
            <CameraPlayer
              camera={secondaryCam}
              isFullscreen={false}
              refreshTrigger={refreshTrigger}
            />
            <div className="absolute top-2 left-2 z-10 pointer-events-none rounded bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
              {secondaryCam.name.split(" - ")[0]}
            </div>
          </div>
        </div>
      )}

      {/* 3. 1x1 SINGLE CAMERA EXPANDED VIEW */}
      {layout === "1x1" && (
        <div className="relative h-full w-full bg-black flex items-center justify-center">
          <CameraPlayer
            camera={primaryCam}
            isFullscreen={true}
            refreshTrigger={refreshTrigger}
          />
        </div>
      )}
    </div>
  );
}
