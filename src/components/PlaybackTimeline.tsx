"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { CameraConfig } from "@/lib/types";
import { CameraPlayer } from "./CameraPlayer";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Calendar,
  Clock,
  Film,
  Activity,
  ChevronRight,
  Download,
  AlertCircle,
  HardDrive,
  CheckCircle2,
} from "lucide-react";

interface PlaybackTimelineProps {
  cameras: CameraConfig[];
  selectedCameraId: string;
  onSelectCamera: (id: string) => void;
}

interface DvrClip {
  beginTime: string;
  endTime: string;
  fileName: string;
  channel: number;
}

export function PlaybackTimeline({
  cameras,
  selectedCameraId,
  onSelectCamera,
}: PlaybackTimelineProps) {
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [recordings, setRecordings] = useState<DvrClip[]>([]);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(false);
  const [activeClip, setActiveClip] = useState<DvrClip | null>(null);
  const [isPlayingRecorded, setIsPlayingRecorded] = useState(false);
  const [playbackStreamKey, setPlaybackStreamKey] = useState<string>("");
  const [scrubberSec, setScrubberSec] = useState<number>(0);
  const timelineRef = useRef<HTMLDivElement>(null);

  const activeCam =
    cameras.find((c) => c.id === selectedCameraId) || cameras[0];
  const channelNum = parseInt(activeCam?.streamName?.slice(-1) || "1", 10);

  // Fetch real DVR recordings from /api/dvr/recordings
  const fetchDvrRecordings = useCallback(async () => {
    setIsLoadingRecordings(true);
    try {
      const res = await fetch(
        `/api/dvr/recordings?channel=${channelNum}&date=${selectedDate}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.recordings)) {
          setRecordings(data.recordings);
        } else {
          setRecordings([]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch DVR recordings:", err);
      setRecordings([]);
    } finally {
      setIsLoadingRecordings(false);
    }
  }, [channelNum, selectedDate]);

  useEffect(() => {
    fetchDvrRecordings();
  }, [fetchDvrRecordings]);

  // Convert time "HH:mm:ss" or "YYYY-MM-DD HH:mm:ss" to total seconds of the day
  const timeToSeconds = (timeStr: string) => {
    const parts = timeStr.trim().split(" ");
    const t = parts.length > 1 ? parts[1] : parts[0];
    const [hh, mm, ss] = t.split(":").map((v) => parseInt(v, 10) || 0);
    return hh * 3600 + mm * 60 + ss;
  };

  const formatSeconds = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = Math.floor(totalSec % 60);
    return `${h.toString().padStart(2, "0")}:${m
      .toString()
      .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Play a specific DVR recorded clip
  const handlePlayClip = async (clip: DvrClip) => {
    setActiveClip(clip);
    const startSec = timeToSeconds(clip.beginTime);
    setScrubberSec(startSec);

    try {
      const res = await fetch("/api/dvr/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: clip.fileName }),
      });

      if (res.ok) {
        const data = await res.json();
        setPlaybackStreamKey(data.streamName || "playback_active");
        setIsPlayingRecorded(true);
      }
    } catch (err) {
      console.error("Play clip error:", err);
    }
  };

  // Return to live feed
  const handleReturnToLive = () => {
    setIsPlayingRecorded(false);
    setActiveClip(null);
    setPlaybackStreamKey("");
  };

  // Handle timeline scrubber click
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const pct = clickX / rect.width;
    const sec = Math.floor(pct * 86400);
    setScrubberSec(sec);

    // Find if there is a recorded clip matching this time
    const match = recordings.find((r) => {
      const bSec = timeToSeconds(r.beginTime);
      const eSec = timeToSeconds(r.endTime);
      return sec >= bSec && sec <= eSec;
    });

    if (match) {
      handlePlayClip(match);
    }
  };

  // Temporary synthetic camera config for playback player
  const playbackCameraConfig: CameraConfig = {
    id: "playback-player",
    name: `${activeCam?.name || "Camera"} [PLAYBACK]`,
    streamName: playbackStreamKey || activeCam?.streamName || "camera_channel_1",
    rtspUrl: activeCam?.rtspUrl || "",
    enabled: true,
  };

  return (
    <div className="flex flex-1 flex-col bg-slate-50 overflow-y-auto">
      {/* Top Playback Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-xs">
        {/* Camera Selector */}
        <div className="flex items-center gap-2">
          <Film className="h-5 w-5 text-slate-700" />
          <div className="flex items-center gap-1 overflow-x-auto py-1">
            {cameras.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onSelectCamera(c.id);
                  handleReturnToLive();
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCameraId === c.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {c.name.split(" - ")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Date Selector & Mode */}
        <div className="flex items-center gap-2">
          {isPlayingRecorded && (
            <button
              onClick={handleReturnToLive}
              className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
            >
              Switch to Live
            </button>
          )}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-xs">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                handleReturnToLive();
              }}
              className="bg-transparent text-slate-900 font-sans focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Main Stage */}
      <div className="flex flex-col lg:flex-row flex-1 p-3 sm:p-5 gap-4">
        {/* Left: Video Player Surface */}
        <div className="flex-1 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Video Viewport */}
          <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
            <CameraPlayer
              camera={
                isPlayingRecorded ? playbackCameraConfig : activeCam || cameras[0]
              }
              isFullscreen={false}
            />

            {/* Playback Badge */}
            <div className="absolute top-3 right-3 flex items-center gap-2 z-20 pointer-events-none">
              <span
                className={`rounded-md px-2.5 py-1 text-xs font-bold text-white shadow-xs ${
                  isPlayingRecorded ? "bg-amber-500" : "bg-emerald-600"
                }`}
              >
                {isPlayingRecorded ? "RECORDED PLAYBACK" : "LIVE STANDBY"}
              </span>
            </div>

            {/* Timecode overlay */}
            <div className="absolute bottom-3 left-3 rounded-md bg-black/70 px-2.5 py-1 font-mono text-xs text-white backdrop-blur-xs z-20">
              {activeClip
                ? `${activeClip.beginTime.slice(11)} - ${activeClip.endTime.slice(11)}`
                : `${selectedDate} ${formatSeconds(scrubberSec)}`}
            </div>
          </div>

          {/* 24-Hour Timeline Bar */}
          <div className="p-4 bg-white space-y-3">
            <div>
              <div className="flex items-center justify-between text-[11px] font-mono font-medium text-slate-400 mb-1">
                <span>00:00</span>
                <span>04:00</span>
                <span>08:00</span>
                <span>12:00</span>
                <span>16:00</span>
                <span>20:00</span>
                <span>24:00</span>
              </div>

              {/* Interactive Timeline Track */}
              <div
                ref={timelineRef}
                onClick={handleTimelineClick}
                className="relative h-11 w-full rounded-xl bg-slate-100 border border-slate-200 cursor-pointer overflow-hidden select-none"
                title="Tap anywhere to scrub footage"
              >
                {/* Render Actual Recorded Clips as Green Segments */}
                {recordings.map((rec, i) => {
                  const bSec = timeToSeconds(rec.beginTime);
                  const eSec = timeToSeconds(rec.endTime);
                  const dur = Math.max(60, eSec - bSec);
                  const leftPct = (bSec / 86400) * 100;
                  const widthPct = Math.max(0.4, (dur / 86400) * 100);

                  const isActive =
                    activeClip?.fileName === rec.fileName;

                  return (
                    <div
                      key={i}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      className={`absolute inset-y-1.5 rounded-xs transition-colors ${
                        isActive
                          ? "bg-amber-500 z-10"
                          : "bg-emerald-500/80 hover:bg-emerald-600"
                      }`}
                      title={`${rec.beginTime.slice(11)} - ${rec.endTime.slice(11)}`}
                    />
                  );
                })}

                {/* Scrubber Needle */}
                <div
                  style={{ left: `${(scrubberSec / 86400) * 100}%` }}
                  className="absolute inset-y-0 w-1 bg-slate-900 shadow-md z-20 -ml-0.5"
                >
                  <div className="absolute -top-1 -left-1.5 h-3.5 w-3.5 rounded-full bg-slate-900 border-2 border-white shadow-xs" />
                </div>
              </div>
            </div>

            {/* Timecode & Legend */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                <span>{formatSeconds(scrubberSec)}</span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500" />
                  <span>DVR Continuous Recording</span>
                </span>
                {activeClip && (
                  <span className="flex items-center gap-1.5 font-semibold text-amber-600">
                    <span className="h-2.5 w-2.5 rounded-xs bg-amber-500" />
                    <span>Active Segment</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Actual Recorded Files from DVR Hard Drive */}
        <div className="w-full lg:w-80 flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-slate-700" />
              <span>DVR Files ({recordings.length})</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              CH 0{channelNum}
            </span>
          </div>

          {isLoadingRecordings ? (
            <div className="flex flex-col items-center justify-center p-8 text-slate-400">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 mb-2" />
              <span className="text-xs font-medium">Scanning DVR hard drive…</span>
            </div>
          ) : recordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <AlertCircle className="h-8 w-8 text-slate-300 mb-1" />
              <p className="text-xs font-semibold text-slate-600">
                No recordings found
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Check DVR storage or select another date.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-96 lg:max-h-[480px]">
              {recordings.map((rec, idx) => {
                const isSelected = activeClip?.fileName === rec.fileName;
                const bTime = rec.beginTime.slice(11);
                const eTime = rec.endTime.slice(11);

                return (
                  <div
                    key={idx}
                    onClick={() => handlePlayClip(rec)}
                    className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "border-amber-500 bg-amber-50/80 shadow-xs"
                        : "border-slate-100 bg-slate-50/60 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                          isSelected
                            ? "bg-amber-500 text-white"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        <Play className="h-3 w-3 fill-current ml-0.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {bTime} - {eTime}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          5 min clip &bull; H.264
                        </p>
                      </div>
                    </div>

                    <a
                      href={`/api/dvr/download?file=${encodeURIComponent(
                        rec.fileName
                      )}`}
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-white hover:text-slate-900 transition-colors shadow-2xs"
                      title="Download .h264 file to device"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-start gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Direct hardware NVR storage from{" "}
              <code className="text-slate-800 font-mono">192.168.1.10:34567</code>.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
