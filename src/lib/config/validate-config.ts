// Isomorphic thin wrapper over scripts/validate-config.mjs. The rules live
// in that CLI so the same logic runs in dev, SSR, tests, and CI without
// duplication.
//
// This module is safe to import from server code. The `assertServerConfig`
// helper runs once per process; failing throws a plain Error so the server
// entry can surface a clear startup message instead of a generic 500.

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- .mjs sibling
import { validateConfig, renderReport } from "../../../scripts/validate-config.mjs";

export type ValidationScope = "server" | "build" | "regression" | "ci";

let cached: { ok: boolean; report: string } | null = null;

export function runConfigValidation(scope: ValidationScope = "server") {
  const env = typeof process !== "undefined" ? process.env : {};
  const result = validateConfig({ scope, env });
  return { result, report: renderReport(result) };
}

export function assertServerConfig(scope: ValidationScope = "server"): void {
  if (cached) {
    if (!cached.ok) throw new Error(cached.report);
    return;
  }
  const { result, report } = runConfigValidation(scope);
  cached = { ok: result.ok, report };
  if (!result.ok) {
    // Log the structured report before throwing so it appears in Worker logs.
    console.error(report);
    console.error("[config] Startup validation failed.");
    throw new Error("Startup configuration validation failed. See server logs for details.");
  }
  console.log("[config] Startup validation passed.");
}