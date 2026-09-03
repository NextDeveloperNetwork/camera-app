"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  LayoutGrid,
  Columns2,
  Maximize2,
  Settings,
  RefreshCw,
  Clock,
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
  const [dateStr, setDateStr] = useState<string>("");

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
      setDateStr(
        now.toLocaleDateString("en-GB", {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b border-cyan-500/20 bg-slate-950/80 px-4 py-3 backdrop-blur-md">
      {/* Branding & Status */}
      <div className="flex items-center gap-3">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
          <ShieldCheck className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-wider text-slate-100 uppercase sm:text-lg">
              Surveillance Command
            </h1>
            <span className="hidden items-center gap-1 rounded bg-emerald-950/60 px-2 py-0.5 text-xs font-mono font-medium text-emerald-400 border border-emerald-500/30 sm:flex">
              <Radio className="h-3 w-3 animate-pulse" />
              ONLINE ({cameraCount})
            </span>
          </div>
          <p className="text-xs text-slate-400">
            RTSP Multi-Stream Bridge &bull; Cloudflare Tunnel Ready
          </p>
        </div>
      </div>

      {/* Clock & System Telemetry */}
      <div className="hidden items-center gap-4 rounded-lg border border-slate-800 bg-slate-900/60 px-3.5 py-1.5 font-mono text-sm lg:flex">
        <Clock className="h-4 w-4 text-cyan-400" />
        <div className="flex flex-col text-right leading-tight">
          <span className="text-cyan-300 font-semibold tracking-widest">{timeStr || "--:--:--"}</span>
          <span className="text-[10px] text-slate-400 uppercase">{dateStr || "Loading..."}</span>
        </div>
      </div>

      {/* Action Controls & Layout Selector */}
      <div className="flex items-center gap-2">
        {/* Layout Selectors */}
        <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/80 p-1">
          <button
            onClick={() => onLayoutChange("1x1")}
            title="Single Camera View"
            className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
              layout === "1x1"
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onLayoutChange("1x2")}
            title="Dual Camera View (Side-by-Side)"
            className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
              layout === "1x2"
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Columns2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onLayoutChange("2x2")}
            title="Quad / Grid View"
            className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
              layout === "2x2" || layout === "auto"
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>

        {/* Refresh All */}
        <button
          onClick={onRefreshAll}
          title="Reconnect / Refresh Streams"
          className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-3 text-xs font-medium text-slate-300 transition-all hover:border-cyan-500/40 hover:text-cyan-300 hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Refresh</span>
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          title="Camera Configuration & RTSP URLs"
          className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-3 text-xs font-medium text-slate-300 transition-all hover:border-cyan-500/40 hover:text-cyan-300 hover:bg-slate-800"
        >
          <Settings className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Settings</span>
        </button>
      </div>
    </header>
  );
}
