import { z } from "zod";

/**
 * Lifecycle activity types emitted by the admin shell. Persisted to
 * `audit_logs` so the Main Admin's Employee Activity Feed sees a single
 * unified stream of sign-in/out, presence transitions, AND business
 * actions (inventory/orders) that already go through `logAudit`.
 */
export const ACTIVITY_ACTIONS = [
  "auth.sign_in",
  "auth.sign_out",
  "presence.active",
  "presence.idle",
  "presence.away",
  "presence.online",
  "presence.offline",
] as const;

/**
 * Zod v4 requires `z.record(keySchema, valueSchema)`. Keeping the key schema
 * explicit prevents the TS2554 "Expected 2-3 arguments, but got 1" regression
 * if someone rewrites this as `z.record(valueSchema)`.
 */
export const activityLogInput = z.object({
  action: z.enum(ACTIVITY_ACTIONS),
  metadata: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()]),
  ).optional(),
});

export const activityFeedInput = z.object({
  limit: z.number().int().min(1).max(200).optional().default(50),
  category: z.enum(["all", "lifecycle", "orders", "inventory"]).optional().default("all"),
});

export type ActivityLogInput = z.infer<typeof activityLogInput>;
export type ActivityFeedInput = z.infer<typeof activityFeedInput>;
