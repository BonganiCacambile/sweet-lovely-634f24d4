import { resolveSupportRecipients } from "./email-recipients.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

export type SupportEmailPayload = {
  requestId: string;
  reference: string;
  subject: string;
  message: string;
  category: string;
  orderNumber?: string | null;
  customerName: string;
  customerEmail: string;
  zoneId: string | null;
  zoneName: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(p: SupportEmailPayload) {
  const rows: Array<[string, string]> = [
    ["Reference", p.reference],
    ["Delivery zone", p.zoneName ?? "—"],
    ["Category", p.category],
    ["Customer", `${p.customerName} (${p.customerEmail})`],
  ];
  if (p.orderNumber) rows.push(["Order", p.orderNumber]);
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px">
    <h2 style="margin:0 0 4px">New support request</h2>
    <p style="margin:0 0 16px;color:#666">${escapeHtml(p.subject)}</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      ${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:4px 8px;color:#666">${escapeHtml(k)}</td><td style="padding:4px 8px"><strong>${escapeHtml(v)}</strong></td></tr>`,
        )
        .join("")}
    </table>
    <p style="margin:16px 0 4px;color:#666;font-size:13px">Message</p>
    <blockquote style="margin:0;padding:12px;border-left:3px solid #e11d48;background:#faf7f7;white-space:pre-wrap">${escapeHtml(p.message)}</blockquote>
    <p style="margin-top:20px;font-size:13px;color:#666">Open Admin → Support Requests to reply.</p>
  </div>`;
}

/**
 * Emails the main admin(s) and the delivery-zone admins about a new support
 * request. Never throws — email failure must not break the customer's
 * submission; failures are logged and reported in the return value.
 */
export async function sendSupportRequestEmail(
  p: SupportEmailPayload,
): Promise<{ sent: number; skipped?: string; error?: string }> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const resendKey = process.env["RESEND_API_KEY"];
  if (!lovableKey || !resendKey) {
    return { sent: 0, skipped: "resend_not_configured" };
  }

  // Recipients are configured per delivery zone in Admin -> Support Email Alerts.
  const to = await resolveSupportRecipients(p.zoneId);
  if (!to.length) return { sent: 0, skipped: "no_admin_recipients" };

  const from = process.env["SUPPORT_FROM_EMAIL"] || "Sweet 'n Lovely <onboarding@resend.dev>";

  try {
    const response = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({
        from,
        to,
        reply_to: p.customerEmail || undefined,
        subject: `[${p.reference}] New support request${p.zoneName ? ` — ${p.zoneName}` : ""}`,
        html: buildHtml(p),
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`[support-email] gateway failed [${response.status}]: ${body}`);
      return { sent: 0, error: `Email provider failed [${response.status}]: ${body}` };
    }
    return { sent: to.length };
  } catch (err) {
    console.error("[support-email] send failed", err);
    return { sent: 0, error: "Email send failed" };
  }
}
