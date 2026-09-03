"use client";

import React, { useState, useEffect } from "react";
import {
  Cctv,
  LayoutGrid,
  Square,
  Columns2,
  Settings,
  RefreshCw,
  Radio,
} from "lucide-react";
import { GridLayout } from "@/lib/types";

interface HeaderProps {
  layout: GridLayout;
  onLayoutChange: (layout: GridLayout) => void;
  onRefreshAll: () => void;
  onOpenSettings: () => void;
  cameraCount: number;
}

export function Header({
  layout,
  onLayoutChange,
  onRefreshAll,
  onOpenSettings,
  cameraCount,
}: HeaderProps) {
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-3 py-2.5 sm:px-5 sm:py-3 shadow-xs backdrop-blur-md">
      {/* Brand & Live Status */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
          <Cctv className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
              CameraView
            </h1>
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {cameraCount} Live
            </span>
          </div>
          <p className="text-[11px] text-slate-500 hidden sm:block">
            RTSP Surveillance &bull; WebRTC Direct
          </p>
        </div>
      </div>

      {/* Clock - Desktop & Tablet */}
      <div className="hidden md:flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-700 bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200">
        <Radio className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
        <span>{timeStr || "--:--:--"}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {/* Layout Switcher (hidden on very small phones where 1-column is natural) */}
        <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/80 p-0.5">
          <button
            onClick={() => onLayoutChange("1x1")}
            title="Single Column View"
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
              layout === "1x1"
                ? "bg-white text-slate-900 shadow-xs font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Square className="h-4 w-4" />
          </button>
          <button
            onClick={() => onLayoutChange("1x2")}
            title="Two Column View"
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
              layout === "1x2"
                ? "bg-white text-slate-900 shadow-xs font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Columns2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onLayoutChange("auto")}
            title="Grid View (2x2)"
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
              layout === "auto" || layout === "2x2"
                ? "bg-white text-slate-900 shadow-xs font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefreshAll}
          title="Refresh All Feeds"
          className="flex h-8.5 w-8.5 sm:w-auto sm:px-3 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Refresh</span>
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          title="Camera Settings"
          className="flex h-8.5 w-8.5 sm:w-auto sm:px-3 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs"
        >
          <Settings className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Settings</span>
        </button>
      </div>
    </header>
  );
}
