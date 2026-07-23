import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMenuTool from "./tools/get-menu";

// Resolved at build time / worker cold-start. `process.env.SUPABASE_URL` can
// be `undefined` (manifest extraction, some CI shells) or an empty string
// (GitHub Actions when the secret isn't wired) — the nullish-coalescing
// operator does NOT catch the empty-string case, which previously produced
// an issuer of `/auth/v1` and crashed the SDK with
// `auth.issuer must be an absolute URL`. Treat blank as missing and always
// fall back to an absolute placeholder; a real bearer token could never
// verify against `.invalid`, so this is safe.
const rawSupabaseUrl = process.env.SUPABASE_URL;
const supabaseUrlCandidate =
  typeof rawSupabaseUrl === "string" && rawSupabaseUrl.trim().length > 0
    ? rawSupabaseUrl.trim().replace(/\/+$/, "")
    : "https://supabase.invalid";

// Guarantee an absolute URL even if a caller sets SUPABASE_URL to something
// malformed (e.g. `supabase.co` without a scheme). Never throw at module
// eval — that would take down SSR and manifest extraction. Log once and use
// the placeholder so the process keeps starting; tokens still won't verify.
let supabaseUrl = supabaseUrlCandidate;
try {
  const parsed = new URL(supabaseUrlCandidate);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`unsupported protocol ${parsed.protocol}`);
  }
  supabaseUrl = parsed.origin;
} catch (err) {
  console.error(
    `[mcp] SUPABASE_URL is not a valid absolute URL (got ${JSON.stringify(
      rawSupabaseUrl,
    )}): ${(err as Error).message}. Falling back to https://supabase.invalid; MCP token verification will fail until this is fixed.`,
  );
  supabaseUrl = "https://supabase.invalid";
}

export default defineMcp({
  name: "sweet-n-lovely-mcp",
  title: "Sweet & Lovely Pizza",
  version: "0.1.0",
  instructions:
    "Tools for the Sweet & Lovely Pizza site. Use `get_menu` to fetch the public menu of categories and active products with prices in ZAR.",
  tools: [getMenuTool],
  auth: auth.oauth.issuer({
    issuer: `${supabaseUrl}/auth/v1`,
    acceptedAudiences: "authenticated",
    jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
  }),
});