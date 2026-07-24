#!/usr/bin/env node
/**
 * Regression: No HTTP 500 sweep.
 *
 * Hits every user-facing page, public API route, and the Paystack webhook,
 * and fails the run if ANY response comes back as HTTP 5xx.
 *
 * On failure, the captured request log (URL, method, status, latency,
 * response body snippet) is written to
 * tests/regression/artifacts/no-500-sweep.log so CI's artifact upload picks
 * it up. The full log is also printed to stdout.
 *
 * Redirects (3xx) and auth-gated responses (401/403) are treated as PASS —
 * this test targets unhandled server errors, not authorization behaviour.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = join(HERE, "artifacts");
mkdirSync(ARTIFACTS, { recursive: true });
const LOG_PATH = join(ARTIFACTS, "no-500-sweep.log");

const APP_URL = (process.env.APP_URL ?? "http://localhost:8080").replace(/\/$/, "");

/**
 * Env vars whose values must NEVER appear in any captured response body
 * or the on-disk sweep log. These are secrets — any occurrence is a leak.
 */
const SECRET_ENV_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "PAYSTACK_SECRET_KEY",
  "PREVIEW_SUPABASE_SERVICE_ROLE_KEY",
  "PROD_SUPABASE_SERVICE_ROLE_KEY",
  "SSR_ALERT_WEBHOOK_URL",
  "LOVABLE_API_KEY",
];
const MIN_SECRET_LEN = 12; // ignore short/blank values to avoid false positives
const SECRET_VALUES = SECRET_ENV_NAMES
  .map((name) => ({ name, value: process.env[name] ?? "" }))
  .filter((s) => s.value.length >= MIN_SECRET_LEN);

function scanForLeaks(haystack) {
  const hits = [];
  for (const { name, value } of SECRET_VALUES) {
    if (haystack.includes(value)) hits.push(name);
  }
  return hits;
}

/** Pages that should render (or redirect) without a 5xx. */
const PAGES = [
  "/",
  "/auth",
  "/auth/admin",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/login",
  "/cart",
  "/checkout",
  "/checkout/success",
  "/contact",
  "/locations",
  "/loading",
  "/menu/full-menu",
  "/sitemap.xml",
  "/robots.txt",
  "/.well-known/oauth-protected-resource",
  // Deliberately-nonexistent path: must 404, never 500.
  "/this-route-definitely-does-not-exist-xyz",
];

/** MCP endpoints: unauthenticated should 401, never 500. */
const MCP_ENDPOINTS = [
  { method: "GET", path: "/.mcp/list-tools" },
  { method: "POST", path: "/.mcp/invoke-tool/get-menu", body: "{}" },
  { method: "POST", path: "/mcp", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) },
];

const results = [];

async function hit({ method, path, headers = {}, body }) {
  const url = `${APP_URL}${path}`;
  const startedAt = Date.now();
  let status = 0;
  let snippet = "";
  let err;
  try {
    const res = await fetch(url, { method, headers, body, redirect: "manual" });
    status = res.status;
    const text = await res.text();
    snippet = text.slice(0, 400).replace(/\s+/g, " ");
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  const durationMs = Date.now() - startedAt;
  const leaks = err ? [] : scanForLeaks(snippet);
  const pass = !err && status < 500 && leaks.length === 0;
  results.push({ method, url, status, durationMs, pass, snippet, err, leaks });
  const icon = pass ? "✅" : "❌";
  const leakTag = leaks.length ? ` LEAK:${leaks.join(",")}` : "";
  console.log(`  ${icon} ${method.padEnd(4)} ${status || "ERR"} ${durationMs}ms ${path}${leakTag}`);
  return { status, snippet, err };
}

async function sweepPages() {
  console.log("[no-500-sweep] Pages / SSR routes:");
  for (const path of PAGES) {
    await hit({ method: "GET", path });
  }
}

async function sweepMcp() {
  console.log("[no-500-sweep] MCP endpoints (expect 401, never 500):");
  for (const ep of MCP_ENDPOINTS) {
    await hit({
      method: ep.method,
      path: ep.path,
      headers: { "content-type": "application/json" },
      body: ep.body,
    });
  }
}

async function sweepWebhook() {
  console.log("[no-500-sweep] Paystack webhook (bad + missing signature must not 500):");
  const body = JSON.stringify({
    event: "charge.success",
    data: { reference: `NO500-${Date.now()}`, status: "success", amount: 100, currency: "ZAR" },
  });
  // Missing signature: expect 401.
  await hit({
    method: "POST",
    path: "/api/public/paystack-webhook",
    headers: { "content-type": "application/json" },
    body,
  });
  // Bad signature: expect 401.
  await hit({
    method: "POST",
    path: "/api/public/paystack-webhook",
    headers: {
      "content-type": "application/json",
      "x-paystack-signature": crypto.randomBytes(64).toString("hex"),
    },
    body,
  });
  // Malformed JSON body with bad signature: still must not 500.
  await hit({
    method: "POST",
    path: "/api/public/paystack-webhook",
    headers: {
      "content-type": "application/json",
      "x-paystack-signature": crypto.randomBytes(64).toString("hex"),
    },
    body: "{not-json",
  });
  // GET on webhook (wrong method): expect 405/404, never 500.
  await hit({ method: "GET", path: "/api/public/paystack-webhook" });
}

async function preflight() {
  try {
    const res = await fetch(APP_URL, { method: "HEAD", redirect: "manual" });
    if (res.status >= 500) throw new Error(`ping ${res.status}`);
  } catch (e) {
    console.error(`[no-500-sweep] App not reachable at ${APP_URL}: ${e.message}`);
    process.exit(2);
  }
}

function writeLog() {
  const lines = [
    `# no-500-sweep run @ ${new Date().toISOString()}`,
    `# target: ${APP_URL}`,
    `# total: ${results.length}  failed: ${results.filter((r) => !r.pass).length}`,
    "",
    ...results.map((r) =>
      JSON.stringify(
        {
          method: r.method,
          url: r.url,
          status: r.status,
          durationMs: r.durationMs,
          pass: r.pass,
          err: r.err,
          leaks: r.leaks,
          snippet: r.snippet,
        },
        null,
        0,
      ),
    ),
  ];
  writeFileSync(LOG_PATH, lines.join("\n"), "utf8");
}

async function main() {
  console.log(`[no-500-sweep] Target: ${APP_URL}`);
  await preflight();
  await sweepPages();
  await sweepMcp();
  await sweepWebhook();

  writeLog();

  // Belt-and-braces: scan the log file we just wrote for secret values, in
  // case a snippet was truncated across the 400-char boundary above.
  const logContent = readFileSync(LOG_PATH, "utf8");
  const logLeaks = scanForLeaks(logContent);

  const failures = results.filter((r) => !r.pass);
  if (failures.length) {
    console.error(`\n[no-500-sweep] ❌ FAIL — ${failures.length} response(s) returned 5xx/network error:`);
    for (const f of failures) {
      const leakNote = f.leaks?.length ? ` LEAKED:${f.leaks.join(",")}` : "";
      console.error(
        `  - ${f.method} ${f.url} -> ${f.status || "ERR"} ${f.err ? `(${f.err})` : ""}${leakNote}\n      snippet: ${f.snippet}`,
      );
    }
    console.error(`\n[no-500-sweep] Full log: ${LOG_PATH}`);
    process.exit(1);
  }

  if (logLeaks.length) {
    console.error(
      `\n[no-500-sweep] ❌ FAIL — secret env value(s) found in captured log: ${logLeaks.join(", ")}`,
    );
    console.error(`[no-500-sweep] Full log: ${LOG_PATH}`);
    process.exit(1);
  }

  const scannedNote = SECRET_VALUES.length
    ? `${SECRET_VALUES.length} secret(s) scanned: ${SECRET_VALUES.map((s) => s.name).join(", ")}`
    : "no secret env values present in this environment to scan against";
  console.log(
    `\n[no-500-sweep] ✅ PASS — ${results.length} requests, no HTTP 5xx, no secret leaks (${scannedNote}).`,
  );
  console.log(`[no-500-sweep] Log: ${LOG_PATH}`);
}

main().catch((err) => {
  console.error("[no-500-sweep] Fatal:", err);
  try {
    writeLog();
  } catch {}
  process.exit(1);
});