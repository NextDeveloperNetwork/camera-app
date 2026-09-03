export type StreamMode = "webrtc" | "mse" | "mjpeg" | "hls";

export type GridLayout = "auto" | "1x1" | "1x2" | "2x2";

export interface CameraConfig {
  id: string;
  name: string;
  streamName: string;
  rtspUrl: string;
  location?: string;
  enabled: boolean;
}

export interface StreamStats {
  fps?: number;
  bitrateKbps?: number;
  resolution?: string;
  codec?: string;
  latencyMs?: number;
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export const DEFAULT_CAMERAS: CameraConfig[] = [
  {
    id: "cam-4",
    name: "Camera 04 - Channel 4",
    streamName: "camera_channel_4",
    rtspUrl: "rtsp://192.168.1.10:554/user=admin&password=&channel=4&stream=0.sdp",
    location: "Main Area",
    enabled: true,
  },
  {
    id: "cam-3",
    name: "Camera 03 - Channel 3",
    streamName: "camera_channel_3",
    rtspUrl: "rtsp://192.168.1.10:554/user=admin&password=&channel=3&stream=0.sdp",
    location: "Secondary Area",
    enabled: true,
  },
];
