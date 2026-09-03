"use client";

import React, { useState, useEffect } from "react";
import { CameraConfig, DEFAULT_CAMERAS, GridLayout } from "@/lib/types";
import { MobileTopBar } from "@/components/MobileTopBar";
import { MobileVideoGrid } from "@/components/MobileVideoGrid";
import { MobileQuickToolbar } from "@/components/MobileQuickToolbar";
import { MobileCameraList } from "@/components/MobileCameraList";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { FullscreenCameraModal } from "@/components/FullscreenCameraModal";
import { CameraSettingsModal } from "@/components/CameraSettingsModal";
import { DesktopLayout } from "@/components/DesktopLayout";
import { MobileLandscapeView } from "@/components/MobileLandscapeView";

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
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState("monitoring");
  const [isMounted, setIsMounted] = useState(false);

  // Phone tilt / landscape orientation detection
  const [isDeviceLandscape, setIsDeviceLandscape] = useState(false);
  const [manualLandscape, setManualLandscape] = useState(false);
  // Default mobile to MP4 for 100% instant Cloudflare Tunnel compatibility
  const [mobileStreamProtocol, setMobileStreamProtocol] = useState<"webrtc" | "mp4">("mp4");

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

  // Listen for device rotation / tilt
  useEffect(() => {
    const handleOrientation = () => {
      const isWide = window.innerWidth > window.innerHeight;
      // Active on mobile / tablet screens when tilted sideways
      const isMobileDevice = window.innerWidth < 1024 || window.innerHeight < 600;
      setIsDeviceLandscape(isWide && isMobileDevice);
    };

    handleOrientation();
    window.addEventListener("resize", handleOrientation);
    window.addEventListener("orientationchange", handleOrientation);
    return () => {
      window.removeEventListener("resize", handleOrientation);
      window.removeEventListener("orientationchange", handleOrientation);
    };
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

  const inLandscapeMode = isDeviceLandscape || manualLandscape;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900">
      {/* ────────────────────────────────────────────────────────────── */}
      {/* 0. IMMERSIVE TILT LANDSCAPE VIEW                               */}
      {/* ────────────────────────────────────────────────────────────── */}
      {inLandscapeMode && (
        <MobileLandscapeView
          cameras={cameras}
          selectedCameraId={selectedCameraId}
          onSelectCamera={setSelectedCameraId}
          onClose={() => setManualLandscape(false)}
          refreshTrigger={refreshTrigger}
        />
      )}

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
          selectedCameraId={selectedCameraId}
          onSelectCamera={setSelectedCameraId}
        />
      </div>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* 2. MOBILE PORTRAIT VIEW (Visible on screens < 1024px)          */}
      {/* ────────────────────────────────────────────────────────────── */}
      <div className="flex lg:hidden flex-1 justify-center w-full">
        <div className="w-full max-w-md bg-white min-h-screen flex flex-col shadow-xl relative border-x border-slate-200">
          {/* Top Bar: Live ▾ and Fullscreen & Landscape button */}
          <MobileTopBar
            selectedView={
              layoutMode === "2x2" ? "all" : selectedCameraId || "all"
            }
            onSelectView={handleSelectView}
            onRefreshAll={handleRefreshAll}
            onToggleFullscreen={() =>
              setFullscreenCameraId(selectedCameraId || cameras[0]?.id)
            }
            onEnterLandscape={() => setManualLandscape(true)}
            isAllFullscreen={fullscreenCameraId !== null}
          />

          {/* Compact 2x2 Video Grid */}
          <MobileVideoGrid
            cameras={cameras}
            selectedCameraId={selectedCameraId}
            layoutMode={layoutMode}
            isPaused={isPaused}
            isMuted={isMuted}
            streamProtocol={mobileStreamProtocol}
            onSelectCamera={(id) => {
              setSelectedCameraId(id);
            }}
            onDoubleTapCamera={(id) => {
              setSelectedCameraId(id);
              setFullscreenCameraId(id);
            }}
            refreshTrigger={refreshTrigger}
          />

          {/* Quick Action Toolbar */}
          <MobileQuickToolbar
            isPaused={isPaused}
            isMuted={isMuted}
            layoutMode={layoutMode}
            streamProtocol={mobileStreamProtocol}
            onToggleStreamProtocol={() =>
              setMobileStreamProtocol((p) => (p === "mp4" ? "webrtc" : "mp4"))
            }
            onTogglePause={() => setIsPaused((prev) => !prev)}
            onToggleMute={() => setIsMuted((prev) => !prev)}
            onToggleLayout={() =>
              setLayoutMode((prev) => (prev === "2x2" ? "1x1" : "2x2"))
            }
            onExpand={() =>
              setFullscreenCameraId(selectedCameraId || cameras[0]?.id)
            }
            onSnapshot={handleSnapshotActive}
            activeCameraName={activeCam?.name || "Camera"}
          />

          {/* Collapsible Sites / DVR Camera Tree List */}
          <div className="flex-1 overflow-y-auto pb-16">
            <MobileCameraList
              cameras={cameras}
              selectedCameraId={selectedCameraId}
              onSelectCamera={(id) => {
                setSelectedCameraId(id);
              }}
              onDoubleTapCamera={(id) => {
                setSelectedCameraId(id);
                setFullscreenCameraId(id);
              }}
            />
          </div>

          {/* Fixed Bottom Navigation */}
          <MobileBottomNav
            activeTab={activeBottomTab}
            onSelectTab={setActiveBottomTab}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* 3. FULLSCREEN EXPANDED CAMERA MODAL                            */}
      {/* ────────────────────────────────────────────────────────────── */}
      {fullscreenCameraId && !inLandscapeMode && (
        <FullscreenCameraModal
          camera={activeCam}
          allCameras={cameras}
          onClose={() => setFullscreenCameraId(null)}
          onSelectCamera={(id) => {
            setFullscreenCameraId(id);
            setSelectedCameraId(id);
          }}
          refreshTrigger={refreshTrigger}
        />
      )}

      {/* ────────────────────────────────────────────────────────────── */}
      {/* 4. CAMERA SETTINGS MODAL                                       */}
      {/* ────────────────────────────────────────────────────────────── */}
      <CameraSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        cameras={cameras}
        onSaveCameras={handleSaveCameras}
      />
    </div>
  );
}
