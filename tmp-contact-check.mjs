import { chromium } from 'playwright';
import { loadEnvFiles } from '/dev-server/tests/regression/lib/load-env.mjs';
import { createEphemeralCustomerSession } from '/dev-server/tests/regression/lib/browser-session.mjs';
loadEnvFiles();
const s = await createEphemeralCustomerSession({});
const b = await chromium.launch();
for (const w of [390, 1280]) {
  const c = await b.newContext({ viewport: { width: w, height: 1800 } });
  const pg = await c.newPage();
  await pg.goto('http://localhost:8080/');
  await pg.evaluate(([k,v])=>localStorage.setItem(k,v), [s.storageKey, JSON.stringify(s.session)]);
  await pg.goto('http://localhost:8080/contact', { waitUntil: 'networkidle' });
  const el = pg.locator('[data-testid="zone-contact-directory"]');
  console.log(w, 'url', pg.url(), 'visible', await el.isVisible());
  console.log((await el.innerText()).slice(0,900));
  console.log('tel', await pg.locator('[data-testid="zone-contact-directory"] a[href^="tel:"]').count());
  console.log('mail', await pg.locator('[data-testid="zone-contact-directory"] a[href^="mailto:"]').count());
  console.log('form inputs', await pg.locator('form input').count());
  await pg.screenshot({ path: `/tmp/browser/contact/${w}.png` });
}
await b.close();
if (s.cleanup) await s.cleanup();
