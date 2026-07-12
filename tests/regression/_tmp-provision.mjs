import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `regression-test-${Date.now()}@example.com`;
const password = "Regress1!" + crypto.randomBytes(4).toString("hex");

console.log("Creating user", email);
const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (error) {
  console.error("createUser error", error);
  process.exit(1);
}
const userId = data.user.id;
console.log("Created user id", userId);

console.log("Signing in...");
const { data: signData, error: signError } = await userClient.auth.signInWithPassword({ email, password });
if (signError || !signData.session) {
  console.error("signIn error", signError);
  await admin.auth.admin.deleteUser(userId);
  process.exit(1);
}
console.log("Signed in successfully, user id", signData.user.id);

console.log("Deleting user...");
const { error: delError } = await admin.auth.admin.deleteUser(userId);
if (delError) console.error("delete error", delError);
else console.log("Deleted user");
