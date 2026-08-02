import { createHash } from "crypto";

/**
 * Checks a password against the HaveIBeenPwned breach corpus using the
 * k-anonymity range API (only the first 5 hash chars ever leave the server).
 * Fails open on network errors so sign-up is never blocked by an outage.
 */
export async function isPasswordBreached(password: string): Promise<boolean> {
  try {
    const hash = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
    });
    if (!res.ok) return false;
    const body = await res.text();
    for (const line of body.split("\n")) {
      const [candidate, count] = line.trim().split(":");
      if (candidate === suffix && Number(count) > 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}