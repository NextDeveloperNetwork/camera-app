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
  Download,
  AlertCircle,
  HardDrive,
  CheckCircle2,
  Radio,
  Disc,
  Maximize2,
  Volume2,
  VolumeX,
} from "lucide-react";

interface PlaybackTimelineProps {
  cameras: CameraConfig[];
  selectedCameraId: string;
  onSelectCamera: (id: string) => void;
}

interface RecordedClip {
  id: string;
  channel: number;
  fileName: string;
  videoUrl?: string;
  beginTime: string;
  endTime: string;
  sizeBytes?: number;
  durationSec?: number;
}

export function PlaybackTimeline({
  cameras,
  selectedCameraId,
  onSelectCamera,
}: PlaybackTimelineProps) {
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [clips, setClips] = useState<RecordedClip[]>([]);
  const [activeClip, setActiveClip] = useState<RecordedClip | null>(null);
  const [viewMode, setViewMode] = useState<"playback" | "live">("playback");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Video playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isMuted, setIsMuted] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const activeCam =
    cameras.find((c) => c.id === selectedCameraId) || cameras[0];
  const channelNum = parseInt(activeCam?.streamName?.slice(-1) || "1", 10);

  // Fetch recordings for the selected camera
  const fetchClips = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch real playable MP4 recordings
      const res = await fetch(
        `/api/recordings?channel=${channelNum}&date=${selectedDate}`
      );
      let loadedClips: RecordedClip[] = [];

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.clips)) {
          loadedClips = data.clips;
        }
      }

      // 2. Fetch DVR hardware log as well
      try {
        const dvrRes = await fetch(
          `/api/dvr/recordings?channel=${channelNum}&date=${selectedDate}`
        );
        if (dvrRes.ok) {
          const dvrData = await dvrRes.json();
          if (dvrData.success && Array.isArray(dvrData.recordings)) {
            const dvrItems: RecordedClip[] = dvrData.recordings.map((r: { fileName: string; beginTime: string; endTime: string }) => ({
              id: r.fileName,
              channel: channelNum,
              fileName: r.fileName,
              beginTime: r.beginTime,
              endTime: r.endTime,
              // Fallback to channel sample if not converted yet
              videoUrl: `/recordings/sample_cam${channelNum}.mp4`,
            }));
            loadedClips = [...loadedClips, ...dvrItems];
          }
        }
      } catch {}

      setClips(loadedClips);
      if (loadedClips.length > 0) {
        // Auto-select first playable clip
        const firstPlayable = loadedClips.find((c) => c.videoUrl) || loadedClips[0];
        setActiveClip(firstPlayable);
      }
    } catch (err) {
      console.error("Failed to load clips:", err);
    } finally {
      setIsLoading(false);
    }
  }, [channelNum, selectedDate]);

  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  // Video play/pause
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  // Speed change
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  // Jump delta seconds
  const handleJump = (delta: number) => {
    const v = videoRef.current;
    if (v) {
      v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
    }
  };

  // Toggle Mute
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Fullscreen
  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        videoRef.current.requestFullscreen().catch(() => {});
      }
    }
  };

  // Select a clip from the list
  const handleSelectClip = (clip: RecordedClip) => {
    setActiveClip(clip);
    setViewMode("playback");
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setTimeout(() => {
        videoRef.current?.play().catch(() => {});
        setIsPlaying(true);
      }, 100);
    }
  };

  // Trigger on-demand 10s recording from live feed
  const handleRecordClip = async () => {
    if (isRecording) return;
    setIsRecording(true);

    try {
      const res = await fetch("/api/recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: channelNum, duration: 10 }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.clip) {
          setClips((prev) => [data.clip, ...prev]);
          handleSelectClip(data.clip);
        }
      }
    } catch (err) {
      console.error("Recording failed:", err);
    } finally {
      setIsRecording(false);
    }
  };

  // Seek bar click
  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !videoRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = pct * (duration || 10);
    videoRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-1 flex-col bg-slate-50 overflow-y-auto">
      {/* Top Playback Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-xs">
        {/* Camera Selector Pills */}
        <div className="flex items-center gap-2">
          <Film className="h-5 w-5 text-slate-700" />
          <div className="flex items-center gap-1 overflow-x-auto py-1">
            {cameras.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelectCamera(c.id)}
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

        {/* View Mode, Instant REC Button & Date */}
        <div className="flex items-center gap-2">
          {/* Instant Record 10s Clip Button */}
          <button
            onClick={handleRecordClip}
            disabled={isRecording}
            className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition-colors disabled:opacity-50"
            title="Record a 10-second MP4 clip from this camera to review immediately"
          >
            <Disc className={`h-3.5 w-3.5 ${isRecording ? "animate-spin" : ""}`} />
            <span>{isRecording ? "Recording 10s…" : "Record 10s Clip"}</span>
          </button>

          {/* Mode Switcher */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
            <button
              onClick={() => setViewMode("playback")}
              className={`px-3 py-1 rounded-md transition-all ${
                viewMode === "playback"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Review Footage
            </button>
            <button
              onClick={() => setViewMode("live")}
              className={`flex items-center gap-1 px-3 py-1 rounded-md transition-all ${
                viewMode === "live"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Radio className="h-3 w-3 text-emerald-500 animate-pulse" />
              Live Feed
            </button>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-xs">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-slate-900 font-sans focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Main Playback Stage */}
      <div className="flex flex-col lg:flex-row flex-1 p-3 sm:p-5 gap-4">
        {/* Left: Video Viewport & Playback Controls */}
        <div className="flex-1 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Main Video Surface */}
          <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden group">
            {viewMode === "live" ? (
              <CameraPlayer camera={activeCam} isFullscreen={false} />
            ) : activeClip?.videoUrl ? (
              /* ACTIVE HTML5 VIDEO PLAYER */
              <>
                <video
                  ref={videoRef}
                  src={activeClip.videoUrl}
                  playsInline
                  autoPlay
                  muted={isMuted}
                  className="h-full w-full object-contain cursor-pointer"
                  onClick={togglePlay}
                  onTimeUpdate={() => {
                    if (videoRef.current) {
                      setCurrentTime(videoRef.current.currentTime);
                      setDuration(videoRef.current.duration || 10);
                    }
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />

                {/* Big Center Play/Pause button on hover */}
                {!isPlaying && (
                  <button
                    onClick={togglePlay}
                    className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-900/80 text-white shadow-2xl backdrop-blur-xs transition-transform hover:scale-110 active:scale-95 z-20"
                  >
                    <Play className="h-8 w-8 fill-white ml-1" />
                  </button>
                )}

                {/* Status Badges */}
                <div className="absolute top-3 left-3 flex items-center gap-2 z-20 pointer-events-none">
                  <span className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-bold text-slate-950 shadow-xs">
                    REVIEWING FOOTAGE &bull; {activeCam?.name}
                  </span>
                </div>

                <div className="absolute top-3 right-3 flex items-center gap-2 z-20 pointer-events-none">
                  <span className="rounded-md bg-black/70 px-2.5 py-1 font-mono text-xs font-bold text-white shadow-xs backdrop-blur-xs">
                    {activeClip.beginTime}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <AlertCircle className="h-10 w-10 text-slate-500 mb-2" />
                <p className="text-sm font-bold text-white">No clip selected</p>
                <p className="text-xs text-slate-400 mt-1">
                  Select a recorded clip from the right side, or click "Record 10s Clip".
                </p>
              </div>
            )}
          </div>

          {/* Transport Controls & Scrub Bar */}
          <div className="p-4 bg-white space-y-3">
            {/* Scrubber Track */}
            <div
              ref={timelineRef}
              onClick={handleScrubberClick}
              className="relative h-3 w-full rounded-full bg-slate-200 cursor-pointer overflow-hidden group select-none"
            >
              <div
                style={{
                  width: `${
                    duration > 0 ? (currentTime / duration) * 100 : 0
                  }%`,
                }}
                className="h-full bg-amber-500 rounded-full transition-all group-hover:bg-amber-600"
              />
            </div>

            {/* Playback Controls Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              {/* Play / Pause & Skip Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleJump(-10)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
                  title="Rewind 10s"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>

                <button
                  onClick={togglePlay}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-md active:scale-95"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5 fill-white ml-0.5" />
                  )}
                </button>

                <button
                  onClick={() => handleJump(10)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
                  title="Forward 10s"
                >
                  <RotateCw className="h-4 w-4" />
                </button>

                {/* Time Indicator */}
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 ml-2">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  <span>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
              </div>

              {/* Speed Multipliers & Audio / Fullscreen */}
              <div className="flex items-center gap-2">
                {/* Speed Pills */}
                <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
                  {[0.5, 1, 2, 4].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => handleSpeedChange(spd)}
                      className={`px-2 py-1 rounded transition-colors ${
                        playbackSpeed === spd
                          ? "bg-white text-slate-900 shadow-xs font-bold"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>

                {/* Mute Button */}
                <button
                  onClick={toggleMute}
                  className="flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-xs"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>

                {/* Fullscreen Button */}
                <button
                  onClick={toggleFullscreen}
                  className="flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-xs"
                  title="Fullscreen"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Recorded Footage Archive List */}
        <div className="w-full lg:w-80 flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-slate-700" />
              <span>Clips Archive ({clips.length})</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              CH 0{channelNum}
            </span>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-8 text-slate-400">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 mb-2" />
              <span className="text-xs font-medium">Loading recordings…</span>
            </div>
          ) : clips.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <AlertCircle className="h-8 w-8 text-slate-300 mb-1" />
              <p className="text-xs font-semibold text-slate-600">
                No clips in archive
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Click "Record 10s Clip" at the top to record footage immediately!
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-96 lg:max-h-[480px]">
              {clips.map((clip, idx) => {
                const isSelected = activeClip?.id === clip.id;
                const timeStr = clip.beginTime.slice(11);

                return (
                  <div
                    key={idx}
                    onClick={() => handleSelectClip(clip)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "border-amber-500 bg-amber-50/80 shadow-xs ring-1 ring-amber-500/20"
                        : "border-slate-100 bg-slate-50/60 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                          isSelected
                            ? "bg-amber-500 text-white font-bold"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        <Play className="h-3 w-3 fill-current ml-0.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-900">
                            {timeStr || "Footage Clip"}
                          </p>
                          <span className="rounded bg-emerald-100 px-1 py-0.2 text-[9px] font-bold text-emerald-700">
                            Playable MP4
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">
                          Camera {clip.channel} &bull; Recorded Video
                        </p>
                      </div>
                    </div>

                    <a
                      href={clip.videoUrl || `/recordings/sample_cam${channelNum}.mp4`}
                      download={clip.fileName || `camera_${channelNum}_clip.mp4`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-white hover:text-slate-900 transition-colors shadow-2xs"
                      title="Download MP4 video"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-start gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Direct in-browser MP4 video playback &bull; Full transport controls.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
