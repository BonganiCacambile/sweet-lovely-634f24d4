# Load & Burst Testing

## `burst.k6.js`

Staged ramp: 0 → 100 → 200 → 500 concurrent VUs over 8 minutes across the
public storefront routes (`/`, `/menu/full-menu`, `/cart`, `/contact`,
`/locations`, `/auth`).

### Run against staging

```bash
BASE_URL=https://project--<id>-dev.lovable.app k6 run tests/load/burst.k6.js
```

### Thresholds

- Error rate < 1% overall
- p95 latency < 3s overall, < 2s for `/`, < 1.5s for `/menu`

If thresholds fail, k6 exits non-zero — wire this into CI as a nightly job
against the preview deployment.

## SSR burst monitoring

`src/lib/ssr-alerts.ts` already emits structured `[SSR_ALERT]` and
`[SSR_BURST_ALERT]` log lines during production traffic. Set
`SSR_ALERT_WEBHOOK_URL` to POST bursts to Slack / PagerDuty / etc.

## Investigating rolled-back transactions

The most recent burst run observed ~14k rolled-back transactions since boot.
Run this against the DB to see which statements roll back most often:

```sql
SELECT queryid, calls, rows, mean_exec_time, query
FROM pg_stat_statements
WHERE query ILIKE '%rollback%' OR query ILIKE '%RAISE EXCEPTION%'
ORDER BY calls DESC
LIMIT 20;
```

Expected benign sources: RLS-denied writes from unauthenticated probes, and
`process_order_stock_deduction` raising `Insufficient stock`. If a different
statement dominates, add a targeted fix.