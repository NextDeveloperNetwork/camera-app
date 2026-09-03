"use client";

import React, { useState, useEffect } from "react";

const STORAGE_KEY = "cameraview_configs";
const STORAGE_VERSION = "v3"; // bump this when DEFAULT_CAMERAS changes
import { Header } from "@/components/Header";
import { CameraGrid } from "@/components/CameraGrid";
import { CameraSettingsModal } from "@/components/CameraSettingsModal";
import { CameraConfig, DEFAULT_CAMERAS, GridLayout } from "@/lib/types";
import { Server, Globe, Cpu } from "lucide-react";

export default function Home() {
  const [cameras, setCameras] = useState<CameraConfig[]>(DEFAULT_CAMERAS);
  const [layout, setLayout] = useState<GridLayout>("auto");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Load user saved camera configurations from localStorage if any
  useEffect(() => {
    setIsMounted(true);
    // If storage version doesn't match, clear stale data
    const storedVersion = localStorage.getItem(STORAGE_KEY + "_version");
    if (storedVersion !== STORAGE_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY + "_version", STORAGE_VERSION);
      return; // use DEFAULT_CAMERAS
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCameras(parsed);
        }
      } catch (err) {
        console.error("Failed to parse saved cameras:", err);
      }
    }
  }, []);

  const handleSaveCameras = (updated: CameraConfig[]) => {
    setCameras(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    localStorage.setItem(STORAGE_KEY + "_version", STORAGE_VERSION);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleRefreshAll = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  if (!isMounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-cyan-400 font-mono text-sm">
        INITIALIZING SURVEILLANCE HUD...
      </div>
    );
  }

  const activeCount = cameras.filter((c) => c.enabled).length;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* HUD Header */}
      <Header
        layout={layout}
        onLayoutChange={setLayout}
        onRefreshAll={handleRefreshAll}
        onOpenSettings={() => setIsSettingsOpen(true)}
        cameraCount={activeCount}
      />

      {/* Main Grid Content */}
      <main className="flex flex-1 flex-col">
        <CameraGrid
          cameras={cameras}
          layout={layout}
          refreshTrigger={refreshTrigger}
        />
      </main>

      {/* Telemetry Footer Status Bar */}
      <footer className="border-t border-slate-900 bg-slate-950/90 px-4 py-2 text-xs font-mono backdrop-blur-sm">
        <div className="mx-auto flex flex-wrap items-center justify-between gap-3 text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Server className="h-3.5 w-3.5 text-cyan-400" />
              <span>Proxmox Host &bull; 192.168.1.10:554</span>
            </span>
            <span className="hidden items-center gap-1.5 text-slate-300 sm:flex">
              <Globe className="h-3.5 w-3.5 text-emerald-400" />
              <span>Cloudflare Tunnel Compatible</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              <Cpu className="h-3 w-3 text-cyan-500" />
              <span>Zero-Copy Passthrough (H.264)</span>
            </span>
            <span className="text-[10px] text-slate-600">v1.0.0</span>
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      <CameraSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        cameras={cameras}
        onSaveCameras={handleSaveCameras}
      />
    </div>
  );
}
