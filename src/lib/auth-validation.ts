const SA_MOBILE = /^(?:\+27|27|0)(6[0-9]|7[0-9]|8[0-9])[0-9]{7}$/;

export function normalizeSouthAfricanPhone(value: string) {
  const compact = value.trim().replace(/[\s()-]/g, "");
  if (!SA_MOBILE.test(compact)) return null;
  if (compact.startsWith("+27")) return compact;
  if (compact.startsWith("27")) return `+${compact}`;
  return `+27${compact.slice(1)}`;
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function authErrorMessage(error: { message?: string; status?: number } | null, fallback: string) {
  const message = error?.message?.toLowerCase() ?? "";
  if (message.includes("already registered") || message.includes("already exists")) {
    return "An account with these details already exists. Try signing in instead.";
  }
  if (message.includes("phone") && (message.includes("duplicate") || message.includes("unique"))) {
    return "That cell number is already linked to an account.";
  }
  if (message.includes("invalid login credentials")) return "The email or password is incorrect.";
  if (message.includes("email not confirmed")) return "Please confirm your email before signing in.";
  if (message.includes("expired")) return "This link has expired. Please request a new one.";
  if (error?.status === 429) return "Too many attempts. Please wait a moment and try again.";
  return fallback;
}