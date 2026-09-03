"use client";

import React, { useState } from "react";
import { ChevronDown, Maximize2, RefreshCw, Radio, Check } from "lucide-react";

interface MobileTopBarProps {
  selectedView: string;
  onSelectView: (view: string) => void;
  onRefreshAll: () => void;
  onToggleFullscreen: () => void;
  isAllFullscreen: boolean;
}

export function MobileTopBar({
  selectedView,
  onSelectView,
  onRefreshAll,
  onToggleFullscreen,
  isAllFullscreen,
}: MobileTopBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const views = [
    { id: "all", label: "Quad View (4 Cameras)" },
    { id: "cam-1", label: "Camera 01 (Channel 1)" },
    { id: "cam-2", label: "Camera 02 (Channel 2)" },
    { id: "cam-3", label: "Camera 03 (Channel 3)" },
    { id: "cam-4", label: "Camera 04 (Channel 4)" },
  ];

  const currentLabel =
    views.find((v) => v.id === selectedView)?.label.split(" (")[0] || "Live";

  return (
    <div className="sticky top-0 z-40 flex items-center justify-between bg-white px-4 py-2.5 border-b border-slate-100">
      {/* Dropdown Selector */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-1 text-base font-bold text-slate-900 active:opacity-70"
        >
          <span className="flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 text-lime-500 animate-pulse" />
            {currentLabel}
          </span>
          <ChevronDown className="h-4 w-4 text-slate-500 transition-transform duration-200" />
        </button>

        {dropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setDropdownOpen(false)}
            />
            <div className="absolute left-0 top-full mt-1.5 z-40 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-fadeIn">
              {views.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    onSelectView(v.id);
                    setDropdownOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-left transition-colors ${
                    selectedView === v.id
                      ? "bg-lime-50 text-lime-700 font-semibold"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>{v.label}</span>
                  {selectedView === v.id && (
                    <Check className="h-3.5 w-3.5 text-lime-600" />
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Right Icons: Refresh & Fullscreen */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRefreshAll}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
          title="Refresh Feeds"
        >
          <RefreshCw className="h-4 w-4" />
        </button>

        <button
          onClick={onToggleFullscreen}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
          title="Fullscreen Mode"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
