import { describe, expect, test } from "bun:test";
import { validateConfig, renderReport } from "../../scripts/validate-config.mjs";

// Minimal set of valid values for the "server" scope. Fake but well-formed.
const VALID_SERVER_ENV = {
  SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnopqrstuvwx",
  SUPABASE_PROJECT_ID: "abcdefghijklmnop",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_abcdefghijklmnopqrstuvwx",
  PAYSTACK_SECRET_KEY: "sk_test_abcdefghijklmnop1234567890",
};

const VALID_CI_EXTRAS = {
  VITE_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnopqrstuvwx",
  VITE_SUPABASE_PROJECT_ID: "abcdefghijklmnop",
  ADMIN_EMAIL: "admin@example.com",
  ADMIN_PASSWORD: "supersecret1",
};

describe("validateConfig — happy path", () => {
  test("passes with a complete server env", () => {
    const result = validateConfig({ scope: "server", env: { ...VALID_SERVER_ENV } });
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.invalid).toEqual([]);
    expect(result.checked).toEqual(expect.arrayContaining(Object.keys(VALID_SERVER_ENV)));
  });

  test("passes with a complete ci env (client + admin extras)", () => {
    const result = validateConfig({
      scope: "ci",
      env: { ...VALID_SERVER_ENV, ...VALID_CI_EXTRAS },
    });
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.invalid).toEqual([]);
  });
});

describe("validateConfig — missing variables", () => {
  test("reports every missing required var for server scope", () => {
    const result = validateConfig({ scope: "server", env: {} });
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(
      expect.arrayContaining([
        "SUPABASE_URL",
        "SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_PROJECT_ID",
        "SUPABASE_SERVICE_ROLE_KEY",
        "PAYSTACK_SECRET_KEY",
      ]),
    );
  });

  test("blank string is treated as missing", () => {
    const env = { ...VALID_SERVER_ENV, SUPABASE_URL: "" };
    const result = validateConfig({ scope: "server", env });
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("SUPABASE_URL");
  });

  test("optional vars stay silent when absent", () => {
    const result = validateConfig({ scope: "server", env: { ...VALID_SERVER_ENV } });
    expect(result.missing).not.toContain("PAYSTACK_PUBLIC_KEY");
    expect(result.missing).not.toContain("PREVIEW_SUPABASE_URL");
  });

  test("ci scope demands VITE_ mirrors and admin credentials", () => {
    const result = validateConfig({ scope: "ci", env: { ...VALID_SERVER_ENV } });
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(
      expect.arrayContaining([
        "VITE_SUPABASE_URL",
        "VITE_SUPABASE_PUBLISHABLE_KEY",
        "VITE_SUPABASE_PROJECT_ID",
        "ADMIN_EMAIL",
        "ADMIN_PASSWORD",
      ]),
    );
  });
});

describe("validateConfig — malformed values", () => {
  test("http (non-https) URL is invalid", () => {
    const env = { ...VALID_SERVER_ENV, SUPABASE_URL: "http://abcdefghijklmnop.supabase.co" };
    const result = validateConfig({ scope: "server", env });
    expect(result.ok).toBe(false);
    expect(result.invalid.find((i) => i.name === "SUPABASE_URL")?.reason).toBe("value has wrong format");
  });

  test("localhost URL is invalid", () => {
    const env = { ...VALID_SERVER_ENV, SUPABASE_URL: "https://localhost:8080" };
    const result = validateConfig({ scope: "server", env });
    expect(result.invalid.some((i) => i.name === "SUPABASE_URL")).toBe(true);
  });

  test("placeholder-looking value is flagged with expected hint", () => {
    const env = { ...VALID_SERVER_ENV, SUPABASE_PUBLISHABLE_KEY: "your-key-here" };
    const result = validateConfig({ scope: "server", env });
    const entry = result.invalid.find((i) => i.name === "SUPABASE_PUBLISHABLE_KEY");
    expect(entry?.reason).toBe("value looks like a placeholder");
    expect(entry?.expected).toBeTruthy();
  });

  test("angle-bracket placeholder is flagged", () => {
    const env = { ...VALID_SERVER_ENV, SUPABASE_PROJECT_ID: "<project-id>" };
    const result = validateConfig({ scope: "server", env });
    expect(result.invalid.some((i) => i.name === "SUPABASE_PROJECT_ID")).toBe(true);
  });

  test("leading/trailing whitespace is flagged before format check", () => {
    const env = { ...VALID_SERVER_ENV, SUPABASE_PROJECT_ID: " abcdefghijklmnop " };
    const result = validateConfig({ scope: "server", env });
    const entry = result.invalid.find((i) => i.name === "SUPABASE_PROJECT_ID");
    expect(entry?.reason).toBe("value has leading/trailing whitespace");
  });

  test("malformed Paystack secret key is rejected", () => {
    const env = { ...VALID_SERVER_ENV, PAYSTACK_SECRET_KEY: "pk_test_wrongprefix1234567890" };
    const result = validateConfig({ scope: "server", env });
    expect(result.invalid.some((i) => i.name === "PAYSTACK_SECRET_KEY")).toBe(true);
  });

  test("Supabase key that is neither JWT nor sb_ prefixed is rejected", () => {
    const env = { ...VALID_SERVER_ENV, SUPABASE_PUBLISHABLE_KEY: "not-a-real-key" };
    const result = validateConfig({ scope: "server", env });
    expect(result.invalid.some((i) => i.name === "SUPABASE_PUBLISHABLE_KEY")).toBe(true);
  });

  test("invalid ADMIN_EMAIL and short ADMIN_PASSWORD are rejected in ci scope", () => {
    const env = {
      ...VALID_SERVER_ENV,
      ...VALID_CI_EXTRAS,
      ADMIN_EMAIL: "not-an-email",
      ADMIN_PASSWORD: "short",
    };
    const result = validateConfig({ scope: "ci", env });
    expect(result.invalid.some((i) => i.name === "ADMIN_EMAIL")).toBe(true);
    expect(result.invalid.some((i) => i.name === "ADMIN_PASSWORD")).toBe(true);
  });

  test("optional PREVIEW vars are validated when present", () => {
    const env = {
      ...VALID_SERVER_ENV,
      PREVIEW_SUPABASE_URL: "http://not-https.example.com",
    };
    const result = validateConfig({ scope: "server", env });
    expect(result.invalid.some((i) => i.name === "PREVIEW_SUPABASE_URL")).toBe(true);
  });
});

describe("renderReport", () => {
  test("produces an actionable failure report without leaking values", () => {
    const env = {
      ...VALID_SERVER_ENV,
      SUPABASE_URL: "",
      SUPABASE_PUBLISHABLE_KEY: "totally-secret-value-should-not-appear",
    };
    const result = validateConfig({ scope: "server", env });
    const report = renderReport(result);

    expect(report).toContain("Startup Configuration Validation Failed");
    expect(report).toContain("Scope: server");
    expect(report).toContain("Missing Variables:");
    expect(report).toContain("SUPABASE_URL");
    expect(report).toContain("Invalid Variables:");
    expect(report).toContain("SUPABASE_PUBLISHABLE_KEY");
    expect(report).toContain("Reason:");
    expect(report).toContain("Application startup has been stopped.");
    // Never echo the actual secret value.
    expect(report).not.toContain("totally-secret-value-should-not-appear");
  });

  test("produces a passing report on success", () => {
    const result = validateConfig({ scope: "server", env: { ...VALID_SERVER_ENV } });
    const report = renderReport(result);
    expect(report).toContain("Startup Configuration Validation Passed");
    expect(report).not.toContain("Missing Variables:");
    expect(report).not.toContain("Invalid Variables:");
  });
});