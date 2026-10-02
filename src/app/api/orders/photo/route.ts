import { NextRequest, NextResponse } from "next/server";

// Server-only. Proxies a ClickUp task attachment (image) through our own
// origin instead of handing the browser a raw ClickUp attachment URL —
// those can be short-lived / single-use on workspaces with private
// attachments enabled. This route re-fetches the task fresh on every
// request and grabs whatever URL ClickUp gives it *right now*, so the
// image never depends on a URL that might already be stale by the time
// the customer's dashboard renders.

const CLICKUP_API_BASE = "https://api.clickup.com/api/v2";

type RawAttachment = {
  id: string;
  url?: string;
  url_w_host?: string;
  mimetype?: string;
};

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
    const taskRes = await fetch(`${CLICKUP_API_BASE}/task/${taskId}`, {
      headers: { Authorization: token },
      cache: "no-store",
    });
    if (!taskRes.ok) {
      return NextResponse.json({ error: "task_fetch_failed" }, { status: 502 });
    }

    const task = (await taskRes.json()) as { attachments?: RawAttachment[] };
    const attachment = task.attachments?.find((a) => a.id === attachmentId);
    const imageUrl = attachment?.url ?? attachment?.url_w_host;
    if (!imageUrl) {
      return NextResponse.json({ error: "attachment_not_found" }, { status: 404 });
    }

    const imageRes = await fetch(imageUrl, { headers: { Authorization: token }, cache: "no-store" });
    if (!imageRes.ok || !imageRes.body) {
      return NextResponse.json({ error: "image_fetch_failed" }, { status: 502 });
    }

    return new NextResponse(imageRes.body, {
      status: 200,
      headers: {
        "Content-Type": attachment?.mimetype || imageRes.headers.get("content-type") || "image/jpeg",
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
