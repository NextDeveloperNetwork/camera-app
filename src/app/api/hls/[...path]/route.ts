import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy route: /api/hls/[...path] → MediaMTX HLS server
 *
 * MediaMTX serves HLS on port 8888 with URLs like:
 *   http://stream-server:8888/{streamName}/index.m3u8
 *   http://stream-server:8888/{streamName}/seg0001.mp4
 *   http://stream-server:8888/{streamName}/seg0001.mp4  (LL-HLS parts)
 *
 * We proxy all these transparently so the browser never knows about port 8888.
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const getMediaMtxUrl = (): string =>
  (process.env.MEDIAMTX_URL || "http://127.0.0.1:8888").replace(/\/$/, "");

let isSpawning = false;
function autoStartWindowsMediaMtx() {
  if (process.platform !== "win32" || isSpawning) return;
  const exePath = path.join(process.cwd(), "mediamtx.exe");
  const configPath = path.join(process.cwd(), "mediamtx.yml");
  if (fs.existsSync(exePath)) {
    isSpawning = true;
    try {
      const child = spawn(exePath, [configPath], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      console.log("[MediaMTX] Auto-started local mediamtx.exe process");
    } catch (e) {
      console.warn("[MediaMTX] Could not auto-start mediamtx.exe:", e);
    }
    setTimeout(() => {
      isSpawning = false;
    }, 5000);
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const pathStr = path.join("/");
  const search = request.nextUrl.search || "";
  const targetUrl = `${getMediaMtxUrl()}/${pathStr}${search}`;

  const forwardHeaders: Record<string, string> = {
    accept: request.headers.get("accept") || "*/*",
    "user-agent": "NextJS-HLS-Proxy/1.0",
  };

  const cookie = request.headers.get("cookie");
  if (cookie) forwardHeaders["cookie"] = cookie;

  const range = request.headers.get("range");
  if (range) forwardHeaders["range"] = range;

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method: "GET",
      headers: forwardHeaders,
      // No timeout — segments stream continuously
      cache: "no-store",
    });
  } catch (err: unknown) {
    autoStartWindowsMediaMtx();
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[HLS Proxy] Cannot reach MediaMTX at ${targetUrl}: ${msg}`);
    return NextResponse.json(
      {
        error: "STREAM_SERVER_UNREACHABLE",
        target: targetUrl,
        hint: "Starting MediaMTX. Please wait a moment...",
      },
      { status: 503 }
    );
  }

  if (!upstream.ok && upstream.status !== 206) {
    console.warn(`[HLS Proxy] Upstream ${upstream.status} for ${targetUrl}`);
  }

  // Copy relevant response headers
  const responseHeaders = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) responseHeaders.set("content-type", ct);

  const contentRange = upstream.headers.get("content-range");
  if (contentRange) responseHeaders.set("content-range", contentRange);

  const acceptRanges = upstream.headers.get("accept-ranges");
  if (acceptRanges) responseHeaders.set("accept-ranges", acceptRanges);

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) responseHeaders.set("content-length", contentLength);

  const setCookie = upstream.headers.get("set-cookie");
  if (setCookie) responseHeaders.set("set-cookie", setCookie);

  // Never cache — live stream segments change constantly
  responseHeaders.set("cache-control", "no-cache, no-store, must-revalidate");
  responseHeaders.set("access-control-allow-origin", "*");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
