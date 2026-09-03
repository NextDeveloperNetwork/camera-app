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
  Video,
  Radio,
  Disc,
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
  videoUrl?: string;
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
  const [localClips, setLocalClips] = useState<DvrClip[]>([]);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(false);
  const [activeClip, setActiveClip] = useState<DvrClip | null>(null);
  const [viewMode, setViewMode] = useState<"playback" | "live">("playback");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [isRecordingLive, setIsRecordingLive] = useState(false);

  const videoElementRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

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
          if (data.recordings.length > 0 && !activeClip && localClips.length === 0) {
            setActiveClip(data.recordings[0]);
          }
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
  }, [channelNum, selectedDate, activeClip, localClips.length]);

  useEffect(() => {
    fetchDvrRecordings();
  }, [fetchDvrRecordings]);

  // Handle Play/Pause for the recorded video
  const togglePlayPause = () => {
    const v = videoElementRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  // Handle speed change
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoElementRef.current) {
      videoElementRef.current.playbackRate = speed;
    }
  };

  // Jump seconds
  const handleJump = (delta: number) => {
    const v = videoElementRef.current;
    if (v) {
      v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
    }
  };

  // Select a recorded clip to review
  const handleSelectClip = (clip: DvrClip) => {
    setActiveClip(clip);
    setViewMode("playback");
    setIsPlaying(false);
  };

  // Capture a 15-second live clip directly from the WebRTC stream to review in playback
  const handleCaptureLiveClip = async () => {
    if (isRecordingLive) return;
    setIsRecordingLive(true);

    try {
      // Connect to the camera's WebRTC stream temporarily to record
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pc.addTransceiver("video", { direction: "recvonly" });

      pc.ontrack = (event) => {
        const stream = event.streams[0];
        if (!stream) return;

        recordedChunksRef.current = [];
        const recorder = new MediaRecorder(stream, {
          mimeType: "video/webm;codecs=vp8,opus",
        });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          const now = new Date();
          const timeStr = now.toTimeString().slice(0, 8);
          const newClip: DvrClip = {
            beginTime: `${selectedDate} ${timeStr}`,
            endTime: `${selectedDate} ${timeStr}`,
            fileName: `Live_Recording_${activeCam.streamName}_${Date.now()}.webm`,
            channel: channelNum,
            videoUrl: url,
          };

          setLocalClips((prev) => [newClip, ...prev]);
          setActiveClip(newClip);
          setViewMode("playback");
          setIsRecordingLive(false);
          pc.close();
        };

        recorder.start();
        // Record for 10 seconds
        setTimeout(() => {
          if (recorder.state === "recording") {
            recorder.stop();
          }
        }, 10000);
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await fetch(
        `/api/stream/webrtc?src=${encodeURIComponent(activeCam.streamName)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: offer.sdp,
        }
      );

      if (res.ok) {
        const answer = await res.text();
        await pc.setRemoteDescription({ type: "answer", sdp: answer });
      }
    } catch (err) {
      console.error("Capture live clip error:", err);
      setIsRecordingLive(false);
    }
  };

  const formatSeconds = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = Math.floor(totalSec % 60);
    return `${h.toString().padStart(2, "0")}:${m
      .toString()
      .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const allDisplayClips = [...localClips, ...recordings];

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
                  setActiveClip(null);
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

        {/* View Mode & Date Selector */}
        <div className="flex items-center gap-2">
          {/* Capture Live Clip Button */}
          <button
            onClick={handleCaptureLiveClip}
            disabled={isRecordingLive}
            className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition-colors disabled:opacity-50"
            title="Record 10 seconds of live camera footage to review in player"
          >
            <Disc
              className={`h-3.5 w-3.5 ${isRecordingLive ? "animate-spin" : ""}`}
            />
            <span>{isRecordingLive ? "Recording 10s…" : "Record Live Clip"}</span>
          </button>

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
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setActiveClip(null);
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
          {/* Main Viewport */}
          <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
            {viewMode === "live" ? (
              <CameraPlayer camera={activeCam} isFullscreen={false} />
            ) : activeClip?.videoUrl ? (
              /* REAL In-Browser Video Player */
              <video
                ref={videoElementRef}
                src={activeClip.videoUrl}
                playsInline
                autoPlay
                className="h-full w-full object-contain"
                onTimeUpdate={() => {
                  if (videoElementRef.current) {
                    setCurrentTimeSec(videoElementRef.current.currentTime);
                    setDurationSec(videoElementRef.current.duration || 0);
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />
            ) : (
              /* Clip Standby Surface with Quick Play */
              <div className="relative h-full w-full flex flex-col items-center justify-center p-6 text-center text-white bg-radial from-slate-900 to-slate-950">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3 shadow-lg">
                  <Video className="h-7 w-7" />
                </div>

                <div className="max-w-md">
                  <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-400 border border-amber-500/30">
                    DVR HARD DRIVE RECORDING
                  </span>

                  <h3 className="text-base sm:text-lg font-bold text-white mt-3">
                    {activeClip
                      ? `${activeClip.beginTime.slice(11)} – ${activeClip.endTime.slice(11)}`
                      : "Select a recorded segment from the list"}
                  </h3>

                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    {selectedDate} &bull; {activeCam?.name} &bull; 5 Min Continuous H.264
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      onClick={handleCaptureLiveClip}
                      disabled={isRecordingLive}
                      className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-md hover:bg-amber-400 transition-colors"
                    >
                      <Disc className="h-4 w-4" />
                      <span>{isRecordingLive ? "Recording 10s Clip…" : "Record 10s Clip to Play"}</span>
                    </button>

                    {activeClip && (
                      <a
                        href={`/api/dvr/download?file=${encodeURIComponent(
                          activeClip.fileName
                        )}`}
                        download
                        className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download (.h264)</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Disk Path Stamp */}
                <div className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2.5 py-1 font-mono text-[10px] text-slate-400 border border-slate-800 backdrop-blur-xs">
                  {activeClip?.fileName || "DVR Local Storage"}
                </div>
              </div>
            )}

            {/* Badge Indicator */}
            <div className="absolute top-3 right-3 flex items-center gap-2 z-20 pointer-events-none">
              <span
                className={`rounded-md px-2.5 py-1 text-xs font-bold text-white shadow-xs ${
                  viewMode === "playback"
                    ? activeClip?.videoUrl
                      ? "bg-amber-500"
                      : "bg-blue-600"
                    : "bg-emerald-600"
                }`}
              >
                {viewMode === "playback"
                  ? activeClip?.videoUrl
                    ? isPlaying
                      ? `PLAYING ${playbackSpeed}x`
                      : "PAUSED"
                    : "DVR ARCHIVE"
                  : "LIVE STREAM"}
              </span>
            </div>
          </div>

          {/* Player Scrubber & Controls Bar */}
          <div className="p-4 bg-white space-y-3">
            {/* Scrubber Seek Bar */}
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

              {/* 24-Hour Timeline Track */}
              <div
                ref={timelineRef}
                className="relative h-11 w-full rounded-xl bg-slate-100 border border-slate-200 cursor-pointer overflow-hidden select-none"
              >
                {/* Render Actual Recorded Clips as Green Segments */}
                {recordings.map((rec, i) => {
                  const parts = rec.beginTime.slice(11).split(":").map(Number);
                  const bSec = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
                  const leftPct = (bSec / 86400) * 100;
                  const widthPct = Math.max(0.4, (300 / 86400) * 100);
                  const isActive = activeClip?.fileName === rec.fileName;

                  return (
                    <div
                      key={i}
                      onClick={() => handleSelectClip(rec)}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      className={`absolute inset-y-1.5 rounded-xs transition-colors cursor-pointer ${
                        isActive
                          ? "bg-amber-500 z-10 shadow-xs"
                          : "bg-emerald-500/80 hover:bg-emerald-600"
                      }`}
                      title={`${rec.beginTime.slice(11)} – ${rec.endTime.slice(11)}`}
                    />
                  );
                })}

                {/* Scrubber needle */}
                <div
                  style={{
                    left: `${
                      durationSec > 0
                        ? (currentTimeSec / durationSec) * 100
                        : 10
                    }%`,
                  }}
                  className="absolute inset-y-0 w-1 bg-slate-900 shadow-md z-20 -ml-0.5"
                >
                  <div className="absolute -top-1 -left-1.5 h-3.5 w-3.5 rounded-full bg-slate-900 border-2 border-white shadow-xs" />
                </div>
              </div>
            </div>

            {/* Video Transport Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1.5">
                {/* Rewind -10s */}
                <button
                  onClick={() => handleJump(-10)}
                  className="flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
                  title="Rewind 10s"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>

                {/* Play / Pause */}
                <button
                  onClick={togglePlayPause}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs active:scale-95"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4 fill-white ml-0.5" />
                  )}
                </button>

                {/* Forward +10s */}
                <button
                  onClick={() => handleJump(10)}
                  className="flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
                  title="Forward 10s"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
              </div>

              {/* Time Indicator */}
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                <span>
                  {formatSeconds(currentTimeSec)} / {formatSeconds(durationSec)}
                </span>
              </div>

              {/* Speed Multipliers */}
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
                {[0.5, 1, 2, 4].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => handleSpeedChange(spd)}
                    className={`px-2 py-1 rounded transition-colors ${
                      playbackSpeed === spd
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Recorded Files List from DVR & Local Archive */}
        <div className="w-full lg:w-80 flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-slate-700" />
              <span>Recordings ({allDisplayClips.length})</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              CH 0{channelNum}
            </span>
          </div>

          {isLoadingRecordings ? (
            <div className="flex flex-col items-center justify-center p-8 text-slate-400">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 mb-2" />
              <span className="text-xs font-medium">Scanning DVR recordings…</span>
            </div>
          ) : allDisplayClips.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <AlertCircle className="h-8 w-8 text-slate-300 mb-1" />
              <p className="text-xs font-semibold text-slate-600">
                No recordings found
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Click "Record Live Clip" above to capture a clip immediately!
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-96 lg:max-h-[480px]">
              {allDisplayClips.map((rec, idx) => {
                const isSelected = activeClip?.fileName === rec.fileName;
                const bTime = rec.beginTime.slice(11);
                const isLocal = Boolean(rec.videoUrl);

                return (
                  <div
                    key={idx}
                    onClick={() => handleSelectClip(rec)}
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
                            : isLocal
                            ? "bg-rose-500 text-white"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        <Play className="h-3 w-3 fill-current ml-0.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-900">
                            {bTime}
                          </p>
                          {isLocal && (
                            <span className="rounded bg-rose-100 px-1 py-0.2 text-[9px] font-bold text-rose-700">
                              Instant Play
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {isLocal ? "Recorded Clip" : "5 min DVR H.264"}
                        </p>
                      </div>
                    </div>

                    <a
                      href={
                        rec.videoUrl ||
                        `/api/dvr/download?file=${encodeURIComponent(
                          rec.fileName
                        )}`
                      }
                      download={rec.fileName}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-white hover:text-slate-900 transition-colors shadow-2xs"
                      title="Download file to device"
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
              Playback & Video Review &bull; Real camera stream recording.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
