import { createFileRoute } from "@tanstack/react-router";
import {
  AUDIT_RETENTION_GROUP,
  DEFAULT_RETENTION,
  purgeReplyAudit,
  settingsFromRows,
} from "@/lib/admin/audit-retention.server";

/**
 * Scheduled cleanup endpoint for reply-audit retention.
 * Call with header `x-cleanup-token: <AUDIT_CLEANUP_TOKEN>` from pg_cron or
 * any external scheduler. Does nothing unless retention is enabled in
 * Admin -> Audit Retention.
 */
export const Route = createFileRoute("/api/public/audit-retention-cleanup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["AUDIT_CLEANUP_TOKEN"];
        if (!expected) return new Response("Cleanup token not configured", { status: 503 });
        const provided = request.headers.get("x-cleanup-token") ?? "";
        if (provided.length !== expected.length || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("system_settings")
          .select("key, value")
          .eq("group_key", AUDIT_RETENTION_GROUP);
        if (error) return new Response(error.message, { status: 500 });

        const settings = (data ?? []).length ? settingsFromRows(data ?? []) : DEFAULT_RETENTION;
        if (!settings.enabled) {
          return Response.json({ ok: true, skipped: "retention disabled" });
        }

        const result = await purgeReplyAudit({
          retentionDays: settings.retentionDays,
          keepCustomerReplies: settings.keepCustomerReplies,
          source: "scheduled",
        });
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
