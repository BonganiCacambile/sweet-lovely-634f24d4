process.chdir("/dev-server");
const { loadEnvFiles } = await import("/dev-server/tests/regression/lib/load-env.mjs");
loadEnvFiles();
const { chromium } = await import("playwright");
const { createClient } = await import("@supabase/supabase-js");
const { resolveAdminCredentials } = await import("/dev-server/tests/regression/lib/admin-session.mjs");
const { storageKeyFor } = await import("/dev-server/tests/regression/lib/browser-session.mjs");
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession:false, autoRefreshToken:false }});
const creds = await resolveAdminCredentials();
const { data } = await supa.auth.signInWithPassword({ email: creds.email, password: creds.password });
const b = await chromium.launch({headless:true});
const p = await (await b.newContext({viewport:{width:1280,height:900}})).newPage();
p.on("console", m => console.log("CONSOLE", m.type(), m.text().slice(0,200)));
await p.goto("http://localhost:8080/auth", {waitUntil:"domcontentloaded"});
await p.evaluate(([k,s])=>localStorage.setItem(k,JSON.stringify(s)), [storageKeyFor(process.env.SUPABASE_URL, process.env.SUPABASE_PROJECT_ID), data.session]);
await p.goto("http://localhost:8080/admin/products", {waitUntil:"domcontentloaded"});
await p.waitForTimeout(6000);
console.log("URL", p.url());
await p.goto("http://localhost:8080/admin/products", {waitUntil:"domcontentloaded"});
try {
  await p.getByPlaceholder(/search by name or slug/i).fill("chicken-mayo", {timeout: 15000});
  console.log("FILL OK");
} catch (e) { console.log("FILL FAIL", e.message.slice(0,200)); console.log(await p.locator("body").innerText()); }
console.log("count", await p.locator('input[placeholder]').count(), await p.locator('input[placeholder]').evaluateAll(els=>els.map(e=>e.placeholder)));
await b.close();
