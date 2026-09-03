import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_CAMERAS } from "@/lib/types";

const getGo2RtcUrl = () => {
  return process.env.GO2RTC_URL || "http://127.0.0.1:1984";
};

// Ensure a camera stream exists in go2rtc
async function ensureStreamRegistered(src: string, baseUrl: string) {
  const cam = DEFAULT_CAMERAS.find((c) => c.streamName === src);
  if (cam && cam.rtspUrl) {
    try {
      await fetch(
        `${baseUrl}/api/streams?name=${encodeURIComponent(
          src
        )}&src=${encodeURIComponent(cam.rtspUrl)}`,
        { method: "PUT" }
      );
    } catch (e) {
      console.warn(`Failed to auto-register stream ${src} in go2rtc:`, e);
    }
  }
}

// Handle all GET requests (snapshots, streams, status)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  const path = resolvedParams.path.join("/");
  const searchParams = request.nextUrl.searchParams.toString();
  const src = request.nextUrl.searchParams.get("src");
  const baseUrl = getGo2RtcUrl();
  const targetUrl = `${baseUrl}/api/${path}${searchParams ? `?${searchParams}` : ""}`;

  try {
    let response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        accept: request.headers.get("accept") || "*/*",
      },
      cache: "no-store",
    });

    // If stream not found (404), auto-register in go2rtc and retry
    if (response.status === 404 && src) {
      await ensureStreamRegistered(src, baseUrl);
      response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          accept: request.headers.get("accept") || "*/*",
        },
        cache: "no-store",
      });
    }

    if (!response.ok) {
      return new NextResponse(response.body, {
        status: response.status,
        headers: {
          "content-type": response.headers.get("content-type") || "text/plain",
          "cache-control": "no-store",
        },
      });
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    return new NextResponse(response.body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "no-store",
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: "GO2RTC_UNREACHABLE",
        message: `go2rtc streaming bridge at ${baseUrl} is not currently running or unreachable.`,
      },
      { status: 503 }
    );
  }
}

// Handle all POST requests (WebRTC WHEP SDP negotiation)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  const path = resolvedParams.path.join("/");
  const searchParams = request.nextUrl.searchParams.toString();
  const src = request.nextUrl.searchParams.get("src");
  const baseUrl = getGo2RtcUrl();
  const targetUrl = `${baseUrl}/api/${path}${searchParams ? `?${searchParams}` : ""}`;

  try {
    const body = await request.text();

    // Auto-register stream in go2rtc before connection if missing
    if (src) {
      await ensureStreamRegistered(src, baseUrl);
    }

    let response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "content-type": request.headers.get("content-type") || "application/sdp",
      },
      body,
      cache: "no-store",
    });

    // If 404, force re-register and retry
    if (response.status === 404 && src) {
      await ensureStreamRegistered(src, baseUrl);
      response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "content-type": request.headers.get("content-type") || "application/sdp",
        },
        body,
        cache: "no-store",
      });
    }

    const responseText = await response.text();
    return new NextResponse(responseText, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || "application/sdp",
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: "GO2RTC_UNREACHABLE",
        message: `go2rtc streaming bridge at ${baseUrl} is not currently running or unreachable.`,
      },
      { status: 503 }
    );
  }
}
