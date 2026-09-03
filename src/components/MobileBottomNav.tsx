"use client";

import React from "react";
import {
  Cctv,
  LayoutGrid,
  Bell,
  Settings,
} from "lucide-react";

interface MobileBottomNavProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onOpenSettings: () => void;
}

export function MobileBottomNav({
  activeTab,
  onSelectTab,
  onOpenSettings,
}: MobileBottomNavProps) {
  return (
    <nav className="sticky bottom-0 z-40 flex items-center justify-around bg-white border-t border-slate-200 py-1.5 px-2 shadow-lg">
      {/* 1. Monitoring (Active with Lime Green) */}
      <button
        onClick={() => onSelectTab("monitoring")}
        className={`flex flex-col items-center gap-0.5 py-1 px-3 transition-colors ${
          activeTab === "monitoring"
            ? "text-[#84cc16]"
            : "text-slate-400 hover:text-slate-600"
        }`}
      >
        <Cctv className="h-5 w-5" />
        <span className="text-[10px] font-semibold">Live</span>
      </button>

      {/* 2. Grid */}
      <button
        onClick={() => onSelectTab("grid")}
        className={`flex flex-col items-center gap-0.5 py-1 px-3 transition-colors ${
          activeTab === "grid"
            ? "text-[#84cc16]"
            : "text-slate-400 hover:text-slate-600"
        }`}
      >
        <LayoutGrid className="h-5 w-5" />
        <span className="text-[10px] font-semibold">Cameras</span>
      </button>

      {/* 3. Alerts */}
      <button
        onClick={() => onSelectTab("alerts")}
        className={`flex flex-col items-center gap-0.5 py-1 px-3 transition-colors ${
          activeTab === "alerts"
            ? "text-[#84cc16]"
            : "text-slate-400 hover:text-slate-600"
        }`}
      >
        <Bell className="h-5 w-5" />
        <span className="text-[10px] font-semibold">Alerts</span>
      </button>

      {/* 4. Settings */}
      <button
        onClick={onOpenSettings}
        className="flex flex-col items-center gap-0.5 py-1 px-3 text-slate-400 hover:text-slate-600 transition-colors"
      >
        <Settings className="h-5 w-5" />
        <span className="text-[10px] font-semibold">Settings</span>
      </button>
    </nav>
  );
}
