## Goal

Add a single Playwright E2E test that exercises every Admin → Home Content section (Popular Items, Desserts, Hot Deals, Specials, Featured, Banners, Section Visibility) and asserts each mutation surfaces on the customer home page in real time — no reload — covering insert, update (title / description / image / price), enable/disable, reorder, and delete.

## New file

`tests/regression/home-content-realtime.e2e.mjs` — Playwright script following the existing conventions in `tests/regression/admin-edit-propagation.e2e.mjs`:

- Two browser contexts: `admin` (signed in) and `customer` (anonymous).
- Customer opens `/` first so its Realtime subscription is live before any write.
- Track `framenavigated` on the customer page to prove no reload occurred.
- Each assertion waits for a unique `RT-<timestamp>-<section>` sentinel string to appear/disappear via `expect(locator).toBeVisible/toHaveCount` with a bounded timeout.
- Uses the existing admin UI at `/admin/home-content` (tabs: popular, desserts, hot_deals, specials, featured, banners, visibility) — no direct DB writes for mutations, so the full server-fn + realtime path is covered.
- Cleanup: every created row is deleted in a `finally` block; toggled visibility restored; edited featured item reverted.

## Section coverage matrix

| Section | Create | Edit title | Edit price/desc | Edit image | Toggle active | Reorder (position) | Delete |
|---|---|---|---|---|---|---|---|
| Popular Items | ✓ | ✓ | ✓ price | ✓ image_url | ✓ | ✓ | ✓ |
| Desserts | ✓ | ✓ | ✓ desc | ✓ | ✓ | ✓ | ✓ |
| Hot Deals | ✓ | ✓ | ✓ discounted_price | ✓ | ✓ | ✓ | ✓ |
| Specials | ✓ | ✓ | ✓ price | ✓ | ✓ | ✓ | ✓ |
| Banners | ✓ | ✓ | ✓ subtitle/cta | ✓ | ✓ | ✓ | ✓ |
| Featured | ✓ (pick existing product) | (product-driven) | — | — | ✓ | ✓ sort_order | ✓ |
| Section Visibility | — | — | — | — | ✓ per section | — | — |

For each row: assert sentinel text visible on `/` after create/edit; assert removed after delete/disable; assert reorder swaps DOM order of two sentinel-tagged siblings; assert an `<img>` with the new image URL exists after image change.

## Reorder verification

For Popular/Desserts/Hot Deals/Specials/Banners: create two sentinel rows (`RT-…-A`, `RT-…-B`) with positions 100 and 101, verify customer DOM order A→B, swap positions in admin, verify DOM order flips to B→A within timeout, then delete both.

## Visibility verification

For each section key (`popular`, `hot_deals`, `specials`, `banners`, `desserts`, `featured`): toggle visibility off in admin, assert the section's heading/container disappears from `/` within timeout, toggle back on, assert it returns.

## Wiring

- Add `test:regression:home-content-realtime-e2e` script in `package.json`.
- Include it in the aggregated `test:regression` script (after existing e2e).
- Add the same env-required note as the existing e2e in `tests/regression/README.md` (BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY for pre-flight product pick used by Featured).
- Add to `.github/workflows/regression-suite.yml` alongside the existing propagation e2e (same secrets).

## Non-goals

- No UI/design changes.
- No new server functions or schema changes — the previous migration (REPLICA IDENTITY FULL on `home_*`) already delivers realtime; this test locks the behavior in.
- No load/perf assertions — sentinel-visibility timing uses a generous `PROPAGATION_TIMEOUT_MS` (default 15s) matching the existing e2e.

## Technical details

- Selectors: reuse admin tab buttons by visible text (`Popular Items`, `Desserts`, etc.); rows located by `tr:has-text(sentinel)`; edit fields located by label text via `getByLabel` where the admin form provides labels, falling back to input `name`/placeholder for legacy fields.
- Customer-side sentinel matching: `page.getByText(SENTINEL, { exact: false }).first().waitFor({ state: 'visible' })` and `.waitFor({ state: 'detached' })` for delete/disable.
- Image assertion: `page.locator(\`img[src*="${imageToken}"]\`).first().waitFor()` where `imageToken` is a unique query-string appended to a stock CDN URL.
- Script exits non-zero on any failed check; per-section failures aggregated so one broken section doesn't mask others.
