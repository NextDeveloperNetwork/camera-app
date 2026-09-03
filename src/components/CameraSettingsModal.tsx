"use client";

import React, { useState } from "react";
import { X, Plus, Trash2, RotateCcw, Save, Shield, Info } from "lucide-react";
import { CameraConfig, DEFAULT_CAMERAS } from "@/lib/types";

interface CameraSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cameras: CameraConfig[];
  onSaveCameras: (updated: CameraConfig[]) => void;
}

export function CameraSettingsModal({
  isOpen,
  onClose,
  cameras,
  onSaveCameras,
}: CameraSettingsModalProps) {
  const [editedCameras, setEditedCameras] = useState<CameraConfig[]>(cameras);
  const [newCameraName, setNewCameraName] = useState("");
  const [newRtspUrl, setNewRtspUrl] = useState("");
  const [newLocation, setNewLocation] = useState("");

  if (!isOpen) return null;

  const handleToggleEnable = (id: string) => {
    setEditedCameras((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const handleUpdateName = (id: string, name: string) => {
    setEditedCameras((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name } : c))
    );
  };

  const handleUpdateRtsp = (id: string, rtspUrl: string) => {
    setEditedCameras((prev) =>
      prev.map((c) => (c.id === id ? { ...c, rtspUrl } : c))
    );
  };

  const handleDelete = (id: string) => {
    setEditedCameras((prev) => prev.filter((c) => c.id !== id));
  };

  const handleAddCamera = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCameraName || !newRtspUrl) return;

    const streamKey = `cam_${Date.now().toString().slice(-4)}`;
    const newCam: CameraConfig = {
      id: `cam-${Date.now()}`,
      name: newCameraName,
      streamName: streamKey,
      rtspUrl: newRtspUrl,
      location: newLocation || undefined,
      enabled: true,
    };

    setEditedCameras((prev) => [...prev, newCam]);
    setNewCameraName("");
    setNewRtspUrl("");
    setNewLocation("");
  };

  const handleResetDefaults = () => {
    if (confirm("Reset to default cameras (Channel 4 and Channel 3)?")) {
      setEditedCameras(DEFAULT_CAMERAS);
    }
  };

  const handleSave = () => {
    onSaveCameras(editedCameras);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-cyan-500/30 bg-slate-950 p-6 shadow-[0_0_50px_rgba(6,182,212,0.15)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-cyan-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                Camera Configuration
              </h2>
              <p className="text-xs text-slate-400">
                Manage RTSP streams and channel mappings
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Proxmox Note */}
          <div className="flex items-start gap-2.5 rounded-lg border border-cyan-500/20 bg-cyan-950/30 p-3 text-xs text-cyan-200/90">
            <Info className="h-4 w-4 shrink-0 text-cyan-400 mt-0.5" />
            <div>
              <span className="font-semibold text-cyan-300">Docker & Proxmox:</span> Streams configured in{" "}
              <code className="rounded bg-black/40 px-1 py-0.5 text-[11px] text-cyan-300">go2rtc.yaml</code>{" "}
              connect directly over your LAN to <code className="text-cyan-300 font-mono">192.168.1.10:554</code>.
            </div>
          </div>

          {/* Active Cameras List */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
              Configured Cameras ({editedCameras.length})
            </h3>
            {editedCameras.map((cam) => (
              <div
                key={cam.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 transition-colors hover:border-slate-700"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={cam.enabled}
                      onChange={() => handleToggleEnable(cam.id)}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
                    />
                    <input
                      type="text"
                      value={cam.name}
                      onChange={(e) => handleUpdateName(cam.id, e.target.value)}
                      className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-semibold text-slate-200 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={() => handleDelete(cam.id)}
                    className="rounded p-1 text-slate-500 hover:text-rose-400"
                    title="Delete camera"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  <input
                    type="text"
                    value={cam.rtspUrl}
                    onChange={(e) => handleUpdateRtsp(cam.id, e.target.value)}
                    className="w-full rounded-md border border-slate-800 bg-black/50 px-2.5 py-1 font-mono text-[11px] text-slate-300 focus:border-cyan-500 focus:outline-none"
                    placeholder="rtsp://192.168.1.10:554/..."
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>go2rtc stream key: <span className="text-cyan-400 font-mono">{cam.streamName}</span></span>
                    <span>Status: {cam.enabled ? "Active" : "Disabled"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add New Camera Form */}
          <form
            onSubmit={handleAddCamera}
            className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-4 space-y-3"
          >
            <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5 text-cyan-400" /> Add Another Camera Channel
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Camera Name (e.g., Garage)"
                value={newCameraName}
                onChange={(e) => setNewCameraName(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Location (optional)"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <input
              type="text"
              placeholder="RTSP Stream URL (rtsp://192.168.1.10:554/...)"
              value={newRtspUrl}
              onChange={(e) => setNewRtspUrl(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newCameraName || !newRtspUrl}
              className="w-full rounded-lg border border-cyan-500/40 bg-cyan-950/40 py-1.5 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-900/50 disabled:opacity-40"
            >
              Add Camera
            </button>
          </form>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:bg-cyan-500"
            >
              <Save className="h-3.5 w-3.5" />
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
