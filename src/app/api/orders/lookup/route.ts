import { NextRequest, NextResponse } from "next/server";
import { lookupOrder, getDashboardData } from "@/lib/clickup";
import { isRateLimited, clientIp } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  // Order number + email is much harder to brute-force than order number
  // alone, but there's still no real cost to guessing — this blunts a
  // scripted enumeration attempt without affecting a real customer
  // double-checking a typo a couple of times.
  if (isRateLimited(clientIp(req))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const orderNumber = typeof body?.orderNumber === "string" ? body.orderNumber.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!orderNumber || !email) {
    return NextResponse.json(
      { error: "Order number and email are both required." },
      { status: 400 }
    );
  }

  try {
    const order = await lookupOrder(orderNumber, email);
    if (!order) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const dashboard = await getDashboardData(order);
    return NextResponse.json(dashboard);
  } catch (err) {
    console.error("[orders/lookup]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
