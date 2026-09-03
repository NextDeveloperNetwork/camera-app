"use client";

import React, { useState, useEffect } from "react";
import { CameraConfig, DEFAULT_CAMERAS, GridLayout, AppMode } from "@/lib/types";
import { MobileTopBar } from "@/components/MobileTopBar";
import { MobileVideoGrid } from "@/components/MobileVideoGrid";
import { MobileQuickToolbar } from "@/components/MobileQuickToolbar";
import { MobileCameraList } from "@/components/MobileCameraList";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { FullscreenCameraModal } from "@/components/FullscreenCameraModal";
import { CameraSettingsModal } from "@/components/CameraSettingsModal";
import { DesktopLayout } from "@/components/DesktopLayout";
import { PlaybackTimeline } from "@/components/PlaybackTimeline";

const STORAGE_KEY = "cameraview_configs";
const STORAGE_VERSION = "v6";

export default function Home() {
  const [cameras, setCameras] = useState<CameraConfig[]>(DEFAULT_CAMERAS);
  const [selectedCameraId, setSelectedCameraId] = useState<string>(
    DEFAULT_CAMERAS[0]?.id || "cam-1"
  );
  const [fullscreenCameraId, setFullscreenCameraId] = useState<string | null>(
    null
  );
  const [layoutMode, setLayoutMode] = useState<"2x2" | "1x1">("2x2");
  const [desktopLayout, setDesktopLayout] = useState<GridLayout>("2x2");
  const [appMode, setAppMode] = useState<AppMode>("live");
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState("monitoring");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const storedVersion = localStorage.getItem(STORAGE_KEY + "_version");
    if (storedVersion !== STORAGE_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY + "_version", STORAGE_VERSION);
      setCameras(DEFAULT_CAMERAS);
      return;
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

  // Snapshot active camera
  const handleSnapshotActive = () => {
    const active =
      cameras.find((c) => c.id === selectedCameraId) || cameras[0];
    if (!active) return;

    const link = document.createElement("a");
    link.href = `/api/stream/frame.jpeg?src=${encodeURIComponent(
      active.streamName
    )}&download=1`;
    link.download = `Snapshot_${active.name}_${Date.now()}.jpg`;
    link.click();
  };

  // Handle dropdown selection from mobile top bar
  const handleSelectView = (view: string) => {
    if (view === "all") {
      setLayoutMode("2x2");
      setSelectedCameraId(cameras[0]?.id || "cam-1");
    } else {
      setLayoutMode("1x1");
      setSelectedCameraId(view);
    }
  };

  if (!isMounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-slate-900 font-sans text-sm">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#84cc16]" />
          <span className="font-semibold text-slate-800">Loading Surveillance…</span>
        </div>
      </div>
    );
  }

  const activeCam =
    cameras.find((c) => c.id === (fullscreenCameraId || selectedCameraId)) ||
    cameras[0];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900">
      {/* ────────────────────────────────────────────────────────────── */}
      {/* 1. DESKTOP VIEW (Visible on screens >= 1024px)                  */}
      {/* ────────────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 h-screen w-full">
        <DesktopLayout
          cameras={cameras}
          layout={desktopLayout}
          onLayoutChange={setDesktopLayout}
          refreshTrigger={refreshTrigger}
          onRefreshAll={handleRefreshAll}
          onOpenSettings={() => setIsSettingsOpen(true)}
          appMode={appMode}
          onSelectAppMode={setAppMode}
          selectedCameraId={selectedCameraId}
          onSelectCamera={setSelectedCameraId}
        />
      </div>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* 2. MOBILE VIEW (Visible on screens < 1024px)                   */}
      {/* ────────────────────────────────────────────────────────────── */}
      <div className="flex lg:hidden flex-1 justify-center w-full">
        <div className="w-full max-w-md bg-white min-h-screen flex flex-col shadow-xl relative border-x border-slate-200">
          {/* Top Bar: Live ▾ and Fullscreen */}
          <MobileTopBar
            selectedView={
              layoutMode === "2x2" ? "all" : selectedCameraId || "all"
            }
            onSelectView={handleSelectView}
            onRefreshAll={handleRefreshAll}
            onToggleFullscreen={() =>
              setFullscreenCameraId(selectedCameraId || cameras[0]?.id)
            }
            isAllFullscreen={fullscreenCameraId !== null}
          />

          {/* Conditional: Live Grid OR History Playback on mobile */}
          {activeBottomTab === "archive" || activeBottomTab === "search" ? (
            <PlaybackTimeline
              cameras={cameras}
              selectedCameraId={selectedCameraId}
              onSelectCamera={setSelectedCameraId}
            />
          ) : (
            <>
              {/* Compact 2x2 Video Grid */}
              <MobileVideoGrid
                cameras={cameras}
                selectedCameraId={selectedCameraId}
                onSelectCamera={(id) => setSelectedCameraId(id)}
                onDoubleTapCamera={(id) => setFullscreenCameraId(id)}
                refreshTrigger={refreshTrigger}
                isPaused={isPaused}
                isMuted={isMuted}
                layoutMode={layoutMode}
              />

              {/* Quick Action Toolbar directly beneath video grid */}
              <MobileQuickToolbar
                isPaused={isPaused}
                onTogglePause={() => setIsPaused(!isPaused)}
                onSnapshot={handleSnapshotActive}
                onExpand={() =>
                  setFullscreenCameraId(selectedCameraId || cameras[0]?.id)
                }
                layoutMode={layoutMode}
                onToggleLayout={() =>
                  setLayoutMode((prev) => (prev === "2x2" ? "1x1" : "2x2"))
                }
                isMuted={isMuted}
                onToggleMute={() => setIsMuted(!isMuted)}
                activeCameraName={activeCam?.name || "Camera"}
              />

              {/* Middle Section: Sites / Displays Tabs + Camera Accordion List */}
              <MobileCameraList
                cameras={cameras}
                selectedCameraId={selectedCameraId}
                onSelectCamera={(id) => setSelectedCameraId(id)}
                onDoubleTapCamera={(id) => setFullscreenCameraId(id)}
              />
            </>
          )}

          {/* Fixed Bottom Navigation Bar */}
          <MobileBottomNav
            activeTab={activeBottomTab}
            onSelectTab={(tab) => {
              setActiveBottomTab(tab);
              if (tab === "settings") setIsSettingsOpen(true);
            }}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        </div>
      </div>

      {/* Fullscreen Expanded Camera Modal */}
      {fullscreenCameraId && (
        <FullscreenCameraModal
          camera={activeCam}
          allCameras={cameras}
          onClose={() => setFullscreenCameraId(null)}
          onSelectCamera={(id) => setFullscreenCameraId(id)}
          refreshTrigger={refreshTrigger}
        />
      )}

      {/* Camera Settings Modal */}
      <CameraSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        cameras={cameras}
        onSaveCameras={handleSaveCameras}
      />
    </div>
  );
}
