import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { fileName } = await request.json();
    if (!fileName) {
      return NextResponse.json({ error: "Missing fileName" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      fileName,
      message: "Clip selected for playback",
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Playback request failed" },
      { status: 500 }
    );
  }
}
