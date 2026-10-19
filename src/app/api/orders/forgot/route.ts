import { NextRequest, NextResponse, after } from "next/server";
import { findOrdersByEmail } from "@/lib/clickup";
import { sendOrderReminder } from "@/lib/orderReminderEmail";
import { isRateLimited, clientIp } from "@/lib/rateLimit";

const HOUR = 60 * 60 * 1000;

// "Forgot your order number?" — emails the order number(s) on file to the
// address the customer typed. The answer is always the same ("if that email
// is on an order, we've sent it"), and the lookup + send run after the
// response, so the page can't be used to learn who is an Oxify customer.
export async function POST(req: NextRequest) {
  // Per device: blunts someone trying a list of addresses.
  if (isRateLimited(`forgot-ip:${clientIp(req)}`, { max: 10, windowMs: HOUR })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  // Per address: nobody can flood a customer's inbox. Over the limit we
  // still answer "sent" — the customer already has the earlier emails.
  if (!isRateLimited(`forgot-email:${email}`, { max: 3, windowMs: HOUR })) {
    const portalOrigin = req.nextUrl.origin;
    after(async () => {
      try {
        const orders = await findOrdersByEmail(email);
        if (orders.length > 0) await sendOrderReminder(email, orders, portalOrigin);
      } catch (err) {
        console.error("[orders/forgot]", err);
      }
    });
  }

  return NextResponse.json({ ok: true });
}
