import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMenuTool from "./tools/get-menu";

// Resolved at build time. Falls back to a placeholder issuer when SUPABASE_URL
// isn't set (e.g. during manifest extraction outside the runtime env). At
// runtime SUPABASE_URL is always defined, so the SDK verifies bearer JWTs
// against Supabase Auth's JWKS.
const supabaseUrl = process.env.SUPABASE_URL ?? "https://supabase.invalid";

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