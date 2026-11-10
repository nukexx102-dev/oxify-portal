import { NextRequest, NextResponse } from "next/server";
import { getOrderPhoto } from "@/lib/clickup";

// Server-only. Proxies one image from an order's "Order Photos" field
// through our own origin instead of handing the browser a raw ClickUp file
// URL — those can be short-lived. Each request looks up whatever URL
// ClickUp gives *right now*, so the image never depends on a URL that may
// already be stale by the time the customer's dashboard renders.
// getOrderPhoto only resolves files from tasks on the Oxify orders list, so
// this route can't be used to read any other ClickUp file.
export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get("taskId");
  const attachmentId = req.nextUrl.searchParams.get("attachmentId");

  if (!taskId || !attachmentId) {
    return NextResponse.json({ error: "taskId and attachmentId are both required" }, { status: 400 });
  }

  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) {
    console.error("[orders/photo] CLICKUP_API_TOKEN is not set");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  try {
    const sources = await getOrderPhoto(taskId, attachmentId);
    if (!sources) {
      return NextResponse.json({ error: "photo_not_found" }, { status: 404 });
    }

    // Only real image bytes are passed on — a Drive file that isn't shared
    // publicly answers with an HTML page, not an error status.
    for (const src of sources) {
      const res = await fetch(src.url, {
        headers: src.withClickUpToken ? { Authorization: token } : undefined,
        cache: "no-store",
        redirect: "follow",
      });
      const type = res.headers.get("content-type") ?? "";
      // ClickUp may label an uploaded file as a generic download; anything
      // else must say it's an image.
      const isImage =
        type.startsWith("image/") || (src.withClickUpToken && /^(application|binary)\/octet-stream/.test(type));
      if (res.ok && res.body && isImage) {
        return new NextResponse(res.body, {
          status: 200,
          headers: {
            "Content-Type": type.startsWith("image/") ? type : "image/jpeg",
            // Once bytes are served to the browser they're cached as the
            // final image, independent of whether the underlying URL later
            // expires — safe to cache for a while.
            "Cache-Control": "private, max-age=3600",
          },
        });
      }
    }
    console.error("[orders/photo] no image at the file's link — if it's a Drive file, is it shared publicly?");
    return NextResponse.json({ error: "image_unavailable" }, { status: 502 });
  } catch (err) {
    console.error("[orders/photo]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
