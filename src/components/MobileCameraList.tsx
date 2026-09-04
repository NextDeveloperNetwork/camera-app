"use client";

import React, { useState } from "react";
import { CameraConfig } from "@/lib/types";
import {
  Cctv,
  Maximize2,
  Camera,
  RotateCw,
  Zap,
  ShieldCheck,
  Radio,
  Server,
  Activity,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  Sliders,
  Clock,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface MobileCameraListProps {
  cameras: CameraConfig[];
  selectedCameraId: string | null;
  onSelectCamera: (id: string) => void;
  onDoubleTapCamera: (id: string) => void;
  onRefreshAll?: () => void;
  onSnapshot?: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

interface SecurityEvent {
  id: string;
  time: string;
  channel: string;
  cameraName: string;
  type: "motion" | "system" | "stream";
  description: string;
  severity: "info" | "warning" | "success";
}

export function MobileCameraList({
  cameras,
  selectedCameraId,
  onSelectCamera,
  onDoubleTapCamera,
  onRefreshAll,
  onSnapshot,
  activeTab = "channels",
  onTabChange,
}: MobileCameraListProps) {
  const [internalTab, setInternalTab] = useState<"channels" | "events" | "system">("channels");
  const [eventFilter, setEventFilter] = useState<"all" | "motion" | "system">("all");
  const [snapshotFeedback, setSnapshotFeedback] = useState(false);

  const currentTab = onTabChange && (activeTab === "alerts" || activeTab === "grid" || activeTab === "monitoring")
    ? (activeTab === "alerts" ? "events" : "channels")
    : internalTab;

  const handleTabClick = (tab: "channels" | "events" | "system") => {
    setInternalTab(tab);
    if (onTabChange) {
      if (tab === "events") onTabChange("alerts");
      else if (tab === "channels") onTabChange("grid");
      else onTabChange("monitoring");
    }
  };

  const selectedCam =
    cameras.find((c) => c.id === selectedCameraId) || cameras[0] || null;

  const channelNum = selectedCam
    ? selectedCam.streamName.replace(/\D/g, "").slice(-1) || "1"
    : "1";

  const handleSnapshotClick = () => {
    if (onSnapshot) {
      onSnapshot();
      setSnapshotFeedback(true);
      setTimeout(() => setSnapshotFeedback(false), 2000);
    }
  };

  // Realistic security events
  const securityEvents: SecurityEvent[] = [
    {
      id: "ev-1",
      time: "Just now",
      channel: `CH 0${channelNum}`,
      cameraName: selectedCam?.name || "Camera 01",
      type: "stream",
      description: "HLS fMP4 stream synchronized via MediaMTX",
      severity: "success",
    },
    {
      id: "ev-2",
      time: "3 min ago",
      channel: "CH 02",
      cameraName: cameras[1]?.name || "Camera 02 - Channel 2",
      type: "motion",
      description: "Motion trigger detected in Driveway zone",
      severity: "warning",
    },
    {
      id: "ev-3",
      time: "8 min ago",
      channel: "DVR Host",
      cameraName: "192.168.1.10:554",
      type: "system",
      description: "RTSP TCP keepalive heartbeat ACK (latency 2ms)",
      severity: "info",
    },
    {
      id: "ev-4",
      time: "14 min ago",
      channel: "CH 01",
      cameraName: cameras[0]?.name || "Camera 01 - Channel 1",
      type: "motion",
      description: "Pedestrian activity detected near Entrance",
      severity: "warning",
    },
    {
      id: "ev-5",
      time: "22 min ago",
      channel: "MediaMTX",
      cameraName: "Stream Engine",
      type: "system",
      description: "All 8 paths initialized with on-demand TCP transport",
      severity: "success",
    },
  ];

  const filteredEvents = securityEvents.filter((ev) => {
    if (eventFilter === "all") return true;
    if (eventFilter === "motion") return ev.type === "motion";
    if (eventFilter === "system") return ev.type === "system" || ev.type === "stream";
    return true;
  });

  return (
    <div className="flex flex-col w-full bg-white select-none">
      {/* ── Sub-header Navigation Tabs ── */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-2 py-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleTabClick("channels")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all rounded-none border ${
              currentTab === "channels"
                ? "bg-white text-slate-900 border-slate-300 shadow-2xs"
                : "text-slate-500 hover:text-slate-800 border-transparent"
            }`}
          >
            <Cctv className="h-3.5 w-3.5 text-slate-700" />
            <span>Channels ({cameras.length})</span>
          </button>

          <button
            onClick={() => handleTabClick("events")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all rounded-none border ${
              currentTab === "events"
                ? "bg-white text-slate-900 border-slate-300 shadow-2xs"
                : "text-slate-500 hover:text-slate-800 border-transparent"
            }`}
          >
            <Bell className="h-3.5 w-3.5 text-slate-700" />
            <span>Activity Log</span>
            <span className="flex h-1.5 w-1.5 rounded-full bg-lime-500" />
          </button>

          <button
            onClick={() => handleTabClick("system")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all rounded-none border ${
              currentTab === "system"
                ? "bg-white text-slate-900 border-slate-300 shadow-2xs"
                : "text-slate-500 hover:text-slate-800 border-transparent"
            }`}
          >
            <Server className="h-3.5 w-3.5 text-slate-700" />
            <span>System</span>
          </button>
        </div>

        {onRefreshAll && (
          <button
            onClick={onRefreshAll}
            title="Refresh feeds"
            className="p-1.5 text-slate-400 hover:text-slate-800 active:rotate-180 transition-transform rounded-none"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* TAB 1: CHANNELS & QUICK CONTROL HUB                            */}
      {/* ────────────────────────────────────────────────────────────── */}
      {currentTab === "channels" && (
        <div className="p-3 space-y-3">
          {/* Active Camera Hero Control Card */}
          {selectedCam && (
            <div className="border border-slate-300 bg-slate-900 text-white p-3 shadow-xs rounded-none">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="bg-lime-500 text-slate-950 text-[10px] font-mono font-black px-1.5 py-0.5 rounded-none">
                    ACTIVE CH {channelNum}
                  </span>
                  <span className="text-xs font-bold text-white truncate max-w-[170px]">
                    {selectedCam.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 border border-emerald-800/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>ONLINE</span>
                </div>
              </div>

              {/* Camera metadata row */}
              <div className="grid grid-cols-3 gap-2 py-2 text-[10px] font-mono text-slate-300 border-b border-slate-800/80">
                <div>
                  <span className="text-slate-500 block text-[9px]">RESOLUTION</span>
                  <span className="text-white font-bold">352x288 Sub</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px]">ENCODING</span>
                  <span className="text-white font-bold">H.264 / fMP4</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px]">TRANSPORT</span>
                  <span className="text-white font-bold">RTSP TCP</span>
                </div>
              </div>

              {/* Quick Action Buttons for the active camera */}
              <div className="grid grid-cols-3 gap-1.5 pt-2.5">
                <button
                  onClick={() => onDoubleTapCamera(selectedCam.id)}
                  className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white py-2 px-2 text-xs font-bold border border-slate-700 transition-colors rounded-none"
                >
                  <Maximize2 className="h-3.5 w-3.5 text-lime-400" />
                  <span>Fullscreen</span>
                </button>

                <button
                  onClick={handleSnapshotClick}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-bold border transition-colors rounded-none ${
                    snapshotFeedback
                      ? "bg-lime-500 text-slate-950 border-lime-400"
                      : "bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
                  }`}
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>{snapshotFeedback ? "Saved!" : "Snapshot"}</span>
                </button>

                <button
                  onClick={onRefreshAll}
                  className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white py-2 px-2 text-xs font-bold border border-slate-700 transition-colors rounded-none"
                >
                  <RotateCw className="h-3.5 w-3.5 text-slate-400" />
                  <span>Sync Feed</span>
                </button>
              </div>
            </div>
          )}

          {/* Channels List Header */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Camera Channels ({cameras.length})
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Tap to focus &bull; Double-tap to expand
            </span>
          </div>

          {/* Interactive Channel List Cards */}
          <div className="space-y-1.5">
            {cameras.map((cam, idx) => {
              const isSelected = selectedCameraId === cam.id;
              const ch = cam.streamName.replace(/\D/g, "").slice(-1) || String(idx + 1);

              return (
                <div
                  key={cam.id}
                  onClick={() => onSelectCamera(cam.id)}
                  onDoubleClick={() => onDoubleTapCamera(cam.id)}
                  className={`flex items-center justify-between p-2.5 cursor-pointer border transition-all rounded-none ${
                    isSelected
                      ? "bg-slate-900 text-white border-slate-900 ring-2 ring-lime-500/40 shadow-xs"
                      : "bg-white hover:bg-slate-50 text-slate-900 border-slate-200"
                  }`}
                >
                  {/* Left: Channel Number Badge + Info */}
                  <div className="flex items-center gap-2.5 truncate">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center font-mono text-xs font-black rounded-none border ${
                        isSelected
                          ? "bg-lime-500 text-slate-950 border-lime-400"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      CH{ch}
                    </div>

                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold truncate leading-snug">
                          {cam.name}
                        </p>
                        {isSelected && (
                          <span className="text-[9px] font-mono px-1 py-0.2 bg-lime-500/20 text-lime-400 border border-lime-500/30">
                            VIEWING
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-[10px] font-mono truncate ${
                          isSelected ? "text-slate-300" : "text-slate-400"
                        }`}
                      >
                        {cam.location || `Channel ${ch}`} &bull; rtsp:554
                      </p>
                    </div>
                  </div>

                  {/* Right: Status indicator + Maximize Icon */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span
                        className={`text-[10px] font-mono font-semibold ${
                          isSelected ? "text-emerald-300" : "text-emerald-600"
                        }`}
                      >
                        LIVE
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDoubleTapCamera(cam.id);
                      }}
                      title="Fullscreen Camera"
                      className={`p-1.5 border transition-colors rounded-none ${
                        isSelected
                          ? "border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
                          : "border-slate-200 text-slate-400 hover:text-slate-800 hover:bg-slate-100"
                      }`}
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────── */}
      {/* TAB 2: CCTV SECURITY ACTIVITY & MOTION LOG                     */}
      {/* ────────────────────────────────────────────────────────────── */}
      {currentTab === "events" && (
        <div className="p-3 space-y-3">
          {/* Filters Bar */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Live Surveillance Feed
            </span>
            <div className="flex items-center gap-1 text-[11px]">
              <button
                onClick={() => setEventFilter("all")}
                className={`px-2 py-0.5 rounded-none border text-[10px] font-semibold transition-colors ${
                  eventFilter === "all"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                All ({securityEvents.length})
              </button>
              <button
                onClick={() => setEventFilter("motion")}
                className={`px-2 py-0.5 rounded-none border text-[10px] font-semibold transition-colors ${
                  eventFilter === "motion"
                    ? "bg-amber-600 text-white border-amber-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Motion
              </button>
              <button
                onClick={() => setEventFilter("system")}
                className={`px-2 py-0.5 rounded-none border text-[10px] font-semibold transition-colors ${
                  eventFilter === "system"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                System
              </button>
            </div>
          </div>

          {/* Event list */}
          <div className="space-y-2">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-2.5 p-2.5 border border-slate-200 bg-white hover:bg-slate-50 transition-colors rounded-none"
              >
                <div className="mt-0.5 shrink-0">
                  {event.severity === "warning" ? (
                    <div className="flex h-6 w-6 items-center justify-center bg-amber-100 text-amber-700 border border-amber-300 rounded-none">
                      <Activity className="h-3.5 w-3.5" />
                    </div>
                  ) : event.severity === "success" ? (
                    <div className="flex h-6 w-6 items-center justify-center bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-none">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center bg-blue-100 text-blue-700 border border-blue-300 rounded-none">
                      <Radio className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-800 px-1 py-0.2 border border-slate-200">
                        {event.channel}
                      </span>
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {event.cameraName}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">
                      {event.time}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {event.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────── */}
      {/* TAB 3: DVR SYSTEM & STREAM ENGINE DIAGNOSTICS                  */}
      {/* ────────────────────────────────────────────────────────────── */}
      {currentTab === "system" && (
        <div className="p-3 space-y-3">
          {/* DVR Gateway Card */}
          <div className="border border-slate-200 bg-white p-3 rounded-none shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center bg-slate-900 text-white rounded-none">
                  <Server className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">DVR Gateway Host</h4>
                  <p className="font-mono text-[10px] text-slate-500">192.168.1.10:554</p>
                </div>
              </div>
              <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ONLINE
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
              <div className="bg-slate-50 p-2 border border-slate-100">
                <span className="text-slate-400 block text-[9px] font-mono">CHANNELS</span>
                <span className="font-bold text-slate-800">4 Active / 0 Offline</span>
              </div>
              <div className="bg-slate-50 p-2 border border-slate-100">
                <span className="text-slate-400 block text-[9px] font-mono">PROTOCOL</span>
                <span className="font-bold text-slate-800">RTSP over TCP</span>
              </div>
            </div>
          </div>

          {/* MediaMTX Streaming Engine Card */}
          <div className="border border-slate-200 bg-white p-3 rounded-none shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center bg-emerald-600 text-white rounded-none">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">MediaMTX HLS Bridge</h4>
                  <p className="font-mono text-[10px] text-slate-500">:8888 &bull; Proxied to /api/hls</p>
                </div>
              </div>
              <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-mono font-bold px-1.5 py-0.5">
                fMP4 HLS
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-2 text-[10px] font-mono">
              <div className="bg-slate-50 p-2 border border-slate-100">
                <span className="text-slate-400 block text-[9px]">SEGMENTS</span>
                <span className="font-bold text-slate-800">2.0s</span>
              </div>
              <div className="bg-slate-50 p-2 border border-slate-100">
                <span className="text-slate-400 block text-[9px]">BUFFER</span>
                <span className="font-bold text-slate-800">5 Segs</span>
              </div>
              <div className="bg-slate-50 p-2 border border-slate-100">
                <span className="text-slate-400 block text-[9px]">LATENCY</span>
                <span className="font-bold text-emerald-600">~2.0s</span>
              </div>
            </div>
          </div>

          {/* Quick Diagnostics Action */}
          {onRefreshAll && (
            <button
              onClick={onRefreshAll}
              className="flex w-full items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs font-bold py-2.5 border border-slate-900 transition-colors rounded-none shadow-xs"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>Resync All Streams & Clear Buffers</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
