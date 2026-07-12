#!/usr/bin/env node
/**
 * Regression: MCP server auth gate
 *
 * The MCP server is configured as an OAuth 2.1 resource server
 * (auth.oauth.issuer pointing at Supabase Auth). Every MCP endpoint
 * except the OAuth metadata document must reject requests that do not
 * present a valid Supabase bearer token.
 *
 * Verifies, for /mcp, /.mcp/list-tools, and /.mcp/invoke-tool/get_menu:
 *   1. No Authorization header       -> 401 + WWW-Authenticate: Bearer
 *   2. Malformed Authorization       -> 401
 *   3. Bogus bearer token            -> 401
 *   4. Expired-looking (bad sig) JWT -> 401
 *
 * Verifies for /.well-known/oauth-protected-resource:
 *   5. Reachable anonymously (2xx) — required for RFC 9728 discovery.
 */
import crypto from "node:crypto";

const { APP_URL = "http://localhost:8080" } = process.env;
const BASE = APP_URL.replace(/\/$/, "");

const failures = [];
function record(name, ok, detail) {
  if (ok) {
    console.log(`  ✅ ${name}`);
  } else {
    console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(name);
  }
}

// Well-formed but unsigned JWT (HS256 header, empty payload, random "sig").
// mcp-js should reject it at signature verification before ever looking at
// the claims — proves the guard isn't just checking for header presence.
function bogusJwt() {
  const b64 = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({ sub: "regression", aud: "authenticated", iat: 0, exp: 0 });
  const sig = crypto.randomBytes(32).toString("base64url");
  return `${header}.${payload}.${sig}`;
}

const PROTECTED_ENDPOINTS = [
  {
    label: "POST /mcp (initialize)",
    url: `${BASE}/mcp`,
    method: "POST",
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "regression", version: "0.0.0" },
      },
    }),
    contentType: "application/json",
    accept: "application/json, text/event-stream",
  },
  {
    label: "GET /.mcp/list-tools",
    url: `${BASE}/.mcp/list-tools`,
    method: "GET",
  },
  {
    label: "POST /.mcp/invoke-tool/get_menu",
    url: `${BASE}/.mcp/invoke-tool/get_menu`,
    method: "POST",
    body: JSON.stringify({ arguments: {} }),
    contentType: "application/json",
  },
];

const AUTH_VARIANTS = [
  { label: "no auth header", header: undefined },
  { label: "malformed auth header", header: "NotBearer whatever" },
  { label: "bogus bearer token", header: "Bearer not-a-real-token" },
  { label: "unsigned JWT", header: () => `Bearer ${bogusJwt()}` },
];

async function callEndpoint(ep, authHeader) {
  const headers = {};
  if (ep.contentType) headers["content-type"] = ep.contentType;
  if (ep.accept) headers["accept"] = ep.accept;
  if (authHeader) headers["authorization"] = authHeader;
  return fetch(ep.url, { method: ep.method, headers, body: ep.body });
}

async function main() {
  console.log(`Running MCP auth regression against ${BASE}\n`);

  for (const ep of PROTECTED_ENDPOINTS) {
    console.log(ep.label);
    for (const variant of AUTH_VARIANTS) {
      const header = typeof variant.header === "function" ? variant.header() : variant.header;
      let res;
      try {
        res = await callEndpoint(ep, header);
      } catch (err) {
        record(`${variant.label} → 401`, false, `fetch threw: ${err?.message ?? err}`);
        continue;
      }
      const ok = res.status === 401;
      const detail = ok ? undefined : `got HTTP ${res.status}`;
      record(`${variant.label} → 401`, ok, detail);

      if (ok && variant.label === "no auth header") {
        const challenge = res.headers.get("www-authenticate") ?? "";
        const looksLikeBearer = /Bearer/i.test(challenge);
        record(
          "  WWW-Authenticate advertises Bearer",
          looksLikeBearer,
          looksLikeBearer ? undefined : `header was: ${challenge || "<missing>"}`,
        );
        const advertisesMetadata = /resource_metadata=/.test(challenge);
        record(
          "  WWW-Authenticate points at protected-resource metadata",
          advertisesMetadata,
          advertisesMetadata ? undefined : `header was: ${challenge || "<missing>"}`,
        );
      }
    }
  }

  console.log("\nGET /.well-known/oauth-protected-resource");
  try {
    const res = await fetch(`${BASE}/.well-known/oauth-protected-resource`);
    const ok = res.status >= 200 && res.status < 300;
    record("public metadata reachable anonymously (2xx)", ok, ok ? undefined : `got HTTP ${res.status}`);
    if (ok) {
      try {
        const body = await res.json();
        const hasResource = typeof body.resource === "string";
        record(
          "metadata document exposes `resource`",
          hasResource,
          hasResource ? undefined : `body: ${JSON.stringify(body)}`,
        );
        const hasAuthServer =
          Array.isArray(body.authorization_servers) && body.authorization_servers.length > 0;
        record(
          "metadata document lists authorization_servers",
          hasAuthServer,
          hasAuthServer ? undefined : `body: ${JSON.stringify(body)}`,
        );
      } catch (err) {
        record("metadata document is valid JSON", false, err?.message ?? String(err));
      }
    }
  } catch (err) {
    record("public metadata reachable anonymously (2xx)", false, `fetch threw: ${err?.message ?? err}`);
  }

  console.log("");
  if (failures.length > 0) {
    console.error(`❌ ${failures.length} MCP auth check(s) failed:`);
    for (const f of failures) console.error(`   - ${f}`);
    process.exit(1);
  }
  console.log("✅ MCP auth gate rejects unauthenticated requests as expected");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});