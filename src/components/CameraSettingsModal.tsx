"use client";

import React, { useState } from "react";
import { X, Plus, Trash2, RotateCcw, Save, Cctv, Info } from "lucide-react";
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

    const streamKey = `camera_channel_${Date.now().toString().slice(-4)}`;
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
    if (confirm("Reset to default 4 cameras (Channels 1 to 4)?")) {
      setEditedCameras(DEFAULT_CAMERAS);
    }
  };

  const handleSave = () => {
    onSaveCameras(editedCameras);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 sm:p-4 backdrop-blur-xs animate-fadeIn">
      <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Cctv className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Camera Setup
              </h2>
              <p className="text-xs text-slate-500">
                Configure RTSP channels and stream names
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
          {/* LAN Information Callout */}
          <div className="flex items-start gap-2 rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-xs text-slate-600">
            <Info className="h-4 w-4 shrink-0 text-slate-900 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-900">RTSP DVR:</span> Feeds connect to DVR IP{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-800 border border-slate-200">
                192.168.1.10:554
              </code>{" "}
              over your local network.
            </div>
          </div>

          {/* Active Cameras List */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-700">
              Active Cameras ({editedCameras.length})
            </h3>
            {editedCameras.map((cam) => (
              <div
                key={cam.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 transition-colors hover:border-slate-300"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={cam.enabled}
                      onChange={() => handleToggleEnable(cam.id)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <input
                      type="text"
                      value={cam.name}
                      onChange={(e) => handleUpdateName(cam.id, e.target.value)}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-900 focus:border-slate-900 focus:outline-none shadow-xs"
                    />
                  </div>
                  <button
                    onClick={() => handleDelete(cam.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                    title="Delete camera"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <input
                  type="text"
                  value={cam.rtspUrl}
                  onChange={(e) => handleUpdateRtsp(cam.id, e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] text-slate-700 focus:border-slate-900 focus:outline-none shadow-xs"
                  placeholder="rtsp://192.168.1.10:554/..."
                />
              </div>
            ))}
          </div>

          {/* Add New Camera Form */}
          <form
            onSubmit={handleAddCamera}
            className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-3.5 space-y-2.5"
          >
            <h4 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5 text-slate-700" /> Add Another Channel
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Camera Name (e.g., Gate)"
                value={newCameraName}
                onChange={(e) => setNewCameraName(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none shadow-xs"
              />
              <input
                type="text"
                placeholder="Location (optional)"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none shadow-xs"
              />
            </div>
            <input
              type="text"
              placeholder="RTSP Stream URL (rtsp://192.168.1.10:554/...)"
              value={newRtspUrl}
              onChange={(e) => setNewRtspUrl(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none shadow-xs"
            />
            <button
              type="submit"
              disabled={!newCameraName || !newRtspUrl}
              className="w-full rounded-lg bg-slate-900 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 shadow-xs"
            >
              Add Channel
            </button>
          </form>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
