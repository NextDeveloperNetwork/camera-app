"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import Hls from "hls.js";
import { CameraConfig, ConnectionStatus } from "@/lib/types";
import {
  Wifi,
  Maximize2,
  Volume2,
  VolumeX,
  RotateCw,
  Camera,
  Check,
  AlertCircle,
  X,
  Expand,
  Zap,
  Gauge,
} from "lucide-react";

export type StreamProtocol = "hls" | "mp4" | "webrtc" | "mjpeg";

interface CameraPlayerProps {
  camera: CameraConfig;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  refreshTrigger?: number;
  initialProtocol?: StreamProtocol;
}

export function CameraPlayer({
  camera,
  isFullscreen = false,
  onToggleFullscreen,
  refreshTrigger = 0,
  initialProtocol = "hls",
}: CameraPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [streamProtocol, setStreamProtocol] = useState<StreamProtocol>(initialProtocol);
  // In grid view, default to fast substream for instant, smooth playback. In fullscreen, default to HD.
  const [quality, setQuality] = useState<"fast" | "hd">(isFullscreen ? "hd" : "fast");
  const [isMuted, setIsMuted] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [snapshotTaken, setSnapshotTaken] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  // Determine active stream name based on quality setting
  const activeStreamName =
    quality === "fast" && camera.subStreamName
      ? camera.subStreamName
      : camera.streamName;

  // Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup all streams
  const stopStream = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.onloadedmetadata = null;
      videoRef.current.oncanplay = null;
      videoRef.current.onerror = null;
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
  }, []);

  // Buffer sync: Keep video pinned to real-time live edge (prevents lag accumulation)
  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v || v.buffered.length === 0) return;
    try {
      const liveEdge = v.buffered.end(v.buffered.length - 1);
      const lag = liveEdge - v.currentTime;
      if (lag > 3.0) {
        // Jump directly to live edge
        v.currentTime = liveEdge - 0.2;
      } else if (lag > 0.8) {
        // Slight lag: catch up gently
        v.playbackRate = 1.15;
      } else {
        v.playbackRate = 1.0;
      }
    } catch {}
  }, []);

  // Start Stream with intelligent multi-transport support
  const startStream = useCallback(
    async (forcedProtocol?: StreamProtocol) => {
      stopStream();
      setStatus("connecting");
      setErrorMessage("");

      const activeProtocol = forcedProtocol || streamProtocol;

      // ── PROTOCOL 1: Low-Latency HLS (100% Mobile & Safari & Cloudflare Tunnel compatible) ──
      if (activeProtocol === "hls") {
        setStreamProtocol("hls");
        const v = videoRef.current;
        if (!v) return;

        const hlsUrl = `/api/stream/stream.m3u8?src=${encodeURIComponent(
          activeStreamName
        )}`;

        // A) Native HLS for Safari (iPhone, iPad, Mac)
        if (v.canPlayType("application/vnd.apple.mpegurl")) {
          v.src = hlsUrl;
          v.muted = true;
          v.setAttribute("playsinline", "true");
          v.setAttribute("webkit-playsinline", "true");

          let connected = false;
          const markConnected = () => {
            if (connected) return;
            connected = true;
            if (fallbackTimerRef.current) {
              clearTimeout(fallbackTimerRef.current);
              fallbackTimerRef.current = null;
            }
            setStatus("connected");
            v.play().catch(() => {
              v.muted = true;
              v.play().catch(() => {});
            });
          };

          v.onloadedmetadata = markConnected;
          v.oncanplay = markConnected;
          v.addEventListener("playing", markConnected, { once: true });
          v.onerror = () => {
            if (!connected) {
              console.warn("Native HLS error, trying MP4 fallback");
              startStream("mp4");
            }
          };

          // go2rtc needs time to connect RTSP and prepare the first HLS segments
          // 12 seconds is safe for slow DVR connections
          fallbackTimerRef.current = setTimeout(() => {
            if (!connected) {
              console.warn("Native HLS timeout (12s), falling back to MP4");
              startStream("mp4");
            }
          }, 12000);
          return;
        }

        // B) HLS.js for Android Chrome, Edge, Firefox, Desktop Chrome
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 0,
            maxBufferLength: 2,
            maxMaxBufferLength: 4,
            liveSyncDurationCount: 1,
            liveMaxLatencyDurationCount: 2.5,
            manifestLoadingTimeOut: 6000,
            manifestLoadingMaxRetry: 3,
            levelLoadingTimeOut: 6000,
            levelLoadingMaxRetry: 3,
            fragLoadingTimeOut: 6000,
            fragLoadingMaxRetry: 3,
          });
          hlsRef.current = hls;

          hls.loadSource(hlsUrl);
          hls.attachMedia(v);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setStatus("connected");
            v.muted = true;
            v.play().catch(() => {
              v.muted = true;
              v.play().catch(() => {});
            });
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              console.warn("HLS fatal error:", data.type, data.details);
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  hls.recoverMediaError();
                  break;
                default:
                  hls.destroy();
                  hlsRef.current = null;
                  startStream("mp4");
                  break;
              }
            }
          });

          // 12 second timeout - go2rtc RTSP startup can take several seconds
          fallbackTimerRef.current = setTimeout(() => {
            if (v.videoWidth === 0 && v.readyState < 2) {
              console.warn("HLS.js timeout (12s) without video frames, trying MP4");
              startStream("mp4");
            }
          }, 12000);
          return;
        }

        // Fallback to MP4 if HLS is unavailable
        startStream("mp4");
        return;
      }

      // ── PROTOCOL 2: MP4 Progressive HTTP Stream ──
      if (activeProtocol === "mp4") {
        setStreamProtocol("mp4");
        const v = videoRef.current;
        if (v) {
          const streamUrl = `/api/stream/stream.mp4?src=${encodeURIComponent(
            activeStreamName
          )}`;
          v.src = streamUrl;
          v.muted = true;
          v.setAttribute("playsinline", "true");
          v.setAttribute("webkit-playsinline", "true");

          let mpConnected = false;
          const markMp4Connected = () => {
            if (mpConnected) return;
            mpConnected = true;
            if (fallbackTimerRef.current) {
              clearTimeout(fallbackTimerRef.current);
              fallbackTimerRef.current = null;
            }
            setStatus("connected");
            v.play().catch(() => {});
          };

          v.onloadedmetadata = markMp4Connected;
          v.addEventListener("playing", markMp4Connected, { once: true });
          v.onerror = () => {
            if (!mpConnected) {
              console.warn("MP4 stream error, retrying HLS");
              startStream("hls");
            }
          };

          // If MP4 doesn't produce frames in 8s, retry from HLS (not MJPEG which returns 404)
          fallbackTimerRef.current = setTimeout(() => {
            if (!mpConnected) {
              console.warn("MP4 timed out (8s), retrying HLS");
              startStream("hls");
            }
          }, 8000);
        }
        return;
      }

      // ── PROTOCOL 3: WebRTC WHEP (Fast on LAN) ──
      if (activeProtocol === "webrtc") {
        setStreamProtocol("webrtc");
        try {
          const pc = new RTCPeerConnection({
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
            ],
          });
          pcRef.current = pc;

          pc.addTransceiver("video", { direction: "recvonly" });
          pc.addTransceiver("audio", { direction: "recvonly" });

          pc.ontrack = (event) => {
            if (videoRef.current && event.streams[0]) {
              videoRef.current.srcObject = event.streams[0];
              videoRef.current.muted = true;
              videoRef.current.play().catch(() => {});
              setStatus("connected");
            }
          };

          pc.oniceconnectionstatechange = () => {
            if (
              pc.iceConnectionState === "failed" ||
              pc.iceConnectionState === "disconnected"
            ) {
              console.warn("WebRTC UDP failed, switching to HLS stream");
              startStream("hls");
            }
          };

          fallbackTimerRef.current = setTimeout(() => {
            if (videoRef.current && videoRef.current.videoWidth === 0) {
              console.warn("WebRTC has no video frames, falling back to HLS stream");
              startStream("hls");
            }
          }, 5000);

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          const endpoint = `/api/stream/webrtc?src=${encodeURIComponent(
            activeStreamName
          )}`;

          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/sdp" },
            body: offer.sdp,
          });

          if (pcRef.current !== pc) return;

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const answerSdp = await response.text();
          if (pcRef.current !== pc) return;

          await pc.setRemoteDescription({
            type: "answer",
            sdp: answerSdp,
          });
        } catch (err: unknown) {
          if (!pcRef.current) return;
          console.warn("WebRTC handshake failed, falling back to HLS stream:", err);
          startStream("hls");
        }
        return;
      }

      // MJPEG is not supported by go2rtc for RTSP sources, so we loop back to HLS
      if (activeProtocol === "mjpeg") {
        console.warn("MJPEG not available, retrying HLS in 3s");
        fallbackTimerRef.current = setTimeout(() => {
          startStream("hls");
        }, 3000);
      }
    },
    [activeStreamName, stopStream, streamProtocol]
  );

  useEffect(() => {
    startStream();
    return () => {
      stopStream();
    };
  }, [activeStreamName, refreshTrigger, startStream, stopStream]);

  // Snapshot capture
  const handleSnapshot = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
        const link = document.createElement("a");
        link.download = `Snapshot_${camera.name}_${Date.now()}.jpg`;
        link.href = dataUrl;
        link.click();

        setSnapshotTaken(true);
        setTimeout(() => setSnapshotTaken(false), 2500);
      }
    } catch (err) {
      console.error("Snapshot error:", err);
    }
  };

  const handleReconnect = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    startStream();
  };

  const toggleAudio = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Toggle protocol explicitly
  const toggleProtocol = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    let next: StreamProtocol = "hls";
    if (streamProtocol === "hls") next = "mp4";
    else if (streamProtocol === "mp4") next = "webrtc";
    else next = "hls";
    startStream(next);
  };

  // Toggle quality explicitly (Fast Substream vs HD Mainstream)
  const toggleQuality = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setQuality((prev) => (prev === "fast" ? "hd" : "fast"));
  };

  const channelNum = camera.streamName.slice(-1) || "1";

  const getProtocolLabel = () => {
    switch (streamProtocol) {
      case "hls":
        return "HLS Live";
      case "mp4":
        return "MP4 Stream";
      case "webrtc":
        return "WebRTC";
      case "mjpeg":
        return "MJPEG";
    }
  };

  return (
    <div
      onClick={!isFullscreen ? onToggleFullscreen : undefined}
      className={`group relative flex flex-col overflow-hidden bg-white transition-all ${
        isFullscreen
          ? "h-full w-full fixed inset-0 z-50 rounded-none bg-black"
          : "rounded-2xl border border-slate-200 shadow-xs hover:shadow-md cursor-pointer"
      }`}
    >
      {/* ── Top Camera Header ── */}
      {!isFullscreen && (
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-100 bg-white z-10">
          <div className="flex items-center gap-2 truncate">
            <span
              className={`h-2.5 w-2.5 rounded-full shrink-0 transition-all ${
                status === "connected"
                  ? "bg-emerald-500 shadow-xs ring-2 ring-emerald-100"
                  : status === "connecting"
                  ? "bg-amber-400 animate-pulse"
                  : "bg-rose-500"
              }`}
            />
            <span className="text-xs font-bold text-slate-800 truncate tracking-tight">
              {camera.name}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Quality pill: Fast vs HD */}
            <button
              onClick={toggleQuality}
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold border transition-colors ${
                quality === "fast"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              }`}
              title="Click to toggle Fast (Smooth) vs HD (1080p)"
            >
              <Gauge className="h-2.5 w-2.5" />
              <span>{quality === "fast" ? "FAST" : "HD"}</span>
            </button>

            {status === "connected" && (
              <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                LIVE
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleFullscreen) onToggleFullscreen();
              }}
              className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Expand Camera"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Video Viewport Area ── */}
      <div className="relative flex-1 w-full bg-slate-950 flex items-center justify-center overflow-hidden aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          onTimeUpdate={handleTimeUpdate}
          className="h-full w-full object-contain pointer-events-none"
        />

        {/* Connecting indicator */}
        {status === "connecting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xs text-white">
            <div className="relative flex h-10 w-10 items-center justify-center mb-2">
              <div className="absolute h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
              <Wifi className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="font-medium text-xs text-white">Connecting live feed…</p>
            <p className="text-[10px] text-slate-400">{camera.name}</p>
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 p-4 text-center text-white">
            <AlertCircle className="h-7 w-7 text-amber-400 mb-1.5" />
            <p className="text-xs font-semibold">Feed Interrupted</p>
            <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
              {errorMessage || "Unable to establish stream connection"}
            </p>
            <button
              onClick={handleReconnect}
              className="mt-3 flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
            >
              <RotateCw className="h-3.5 w-3.5" /> Reconnect
            </button>
          </div>
        )}

        {/* Snapshot feedback pill */}
        {snapshotTaken && (
          <div className="absolute inset-x-0 top-3 flex justify-center pointer-events-none z-30">
            <div className="flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1 text-xs font-semibold text-slate-900 shadow-lg border border-slate-200">
              <Check className="h-3.5 w-3.5 text-emerald-600" /> Snapshot Saved
            </div>
          </div>
        )}

        {/* "Tap to Expand" hint pill */}
        {!isFullscreen && (
          <div className="absolute bottom-2.5 right-2.5 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            <span className="flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold text-white shadow-xs backdrop-blur-xs border border-white/10">
              <Expand className="h-3 w-3" /> Tap to expand
            </span>
          </div>
        )}

        {/* Fullscreen Overlay Controls (when expanded) */}
        {isFullscreen && (
          <>
            <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between bg-black/80 px-4 py-3 border-b border-white/10 shadow-sm backdrop-blur-md text-white">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-sm font-bold text-white">
                  {camera.name}
                </span>
                <button
                  onClick={toggleQuality}
                  className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold border transition-colors ${
                    quality === "fast"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                  }`}
                  title="Toggle Fast vs HD Quality"
                >
                  <Gauge className="h-3 w-3" />
                  <span>{quality === "fast" ? "FAST (Smooth)" : "HD (1080p)"}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onToggleFullscreen) onToggleFullscreen();
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors shadow-xs"
                  title="Close Fullscreen"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Bottom bar in fullscreen */}
            <div className="absolute bottom-0 inset-x-0 z-20 flex items-center justify-between bg-black/80 px-4 py-3 border-t border-white/10 backdrop-blur-md text-white">
              <div className="flex items-center gap-2 text-xs font-mono text-white/70">
                <span>{currentTime}</span>
                <span>&bull;</span>
                <button
                  onClick={toggleProtocol}
                  className="flex items-center gap-1 font-bold text-amber-400 bg-white/10 px-2 py-0.5 rounded border border-white/20 hover:bg-white/20"
                >
                  <Zap className="h-3 w-3" />
                  <span>{getProtocolLabel()}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleAudio}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 transition-colors"
                  title={isMuted ? "Unmute Audio" : "Mute Audio"}
                >
                  {isMuted ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5 text-emerald-400" />
                  )}
                </button>

                <button
                  onClick={handleSnapshot}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 transition-colors"
                  title="Capture Snapshot"
                >
                  <Camera className="h-5 w-5" />
                </button>

                <button
                  onClick={handleReconnect}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 transition-colors"
                  title="Reconnect"
                >
                  <RotateCw className="h-5 w-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Bottom Card Toolbar ── */}
      {!isFullscreen && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-100 bg-white text-slate-500 text-[11px] font-mono z-10">
          {/* Stream protocol indicator / switcher */}
          <div className="flex items-center gap-1.5">
            <span>CH:{channelNum}</span>
            <span>&bull;</span>
            <button
              onClick={toggleProtocol}
              className="flex items-center gap-1 font-bold text-[10px] text-slate-700 hover:text-slate-950 transition-colors bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
              title="Click to switch stream protocol (HLS / MP4 / WebRTC)"
            >
              <Zap className="h-3 w-3 text-amber-500" />
              <span>{getProtocolLabel()}</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleAudio}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5 text-emerald-600" />
              )}
            </button>

            <button
              onClick={handleSnapshot}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              title="Take snapshot"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={handleReconnect}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              title="Refresh Stream"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
