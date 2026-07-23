## Goal
Bring the Pizza-style size selection modal to the BBQ category — same design, animations, and layout — but **without** the "Add toppings" step. Admins can add/edit/reorder unlimited sizes per BBQ product from Admin → Products, and every change propagates to customers in real-time.

## 1. Database (Lovable Cloud)

New table + product flag, both realtime-enabled:

```text
public.product_sizes
├─ id uuid pk
├─ product_slug text fk → products.slug ON DELETE CASCADE
├─ name text            (Small, Half Chicken, 300g, Family…)
├─ description text     (optional — "Perfect for one")
├─ portion text         (optional — "300g", "1/4 chicken")
├─ price_zar numeric
├─ sort_order int
├─ is_available bool default true
├─ created_at / updated_at
```

Plus `products.size_selection_enabled bool default false` so admins can toggle the size picker per product.

- RLS: public `SELECT` for available sizes (`is_available = true` on active products); admin-only `INSERT/UPDATE/DELETE` via `private.has_role`.
- Grants: `SELECT` to anon/authenticated; full CRUD to authenticated (gated by RLS); ALL to service_role.
- Realtime: add `product_sizes` and `products` to `supabase_realtime` publication (products is already covered).

## 2. Cart identity

Extend `src/lib/cart-id.ts` to a general `splitVariantId(id)` returning `{ slug, size: "medium"|"large"|null, sizeId: uuid|null }`:

- Pizza cart id stays `${slug}-medium|large[-x-<hash>]` (unchanged).
- BBQ cart id becomes `${slug}--sz-${sizeId}` — clean separator, no collision with pizza suffixes.
- Server (`paystack.functions.ts`, `checkCartStock`) uses the base slug for stock aggregation and looks up the authoritative price from `product_sizes` when `sizeId` is present.

## 3. Customer modal (reuse existing component)

`src/components/cart/add-to-cart-button.tsx`:

- Accept new prop `sizes?: ProductSize[]`. When present, render the same modal shell but:
  - Header: "Step 1 · Choose your size" (no step 2).
  - Grid of size cards (2-col mobile, 3-col ≥sm when >2 sizes) using the identical card treatment as pizza (border-2, red highlight, check badge, hover lift, price in brand red).
  - Each card shows: name, description (if any), portion (if any), price.
  - Live total in the footer updates on selection.
  - CTA changes to `Add to cart · R<total>` and closes the modal — no toppings step at all.
- Pizza flow is untouched (still `isPizza`).

## 4. Menu wiring

- `src/lib/public-menu.functions.ts` also selects `product_sizes` (available only) and `size_selection_enabled`, returning them alongside products.
- `src/routes/menu.full-menu.tsx` and `src/routes/index.tsx` merge sizes onto items and pass them to `ProductGrid`.
- `src/components/product-grid.tsx` + `src/components/menu-card.tsx` forward `sizes` and open the modal when `sizes.length > 0` (BBQ) or `isPizza` (pizza).
- `useRealtimeInvalidate(["products","product_sizes","categories"], [["public-menu"]])` keeps the store live.

## 5. Admin → Products

Extend the existing product drawer (`src/routes/_authenticated/admin.products.tsx`):

- Toggle: **Enable size selection**.
- When enabled, a "Product sizes" section with:
  - Sortable rows (drag handle or up/down buttons), each editing name, description, portion, price, availability toggle.
  - "Add size" button (unlimited rows).
  - Delete row.
- New admin server fns in `src/lib/admin/product-sizes.functions.ts`: `listSizes`, `upsertSizes` (bulk replace on save), `deleteSize`. All admin-gated via `requireAdmin`.
- Product save flow persists sizes atomically after the product update.

## 6. Regression coverage

- Unit: extend `tests/unit/cart-id-split.test.ts` with BBQ `--sz-<uuid>` cases.
- Realtime: add `product_sizes` to the existing `realtime-menu-invalidation.mjs` assertions.

## Technical notes

- Reuses `useRealtimeInvalidate` and the existing pizza modal component — no duplicate UI code.
- Server price resolution stays authoritative: client-supplied prices are ignored in `verifyAndCreateOrder`; BBQ size prices come from `product_sizes`.
- Backward compatible: pizza cart ids, pizza modal, existing `price_medium_zar`/`price_large_zar` fields and stock aggregation are unchanged.
