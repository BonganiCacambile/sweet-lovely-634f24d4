import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { reportSsrException, __resetSsrAlertsForTests } from "../../src/lib/ssr-alerts";

type FetchCall = { url: string; init: RequestInit };

describe("ssr-alerts webhook integration", () => {
  const originalFetch = globalThis.fetch;
  const originalProcess = (globalThis as any).process;
  let fetchCalls: FetchCall[];
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    __resetSsrAlertsForTests();
    fetchCalls = [];
    (globalThis as any).process = {
      ...(originalProcess ?? {}),
      env: {
        ...(originalProcess?.env ?? {}),
        SSR_ALERT_WEBHOOK_URL: "https://hooks.example.com/ssr",
      },
    };
    globalThis.fetch = vi.fn(async (url: any, init: any) => {
      fetchCalls.push({ url: String(url), init: init as RequestInit });
      return new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    (globalThis as any).process = originalProcess;
    vi.restoreAllMocks();
  });

  async function flushMicrotasks() {
    // The webhook post is fire-and-forget (`void postWebhook`) — yield so its
    // promise chain (await fetch) resolves before we assert.
    for (let i = 0; i < 5; i++) await Promise.resolve();
  }

  it("POSTs a burst alert payload to the configured webhook exactly once per cooldown window", async () => {
    for (let i = 0; i < 5; i++) {
      reportSsrException(new Error("Disallowed operation called in global scope"), {
        source: "server-entry",
        path: "/cart",
        method: "GET",
      });
    }
    await flushMicrotasks();

    expect(fetchCalls).toHaveLength(1);
    const call = fetchCalls[0];
    expect(call.url).toBe("https://hooks.example.com/ssr");
    expect(call.init.method).toBe("POST");
    expect((call.init.headers as Record<string, string>)["content-type"]).toBe(
      "application/json",
    );

    const body = JSON.parse(call.init.body as string);
    expect(body.tag).toBe("SSR_BURST_ALERT");
    expect(body.kind).toBe("DisallowedOperation");
    expect(body.count).toBeGreaterThanOrEqual(5);
    expect(body.windowMs).toBe(60_000);
    expect(body.samplePath).toBe("/cart");
    expect(typeof body.at).toBe("string");

    // Additional errors within cooldown must not re-POST.
    for (let i = 0; i < 10; i++) {
      reportSsrException(new Error("Disallowed operation"), { source: "server-entry" });
    }
    await flushMicrotasks();
    expect(fetchCalls).toHaveLength(1);

    // And the logger still emitted a structured per-exception line for each call.
    const alertLines = errorSpy.mock.calls
      .map((c) => c[0] as string)
      .filter((l) => typeof l === "string" && l.startsWith("[SSR_ALERT]"));
    expect(alertLines.length).toBe(15);
  });

  it("does not POST when the threshold is not reached", async () => {
    for (let i = 0; i < 4; i++) {
      reportSsrException(new Error("Disallowed operation"), { source: "server-entry" });
    }
    await flushMicrotasks();
    expect(fetchCalls).toHaveLength(0);
  });

  it("does not POST when no webhook URL is configured", async () => {
    (globalThis as any).process.env.SSR_ALERT_WEBHOOK_URL = undefined;
    for (let i = 0; i < 6; i++) {
      reportSsrException(new Error("Disallowed operation"), { source: "server-entry" });
    }
    await flushMicrotasks();
    expect(fetchCalls).toHaveLength(0);
  });
});