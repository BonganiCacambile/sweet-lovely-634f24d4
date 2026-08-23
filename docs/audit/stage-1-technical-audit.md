# Sweet ’n Lovely — Stage 1: Technical Audit & Performance Baseline

Read-only audit. No production data, schema, RLS, auth, Paystack, realtime behaviour, or
application functionality was modified. No migrations were created. Only this report was added.

Date: 2026-08-23 · Branch state: current preview build

---

## 1. Measured baseline

### 1.1 Production build (`bun run build`)

| Artifact | Size | Note |
|---|---|---|
| `dist` total | 27 MB | includes server bundle + prerender |
| `assets/google-3FCAKCAC-*.js` | **3.38 MB** | Framer Google-font payload, largest single chunk |
| `assets/index-*.js` (entry) | **875 KB** | shared entry: React, Router, Query, Supabase, Framer runtime |
| `assets/export-menu-*.js` | **699 KB** | `xlsx` + `jspdf` + `jspdf-autotable` (admin CSV/XLSX/PDF export) |
| `assets/site-footer-*.js` | **445 KB** | footer pulls Framer chunk graph |
| `assets/AreaChart-*.js` | **395 KB** | recharts (admin analytics only) |
| `html2canvas.esm-*.js` | 201 KB | pulled in by jspdf |
| `fontshare-*.js` | 134 KB | second font loader |
| `assets/menu-*.js` | 33 KB | route chunk (fine) |
| `assets/checkout-*.js` | 28 KB | route chunk (fine) |

Route-level code splitting **is** working (admin routes are separate chunks). The weight is in
shared/entry chunks and font/Framer payloads, not in route code.

Static assets:

| File | Size |
|---|---|
| `src/assets/logo-transparent.png` | **1.56 MB** |
| `public/logo.png` | **1.20 MB** |
| `public/logo-transparent.png` | **1.20 MB** |

`/logo-transparent.png` is referenced by the header logo, footer and admin brand mark — i.e. a
1.2 MB PNG on **every** page, and `/logo.png` is additionally used as a CSS background in
`styles.css`.

### 1.2 Dev-server runtime measurements (authenticated, Playwright)

Dev server is unbundled ESM, so absolute numbers are inflated vs production; trends are valid.

| Scenario | TTFB | domInteractive | LCP | Stored baseline (LCP) |
|---|---|---|---|---|
| Home, desktop 1400×1000 | 190 ms | 307 ms | **3 948 ms** | 2 240 ms → **regressed +76 %** |
| Home, iPhone 13 (390×664 @3x) | 230 ms | 317 ms | **4 244 ms** | 2 104 ms → **regressed +102 %** |
| `/cart`, mobile | 172 ms | 387 ms | **2 316 ms** | 1 716 ms → regressed +35 % |
| `/checkout`, mobile (cold) | 389 ms | 490 ms | 1 844 ms | 2 076 ms → within budget |
| `/cart → /checkout` soft nav | — | — | 240 ms | 244 ms → stable |

Structural assertions still pass: hero `<link rel=preload as=image>` present in SSR HTML, hero
`<img>` renders, and **0** client-side `getHomeContent` calls at hydration (SSR prefetch honoured).

Network profile of `/` (dev, authenticated, 6 s observation window):

- 337 responses total → 278 script (dev ESM modules), 46 image, 6 fetch, 4 font, 2 CSS, 1 document
- 2 WebSocket connections (Supabase Realtime + Vite HMR)
- fetches observed: `listActiveZones` ×3, `getHomeContent` ×2, `pizza_toppings` ×1

The **duplicate `listActiveZones` (3×) and `getHomeContent` (2×)** after hydration are real
duplicate work, not dev-server noise (see C-2 / H-1).

### 1.3 Regression suite state

Functional suites (realtime, checkout, Paystack webhook + lifecycle, RLS matrix, product sizes,
order snapshots, push, MCP auth, zone leak, visual) are wired via `bun run test:regression`.
The three perf suites currently **fail on baseline comparison only** (LCP/TTI regression vs the
committed baselines above) — no functional assertion failed during this audit.

---

## 2. Prioritised findings

### CRITICAL

#### C-1 — Global `AuthGate` forces login before any storefront page
- **Problem:** `src/routes/__root.tsx` redirects every unauthenticated visitor to `/auth`, and
  renders `<LoadingScreen />` instead of content while `loading` is true. SSR therefore emits a
  loading shell for all visitors and search engines; real content only exists after hydration +
  session resolution.
- **Why inefficient:** kills SSR value for `/`, `/menu/full-menu`, `/locations`, `/contact`; LCP
  is gated on Supabase session round-trip + profile + roles + zone-name queries; SEO/OG value of
  the public routes is lost; the perf tests must seed a session to measure anything.
- **Proposed solution:** keep auth required for ordering actions, but let public storefront routes
  SSR their content and show a "Sign in to order" CTA. This is a product decision — flagged, not
  assumed.
- **Expected benefit:** LCP −1 to −2 s on `/`, working SSR/SEO, fewer blocking auth queries on
  first paint.
- **Risk:** High (changes the deliberately requested "must log in first" behaviour). Requires
  explicit sign-off.
- **Files:** `src/routes/__root.tsx`, `src/lib/auth-context.tsx`.

#### C-2 — Per-component Supabase Realtime channels with random names (channel fan-out)
- **Problem:** `use-realtime-invalidate.ts`, `use-realtime-table.ts`, `use-pizza-toppings.ts` and
  `use-home-content-updates.ts` each open a channel named `rt:<table>:<random>`. Every component
  instance gets its own channel. `usePizzaToppings()` lives inside `AddToCartButton`, which is
  rendered **once per product card** — a full menu page opens one WebSocket channel per card.
  `admin.orders`, `admin.inventory`, `admin.index`, `admin.analytics` each open 2 channels for the
  same `orders`/`order_items` tables.
- **Why inefficient:** N duplicate subscriptions to identical filters; every DB change fans out N
  messages to one client; each triggers N `invalidateQueries` → N refetch storms; Supabase Realtime
  concurrent-channel quotas are consumed per user; on mobile/WebView each channel holds JS timers
  and buffers.
- **Proposed solution:** a single shared realtime manager (module-level `Map<table, channel>` with
  refcounting) that dedupes subscriptions and multiplexes callbacks; hoist toppings realtime out of
  the per-card hook into one app-level subscription; coalesce invalidations with a short debounce.
- **Expected benefit:** channel count on menu/admin pages drops from N to 1 per table; far fewer
  refetches per admin edit; lower battery/data use on mobile.
- **Risk:** Medium (touches realtime plumbing — covered by the existing realtime regression suites).
- **Files:** `src/hooks/use-realtime-invalidate.ts`, `src/hooks/use-realtime-table.ts`,
  `src/hooks/use-pizza-toppings.ts`, `src/hooks/use-home-content-updates.ts`,
  `src/components/cart/add-to-cart-button.tsx`, all admin routes listed above.

#### C-3 — 1.2–1.6 MB PNG logos loaded on every page
- **Problem:** `/logo-transparent.png` (1.2 MB) is used by `site-header`, `site-footer`,
  `admin/brand-mark`; `/logo.png` (1.2 MB) is a CSS background in `styles.css`;
  `src/assets/logo-transparent.png` is 1.56 MB.
- **Why inefficient:** ~2.4 MB of image bytes for a logo that renders at ≤ 200 px; directly
  competes with the hero LCP image for bandwidth on 3G/mobile data.
- **Proposed solution:** emit WebP/AVIF at 2–3 render sizes (`<= 40 KB` each), serve via
  `srcset`/`sizes`, keep a small PNG fallback for OG/schema.
- **Expected benefit:** −2 MB per cold page load; measurable LCP win on mobile.
- **Risk:** Low (assets only).
- **Files:** `src/components/logo.tsx`, `src/components/site-footer.tsx`,
  `src/components/admin/brand-mark.tsx`, `src/styles.css`, `public/`, `src/assets/`.

---

### HIGH

#### H-1 — Duplicate `listActiveZones` / `getHomeContent` fetches after hydration
- **Problem:** on `/`, `listActiveZones` is requested 3× and `getHomeContent` 2× within 6 s despite
  the route loader prefetching both. Sources: `ZoneProvider` (`["zones","active"]`),
  `useActiveZoneCities`, `DeliveryFaqList` (its own `ZONES_KEY`), and
  `useHomeContentUpdates` fingerprint check on mount + visibility + interval.
- **Why inefficient:** 3 server-fn round trips for identical data; each is an authenticated Worker
  invocation plus a Postgres query.
- **Proposed solution:** one canonical `zonesQueryOptions` (single query key, `staleTime` 5 min)
  consumed everywhere; make the fingerprint check reuse the already-fresh `home-content` cache
  entry instead of firing on mount.
- **Expected benefit:** −3 to −4 network round trips per home load; less Worker/DB load per visitor.
- **Risk:** Low.
- **Files:** `src/lib/zone-context.tsx`, `src/hooks/use-active-zones.ts`,
  `src/components/delivery-faq-list.tsx`, `src/hooks/use-home-content-updates.ts`.

#### H-2 — Admin export stack (699 KB) and recharts (395 KB) eagerly imported
- **Problem:** `ExportMenu` statically imports `src/lib/admin/exports.ts` → `xlsx`, `jspdf`,
  `jspdf-autotable`, `html2canvas`. It is imported by 13 admin routes, so opening *any* admin list
  page downloads ~700 KB before the admin clicks anything.
- **Why inefficient:** the export code is used in a small fraction of sessions; it is parse-heavy on
  low-end Android WebViews.
- **Proposed solution:** `await import(...)` the exporter inside `runExport`; lazy-load recharts in
  `admin.analytics` / `kpi-card`.
- **Expected benefit:** ~700 KB and ~400 KB removed from admin first load; faster admin TTI.
- **Risk:** Low (behaviour identical, one extra async tick on click).
- **Files:** `src/components/admin/export-menu.tsx`, `src/lib/admin/exports.ts`,
  `src/routes/_authenticated/admin.analytics.tsx`, `src/components/ui/chart.tsx`.

#### H-3 — Framer font chunk of 3.38 MB
- **Problem:** `google-3FCAKCAC-*.js` (3.38 MB) plus `fontshare-*.js` (134 KB) and further
  `google-*` chunks come from the vendored Framer components (`src/framer/**`) used by
  `site-header`, `product-grid` and the home menu tab.
- **Why inefficient:** font *metadata* shipped as JavaScript; it is dead weight for a site that
  needs a handful of families. Even if lazily fetched, it inflates the CDN surface and can be pulled
  in by a single Framer import.
- **Proposed solution:** verify with a chunk-graph report whether the 3.38 MB chunk is reachable
  from the storefront entry; if so, replace the Framer nav/product-card/menu-tab wrappers with
  native components, or stub the Framer font module and load fonts via a `<link>` in `__root`.
- **Expected benefit:** potentially the single largest bundle reduction available.
- **Risk:** Medium (visual parity of Framer-rendered UI must be preserved — the visual regression
  suite covers home cards).
- **Files:** `src/framer/**`, `src/components/site-header.tsx`, `src/components/product-grid.tsx`,
  `src/routes/index.tsx`.

#### H-4 — `AuthGate` blocks first paint on a 3-query auth waterfall
- **Problem:** `loadExtras()` runs `profiles` → `user_roles` → (conditionally) `delivery_zones`
  sequentially-ish for every signed-in user on every page load, with an 8 s timeout fallback; the
  whole app renders `<LoadingScreen />` until it resolves.
- **Why inefficient:** 2–3 serial round trips gate content for a returning customer who only needs
  `user.id`.
- **Proposed solution:** render the app as soon as the session is known; resolve profile/roles in a
  React Query entry (`staleTime` minutes) that only admin surfaces await; fold role + zone name into
  a single RPC/view read.
- **Expected benefit:** −200 to −600 ms to first content for signed-in users; fewer DB round trips
  per navigation.
- **Risk:** Medium (auth-adjacent; must not weaken the admin guards — `rls-matrix` and `auth-flow`
  suites cover it).
- **Files:** `src/lib/auth-context.tsx`, `src/routes/__root.tsx`.

#### H-5 — `select("*")` on home-content and admin tables
- **Problem:** `home-content.functions.ts` reads `*` from 5 tables twice (content + fingerprint
  path); `admin/home-content.functions.ts` does the same for 6 tables; `account.functions.ts`,
  `admin/zones.functions.ts`, `admin/users.functions.ts`, `admin/presence.functions.ts` also use `*`.
- **Why inefficient:** transfers columns the UI never reads (timestamps, internal flags), defeats
  index-only scans, and enlarges the SSR payload embedded in the HTML.
- **Proposed solution:** explicit column projections matching the rendered fields; for the
  fingerprint path select only `id, updated_at`.
- **Expected benefit:** smaller SSR HTML and JSON payloads; cheaper queries.
- **Risk:** Low, but each projection must be checked against consumers.
- **Files:** `src/lib/home-content.functions.ts`, `src/lib/admin/home-content.functions.ts`,
  `src/lib/account/account.functions.ts`, `src/lib/admin/*.functions.ts`.

---

### MEDIUM

#### M-1 — Unbounded / very large row reads
`audit_logs` ×1000 (`admin/audit.functions.ts`, `admin/security-core.server.ts`),
`notifications` ×1000 (`admin/notifications.functions.ts` — fetches only `category`, in JS, to
aggregate), `user_notification_devices` ×5000, `support_reply_audit` ×500,
`admin/home-content.functions.ts` ×500, `support.functions.ts` ×100.
*Why:* row counts grow with production usage; the ×1000 category read is an aggregation that belongs
in SQL. *Solution:* server-side `count`/`group by` via RPC or a view; keep pagination for lists.
*Benefit:* constant-time admin dashboards as data grows. *Risk:* Low (read-only queries).
*Files:* the listed `src/lib/admin/*` modules.

#### M-2 — Polling that overlaps realtime
`admin.index` (30 s ×2), `admin.security` (30 s), `admin.employee-activity` (30 s **and 3 s**),
`use-home-content-updates` interval, `admin-presence` heartbeat — several of these tables *also*
have realtime subscriptions, so the same data is refreshed twice.
*Solution:* drop `refetchInterval` where a realtime subscription exists; keep polling only as a
reconnect fallback (poll only when channel status ≠ `SUBSCRIBED`).
*Benefit:* fewer Worker invocations and DB hits per open admin tab; better battery on tablets.
*Risk:* Low–Medium (the presence perf suite asserts the 3 s/30 s cadence and would need updating).
*Files:* `src/routes/_authenticated/admin.index.tsx`, `admin.security.tsx`,
`admin.employee-activity.tsx`, `src/hooks/use-home-content-updates.ts`, `src/lib/admin-presence.tsx`.

#### M-3 — Oversized components
`admin.home-content.tsx` 1 464 lines, `checkout.tsx` 1 195, `admin.support-requests.tsx` 788,
`add-to-cart-button.tsx` 639, `index.tsx` 628.
*Why:* every state change re-renders the whole tree; hard to memoise; hard to test; large route
chunks. *Solution:* extract per-section subcomponents + colocate their state; move pure mapping
logic (the `content.popular → Product[]` transforms in `index.tsx`) into module-level helpers.
*Benefit:* fewer wasted renders, better maintainability. *Risk:* Low–Medium (pure refactor; visual
regression suite gives cover). *Files:* as listed.

#### M-4 — Missing memoisation on derived lists / list virtualisation
`index.tsx` recomputes the popular/deals/specials mapping on every render;
`menu.full-menu.tsx` merges DB rows with static metadata on every render and renders every product
at once (no windowing).
*Solution:* `useMemo` on the derived arrays keyed by the query data; consider virtualisation only if
the catalogue grows past ~100 items.
*Benefit:* smoother scroll on low-end Android WebView. *Risk:* Low.
*Files:* `src/routes/index.tsx`, `src/routes/menu.full-menu.tsx`, `src/components/product-grid.tsx`.

#### M-5 — Duplicated `src/framer/**` and root `framer/**` trees
Two near-identical copies of the Framer export exist (`framer/` at repo root and `src/framer/`).
*Why:* confusing provenance, risk of editing the dead copy, larger repo/IDE index.
*Solution:* confirm the root copy is unreferenced, then remove it. *Risk:* Low. *Files:* `framer/**`.

#### M-6 — Perf baselines are stale / environment-sensitive
Three perf suites fail purely on baseline comparison (home desktop +76 %, home mobile +102 %,
cart +35 %) with absolute budgets still green. Baselines were captured on a quieter machine.
*Solution:* record baselines from the production build in CI (not the dev server), keep the
dev-mode multiplier, and store separate `dev` / `prod` baseline keys (the harness in
`lib/perf-session.mjs` already supports modes).
*Benefit:* trustworthy regression signal. *Risk:* Low (test-only).
*Files:* `tests/regression/home-perf*.mjs`, `cart-checkout-perf-mobile.mjs`, `artifacts/*.json`.

---

### LOW

- **L-1 — `select("*", { count: "exact", head: true })`** in `admin-dashboard.functions.ts`: `head`
  makes it cheap, but `count: "exact"` is a full scan on large tables; `planned`/`estimated` is
  usually enough for a KPI tile. *Risk: Low.*
- **L-2 — `use-realtime-invalidate` dependency array is `[tables.join(",")]`** with the eslint rule
  disabled: `queryKeys` changes are ignored. Works today because keys are literals; it is a latent
  stale-closure bug. *Risk: Low.*
- **L-3 — No `React.lazy` anywhere.** Route-level splitting covers most of it, but heavy dialogs
  (home-content editors, product editor, MFA, command palette) could be deferred. *Risk: Low.*
- **L-4 — Static `src/data/menu.ts` fallback data** is shipped to the client and merged with DB rows
  on every menu render. Consider trimming to the fields actually used as fallback. *Risk: Low.*
- **L-5 — 46 images on the home page**, all remote `framerusercontent.com` URLs with no `sizes`
  attribute and only the hero preloaded. Add explicit `width`/`height` (CLS) and `loading="lazy"`
  below the fold. *Risk: Low.*
- **L-6 — WebView specifics:** `beforeunload`/`pagehide` presence teardown is unreliable in Android
  WebView; timers keep running when the app is backgrounded unless `visibilitychange` gates them
  (currently gated in `use-home-content-updates`, not in `admin-presence`). *Risk: Low.*

---

## 3. Memory-leak / cleanup review (no leaks found, two risks)

Checked every `useEffect` with subscriptions/timers:

- All `supabase.channel(...)` call sites return a cleanup that calls `removeChannel` — **clean**.
- `admin-presence.tsx` clears its interval and all listeners — **clean**.
- `use-home-content-updates.ts` clears interval + listeners + channel — **clean**.
- **Risk A:** `use-realtime-table.ts` re-subscribes on `SIGNED_IN`/`TOKEN_REFRESHED` (~hourly). If
  `removeChannel` ever rejects, the old channel leaks; no ref-count guard exists.
- **Risk B:** `zone-context.tsx` fires an async `supabase.auth.getUser()` + profile write on every
  `selectedSlug` change; it guards with `cancelled` but still issues a network write per change.

---

## 4. Security / correctness observations (informational only — nothing changed)

- RLS architecture uses `private.has_role`-style security-definer helpers and looks consistent.
- `getPublicMenu` and home content read through `supabaseAdmin` (service role) in server functions.
  That bypasses RLS for public reads. It works and is server-only, but a publishable-key client with
  narrow `TO anon` SELECT policies would be the safer default and would remove any chance of a
  service-role read leaking a hidden column through a future projection change. Flagged for Stage 2
  discussion; **not** changed here.

---

## 5. Suggested execution order for Stage 2

1. C-3 (logo assets) — biggest win per unit of risk, zero functional surface.
2. H-2 (lazy admin export + charts) — pure import-time change.
3. H-1 (dedupe zones/home-content queries) — cache-key consolidation.
4. C-2 (shared realtime channel manager) — behind the existing realtime regression suites.
5. H-5 / M-1 (column projections, SQL-side aggregation).
6. M-2 (retire polling where realtime exists) + M-6 (re-baseline perf in CI on prod build).
7. M-3 / M-4 (component splitting and memoisation).
8. H-3 (Framer/font payload) — largest potential win, needs a chunk-graph spike first.
9. C-1 / H-4 (auth gating and auth waterfall) — product decision required before any change.

No optimisation above has been applied. Nothing in this report was implemented.

---

## 6. Post-fix baseline refresh (2026-08-23, client-side auth gating)

Signed-in customer session; values are LCP / domInteractive / TTFB in ms.

| Suite | Dev (vite :8080) | Prod (built worker) |
| --- | --- | --- |
| Home desktop | 1120 / 998 / 706 | 1256 / 315 / 214 |
| Home mobile (390x664 @3x) | 944 / 801 / 535 | 1120 / 250 / 185 |
| Cart mobile | 2004 / 226 / 133 | 868 / 94 / 12 |
| Checkout mobile | 2020 / 520 / 402 | 520 / 31 / 15 |
| Cart→checkout soft nav | 337 | 197 |

Home desktop LCP dropped from ~3,948 ms (pre-fix dev) to ~1,120 ms; all budgets pass in both modes.

Baseline artifacts now store one entry per mode (`authenticated:dev`, `authenticated:prod`)
in the same file, so dev and prod runs no longer overwrite each other. Refresh with
`UPDATE_BASELINE=1`, which skips comparisons and rewrites that mode's entry.
