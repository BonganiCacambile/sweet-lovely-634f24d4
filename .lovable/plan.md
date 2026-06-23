# Home Page Content Manager

Build a complete admin module to manage all promotional content on the customer home page, with realtime sync, scheduling, zone-scoped permissions, and analytics.

## Scope decisions (please confirm or adjust)

1. **Existing tables to reuse vs. new tables.** The DB already has `featured_items`, `promotions`, `banners`. I will:
   - Reuse `featured_items` for **Popular Items** (add `position`, `zone_id`, `is_active`, `image_url`, `description` if missing).
   - Reuse `promotions` for **Hot Deals** and **Specials** (discriminator column `kind: 'hot_deal' | 'special' | 'seasonal'`).
   - Reuse `banners` for **Promotional Banners** (add `zone_id`, `cta_label`, `cta_href`, `starts_at`, `ends_at`, `position` if missing).
   - Add new `home_section_visibility` table (toggle whole sections on/off per zone).
   - Add new `home_content_events` table for click/view analytics.
2. **Featured Products vs Popular Items.** Treat as two presentation slots over the same `featured_items` table, distinguished by a `slot` column (`popular` | `featured`).
3. **Seasonal Campaigns.** Modeled as `promotions.kind = 'seasonal'` — same CRUD UI, different filter.
4. **Scheduling.** `starts_at`/`ends_at` on every promo row; the public query filters `now() between starts_at and ends_at` (or nulls = always). No cron needed — purely query-time.
5. **Zone scoping.** Every promo row gets `zone_id uuid` (nullable = global). Public home page filters by the user's active zone (from `zone-context`). `zone_admin` can only mutate rows in their assigned zone; `admin` can mutate any.
6. **Realtime.** Add affected tables to `supabase_realtime` publication; customer home subscribes via `useRealtimeInvalidate` and refetches the public query.
7. **Images.** Reuse the existing `avatars` bucket? Or create a public `home-content` bucket? **I will create a new public `home-content` bucket** so home images are publicly readable without signed URLs.
8. **Analytics.** Lightweight: insert one row per click/view via a public RPC; admin sees aggregated counts per item over last 30 days. No funnel/conversion tracking beyond click→order link.

## Deliverables

### Database (one migration)
- ALTER `featured_items`: add `slot`, `position`, `zone_id`, `is_active`, `image_url`, `description`, `price_override`, `starts_at`, `ends_at`.
- ALTER `promotions`: add `kind`, `zone_id`, `position`, `product_slug`, `original_price`, `discounted_price`, `discount_pct`, `image_url`, `label`.
- ALTER `banners`: add `zone_id`, `cta_label`, `cta_href`, `position`, `starts_at`, `ends_at`.
- CREATE `home_section_visibility(zone_id, section, is_visible)`.
- CREATE `home_content_events(id, content_type, content_id, event_type, occurred_at, zone_id)`.
- RLS: public SELECT for active+in-window rows; admin/zone_admin write scoped via `private.has_role` + `can_access_zone`.
- GRANTs per rule.
- Add tables to `supabase_realtime` publication.
- Create `home-content` storage bucket (public).

### Server functions (`src/lib/admin/home-content.functions.ts`)
- `listPopularItems / upsertPopularItem / deletePopularItem / reorderPopularItems / togglePopularItem`
- Same set for `HotDeals`, `Specials`, `FeaturedProducts`, `Banners`.
- `listSectionVisibility / setSectionVisibility`.
- `getHomeAnalytics({ days })`.
- All gated by `requireSupabaseAuth` + role/zone check via existing helpers in `src/lib/admin/server-helpers.server.ts`.

### Public server function (`src/lib/public-home.functions.ts`)
- `getHomeContent({ zoneId })` — returns `{ popular, featured, hotDeals, specials, banners, visibility }` from publishable-key client with narrow `TO anon` policies.
- `trackHomeEvent({ contentType, contentId, eventType })` — anon insert into events table (rate-limited via simple per-IP throttle? skipping for v1).

### Admin UI
- New route `src/routes/_authenticated/admin.home-content.tsx` with tabs: Popular | Hot Deals | Specials | Featured | Banners | Seasonal | Ordering | Analytics | Visibility.
- Each tab: table + drawer form (image upload, product picker from existing `products`, schedule pickers, zone picker for main admin).
- Drag-and-drop ordering using `@dnd-kit/sortable` (already installed? will check; if not, simple up/down arrows as fallback).
- Sidebar entry "Home Content" between Content and Products.

### Customer home rewrite
- Replace mock data in `src/data/menu.ts` consumption on `src/routes/index.tsx`, `src/components/product-grid.tsx`, `src/components/offer-grid.tsx`, `src/components/testimonials.tsx` (offers only).
- Loader calls `getHomeContent`; component uses `useSuspenseQuery` + `useRealtimeInvalidate` on `featured_items`, `promotions`, `banners`.
- Preserve existing Framer-derived markup and animations — only swap the data source.

### Security memory
- Update `@security-memory` noting the new public read policies are projection-narrowed and event insert is anon-allowed by design.

## Out of scope (call out if you want them)
- Conversion-rate attribution (requires order→promo linkage table).
- A/B testing of home sections.
- Per-user personalization.
- Approval workflow / drafts (changes go live immediately).

## Technical notes
- Realtime: customer subscribes to `featured_items`, `promotions`, `banners`, `home_section_visibility` filtered by zone; invalidates the `home-content` query key.
- Scheduling enforced at query time, not via pg_cron — simpler, correct, no drift.
- Zone filter on public read: `zone_id IS NULL OR zone_id = :activeZone`.
- Image uploads go through admin server fn → `supabaseAdmin.storage.from('home-content').upload(...)` to keep client free of service role.

Reply **go** to build, or tell me what to change (e.g. "skip analytics", "use new tables instead of altering existing", "drop seasonal").
