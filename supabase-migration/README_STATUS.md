# Sweet 'n Lovely Pizza – Migration Package Status

## Files present in this folder

| File | Contents | Status |
|---|---|---|
| `00_schema.sql` | Combined DDL from all `supabase/migrations/` files | Complete |
| `04_data_profiles.sql` | 15 `public.profiles` rows | Complete |
| `04_data_products.sql` | 59 `public.products` rows | Complete |
| `04_data_part1.sql` | `categories`, `delivery_zones`, `home_hot_deals`, `home_popular_items`, `home_section_visibility` | Complete |
| `04_data_small.sql` | `integrations`, `loyalty_programs`, `pizza_toppings`, `product_sizes`, `user_roles` | Complete |
| `04_data_system.sql` | `admin_presence`, `reviews`, `role_permissions`, `store_hours`, `system_settings` | Complete |

## Still needed

The following tables have data that must still be extracted and added to the migration package:

- `public.order_items` (85 rows)
- `public.inventory_movements` (94 rows)
- `public.notifications` (154 rows)
- `public.audit_logs` (1,518 rows)
- `public.orders` (49 rows) — file was generated and removed because it contained invented/placeholder UUIDs; must be regenerated from the live database

## Next steps

1. Extract the remaining tables as `INSERT` statements directly from the production database.
2. Create a single `04_data_orders.sql` with the exact 49 rows from `public.orders`.
3. Create a `04_data_logs.sql` or split file for `notifications`, `inventory_movements`, and the large `audit_logs` table.
4. Create a `04_data_order_items.sql` for the 85 order items.
5. Add `05_foreign_keys.sql`, `06_indexes.sql`, `06b_views.sql`, `07_functions.sql`, `08_triggers.sql`, `09_security.sql`, `10_realtime.sql`, `11_storage.sql`, and `12_auth_trigger.sql`.
6. Validate the full package by running it against a fresh PostgreSQL 17 instance (with Supabase stubs) and comparing object counts.

## Notes

- The `products` file uses the real image URLs (Framer CDN + GitHub raw URLs) stored in production.
- The `profiles` file preserves the original UUIDs and notification-preference JSON so the migrated users behave identically.
- When the remaining data is added, run files in this order: `00_schema.sql` → `04_data_*.sql` → `05_foreign_keys.sql` → `06_indexes.sql` → `06b_views.sql` → `07_functions.sql` → `08_triggers.sql` → `09_security.sql` → `10_realtime.sql` → `11_storage.sql` → `12_auth_trigger.sql`.
