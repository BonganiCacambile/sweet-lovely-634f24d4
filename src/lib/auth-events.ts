type AuthEventName =
  | "registration"
  | "login"
  | "logout"
  | "phone_verification"
  | "password_reset_request"
  | "password_reset_confirmation"
  | "redirect"
  | "session_initialization"
  | "authentication_listener"
  | "profile_creation";

type AuthEventStatus = "started" | "succeeded" | "failed" | "timed_out";

export function logAuthEvent(
  event: AuthEventName,
  status: AuthEventStatus,
  details: Record<string, string | number | boolean | null> = {},
) {
  const safeDetails = Object.fromEntries(
    Object.entries(details).filter(([key]) => !/email|phone|password|token|secret|session/i.test(key)),
  );
  const entry = { scope: "auth", event, status, ...safeDetails, at: new Date().toISOString() };
  if (status === "failed" || status === "timed_out") console.warn("[auth]", entry);
  else console.info("[auth]", entry);
}