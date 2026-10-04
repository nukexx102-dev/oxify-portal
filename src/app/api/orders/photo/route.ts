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
    const photo = await getOrderPhoto(taskId, attachmentId);
    if (!photo) {
      return NextResponse.json({ error: "photo_not_found" }, { status: 404 });
    }

    const imageRes = await fetch(photo.url, { headers: { Authorization: token }, cache: "no-store" });
    if (!imageRes.ok || !imageRes.body) {
      return NextResponse.json({ error: "image_fetch_failed" }, { status: 502 });
    }

    return new NextResponse(imageRes.body, {
      status: 200,
      headers: {
        "Content-Type": photo.mimetype || imageRes.headers.get("content-type") || "image/jpeg",
        // Once bytes are served to the browser they're cached as the final
        // image, independent of whether ClickUp's underlying URL later
        // expires — safe to cache for a while.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[orders/photo]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
