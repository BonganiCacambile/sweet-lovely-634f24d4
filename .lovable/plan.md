# Customize Your Pizza — Extra Toppings

This is a large feature. Before I build, I want to confirm scope so we don't waste effort on parts you don't need yet.

## What I'll build (proposed phasing)

### Phase 1 — Customer experience (core)
Replace the current pizza size picker in `AddToCartButton` with a two-step **"Customize Your Pizza"** modal:

1. **Size step** — keep existing Medium (R80) / Large (R150) selection, same look.
2. **Toppings step** — new premium section:
   - Heading: 🍕 Customize Your Pizza, subtitle: "Make it your own by adding delicious extra toppings."
   - Responsive grid of topping cards (image, name, price, animated checkbox, hover/scale, highlighted border on select).
   - Multi-select, no limit.
   - Live "Selected Extras" summary + live total (base + extras).
   - Sticky "Add to cart — RXX.XX" CTA.
   - Skip button ("No extras, add to cart").
3. **Cart integration** — extend `CartItem` with `extras: {id,name,price}[]` and `extrasTotal`. Line-item id keys off size + sorted extras so "Large + Bacon + Cheese" and "Large + Cheese" are separate lines. Cart drawer, `/cart`, `/checkout`, checkout success, order history, admin order details, kitchen view, and receipts all render selected extras beneath the pizza title.

### Phase 2 — Data model + realtime
New Supabase table `pizza_toppings`:

```text
id uuid pk
name text
slug text unique
price_zar numeric
image_url text
is_active boolean
is_available boolean   -- derived from inventory or manual
stock int nullable     -- optional inventory link
display_order int
created_at / updated_at
```

- GRANT SELECT to `anon, authenticated`; full CRUD to admin via RLS + `has_role('admin')`.
- Add table to `supabase_realtime` publication.
- Seed the 11 toppings from your list.
- Customer app subscribes via existing `useRealtimeInvalidate` on `pizza_toppings` so admin edits (price / image / availability / order / new items) appear instantly.
- Out-of-stock toppings render disabled with "Currently unavailable" pill; can't be selected.

### Phase 3 — Admin dashboard
New route `admin.toppings.tsx` (main-admin only) with a table + drawer editor:
- Add / edit / delete
- Price, image upload (to existing storage bucket), enable/disable
- Drag-to-reorder (display_order)
- Manual "Out of stock" toggle
Deferred unless you want it now: per-delivery-zone availability (needs a join table).

### Phase 4 — Images
Generate 11 restaurant-quality topping images (transparent PNGs, consistent top-down angle, matching lighting) via imagegen premium, upload as lovable-assets, seed URLs into `pizza_toppings.image_url`. Admin can replace later.

## Technical details

- **Where the modal lives**: extend existing `src/components/cart/add-to-cart-button.tsx` — keep its portal, animations, and styling; add a second panel/step. No changes to `MenuCard` / `ProductGrid` / product page layout.
- **Cart schema migration**: `CartItem` gains optional `extras` + `extrasTotal`. Storage key stays `sweet-lovely-cart-v1`; old carts load with `extras = []` (backward-compatible).
- **Order persistence**: `order_items` already stores per-line data — add `extras jsonb` column (nullable) via migration so extras survive into orders, checkout success, order history, and admin. Kitchen/admin views read `extras` and render below the item title.
- **No design changes**: reuses the existing red `#ff003c`, rounded-3xl cards, spring animations, and portal pattern already in `AddToCartButton`. Nothing on `/`, `/menu/full-menu`, or product cards changes visually until a user clicks Add.

## Questions before I start

1. **Scope this turn** — build all four phases in one pass, or Phase 1+2+4 now (customer + data + images + realtime) and admin CRUD next turn? Phase 3 is the biggest chunk on its own.
2. **Delivery-zone availability** — you listed it in requirements. Include now (needs a `topping_zone_availability` join table + zone-aware customer query) or defer?
3. **Inventory link** — hard link toppings to a stock count that decrements on order, or just an admin-controlled `is_available` toggle for now? Full stock decrement means extending `process_order_stock_deduction` too.
4. **Topping images** — OK to generate all 11 with imagegen premium (transparent PNGs), or will you upload your own reference photos?
