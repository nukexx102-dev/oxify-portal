import { NextRequest, NextResponse } from "next/server";
import { getModelPhotoSources } from "@/lib/clickup";

// Server-only. Streams the order's model photo (the "HBot Photo (model)"
// Google Drive link) through our own origin. Drive share links open a
// viewer page, not an image, and browsers often block Drive images embedded
// on other sites — fetching server-side sidesteps both. The URL always
// comes from the order's own ClickUp field, never from the request.
export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  try {
    const sources = await getModelPhotoSources(taskId);
    if (!sources) {
      return NextResponse.json({ error: "photo_not_found" }, { status: 404 });
    }

    // Try each source until one returns an actual image — Drive answers a
    // private or missing file with an HTML page, not an error status.
    for (const src of sources) {
      const res = await fetch(src, { cache: "no-store", redirect: "follow" });
      const type = res.headers.get("content-type") ?? "";
      if (res.ok && res.body && type.startsWith("image/")) {
        return new NextResponse(res.body, {
          status: 200,
          headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600" },
        });
      }
    }
    console.error("[orders/model-photo] no image at the order's link — is the Drive file shared publicly?");
    return NextResponse.json({ error: "image_unavailable" }, { status: 502 });
  } catch (err) {
    console.error("[orders/model-photo]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
