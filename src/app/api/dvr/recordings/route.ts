import { NextRequest, NextResponse } from "next/server";
import { queryDvrFiles } from "@/lib/dvrClient";

export async function GET(request: NextRequest) {
  const channelParam = request.nextUrl.searchParams.get("channel") || "1";
  const dateParam =
    request.nextUrl.searchParams.get("date") ||
    new Date().toISOString().slice(0, 10);

  const channel = parseInt(channelParam, 10);

  try {
    const files = await queryDvrFiles(channel, dateParam);
    return NextResponse.json({
      success: true,
      channel,
      date: dateParam,
      count: files.length,
      recordings: files,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to query DVR",
      },
      { status: 500 }
    );
  }
}
