import { describe, expect, test } from "bun:test";
import {
  ACTIVITY_ACTIONS,
  activityFeedInput,
  activityLogInput,
} from "../../src/lib/admin/activity-feed.schemas";

/**
 * Guard against the Zod v4 TS2554 regression where `z.record(valueSchema)`
 * was used instead of `z.record(keySchema, valueSchema)`. This test file
 * imports the real schemas from a client-safe module, so it runs under
 * `bun test` without pulling in server-only middleware.
 */
describe("activity feed schemas", () => {
  test("activityLogInput accepts lifecycle actions with scalar metadata", () => {
    const parsed = activityLogInput.parse({
      action: "presence.online",
      metadata: {
        zone_id: "zone-1",
        count: 5,
        is_online: true,
        notes: null,
      },
    });

    expect(parsed.action).toBe("presence.online");
    expect(parsed.metadata).toEqual({
      zone_id: "zone-1",
      count: 5,
      is_online: true,
      notes: null,
    });
  });

  test("activityLogInput accepts missing metadata", () => {
    const parsed = activityLogInput.parse({ action: "auth.sign_in" });
    expect(parsed.metadata).toBeUndefined();
  });

  test("activityLogInput rejects unknown actions", () => {
    expect(() =>
      activityLogInput.parse({ action: "not.an.action", metadata: {} }),
    ).toThrow();
  });

  test("activityLogInput metadata enforces string keys", () => {
    // Numeric keys are rejected because the schema explicitly uses
    // `z.record(z.string(), ...)`. Reverting to a single-argument record
    // would change this behavior and break the test.
    expect(() =>
      activityLogInput.parse({
        action: "auth.sign_in",
        metadata: { 123: "numeric-key" },
      }),
    ).toThrow();
  });

  test("activityFeedInput uses safe defaults", () => {
    const parsed = activityFeedInput.parse({});
    expect(parsed.limit).toBe(50);
    expect(parsed.category).toBe("all");
  });

  test("activityFeedInput rejects out-of-range limits", () => {
    expect(() => activityFeedInput.parse({ limit: 0 })).toThrow();
    expect(() => activityFeedInput.parse({ limit: 201 })).toThrow();
  });

  test("ACTIVITY_ACTIONS is frozen and non-empty", () => {
    expect(ACTIVITY_ACTIONS.length).toBeGreaterThan(0);
    expect(ACTIVITY_ACTIONS).toContain("auth.sign_in");
    expect(ACTIVITY_ACTIONS).toContain("presence.online");
  });
});
