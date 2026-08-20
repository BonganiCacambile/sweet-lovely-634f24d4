export type SupportReplyTemplate = {
  id: string;
  label: string;
  description: string;
  body: string;
};

/** Placeholders: {{name}}, {{email}}, {{reference}} */
export const SUPPORT_REPLY_TEMPLATES: SupportReplyTemplate[] = [
  {
    id: "acknowledge",
    label: "Acknowledge",
    description: "Confirm we received the request",
    body:
      "Hi {{name}},\n\nThanks for reaching out to Sweet 'n Lovely. We've received your message (ref {{reference}}) and our team is looking into it now. We'll get back to you shortly.\n\nWarm regards,\nSweet 'n Lovely Support",
  },
  {
    id: "order-issue",
    label: "Order issue",
    description: "Investigating an order problem",
    body:
      "Hi {{name}},\n\nWe're sorry your order didn't go as planned. We're checking the details with the kitchen and delivery team and will confirm the outcome as soon as we have it (ref {{reference}}).\n\nWarm regards,\nSweet 'n Lovely Support",
  },
  {
    id: "refund",
    label: "Refund approved",
    description: "Confirm a refund is on the way",
    body:
      "Hi {{name}},\n\nWe've approved a refund for your order. Depending on your bank it can take 3-5 working days to reflect on {{email}}. Ref {{reference}}.\n\nApologies for the inconvenience,\nSweet 'n Lovely Support",
  },
  {
    id: "need-info",
    label: "Need more info",
    description: "Ask for extra details",
    body:
      "Hi {{name}},\n\nThanks for your message. To help us resolve this quickly, could you please reply with your order number and the date/time of the order?\n\nThanks,\nSweet 'n Lovely Support",
  },
  {
    id: "resolved",
    label: "Resolved",
    description: "Close the request politely",
    body:
      "Hi {{name}},\n\nGood news - your request (ref {{reference}}) has been resolved. If anything else comes up, just reply here and we'll be happy to help.\n\nEnjoy your next slice,\nSweet 'n Lovely Support",
  },
];

export function renderSupportTemplate(
  template: SupportReplyTemplate,
  vars: { name?: string | null; email?: string | null; reference?: string | null },
): string {
  return template.body
    .replaceAll("{{name}}", (vars.name ?? "there").trim() || "there")
    .replaceAll("{{email}}", vars.email ?? "your email address")
    .replaceAll("{{reference}}", (vars.reference ?? "").slice(0, 8) || "n/a");
}
