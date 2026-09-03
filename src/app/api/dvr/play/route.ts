import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { fileName } = await request.json();
    if (!fileName || !fileName.startsWith("/idea0/")) {
      return NextResponse.json({ error: "Invalid fileName" }, { status: 400 });
    }

    const dvrHost = process.env.DVR_HOST || "192.168.1.10";
    const fileHttpUrl = `http://${dvrHost}${fileName}`;
    const go2rtcUrl = process.env.GO2RTC_URL || "http://127.0.0.1:1984";

    // Register or update playback_active in go2rtc
    const go2rtcRes = await fetch(
      `${go2rtcUrl}/api/streams?name=playback_active&src=${encodeURIComponent(
        fileHttpUrl
      )}`,
      { method: "PUT" }
    );

    if (!go2rtcRes.ok) {
      return NextResponse.json(
        { error: "Failed to register playback stream in go2rtc" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      streamName: "playback_active",
      fileUrl: fileHttpUrl,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Playback request failed",
      },
      { status: 500 }
    );
  }
}
