"use client";

import React, { useState, useEffect } from "react";
import { CameraConfig, GridLayout, AppMode } from "@/lib/types";
import { CameraPlayer } from "./CameraPlayer";
import { PlaybackTimeline } from "./PlaybackTimeline";
import {
  Cctv,
  LayoutGrid,
  Square,
  Columns2,
  Settings,
  RefreshCw,
  Radio,
  Clock,
  Film,
  Maximize2,
  Server,
  ShieldCheck,
  ChevronRight,
  Eye,
} from "lucide-react";

interface DesktopLayoutProps {
  cameras: CameraConfig[];
  layout: GridLayout;
  onLayoutChange: (layout: GridLayout) => void;
  refreshTrigger: number;
  onRefreshAll: () => void;
  onOpenSettings: () => void;
  appMode: AppMode;
  onSelectAppMode: (mode: AppMode) => void;
  selectedCameraId: string;
  onSelectCamera: (id: string) => void;
}

export function DesktopLayout({
  cameras,
  layout,
  onLayoutChange,
  refreshTrigger,
  onRefreshAll,
  onOpenSettings,
  appMode,
  onSelectAppMode,
  selectedCameraId,
  onSelectCamera,
}: DesktopLayoutProps) {
  const [timeStr, setTimeStr] = useState("");
  const [fullscreenCameraId, setFullscreenCameraId] = useState<string | null>(
    null
  );

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

  const activeCameras = cameras.filter((c) => c.enabled);

  // Fullscreen expanded view
  if (fullscreenCameraId) {
    const activeCam = activeCameras.find((c) => c.id === fullscreenCameraId);
    if (activeCam) {
      return (
        <div className="fixed inset-0 z-50 flex bg-slate-950">
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

  // Grid styling based on user selected layout
  const getGridClasses = () => {
    switch (layout) {
      case "1x1":
        return "grid-cols-1 max-w-5xl mx-auto";
      case "1x2":
        return "grid-cols-2";
      case "2x2":
      case "auto":
      default:
        return "grid-cols-2";
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100 text-slate-900 overflow-hidden">
      {/* ── Top Navigation Bar (Desktop) ── */}
      <header className="flex items-center justify-between bg-white px-5 py-2.5 border-b border-slate-200 shadow-xs z-30">
        {/* Brand & Mode Switcher (Live vs Playback) */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
              <Cctv className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900 leading-none">
                CameraView
              </h1>
              <span className="text-[11px] font-semibold text-slate-500">
                Command VMS
              </span>
            </div>
          </div>

          {/* Mode Tabs: Live Feeds | Playback / History */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1">
            <button
              onClick={() => onSelectAppMode("live")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                appMode === "live"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Radio
                className={`h-3.5 w-3.5 ${
                  appMode === "live"
                    ? "text-emerald-500 animate-pulse"
                    : "text-slate-400"
                }`}
              />
              <span>Live Feeds</span>
            </button>

            <button
              onClick={() => onSelectAppMode("playback")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                appMode === "playback"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Film className="h-3.5 w-3.5 text-amber-500" />
              <span>History / Playback</span>
            </button>
          </div>
        </div>

        {/* Center Clock */}
        <div className="flex items-center gap-2 font-mono text-xs font-semibold text-slate-700 bg-slate-50 px-3.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          <span>{timeStr || "--:--:--"}</span>
          <span className="text-slate-300">&bull;</span>
          <span className="text-emerald-600 font-bold">4 Channels Online</span>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-2">
          {/* Grid Layout Toggles (only in Live mode) */}
          {appMode === "live" && (
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5">
              <button
                onClick={() => onLayoutChange("1x1")}
                title="Single Camera View"
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
                title="Two Camera View"
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                  layout === "1x2"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Columns2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => onLayoutChange("2x2")}
                title="2x2 Quad Grid"
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                  layout === "2x2" || layout === "auto"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Refresh All */}
          <button
            onClick={onRefreshAll}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs"
            title="Refresh All Streams"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs"
            title="Settings"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* ── Main Desktop Body (Sidebar + Content Stage) ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Camera Tree & Device Health */}
        <aside className="w-64 flex flex-col bg-white border-r border-slate-200 shadow-xs p-3 space-y-4 select-none">
          {/* DVR Device Status */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-slate-700" />
                <span className="text-xs font-bold text-slate-900">
                  Local DVR
                </span>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                Online
              </span>
            </div>
            <p className="mt-1 font-mono text-[10px] text-slate-500">
              192.168.1.10:554
            </p>
          </div>

          {/* Channels Tree List */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            <h3 className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Channels ({activeCameras.length})
            </h3>

            {activeCameras.map((cam) => {
              const isSelected = selectedCameraId === cam.id;
              return (
                <div
                  key={cam.id}
                  onClick={() => onSelectCamera(cam.id)}
                  className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? "bg-slate-900 text-white shadow-xs"
                      : "hover:bg-slate-100 text-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isSelected ? "bg-emerald-400" : "bg-emerald-500"
                      }`}
                    />
                    <div className="truncate">
                      <p className="text-xs font-bold truncate">{cam.name}</p>
                      <p
                        className={`text-[10px] font-mono truncate ${
                          isSelected ? "text-slate-300" : "text-slate-400"
                        }`}
                      >
                        {cam.location || `CH:${cam.streamName.slice(-1)}`}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFullscreenCameraId(cam.id);
                    }}
                    className={`p-1 rounded-lg transition-colors ${
                      isSelected
                        ? "text-slate-300 hover:text-white"
                        : "text-slate-400 hover:text-slate-700"
                    }`}
                    title="Expand View"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Quick Help Footer */}
          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            <div className="flex items-center gap-1 text-slate-700 font-semibold mb-0.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>WebRTC Direct</span>
            </div>
            <p className="text-[10px]">Tap any camera to expand full-screen.</p>
          </div>
        </aside>

        {/* Main Viewport: Live 2x2 Grid OR Playback Timeline */}
        <main className="flex-1 flex flex-col bg-slate-100 overflow-y-auto">
          {appMode === "live" ? (
            <div
              className={`grid w-full flex-1 gap-3 p-4 transition-all ${getGridClasses()}`}
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
          ) : (
            <PlaybackTimeline
              cameras={activeCameras}
              selectedCameraId={selectedCameraId}
              onSelectCamera={onSelectCamera}
            />
          )}
        </main>
      </div>
    </div>
  );
}
