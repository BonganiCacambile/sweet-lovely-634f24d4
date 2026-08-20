import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SUPPORT_CATEGORIES = [
  { value: "order_issue", label: "Order issue" },
  { value: "delivery", label: "Delivery" },
  { value: "food_quality", label: "Food quality" },
  { value: "payment", label: "Payment / refund" },
  { value: "account", label: "Account" },
  { value: "general", label: "General enquiry" },
] as const;

const CATEGORY_VALUES = SUPPORT_CATEGORIES.map((c) => c.value) as [string, ...string[]];

const supportSchema = z.object({
  subject: z.string().trim().min(1).max(140),
  category: z.enum(CATEGORY_VALUES).default("general"),
  orderNumber: z.string().trim().max(60).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().min(1).max(1000),
});

/**
 * Customer-facing complaint / support submission.
 *
 * The delivery zone is NEVER taken from the request payload: it is resolved
 * server-side from the authenticated customer's currently selected zone
 * (profiles.selected_zone_id) and validated against the live delivery_zones
 * records. Anonymous submissions are rejected by the auth middleware.
 */
export const submitSupportRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => supportSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: profile, error: profErr } = await context.supabase
      .from("profiles")
      .select("full_name, phone, selected_zone_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (profErr) throw new Error(profErr.message);

    const zoneId = (profile?.selected_zone_id as string | null) ?? null;
    if (!zoneId) {
      return { ok: false as const, code: "no_zone" as const, error: "Please select a delivery zone before submitting a support request." };
    }
    const { data: zone } = await context.supabase
      .from("delivery_zones")
      .select("id, name, is_active")
      .eq("id", zoneId)
      .maybeSingle();
    if (!zone || zone.is_active === false) {
      return { ok: false as const, code: "no_zone" as const, error: "Your selected delivery zone is no longer available. Please choose another zone." };
    }

    const email = (context.claims?.email as string | undefined) ?? "";
    const { data: row, error } = await context.supabase
      .from("support_requests")
      .insert({
        user_id: context.userId,
        delivery_zone_id: zone.id,
        name: (profile?.full_name as string | null) || email.split("@")[0] || "Customer",
        email,
        phone: data.phone ? data.phone : ((profile?.phone as string | null) ?? null),
        subject: data.subject,
        category: data.category,
        order_number: data.orderNumber ? data.orderNumber : null,
        message: data.message,
        status: "open",
        priority: "normal",
        source: "contact_form",
      })
      .select("id, reference, delivery_zone_id")
      .single();

    if (error) {
      console.error("[support] failed to store request", error.message);
      return { ok: false as const, code: "failed" as const, error: "Could not save your message. Please try again." };
    }
    return {
      ok: true as const,
      id: row.id as string,
      reference: row.reference as string,
      zoneName: zone.name as string,
    };
  });

/** The signed-in customer's own support requests (RLS scoped to auth.uid()). */
export const getMySupportRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("support_requests")
      .select(
        "id, reference, subject, category, message, order_number, status, priority, created_at, updated_at, resolution, resolved_at, delivery_zone_id, delivery_zones(name)",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id as string,
      reference: r.reference as string,
      subject: r.subject as string,
      category: r.category as string,
      message: r.message as string,
      order_number: r.order_number as string | null,
      status: r.status as string,
      priority: r.priority as string,
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      resolution: r.resolution as string | null,
      resolved_at: r.resolved_at as string | null,
      zone_name: (r as { delivery_zones?: { name: string } | null }).delivery_zones?.name ?? null,
    }));
  });

/** Replies visible to the customer — internal notes are excluded by RLS and here. */
export const getMySupportRequestReplies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ requestId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("support_request_replies")
      .select("id, body, created_at, is_internal")
      .eq("request_id", data.requestId)
      .eq("is_internal", false)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []).map((r) => ({ id: r.id as string, body: r.body as string, created_at: r.created_at as string })) };
  });
