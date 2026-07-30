import { describe, expect, test } from "bun:test";
import { authErrorMessage, isValidEmail, normalizeSouthAfricanPhone } from "../../src/lib/auth-validation";

describe("authentication validation", () => {
  test("normalizes supported South African mobile formats", () => {
    expect(normalizeSouthAfricanPhone("071 234 5678")).toBe("+27712345678");
    expect(normalizeSouthAfricanPhone("+27 71 234 5678")).toBe("+27712345678");
    expect(normalizeSouthAfricanPhone("27712345678")).toBe("+27712345678");
  });

  test("rejects missing, landline, short, and international mobile values", () => {
    expect(normalizeSouthAfricanPhone("")).toBeNull();
    expect(normalizeSouthAfricanPhone("011 234 5678")).toBeNull();
    expect(normalizeSouthAfricanPhone("07123")).toBeNull();
    expect(normalizeSouthAfricanPhone("+447911123456")).toBeNull();
  });

  test("validates email format", () => {
    expect(isValidEmail("person@example.com")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
  });

  test("maps auth failures to safe user messages", () => {
    expect(authErrorMessage({ message: "Invalid login credentials" }, "Fallback")).toBe(
      "The email or password is incorrect.",
    );
    expect(authErrorMessage({ message: "duplicate key value violates unique phone" }, "Fallback")).toBe(
      "That cell number is already linked to an account.",
    );
    expect(authErrorMessage({ status: 429 }, "Fallback")).toContain("Too many attempts");
  });
});