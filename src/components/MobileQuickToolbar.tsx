"use client";

import React from "react";
import {
  Pause,
  Play,
  Camera,
  Maximize2,
  LayoutGrid,
  Square,
  Mic,
  Volume2,
  VolumeX,
} from "lucide-react";

interface MobileQuickToolbarProps {
  isPaused: boolean;
  onTogglePause: () => void;
  onSnapshot: () => void;
  onExpand: () => void;
  layoutMode: "2x2" | "1x1";
  onToggleLayout: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  activeCameraName: string;
}

export function MobileQuickToolbar({
  isPaused,
  onTogglePause,
  onSnapshot,
  onExpand,
  layoutMode,
  onToggleLayout,
  isMuted,
  onToggleMute,
}: MobileQuickToolbarProps) {
  return (
    <div className="flex items-center justify-between bg-white px-4 py-2 border-b border-slate-200">
      {/* Left controls */}
      <div className="flex items-center gap-4">
        {/* Pause / Play */}
        <button
          onClick={onTogglePause}
          className="flex h-8 w-8 items-center justify-center text-slate-700 hover:text-slate-900 active:scale-95 transition-all"
          title={isPaused ? "Resume Live" : "Pause Live"}
        >
          {isPaused ? (
            <Play className="h-4 w-4 fill-slate-700" />
          ) : (
            <Pause className="h-4 w-4" />
          )}
        </button>

        {/* Snapshot */}
        <button
          onClick={onSnapshot}
          className="flex h-8 w-8 items-center justify-center text-slate-700 hover:text-slate-900 active:scale-95 transition-all"
          title="Capture Snapshot"
        >
          <Camera className="h-4 w-4" />
        </button>

        {/* Expand / Fullscreen */}
        <button
          onClick={onExpand}
          className="flex h-8 w-8 items-center justify-center text-slate-700 hover:text-slate-900 active:scale-95 transition-all"
          title="Expand Active Camera"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-4">
        {/* Layout: 2x2 vs 1x1 */}
        <button
          onClick={onToggleLayout}
          className="flex h-8 w-8 items-center justify-center text-slate-700 hover:text-slate-900 active:scale-95 transition-all"
          title={layoutMode === "2x2" ? "Single View" : "Quad View"}
        >
          {layoutMode === "2x2" ? (
            <LayoutGrid className="h-4 w-4" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>

        {/* Mic (intercom) */}
        <button
          className="flex h-8 w-8 items-center justify-center text-slate-400 hover:text-slate-600 transition-all opacity-60"
          title="Two-Way Audio (Mic)"
        >
          <Mic className="h-4 w-4" />
        </button>

        {/* Speaker / Mute */}
        <button
          onClick={onToggleMute}
          className="flex h-8 w-8 items-center justify-center text-slate-700 hover:text-slate-900 active:scale-95 transition-all"
          title={isMuted ? "Unmute Audio" : "Mute Audio"}
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4 text-lime-600" />
          )}
        </button>
      </div>
    </div>
  );
}
