import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertStorageFileAccess } from "@/lib/file-access.server";
import { readStoredFile } from "@/lib/object-storage.server";

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const session = await getSession();
  if (!session?.seatId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const storageKey = params.path.join("/");
  const access = await assertStorageFileAccess(session.seatId, storageKey);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const file = await readStoredFile(storageKey);
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const total = file.buffer.length;
  const headers: Record<string, string> = {
    "Content-Type": file.contentType,
    "Cache-Control": "private, max-age=3600",
    "Accept-Ranges": "bytes",
  };

  // Safari/iOS воспроизводит видео только при поддержке Range-запросов.
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && total > 0) {
    let start = range[1] ? Number(range[1]) : NaN;
    let end = range[2] ? Number(range[2]) : total - 1;
    if (Number.isNaN(start)) {
      start = Math.max(0, total - end);
      end = total - 1;
    }
    end = Math.min(end, total - 1);
    if (start > end || start >= total) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
    }
    return new NextResponse(new Uint8Array(file.buffer.subarray(start, end + 1)), {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: { ...headers, "Content-Length": String(total) },
  });
}
