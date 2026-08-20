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

export const SUPPORT_ATTACHMENT_BUCKET = "support-attachments";
export const SUPPORT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const SUPPORT_ATTACHMENT_MAX_FILES = 5;
export const SUPPORT_ATTACHMENT_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,image/heic,application/pdf,text/plain";

const attachmentSchema = z.object({
  requestId: z.string().uuid(),
  files: z
    .array(
      z.object({
        storagePath: z.string().trim().min(1).max(400),
        fileName: z.string().trim().min(1).max(200),
        mimeType: z.string().trim().max(150).default("application/octet-stream"),
        sizeBytes: z.number().int().min(0).max(SUPPORT_ATTACHMENT_MAX_BYTES),
      }),
    )
    .min(1)
    .max(SUPPORT_ATTACHMENT_MAX_FILES),
});

/**
 * Records already-uploaded attachment objects against a support request.
 * The storage path is forced into the caller's own folder so a forged
 * payload cannot claim another user's files.
 */
export const registerSupportAttachments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => attachmentSchema.parse(d))
  .handler(async ({ data, context }) => {
    const prefix = `${context.userId}/${data.requestId}/`;
    const rows = data.files
      .filter((f) => f.storagePath.startsWith(prefix))
      .map((f) => ({
        request_id: data.requestId,
        user_id: context.userId,
        storage_path: f.storagePath,
        file_name: f.fileName,
        mime_type: f.mimeType || "application/octet-stream",
        size_bytes: f.sizeBytes,
        scan_status: "pending",
      }));
    if (rows.length === 0) return { ok: false as const, error: "No valid attachments." };
    const { error } = await context.supabase.from("support_request_attachments").insert(rows);
    if (error) {
      console.error("[support] attachment register failed", error.message);
      return { ok: false as const, error: "Could not attach your files." };
    }
    return { ok: true as const, count: rows.length };
  });

/**
 * Virus/malware scan for every not-yet-scanned attachment on one of the
 * caller's own requests. Files stay unviewable until this marks them clean;
 * anything flagged is purged from storage immediately.
 */
export const scanSupportAttachments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ requestId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Ownership check under RLS before touching the privileged client.
    const { data: own } = await context.supabase
      .from("support_requests")
      .select("id")
      .eq("id", data.requestId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!own) return { ok: false as const, error: "Support request not found." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { scanAttachmentBytes } = await import("@/lib/support/malware-scan.server");

    const { data: rows, error } = await supabaseAdmin
      .from("support_request_attachments")
      .select("id, storage_path, file_name, mime_type, scan_status")
      .eq("request_id", data.requestId)
      .in("scan_status", ["pending", "scanning"]);
    if (error) throw new Error(error.message);

    let clean = 0;
    let infected = 0;
    let failed = 0;

    for (const r of rows ?? []) {
      const path = r.storage_path as string;
      try {
        const { data: blob, error: dlErr } = await supabaseAdmin.storage
          .from(SUPPORT_ATTACHMENT_BUCKET)
          .download(path);
        if (dlErr || !blob) throw new Error(dlErr?.message ?? "download failed");

        const bytes = new Uint8Array(await blob.arrayBuffer());
        const verdict = await scanAttachmentBytes(bytes, r.file_name as string, r.mime_type as string);

        if (verdict.status === "infected") {
          infected += 1;
          await supabaseAdmin.storage.from(SUPPORT_ATTACHMENT_BUCKET).remove([path]);
        } else if (verdict.status === "clean") {
          clean += 1;
        } else {
          failed += 1;
        }

        await supabaseAdmin
          .from("support_request_attachments")
          .update({
            scan_status: verdict.status,
            scan_result: `${verdict.engine}: ${verdict.detail}`,
            scanned_at: new Date().toISOString(),
          })
          .eq("id", r.id as string);
      } catch (err) {
        failed += 1;
        console.error("[support] attachment scan failed", path, err);
        await supabaseAdmin
          .from("support_request_attachments")
          .update({
            scan_status: "error",
            scan_result: "Scan could not be completed.",
            scanned_at: new Date().toISOString(),
          })
          .eq("id", r.id as string);
      }
    }

    return { ok: true as const, scanned: (rows ?? []).length, clean, infected, failed };
  });

/**
 * Attachments for one of the caller's own requests. Signed URLs are only
 * minted for files that passed the malware scan.
 */
export const getMySupportRequestAttachments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ requestId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("support_request_attachments")
      .select("id, storage_path, file_name, mime_type, size_bytes, created_at, scan_status, scan_result")
      .eq("request_id", data.requestId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const out = [] as Array<{
      id: string; file_name: string; mime_type: string; size_bytes: number; created_at: string;
      url: string | null; scan_status: string; scan_result: string | null;
    }>;
    for (const r of rows ?? []) {
      const status = (r.scan_status as string | null) ?? "pending";
      let url: string | null = null;
      if (status === "clean") {
        const { data: signed } = await context.supabase.storage
          .from(SUPPORT_ATTACHMENT_BUCKET)
          .createSignedUrl(r.storage_path as string, 60 * 10);
        url = signed?.signedUrl ?? null;
      }
      out.push({
        id: r.id as string,
        file_name: r.file_name as string,
        mime_type: r.mime_type as string,
        size_bytes: Number(r.size_bytes ?? 0),
        created_at: r.created_at as string,
        url,
        scan_status: status,
        scan_result: (r.scan_result as string | null) ?? null,
      });
    }
    return { rows: out };
  });

