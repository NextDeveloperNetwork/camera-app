import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import http from "http";

const RECORDINGS_DIR = path.join(process.cwd(), "public", "recordings");

if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

export async function GET(request: NextRequest) {
  const channel = request.nextUrl.searchParams.get("channel") || "1";
  const date =
    request.nextUrl.searchParams.get("date") ||
    new Date().toISOString().slice(0, 10);

  try {
    const files = fs.readdirSync(RECORDINGS_DIR);
    const clips = files
      .filter((f) => f.endsWith(".mp4") && (f.includes(`cam${channel}`) || f.includes(`cam_${channel}`)))
      .map((fileName) => {
        const stats = fs.statSync(path.join(RECORDINGS_DIR, fileName));
        const createdDate = stats.birthtime.toISOString().slice(0, 10);
        const timeStr = stats.birthtime.toTimeString().slice(0, 8);

        return {
          id: fileName,
          channel: parseInt(channel, 10),
          fileName,
          videoUrl: `/recordings/${fileName}`,
          beginTime: `${createdDate} ${timeStr}`,
          endTime: `${createdDate} ${timeStr}`,
          sizeBytes: stats.size,
          durationSec: 10,
        };
      });

    return NextResponse.json({
      success: true,
      channel: parseInt(channel, 10),
      date,
      count: clips.length,
      clips,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list recordings" },
      { status: 500 }
    );
  }
}

// POST: Trigger an instant recording of the live camera feed (e.g. 10-30 seconds)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const channel = body.channel || 1;
    const duration = Math.min(60, Math.max(5, body.duration || 10));
    const streamName = `camera_channel_${channel}`;

    const go2rtcUrl = process.env.GO2RTC_URL || "http://127.0.0.1:1984";
    const targetUrl = `${go2rtcUrl}/api/stream.mp4?src=${streamName}&duration=${duration}`;

    const now = new Date();
    const timestamp = `${now.toISOString().slice(0, 10)}_${now
      .toTimeString()
      .slice(0, 8)
      .replace(/:/g, "-")}`;
    const fileName = `cam_${channel}_${timestamp}.mp4`;
    const filePath = path.join(RECORDINGS_DIR, fileName);

    await new Promise<void>((resolve, reject) => {
      const file = fs.createWriteStream(filePath);
      const req = http.get(targetUrl, (res) => {
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(filePath);
          return reject(new Error(`go2rtc returned status ${res.statusCode}`));
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      });
      req.on("error", (err) => {
        file.close();
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        reject(err);
      });
    });

    const stats = fs.statSync(filePath);
    return NextResponse.json({
      success: true,
      clip: {
        id: fileName,
        channel,
        fileName,
        videoUrl: `/recordings/${fileName}`,
        beginTime: `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 8)}`,
        endTime: `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 8)}`,
        sizeBytes: stats.size,
        durationSec: duration,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Recording failed" },
      { status: 500 }
    );
  }
}
