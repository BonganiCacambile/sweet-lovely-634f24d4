#!/usr/bin/env node
// Startup Configuration Validation
//
// Runs before dev/build/SSR/tests to fail fast on missing or malformed
// environment configuration. Never prints secret values — only names and
// human-readable reasons.
//
// Usage:
//   node scripts/validate-config.mjs           # validates the current env
//   node scripts/validate-config.mjs --scope=ci
//   node scripts/validate-config.mjs --scope=regression
//   node scripts/validate-config.mjs --scope=build
//
// Exit codes:
//   0  all required config present + valid
//   1  validation failed

import process from "node:process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Best-effort .env loading so local dev doesn't need extra tooling.
function loadDotEnv() {
  const envPath = resolve(__dirname, "..", ".env");
  if (!existsSync(envPath)) return;
  const contents = readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadDotEnv();

const PLACEHOLDER_PATTERNS = [
  /^undefined$/i,
  /^null$/i,
  /^changeme$/i,
  /^xxx+$/i,
  /^your[-_ ]/i,
  /^example$/i,
  /placeholder/i,
  /replace[-_ ]?me/i,
  /<.+>/,
];

function isBlank(v) {
  return v === undefined || v === null || String(v).length === 0;
}
function hasEdgeWhitespace(v) {
  return typeof v === "string" && v !== v.trim();
}
function looksLikePlaceholder(v) {
  return typeof v === "string" && PLACEHOLDER_PATTERNS.some((p) => p.test(v));
}
function isHttpsUrl(v) {
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !!u.hostname && !/localhost|127\.0\.0\.1/.test(u.hostname);
  } catch {
    return false;
  }
}
function isEmail(v) {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function isSupabaseProjectId(v) {
  return typeof v === "string" && /^[a-z0-9]{16,}$/i.test(v);
}
function isJwtLike(v) {
  return typeof v === "string" && v.split(".").length === 3 && v.length > 40;
}
function isSupabaseKey(v) {
  // Accept either legacy JWT-shaped anon/service keys or new sb_publishable_/sb_secret_ opaque keys.
  return typeof v === "string" && (isJwtLike(v) || /^sb_(publishable|secret)_/.test(v));
}
function isPaystackSecret(v) {
  return typeof v === "string" && /^sk_(test|live)_[A-Za-z0-9]{10,}$/.test(v);
}
function isPaystackPublic(v) {
  return typeof v === "string" && /^pk_(test|live)_[A-Za-z0-9]{10,}$/.test(v);
}

/**
 * A rule describes one env var. `when` gates it to a scope; `optional` allows
 * missing values but still validates format when present.
 */
function rule(name, opts) {
  return { name, ...opts };
}

const RULES = [
  // Supabase — required in every scope.
  rule("SUPABASE_URL", { format: isHttpsUrl, expected: "https://<project>.supabase.co" }),
  rule("SUPABASE_PUBLISHABLE_KEY", { format: isSupabaseKey, expected: "JWT anon key or sb_publishable_..." }),
  rule("SUPABASE_PROJECT_ID", { format: isSupabaseProjectId, expected: "alphanumeric project ref" }),

  // Service role — required on the server (SSR/CI/regression), not for pure client build.
  rule("SUPABASE_SERVICE_ROLE_KEY", {
    scopes: ["ci", "regression", "server"],
    format: isSupabaseKey,
    expected: "service role JWT or sb_secret_...",
  }),

  // Vite-exposed mirrors — required for the client bundle at build time.
  rule("VITE_SUPABASE_URL", { scopes: ["build", "ci"], format: isHttpsUrl, expected: "https://<project>.supabase.co" }),
  rule("VITE_SUPABASE_PUBLISHABLE_KEY", { scopes: ["build", "ci"], format: isSupabaseKey }),
  rule("VITE_SUPABASE_PROJECT_ID", { scopes: ["build", "ci"], format: isSupabaseProjectId }),

  // Paystack.
  rule("PAYSTACK_SECRET_KEY", { scopes: ["ci", "regression", "server"], format: isPaystackSecret, expected: "sk_test_... or sk_live_..." }),
  rule("PAYSTACK_PUBLIC_KEY", { optional: true, format: isPaystackPublic, expected: "pk_test_... or pk_live_..." }),

  // Regression admin auth.
  rule("ADMIN_EMAIL", { scopes: ["regression", "ci"], format: isEmail, expected: "user@example.com" }),
  rule("ADMIN_PASSWORD", {
    scopes: ["regression", "ci"],
    format: (v) => typeof v === "string" && v.length >= 8,
    expected: "min 8 characters",
  }),

  // Optional preview/prod cross-env targets used by RLS regression.
  rule("PREVIEW_SUPABASE_URL", { optional: true, format: isHttpsUrl }),
  rule("PREVIEW_SUPABASE_PUBLISHABLE_KEY", { optional: true, format: isSupabaseKey }),
  rule("PREVIEW_SUPABASE_SERVICE_ROLE_KEY", { optional: true, format: isSupabaseKey }),
  rule("PROD_SUPABASE_URL", { optional: true, format: isHttpsUrl }),
  rule("PROD_SUPABASE_PUBLISHABLE_KEY", { optional: true, format: isSupabaseKey }),
  rule("PROD_SUPABASE_SERVICE_ROLE_KEY", { optional: true, format: isSupabaseKey }),
];

export function validateConfig({ scope = "server", env = process.env } = {}) {
  const missing = [];
  const invalid = [];
  const checked = [];

  for (const r of RULES) {
    const applies = r.optional || !r.scopes || r.scopes.includes(scope) || scope === "ci";
    if (!applies && !r.optional) continue;

    const raw = env[r.name];
    if (isBlank(raw)) {
      if (r.optional || (r.scopes && !r.scopes.includes(scope) && scope !== "ci")) continue;
      missing.push(r.name);
      continue;
    }
    checked.push(r.name);
    if (hasEdgeWhitespace(raw)) {
      invalid.push({ name: r.name, reason: "value has leading/trailing whitespace" });
      continue;
    }
    if (looksLikePlaceholder(raw)) {
      invalid.push({ name: r.name, reason: "value looks like a placeholder", expected: r.expected });
      continue;
    }
    if (r.format && !r.format(raw)) {
      invalid.push({ name: r.name, reason: "value has wrong format", expected: r.expected });
    }
  }

  return { ok: missing.length === 0 && invalid.length === 0, missing, invalid, checked, scope };
}

export function renderReport(result) {
  const lines = [];
  lines.push("==========================================");
  lines.push(result.ok ? "Startup Configuration Validation Passed" : "Startup Configuration Validation Failed");
  lines.push("==========================================");
  lines.push(`Scope: ${result.scope}`);
  lines.push(`Checked: ${result.checked.length} variable(s)`);
  if (result.missing.length) {
    lines.push("");
    lines.push("Missing Variables:");
    for (const n of result.missing) lines.push(`  \u2716 ${n}`);
  }
  if (result.invalid.length) {
    lines.push("");
    lines.push("Invalid Variables:");
    for (const i of result.invalid) {
      lines.push(`  \u2716 ${i.name}`);
      lines.push(`      Reason: ${i.reason}`);
      if (i.expected) lines.push(`      Expected: ${i.expected}`);
    }
  }
  if (!result.ok) {
    lines.push("");
    lines.push("Application startup has been stopped.");
    lines.push("Please configure the missing environment variables before continuing.");
  }
  return lines.join("\n");
}

// CLI entry.
if (import.meta.url === `file://${process.argv[1]}`) {
  const scopeArg = process.argv.find((a) => a.startsWith("--scope="));
  const scope = scopeArg ? scopeArg.split("=")[1] : process.env.CONFIG_VALIDATION_SCOPE || "server";
  const soft = process.argv.includes("--soft");

  console.log("[config] Checking configuration...");
  console.log("[config] Validating environment variables...");
  console.log(`[config] Scope: ${scope}`);
  const result = validateConfig({ scope });
  const report = renderReport(result);
  if (result.ok) {
    console.log(report);
    console.log("[config] Startup validation passed.");
    process.exit(0);
  }
  console.error(report);
  console.error("[config] Startup validation failed.");
  if (soft) process.exit(0);
  process.exit(1);
}