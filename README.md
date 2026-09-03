# CameraView - RTSP Surveillance Command Center

A high-performance surveillance dashboard built with **Next.js 16**, **TypeScript**, and **Tailwind CSS**, powered by **go2rtc** for ultra-low latency WebRTC/MSE streaming. Specifically designed to be self-hosted on **Docker (Proxmox)** and securely accessible remotely through a **Cloudflare Tunnel**.

---

## 🚀 Features

- **Ultra-Low Latency Streaming**: Streams local RTSP feeds over WebRTC (< 300ms delay) with instant fallback to Snapshot/MJPEG mode.
- **Zero-Transcoding CPU Overhead**: Ingests H.264/H.265 directly from your NVR/cameras at `192.168.1.10:554` and repacks them on-the-fly with <1% CPU usage on Proxmox.
- **Single Port for Cloudflare Tunnel**: Next.js internally reverse-proxies stream requests under `/api/stream/*` to the `go2rtc` container. You only need to route **one port (`3000`)** in your Cloudflare Tunnel!
- **Multi-Camera HUD Layouts**: Toggle between **Single View (1x1)**, **Dual View (1x2 Side-by-Side)**, and **Quad/Grid View (2x2)**.
- **Snapshot Capture**: Take instant, full-resolution timestamped snapshots from live streams with a single click.
- **Per-Camera Fullscreen & Audio Controls**: Expand any camera to fullscreen or toggle audio streams.
- **CCTV Watermark & Live Timecode**: Real-time telemetry, channel indicators, and digital clock overlay.
- **Dynamic Camera Configuration**: Add additional RTSP streams, customize labels, or enable/disable channels directly from the UI.

---

## 📷 Pre-Configured Cameras

The app is pre-configured for your network setup:
- **Camera 04 (Channel 4)**: `rtsp://192.168.1.10:554/user=admin&password=&channel=4&stream=0.sdp`
- **Camera 03 (Channel 3)**: `rtsp://192.168.1.10:554/user=admin&password=&channel=3&stream=0.sdp`

---

## 📁 Architecture Overview

```
                        [ Local Network: 192.168.1.x ]
                                     │
┌──────────────────────── Proxmox Docker Host ────────────────────────┐
│                                                                     │
│   [ Camera NVR ] ─── RTSP (554) ───► [ go2rtc Container ]          │
│   192.168.1.10:554                       (Port 1984)                │
│                                                │                    │
│                                                ▼                    │
│                                      [ Next.js Container ]          │
│                                            (Port 3000)              │
│                                                │                    │
└────────────────────────────────────────────────┼────────────────────┘
                                                 │
                                     [ Cloudflare Tunnel ]
                                                 │
                                                 ▼
                                     [ Remote Browser / Phone ]
```

---

## 🛠️ Quick Start (Local Development)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🐳 Deployment to Proxmox via GitHub

### Step 1: Push from your local machine to GitHub
```bash
git add .
git commit -m "feat: complete RTSP camera surveillance app with go2rtc"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

### Step 2: Clone and Start on Proxmox Docker
On your Proxmox Docker VM or LXC container:
```bash
# Clone your repository
git clone https://github.com/<your-user>/<your-repo>.git cameraview
cd cameraview

# Start containers in detached mode
docker compose up -d --build
```

Verify that both containers are running:
```bash
docker compose ps
```
You should see:
- `cameraview-web` on port `3000`
- `cameraview-go2rtc` on ports `1984`, `8555`

---

## ☁️ Cloudflare Tunnel Configuration

Because Next.js reverse-proxies `/api/stream/*` to `go2rtc` internally, setup in Cloudflare is effortless:

1. In your **Cloudflare Zero Trust Dashboard** (Access > Tunnels) or `cloudflared` CLI:
2. Add a Public Hostname route:
   - **Service Type**: `HTTP`
   - **URL**: `localhost:3000` (or `<proxmox-ip>:3000`)
   - **Additional Settings**:
     - Under **HTTP Settings**, enable **No TLS Verify** (if needed).
     - Under **Additional application settings**, ensure **WebSockets** are allowed (enabled by default).
3. Access your cameras securely anywhere in the world at `https://cameras.yourdomain.com`!

---

## ⚙️ Adding More Cameras

1. **In the Web Interface**: Click the **Settings** button in the top right to rename channels, add more cameras, or toggle them on/off.
2. **In `go2rtc.yaml`**: Add new streams directly:
   ```yaml
   streams:
     camera_channel_5:
       - "rtsp://192.168.1.10:554/user=admin&password=&channel=5&stream=0.sdp"
   ```
   Then restart the stream container: `docker compose restart stream-server`.

---

## 📜 License
MIT
