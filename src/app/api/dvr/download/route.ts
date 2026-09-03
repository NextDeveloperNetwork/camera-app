import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get("file");
  if (!filePath || !filePath.startsWith("/idea0/")) {
    return new NextResponse("Invalid file path", { status: 400 });
  }

  const dvrHost = process.env.DVR_HOST || "192.168.1.10";
  const targetUrl = `http://${dvrHost}${filePath}`;

  try {
    const dvrRes = await fetch(targetUrl);
    if (!dvrRes.ok) {
      return new NextResponse("File not found on DVR", {
        status: dvrRes.status,
      });
    }

    const filename = filePath.split("/").pop() || "recording.h264";
    return new NextResponse(dvrRes.body, {
      status: 200,
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return new NextResponse("Failed to download from DVR", { status: 500 });
  }
}
