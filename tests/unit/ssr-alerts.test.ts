import { describe, it, expect, beforeEach, vi } from "vitest";
import { reportSsrException, __resetSsrAlertsForTests } from "../../src/lib/ssr-alerts";

describe("ssr-alerts", () => {
  beforeEach(() => {
    __resetSsrAlertsForTests();
    vi.restoreAllMocks();
  });

  it("logs a structured SSR_ALERT line for each exception", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportSsrException(new Error("boom"), { source: "server-entry", path: "/x" });
    const line = spy.mock.calls[0]?.[0] as string;
    expect(line).toContain("[SSR_ALERT]");
    const json = JSON.parse(line.replace("[SSR_ALERT] ", ""));
    expect(json.kind).toBe("Error");
    expect(json.message).toBe("boom");
    expect(json.path).toBe("/x");
  });

  it("classifies Disallowed operation errors distinctly", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportSsrException(new Error("Disallowed operation called in global scope"), {
      source: "h3-swallowed",
    });
    const json = JSON.parse((spy.mock.calls[0]?.[0] as string).replace("[SSR_ALERT] ", ""));
    expect(json.kind).toBe("DisallowedOperation");
  });

  it("emits a burst alert once threshold is reached within the window", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    for (let i = 0; i < 5; i++) {
      reportSsrException(new Error("Disallowed operation"), { source: "server-entry" });
    }
    const burstLines = spy.mock.calls
      .map((c) => c[0] as string)
      .filter((l) => typeof l === "string" && l.startsWith("[SSR_BURST_ALERT]"));
    expect(burstLines.length).toBe(1);
    const json = JSON.parse(burstLines[0].replace("[SSR_BURST_ALERT] ", ""));
    expect(json.kind).toBe("DisallowedOperation");
    expect(json.count).toBeGreaterThanOrEqual(5);
  });
});