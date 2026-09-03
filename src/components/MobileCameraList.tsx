"use client";

import React, { useState } from "react";
import { CameraConfig } from "@/lib/types";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Check,
  Server,
  Folder,
  Cctv,
} from "lucide-react";

interface MobileCameraListProps {
  cameras: CameraConfig[];
  selectedCameraId: string | null;
  onSelectCamera: (id: string) => void;
  onDoubleTapCamera: (id: string) => void;
}

export function MobileCameraList({
  cameras,
  selectedCameraId,
  onSelectCamera,
  onDoubleTapCamera,
}: MobileCameraListProps) {
  const [activeTab, setActiveTab] = useState<"sites" | "displays">("sites");
  const [group1Open, setGroup1Open] = useState(true);
  const [group2Open, setGroup2Open] = useState(true);

  return (
    <div className="flex-1 bg-white overflow-y-auto">
      {/* Tabs: Sites | Displays */}
      <div className="flex border-b border-slate-200 px-4">
        <button
          onClick={() => setActiveTab("sites")}
          className={`pb-2.5 pt-3 text-sm font-bold transition-colors relative ${
            activeTab === "sites"
              ? "text-slate-950"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          Sites
          {activeTab === "sites" && (
            <span className="absolute bottom-0 inset-x-0 h-0.5 bg-slate-950 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("displays")}
          className={`ml-6 pb-2.5 pt-3 text-sm font-medium transition-colors relative ${
            activeTab === "displays"
              ? "text-slate-950 font-bold"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          Displays
          {activeTab === "displays" && (
            <span className="absolute bottom-0 inset-x-0 h-0.5 bg-slate-950 rounded-full" />
          )}
        </button>
      </div>

      {/* Accordion List matching the screenshot */}
      <div className="p-4 space-y-4">
        {/* Parent Group: Local Network DVR */}
        <div>
          <button
            onClick={() => setGroup1Open(!group1Open)}
            className="flex w-full items-center justify-between text-left py-1 text-slate-900"
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              <Server className="h-4 w-4 text-slate-700" />
              <span>DVR Host &bull; 192.168.1.10</span>
            </div>
            {group1Open ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {group1Open && (
            <div className="mt-2 pl-2">
              {/* Sub-group: Security Cameras */}
              <button
                onClick={() => setGroup2Open(!group2Open)}
                className="flex w-full items-center justify-between text-left py-1.5 text-slate-800"
              >
                <div className="flex items-center gap-2 font-semibold text-xs text-slate-700">
                  <Folder className="h-3.5 w-3.5 text-slate-500" />
                  <span>All Channels ({cameras.length})</span>
                </div>
                {group2Open ? (
                  <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                )}
              </button>

              {/* Horizontal / Grid Camera Card Carousel matching screenshot */}
              {group2Open && (
                <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {cameras.map((cam) => {
                    const isSelected = selectedCameraId === cam.id;
                    return (
                      <div
                        key={cam.id}
                        onClick={() => onSelectCamera(cam.id)}
                        onDoubleClick={() => onDoubleTapCamera(cam.id)}
                        className={`group relative flex flex-col rounded-xl border bg-slate-50 p-1.5 cursor-pointer transition-all ${
                          isSelected
                            ? "border-lime-500 ring-2 ring-lime-500/20 shadow-xs"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {/* Thumbnail Viewport */}
                        <div className="relative aspect-video w-full rounded-lg bg-slate-900 overflow-hidden flex flex-col items-center justify-center p-2 text-center">
                          <Cctv className="h-6 w-6 text-slate-500 mb-1 group-hover:text-lime-400 transition-colors" />
                          <span className="text-[10px] font-mono text-slate-300 font-bold">
                            CH:0{cam.streamName.slice(-1)}
                          </span>

                          {/* Green checkmark badge in top-right matching screenshot */}
                          <div className="absolute top-1 right-1">
                            <div className="flex h-4 w-4 items-center justify-center rounded-xs bg-[#84cc16] text-white shadow-xs">
                              <Check className="h-2.5 w-2.5 stroke-[3]" />
                            </div>
                          </div>
                        </div>

                        {/* Camera Title underneath matching screenshot */}
                        <div className="mt-1.5 px-1 pb-0.5 text-center">
                          <p className="text-[11px] font-bold text-slate-900 truncate">
                            {cam.name}
                          </p>
                          <p className="text-[9px] font-mono text-slate-400">
                            CH:0{cam.streamName.slice(-1)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Second Group: Proxmox & Network Telemetry */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-left py-1 text-slate-900">
            <div className="flex items-center gap-2 font-bold text-sm">
              <Building2 className="h-4 w-4 text-slate-700" />
              <span>Proxmox Streaming Bridge</span>
            </div>
            <span className="rounded-full bg-lime-50 px-2 py-0.5 text-[10px] font-semibold text-lime-700 border border-lime-200">
              Online
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 pl-6">
            Zero-copy H.264 passthrough &bull; WebRTC Direct
          </p>
        </div>
      </div>
    </div>
  );
}
