# Sweet 'n Lovely Pizza — Database Migration Package

Complete, verified export of the live production database (PostgreSQL 17), ready to
recreate in a new/external Supabase project.

## Contents (run in this exact order)

| # | File | What it does |
|---|------|--------------|
| 0 | `00_extensions.sql` | Enables required extensions |
| 1 | `01_schema_public.sql` | `public` schema: enums, sequences, tables, all 20 functions, grants |
| 2 | `02_schema_private.sql` | `private` schema: security-definer helpers (`private.has_role`, `can_access_zone`, `get_user_zone`) |
| 3 | `03_data.sql` | All production data — 2,082 rows, original UUIDs/timestamps, column-explicit INSERTs |
| 4 | `04_indexes_constraints_policies.sql` | Primary/unique/foreign keys, 63 indexes, 31 triggers, RLS enable + 96 policies |
| 5 | `05_realtime.sql` | `supabase_realtime` publication + `REPLICA IDENTITY FULL` for 29 tables |
| 6 | `06_storage.sql` | `avatars` bucket + its storage policies |
| 7 | `07_auth_trigger.sql` | `on_auth_user_created` trigger on `auth.users` → `public.handle_new_user()` |

## Step-by-step migration

1. **Create the new Supabase project** (same region as your users; Postgres 15+).
2. **Migrate auth users FIRST.** `public.profiles`, `user_roles`, `orders`, etc. have
   foreign keys to `auth.users`. Use one of:
   - `supabase db dump --data-only --schema auth` from the old project, then restore; or
   - the Auth Admin API (`GET /auth/v1/admin/users` → `POST /auth/v1/admin/users`),
     **preserving each user's `id`** — the UUIDs in this package must match.
   Password hashes only transfer with the `auth` schema dump; via API users must reset passwords.
   Temporarily disable the `on_auth_user_created` trigger during import (step 7 is run last for this reason).
3. **Run the SQL files in order 0 → 7** in the SQL Editor (paste one file at a time) or via CLI:
   ```bash
   for f in 00_extensions.sql 01_schema_public.sql 02_schema_private.sql \
            03_data.sql 04_indexes_constraints_policies.sql \
            05_realtime.sql 06_storage.sql 07_auth_trigger.sql; do
     psql "$NEW_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" || break
   done
   ```
   `03_data.sql` is ~800 KB; if the SQL Editor times out, use `psql` for that file.
4. **Verify** (counts should be: 35 tables, 384 columns, 94 constraints, 63 indexes,
   96 policies, 31 triggers, 22 functions, 2,082 rows):
   ```sql
   select (select count(*) from information_schema.tables  where table_schema='public'),
          (select count(*) from pg_policies where schemaname='public'),
          (select count(*) from pg_indexes  where schemaname='public');
   ```
5. **Point the app at the new project**: update `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` and the server-side
   `SUPABASE_SERVICE_ROLE_KEY`.
6. **Re-add secrets & providers** in the new project: Google OAuth provider + redirect URLs,
   `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY`, and any AI keys. Re-point the Paystack
   webhook to the new domain's `/api/public/paystack-webhook`.

## Files & images

- **Storage bucket `avatars` (private).** Buckets and policies are created by `06_storage.sql`;
  the objects must be copied:
  ```bash
  supabase login
  # download from the old project
  supabase storage cp -r ss://avatars ./avatars-backup --experimental
  # upload into the new project
  supabase link --project-ref <NEW_REF>
  supabase storage cp -r ./avatars-backup ss://avatars --experimental
  ```
  Keep the same object paths (`<user-id>/<file>`), otherwise the per-user RLS policies and the
  `profiles.avatar_url` values will not resolve.
- **Product / homepage images** are external URLs (Framer CDN, GitHub raw, Google avatars)
  stored as text in `products`, `home_*` and `profiles`. They keep working with no action.
  If you want them self-hosted, download each URL, upload to a new public `product-images`
  bucket, and `UPDATE` the corresponding column with the new public URL.
- **App assets** in `src/assets/` ship with the frontend build — nothing to migrate.

## Best practices / gotchas

- Run everything **once, on a brand-new empty project**. `03_data.sql` uses plain INSERTs and
  will produce duplicate-key errors if run twice.
- Never skip step 2; foreign keys in step 4 fail if the auth users are missing.
- Do not edit the dump files by hand — re-generate them instead if the source DB changes.
- After the cutover, take a snapshot (`supabase db dump`) of the new project before going live.
