import type { NextConfig } from "next";

const go2rtcUrl = process.env.GO2RTC_URL || "http://127.0.0.1:1984";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      // WebSocket path for MSE player (go2rtc /api/ws)
      {
        source: "/api/stream/ws",
        destination: `${go2rtcUrl}/api/ws`,
      },
      // MJPEG stream
      {
        source: "/api/stream/stream.mjpeg",
        destination: `${go2rtcUrl}/api/stream.mjpeg`,
      },
    ];
  },
};

export default nextConfig;
