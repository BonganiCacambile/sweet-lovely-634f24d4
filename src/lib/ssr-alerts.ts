// Structured SSR-exception logging + burst detection.
//
// Every SSR error caught by `src/server.ts` or the request `errorMiddleware`
// flows through `reportSsrException`. It emits a single-line JSON log tagged
// `[SSR_ALERT]` so log-based alerts can match on that literal, and it tracks
// a rolling window to emit a `[SSR_BURST_ALERT]` line when the error rate
// crosses a threshold — this is what surfaces "Disallowed operation" bursts.
//
// If `SSR_ALERT_WEBHOOK_URL` is configured, alert payloads are also POSTed
// there (fire-and-forget) so external monitors (Slack/Discord/PagerDuty
// incoming webhooks, etc.) can page on the burst without polling logs.

const WINDOW_MS = 60_000;
const BURST_THRESHOLD = 5;
const BURST_COOLDOWN_MS = 5 * 60_000;

type Bucket = { timestamps: number[]; lastBurstAt: number };
const buckets = new Map<string, Bucket>();

function classify(error: unknown): { kind: string; message: string; stack?: string } {
  if (error instanceof Error) {
    const msg = error.message ?? "";
    let kind = error.name || "Error";
    if (/disallowed operation/i.test(msg)) kind = "DisallowedOperation";
    else if (/permission denied/i.test(msg)) kind = "PermissionDenied";
    else if (/HTTPError/i.test(msg)) kind = "HTTPError";
    return { kind, message: msg, stack: error.stack };
  }
  try {
    return { kind: "NonError", message: JSON.stringify(error) };
  } catch {
    return { kind: "NonError", message: String(error) };
  }
}

async function postWebhook(payload: Record<string, unknown>): Promise<void> {
  const url = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env?.SSR_ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn("[SSR_ALERT] webhook post failed:", err);
  }
}

export type SsrErrorContext = {
  path?: string;
  method?: string;
  source: "server-entry" | "request-middleware" | "h3-swallowed";
};

export function reportSsrException(error: unknown, ctx: SsrErrorContext): void {
  const info = classify(error);
  const now = Date.now();

  const record = {
    tag: "SSR_ALERT",
    at: new Date(now).toISOString(),
    kind: info.kind,
    message: info.message,
    source: ctx.source,
    path: ctx.path,
    method: ctx.method,
    stack: info.stack,
  };
  // Single JSON line — grep-friendly for log-based alerts.
  console.error(`[SSR_ALERT] ${JSON.stringify(record)}`);

  const bucket = buckets.get(info.kind) ?? { timestamps: [], lastBurstAt: 0 };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS);
  bucket.timestamps.push(now);
  buckets.set(info.kind, bucket);

  if (
    bucket.timestamps.length >= BURST_THRESHOLD &&
    now - bucket.lastBurstAt > BURST_COOLDOWN_MS
  ) {
    bucket.lastBurstAt = now;
    const burst = {
      tag: "SSR_BURST_ALERT",
      at: new Date(now).toISOString(),
      kind: info.kind,
      count: bucket.timestamps.length,
      windowMs: WINDOW_MS,
      sampleMessage: info.message,
      samplePath: ctx.path,
    };
    console.error(`[SSR_BURST_ALERT] ${JSON.stringify(burst)}`);
    void postWebhook(burst);
  }
}

// Test-only helper.
export function __resetSsrAlertsForTests(): void {
  buckets.clear();
}