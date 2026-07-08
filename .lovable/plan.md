# Home Page Content Management System

Build a full Admin module to manage all Home Page promotional content (Popular Items, Hot Deals, Specials, Featured Products, Banners), replacing hardcoded data with live database-driven content synced in real-time.

## Current State

The Home Page (`src/routes/index.tsx`) currently pulls from hardcoded arrays in `src/data/menu.ts`:
- `FEATURED_PRODUCTS` → "Fan Favorites / Popular"
- `DESSERTS` → "Save Room for Dessert"
- `TESTIMONIALS` → reviews
- `OfferGrid` → hardcoded offers (`src/components/offer-grid.tsx`)

The DB already has partially-shaped tables (`home_popular_items`, `home_hot_deals`, `home_specials`, `home_banners`, `featured_items`, `home_section_visibility`, `home_content_events`, `promotions`) — I'll audit and reuse/extend rather than duplicate.

## Database (single migration)

Audit existing `home_*` tables; add missing columns and standardize schema across all four content types. Each table will have:

- `id`, `title`, `description`, `image_url`, `price_zar`, `original_price_zar` (hot deals), `discount_pct` (hot deals), `cta_label`, `cta_href`, `product_id` (optional FK to `products`), `position` (int for ordering), `is_active` (bool), `starts_at`, `ends_at` (nullable, for scheduling), `zone_id` (nullable FK to `delivery_zones`), `created_by`, `created_at`, `updated_at`
- `promotional_banners` table (new if missing): image, headline, subhead, CTA, link, position, active, schedule, zone
- `home_section_visibility`: rows for `popular`, `hot_deals`, `specials`, `featured`, `banners`, `desserts` with `is_visible` bool
- Click-tracking table: `home_content_clicks` (content_type, content_id, clicked_at, session_id) for analytics
- Triggers: `updated_at`, and a "scheduled visibility" view/function that treats a row as live when `is_active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())`
- RLS:
  - Public `SELECT` (anon + authenticated) filtered to live rows only via policy
  - Admins (`has_role admin`) full CRUD on all zones
  - Zone admins CRUD scoped to `zone_id = get_user_zone(auth.uid())`
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE` for all home content tables
- Grants: standard `authenticated`/`service_role` + `anon SELECT`

## Server Functions

New files under `src/lib/admin/home-content/`:
- `popular.functions.ts` — list/create/update/delete/reorder/toggle for popular items
- `hot-deals.functions.ts` — same + price/discount validation, schedule
- `specials.functions.ts` — same, with combo/meal-deal fields
- `featured.functions.ts` — same
- `banners.functions.ts` — same
- `section-visibility.functions.ts` — toggle each home section
- `analytics.functions.ts` — click counts, top items, conversion (best-effort)

New public read module `src/lib/home-content.functions.ts` — returns live content for the home page via publishable-key server client (SSR-safe, respects scheduling).

All admin fns use `requireSupabaseAuth` + `requireAdminScope` from existing helpers; zone admins are auto-scoped.

## Admin UI

New route: `src/routes/_authenticated/admin.home-content.tsx` — tabbed shell with sub-sections:
- **Popular Items** — data table + create/edit drawer, drag-to-reorder, activate toggle, image upload, product picker from `products` table
- **Hot Deals** — same UI shape + original/discounted price fields, auto-computed savings, date range picker
- **Specials** — combo builder (link multiple products), image, schedule
- **Featured Products** — simple product picker + position
- **Promotional Banners** — image upload, headline/CTA/link, schedule
- **Section Visibility** — toggle each home page section on/off
- **Analytics** — top clicks per category, conversion snapshot

Add sidebar entry "Home Content" in `src/components/admin/admin-sidebar.tsx`. Uses existing `PageHeader`, `SectionCard`, `DataShell`, `StatusBadge` patterns.

Product picker component reuses existing `products` queries. Image uploads go through the existing `avatars` bucket pattern (or create a public `home-content` bucket).

## Customer Home Page Rewiring

Rewrite `src/routes/index.tsx` to fetch live content via TanStack Query:
- Replace `FEATURED_PRODUCTS` usage → `usePopularItems()`
- Replace `DESSERTS` → `useFeaturedProducts()` (kept as separate section, or merged; will confirm during build)
- Replace `OfferGrid` static offers → `useHotDeals()` and/or `useSpecials()`
- Wrap each section with `home_section_visibility` gate — hide entirely if admin toggled off
- Subscribe via `useRealtimeInvalidate` to all home content tables so admin edits appear instantly with no refresh
- Preserve every current animation, style, layout, and component (`ProductGrid`, `OfferGrid`, `Reveal`, hero, etc.) — only the data source changes
- Loading state: use current data shape with skeletons matching the existing card sizes

Public banners section added above/below hero based on active banner rows (rendered only if any exist, to preserve current design when empty).

## Analytics Hooks

Lightweight click logger fires from `ProductGrid`/`OfferGrid` when a home-content-sourced card is clicked; writes to `home_content_clicks`. Admin analytics tab aggregates via server fn.

## Cleanup

- Remove `FEATURED_PRODUCTS`, `DESSERTS` usage on home from `src/data/menu.ts` (keep file for `/menu/full-menu` if still referenced; otherwise trim)
- Remove hardcoded offer arrays in `src/components/offer-grid.tsx` and rewire to prop-driven live data

## Out of Scope / Assumptions

- "Seasonal Campaigns" treated as `promotions` table already present + banner scheduling — no separate UI unless you ask
- Full drag-and-drop uses simple up/down + position number initially; kanban-style DnD can be added later
- Analytics is basic aggregation (counts, top N); no funnel/attribution modeling
- Images uploaded to Supabase Storage; existing image URLs also supported

## Deliverables

1. One migration creating/extending tables, RLS, realtime, grants
2. Admin server functions (7 modules) + public read module
3. Admin route `admin.home-content.tsx` with all sub-sections + sidebar entry
4. Rewired `src/routes/index.tsx` using live data + realtime + section visibility
5. Removed hardcoded home content
