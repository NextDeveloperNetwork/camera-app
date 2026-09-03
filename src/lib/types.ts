export type StreamMode = "webrtc" | "mse" | "mjpeg" | "hls";

export type GridLayout = "auto" | "1x1" | "1x2" | "2x2";

export interface CameraConfig {
  id: string;
  name: string;
  streamName: string;
  subStreamName?: string;
  rtspUrl: string;
  location?: string;
  enabled: boolean;
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
    subStreamName: "camera_channel_1_sub",
    rtspUrl: "rtsp://192.168.1.10:554/user=admin&password=&channel=1&stream=0.sdp#transport=tcp",
    location: "Main Entrance",
    enabled: true,
  },
  {
    id: "cam-2",
    name: "Camera 02 - Channel 2",
    streamName: "camera_channel_2",
    subStreamName: "camera_channel_2_sub",
    rtspUrl: "rtsp://192.168.1.10:554/user=admin&password=&channel=2&stream=0.sdp#transport=tcp",
    location: "Parking Lot",
    enabled: true,
  },
  {
    id: "cam-3",
    name: "Camera 03 - Channel 3",
    streamName: "camera_channel_3",
    subStreamName: "camera_channel_3_sub",
    rtspUrl: "rtsp://192.168.1.10:554/user=admin&password=&channel=3&stream=0.sdp#transport=tcp",
    location: "Warehouse / Arch",
    enabled: true,
  },
  {
    id: "cam-4",
    name: "Camera 04 - Channel 4",
    streamName: "camera_channel_4",
    subStreamName: "camera_channel_4_sub",
    rtspUrl: "rtsp://192.168.1.10:554/user=admin&password=&channel=4&stream=0.sdp#transport=tcp",
    location: "Driveway",
    enabled: true,
  },
];
