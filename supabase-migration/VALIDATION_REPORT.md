# Validation Report

The package was executed end-to-end against a clean PostgreSQL 17.9 instance with a
Supabase-compatible harness (roles `anon`/`authenticated`/`service_role`, `auth`, `storage`,
`extensions` schemas and `auth.uid()` / `storage.foldername()` stubs).

All 8 files ran with `ON_ERROR_STOP=1` and **zero errors**.

## Object comparison — production vs rebuilt

| Object | Production | Rebuilt |
|---|---|---|
| Tables (public) | 35 | 35 |
| Columns | 384 | 384 |
| Constraints | 94 | 94 |
| Indexes | 63 | 63 |
| RLS policies | 96 | 96 |
| Triggers | 31 | 31 |
| Functions (public + private) | 22 | 22 |

## Data

Per-table row counts were compared across all 35 tables — **exact match**, 2,082 rows total,
with original UUIDs, foreign-key relationships and timestamps preserved.

## Notes

- Environment-specific grants to a sandbox role were stripped; all Supabase role grants
  (`anon`, `authenticated`, `service_role`, `postgres`) are preserved.
- Realtime: 29 tables in the `supabase_realtime` publication with `REPLICA IDENTITY FULL`.
