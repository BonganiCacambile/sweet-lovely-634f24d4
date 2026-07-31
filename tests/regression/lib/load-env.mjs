/**
 * Shared environment loader + validator for the regression suite.
 *
 * Loads .env / .env.local (local dev convenience) without overriding values
 * already present in the process environment (CI, preview, production), then
 * validates the vars a suite declares as required. Never prints secret values.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function loadFile(name) {
  const p = resolve(ROOT, name);
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

let loaded = false;
export function loadEnvFiles() {
  if (loaded) return;
  loaded = true;
  loadFile(".env");
  loadFile(".env.local");
}

const FIXES = {
  SUPABASE_URL:
    "Set it to https://<project-ref>.supabase.co (Supabase Dashboard -> Project Settings -> API).",
  SUPABASE_PUBLISHABLE_KEY:
    "Copy the anon / publishable key from Supabase Dashboard -> Project Settings -> API.",
  SUPABASE_SERVICE_ROLE_KEY: [
    "Copy the service_role key from Supabase Dashboard -> Project Settings -> API.",
    "It is required so the suite can create and delete temporary test users.",
    "  • Local dev:      add SUPABASE_SERVICE_ROLE_KEY=... to .env (git-ignored)",
    "  • GitHub Actions: Settings -> Secrets and variables -> Actions -> SUPABASE_SERVICE_ROLE_KEY",
    "  • Preview:        PREVIEW_SUPABASE_SERVICE_ROLE_KEY (falls back to SUPABASE_SERVICE_ROLE_KEY)",
    "  • Production:     PROD_SUPABASE_SERVICE_ROLE_KEY",
    "The key is used ONLY for setup/teardown — every assertion runs through the",
    "publishable key so RLS is enforced exactly as in production.",
  ].join("\n"),
};

function looksLikeKey(v) {
  return v.split(".").length === 3 || /^sb_(publishable|secret)_/.test(v);
}

/**
 * @param {string[]} names required env var names
 * @param {{ suite?: string }} [opts]
 * @returns {Record<string,string>}
 */
export function requireEnv(names, { suite = "regression" } = {}) {
  loadEnvFiles();
  const missing = [];
  const invalid = [];
  const out = {};
  for (const name of names) {
    const raw = process.env[name];
    if (!raw || !raw.trim()) {
      missing.push(name);
      continue;
    }
    if (raw !== raw.trim()) invalid.push([name, "has leading/trailing whitespace"]);
    else if (name.endsWith("_KEY") && !looksLikeKey(raw))
      invalid.push([name, "does not look like a Supabase API key"]);
    else if (name.endsWith("_URL") && !/^https:\/\//.test(raw))
      invalid.push([name, "must be an https:// URL"]);
    out[name] = raw;
  }

  if (missing.length || invalid.length) {
    const lines = [
      "",
      "==========================================",
      `Regression Configuration Error (${suite})`,
      "==========================================",
    ];
    if (missing.length) {
      lines.push("", "Missing required environment variables:");
      for (const n of missing) {
        lines.push(`  ✖ ${n}`);
        if (FIXES[n]) lines.push(...FIXES[n].split("\n").map((l) => `      ${l}`));
      }
    }
    if (invalid.length) {
      lines.push("", "Invalid environment variables:");
      for (const [n, reason] of invalid) lines.push(`  ✖ ${n} — ${reason}`);
    }
    lines.push("", "The suite was stopped before running any test.", "");
    console.error(lines.join("\n"));
    process.exit(2);
  }
  return out;
}
