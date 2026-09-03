export type StreamMode = "webrtc" | "mse" | "mjpeg" | "hls";

export type GridLayout = "auto" | "1x1" | "1x2" | "2x2";

export type AppMode = "live" | "playback" | "archive" | "settings";

export interface CameraConfig {
  id: string;
  name: string;
  streamName: string;
  rtspUrl: string;
  location?: string;
  enabled: boolean;
}

export interface PlaybackEvent {
  id: string;
  cameraId: string;
  cameraName: string;
  startTime: string; // ISO string or HH:mm:ss
  endTime: string;
  type: "motion" | "continuous" | "alarm";
  thumbnail?: string;
}

export interface SavedSnapshot {
  id: string;
  cameraId: string;
  cameraName: string;
  timestamp: string;
  dataUrl: string;
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export const DEFAULT_CAMERAS: CameraConfig[] = [
  {
    id: "cam-1",
    name: "Camera 01 - Channel 1",
    streamName: "camera_channel_1",
    rtspUrl: "rtsp://192.168.1.10:554/user=admin&password=&channel=1&stream=0.sdp",
    location: "Main Entrance",
    enabled: true,
  },
  {
    id: "cam-2",
    name: "Camera 02 - Channel 2",
    streamName: "camera_channel_2",
    rtspUrl: "rtsp://192.168.1.10:554/user=admin&password=&channel=2&stream=0.sdp",
    location: "Parking Lot",
    enabled: true,
  },
  {
    id: "cam-3",
    name: "Camera 03 - Channel 3",
    streamName: "camera_channel_3",
    rtspUrl: "rtsp://192.168.1.10:554/user=admin&password=&channel=3&stream=0.sdp",
    location: "Warehouse / Arch",
    enabled: true,
  },
  {
    id: "cam-4",
    name: "Camera 04 - Channel 4",
    streamName: "camera_channel_4",
    rtspUrl: "rtsp://192.168.1.10:554/user=admin&password=&channel=4&stream=0.sdp",
    location: "Back Alley",
    enabled: true,
  },
];
