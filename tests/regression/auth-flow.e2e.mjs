#!/usr/bin/env node
import { chromium } from "playwright";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const MAX_LOADING_MS = 10_000;
let failures = 0;

const pass = (message) => console.log(`  ✓ ${message}`);
const fail = (message, error) => {
  failures += 1;
  console.error(`  ✗ ${message}`, error instanceof Error ? error.message : error ?? "");
};

async function check(label, test) {
  try {
    await test();
    pass(label);
  } catch (error) {
    fail(label, error);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(60_000);

  await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded" });
  await page.getByText("Welcome back. Let's get you in.").waitFor();

  await check("signed-out users are redirected from ordering pages", async () => {
    await page.goto(`${BASE_URL}/checkout`, { waitUntil: "domcontentloaded" });
    await page.getByText("Welcome back. Let's get you in.").waitFor({ timeout: MAX_LOADING_MS });
    if (!page.url().endsWith("/auth")) throw new Error(`Expected /auth, received ${page.url()}`);
  });

  await check("registration rejects invalid South African cell numbers", async () => {
    await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Create account", exact: true }).first().click();
    await page.getByPlaceholder("Ada Lovelace").fill("Auth Regression");
    await page.getByPlaceholder("+27 71 234 5678").fill("123");
    await page.getByPlaceholder("you@sweetandlovely.pizza").fill("auth-regression@example.com");
    await page.getByPlaceholder("Create a strong password").fill("Regression1!");
    await page.getByPlaceholder("Repeat your password").fill("Regression1!");
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: "Create account", exact: true }).last().click();
    await page.getByText("Enter a valid South African cell number").waitFor();
  });

  await check("registration requiring confirmation returns to sign-in without hanging", async () => {
    await page.route("**/auth/v1/signup**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "00000000-0000-4000-8000-000000000001",
            aud: "authenticated",
            role: "authenticated",
            email: "auth-regression@example.com",
            created_at: new Date().toISOString(),
            app_metadata: { provider: "email", providers: ["email"] },
            user_metadata: {},
            identities: [],
          },
          session: null,
        }),
      });
    });
    await page.getByPlaceholder("+27 71 234 5678").fill("071 234 5678");
    await page.getByRole("button", { name: "Create account", exact: true }).last().click();
    await page.getByText("Welcome back. Let's get you in.").waitFor({ timeout: MAX_LOADING_MS });
    await page.getByText("Account created. Check your email to verify.").waitFor();
    await page.unroute("**/auth/v1/signup**");
  });

  await check("login validation fails clearly and never leaves a loading screen", async () => {
    await page.getByPlaceholder("you@sweetandlovely.pizza").fill("not-an-email");
    await page.getByPlaceholder("••••••••").fill("WrongPassword1!");
    await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
    await page.getByText("Enter a valid email address").waitFor();
    await page.getByRole("button", { name: "Sign in", exact: true }).last().waitFor();
  });

  await check("forgot-password validates input and accepts a recovery request", async () => {
    await page.goto(`${BASE_URL}/auth/forgot-password`, { waitUntil: "domcontentloaded" });
    const email = page.getByPlaceholder("you@sweetandlovely.pizza");
    await email.fill("invalid");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await page.getByText("Enter a valid email address").waitFor();
    await page.route("**/auth/v1/recover**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await email.fill("auth-regression@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await page.getByText("Check your inbox").waitFor({ timeout: MAX_LOADING_MS });
    await page.unroute("**/auth/v1/recover**");
  });

  await check("an invalid recovery link exits verification loading state", async () => {
    await page.goto(`${BASE_URL}/auth/reset-password`, { waitUntil: "domcontentloaded" });
    await page.getByText("This page must be opened from the reset link we emailed you.", { exact: false })
      .waitFor({ timeout: MAX_LOADING_MS });
  });

  await browser.close();
  if (failures) process.exit(1);
  console.log("\n[auth-flow-e2e] OK — registration, login, redirects, recovery, and loading states verified");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});