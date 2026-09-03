import type { NextConfig } from "next";

const go2rtcUrl = process.env.GO2RTC_URL || "http://127.0.0.1:1984";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/stream/:path*",
        destination: `${go2rtcUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
