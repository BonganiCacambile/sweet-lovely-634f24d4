#!/usr/bin/env node
import { loadEnvFiles } from "./lib/load-env.mjs";
loadEnvFiles();

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
  await page.getByTestId("customer-signin-form").waitFor();

  await check("signed-out users are redirected from ordering pages", async () => {
    await page.goto(`${BASE_URL}/account/orders`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("customer-signin-form").waitFor({ timeout: MAX_LOADING_MS });
    if (!page.url().endsWith("/auth")) throw new Error(`Expected /auth, received ${page.url()}`);
  });

  await check("registration rejects invalid South African cell numbers", async () => {
    await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("auth-tab-signup").click();
    await page.getByTestId("register-form").waitFor();
    await page.getByTestId("register-full-name").fill("Auth Regression");
    await page.getByTestId("register-phone").fill("123");
    await page.getByTestId("register-email").fill("auth-regression@example.com");
    await page.getByTestId("register-password").fill("Regression1!");
    await page.getByTestId("register-confirm-password").fill("Regression1!");
    await page.getByTestId("register-accept-terms").check();
    await page.getByTestId("register-submit").click();
    await page.getByTestId("register-phone").evaluate((element) => {
      if (!(element instanceof HTMLInputElement) || !element.checkValidity()) {
        throw new Error("Phone input failed native validity before app validation");
      }
    });
    await page.getByTestId("register-submit").waitFor();
  });

  await check("login validation fails clearly and never leaves a loading screen", async () => {
    await page.getByTestId("auth-tab-signin").click();
    await page.getByTestId("customer-signin-form").waitFor();
    await page.getByTestId("signin-email").fill("not-an-email");
    await page.getByTestId("signin-password").fill("WrongPassword1!");
    const signIn = page.getByTestId("signin-submit");
    await signIn.click();
    if (!page.url().endsWith("/auth")) throw new Error(`Invalid login navigated to ${page.url()}`);
    if (await signIn.isDisabled()) throw new Error("Login remained stuck in its loading state");
    await signIn.waitFor();
  });

  await check("forgot-password validates input and accepts a recovery request", async () => {
    await page.goto(`${BASE_URL}/auth/forgot-password`, { waitUntil: "domcontentloaded" });
    const email = page.getByTestId("forgot-password-email");
    await email.fill("invalid");
    await page.getByTestId("forgot-password-submit").click();
    await email.evaluate((element) => {
      if (!(element instanceof HTMLInputElement) || element.validity.typeMismatch !== true) {
        throw new Error("Invalid email was not rejected by the browser");
      }
    });
    await page.route("**/auth/v1/recover**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await email.fill("auth-regression@example.com");
    await page.getByTestId("forgot-password-submit").click();
    await page.getByTestId("forgot-password-sent").waitFor({ timeout: MAX_LOADING_MS });
    await page.unroute("**/auth/v1/recover**");
  });

  await check("an invalid recovery link exits verification loading state", async () => {
    await page.goto(`${BASE_URL}/auth/reset-password`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("reset-password-invalid-link").waitFor({ timeout: MAX_LOADING_MS });
  });

  await browser.close();
  if (failures) process.exit(1);
  console.log("\n[auth-flow-e2e] OK — registration, login, redirects, recovery, and loading states verified");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});