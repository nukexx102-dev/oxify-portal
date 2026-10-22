// Server-only. Sends the "Forgot your order number?" email through Resend
// (resend.com, oxify.com is a verified sending domain there). RESEND_API_KEY
// must never reach the browser.

import { CONTACT } from "@/lib/portalContent";
import type { OrderReminder } from "@/lib/clickup";

const RESEND_API = "https://api.resend.com/emails";
const FROM = process.env.ORDER_EMAIL_FROM || `Oxify <${CONTACT.email}>`;
// The logo is always loaded from the live site, so it shows even when the
// email was sent from a (login-protected) preview deployment.
const LOGO_URL = `https://${CONTACT.portalUrl}/oxify-logo-white.png`;

function escapeHtml(v: string): string {
  return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// portalOrigin: where "Track my order" points (the site that sent it).
export async function sendOrderReminder(to: string, orders: OrderReminder[], portalOrigin: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set. Add it in Vercel > Settings > Environment Variables.");

  const firstName = orders.find((o) => o.firstName)?.firstName?.trim() || "there";
  const trackUrl = (orderNumber: string) => `${portalOrigin}/?order=${encodeURIComponent(orderNumber)}`;
  const intro =
    orders.length === 1
      ? "Here's the order number on file for this email:"
      : "Here are the order numbers on file for this email:";

  const orderRows = orders
    .map(
      (o) => `
          <tr><td align="center" style="padding:0 0 14px;">
            <div style="font-size:30px;line-height:1.2;font-weight:600;letter-spacing:1px;color:#ffffff;">${escapeHtml(o.orderNumber)}</div>
          </td></tr>
          <tr><td align="center" style="padding:0 0 26px;">
            <a href="${escapeHtml(trackUrl(o.orderNumber))}" style="display:inline-block;background:#cdb584;color:#0a0d14;font-size:14px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:10px;">Track my order</a>
          </td></tr>`
    )
    .join("");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>Your Oxify order number</title></head>
<body style="margin:0;padding:0;background:#06080d;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#06080d" style="background:#06080d;">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;font-family:Inter,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">
      <tr><td align="center" style="padding:0 0 28px;">
        <img src="${LOGO_URL}" width="120" alt="Oxify" style="display:block;width:120px;height:auto;border:0;">
      </td></tr>
      <tr><td bgcolor="#0d1119" style="background:#0d1119;border:1px solid #1c2230;border-radius:16px;padding:34px 28px 10px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:0 0 10px;font-size:15px;line-height:1.6;color:#eef1f5;">Hi ${escapeHtml(firstName)},</td></tr>
          <tr><td style="padding:0 0 24px;font-size:15px;line-height:1.6;color:#a9b1be;">${intro}</td></tr>
          ${orderRows}
        </table>
      </td></tr>
      <tr><td style="padding:22px 6px 0;font-size:12.5px;line-height:1.6;color:#8a93a2;">
        Didn't ask for this? You can ignore this email. Your order details are only shown to someone who has both your order number and this email address.
      </td></tr>
      <tr><td style="padding:14px 6px 0;font-size:12.5px;line-height:1.6;color:#8a93a2;">
        Questions? Call <a href="tel:${CONTACT.phoneTel}" style="color:#cdb584;text-decoration:none;">${CONTACT.phoneDisplay}</a> or email <a href="mailto:${CONTACT.email}" style="color:#cdb584;text-decoration:none;">${CONTACT.email}</a>.
      </td></tr>
      <tr><td align="center" style="padding:30px 6px 0;font-size:10.5px;letter-spacing:2px;text-transform:uppercase;color:#cdb584;">${escapeHtml(CONTACT.tagline)}</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const text = [
    `Hi ${firstName},`,
    "",
    intro,
    "",
    ...orders.map((o) => `${o.orderNumber}\nTrack my order: ${trackUrl(o.orderNumber)}\n`),
    "Didn't ask for this? You can ignore this email. Your order details are only shown to someone who has both your order number and this email address.",
    "",
    `Questions? Call ${CONTACT.phoneDisplay} or email ${CONTACT.email}.`,
    "",
    CONTACT.tagline,
  ].join("\n");

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      reply_to: CONTACT.email,
      subject: "Your Oxify order number",
      html,
      text,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}
