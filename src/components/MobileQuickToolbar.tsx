"use client";

import React from "react";
import {
  Pause,
  Play,
  Camera,
  Maximize2,
  LayoutGrid,
  Square,
  Volume2,
  VolumeX,
  Zap,
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
  streamProtocol?: "webrtc" | "mp4";
  onToggleStreamProtocol?: () => void;
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
  streamProtocol = "mp4",
  onToggleStreamProtocol,
}: MobileQuickToolbarProps) {
  return (
    <div className="flex items-center justify-between bg-white px-4 py-2 border-b border-slate-200">
      {/* Left controls */}
      <div className="flex items-center gap-3">
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

      {/* Center: Stream Protocol Toggle Badge (WebRTC vs MP4) */}
      {onToggleStreamProtocol && (
        <button
          onClick={onToggleStreamProtocol}
          className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all active:scale-95"
          title="Click to toggle WebRTC vs MP4 Stream"
        >
          <Zap className="h-3 w-3 text-amber-500 fill-current" />
          <span>{streamProtocol === "mp4" ? "MP4 Stream" : "WebRTC"}</span>
        </button>
      )}

      {/* Right controls */}
      <div className="flex items-center gap-3">
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
