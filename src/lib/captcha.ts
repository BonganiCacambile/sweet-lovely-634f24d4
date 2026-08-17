/**
 * Supabase Auth captcha protection support.
 *
 * When captcha protection is enabled on the Supabase project, every auth
 * endpoint (sign-in, sign-up, recover, otp) rejects requests that do not carry
 * a `captchaToken`. Set VITE_CAPTCHA_PROVIDER ("hcaptcha" | "turnstile") and
 * VITE_CAPTCHA_SITE_KEY to make the app solve the challenge invisibly.
 *
 * When no site key is configured this resolves to `undefined`, which is the
 * correct behaviour for projects with captcha protection turned off.
 */
type Provider = "hcaptcha" | "turnstile";

const SITE_KEY = (import.meta.env['VITE_CAPTCHA_SITE_KEY'] as string | undefined)?.trim();
const PROVIDER = ((import.meta.env['VITE_CAPTCHA_PROVIDER'] as string | undefined)?.trim() ||
  "hcaptcha") as Provider;

export const captchaEnabled = Boolean(SITE_KEY);

const SCRIPTS: Record<Provider, string> = {
  hcaptcha: "https://js.hcaptcha.com/1/api.js?render=explicit",
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
};

let scriptPromise: Promise<void> | null = null;

function loadScript(src: string) {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.defer = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("captcha script failed to load"));
    document.head.appendChild(el);
  });
  return scriptPromise;
}

function container() {
  let node = document.getElementById("lovable-captcha-host");
  if (!node) {
    node = document.createElement("div");
    node.id = "lovable-captcha-host";
    node.style.position = "fixed";
    node.style.bottom = "0";
    node.style.left = "0";
    node.style.zIndex = "-1";
    node.style.opacity = "0";
    node.style.pointerEvents = "none";
    document.body.appendChild(node);
  }
  return node;
}

/**
 * Returns a fresh captcha token, or undefined when captcha is not configured
 * (or the challenge could not be solved — the auth call then surfaces the
 * server-side captcha error with a clear message).
 */
export async function getCaptchaToken(): Promise<string | undefined> {
  if (!SITE_KEY || typeof window === "undefined") return undefined;
  try {
    await loadScript(SCRIPTS[PROVIDER]);
    const api = (window as unknown as Record<string, any>)[
      PROVIDER === "turnstile" ? "turnstile" : "hcaptcha"
    ];
    if (!api) return undefined;
    return await new Promise<string | undefined>((resolve) => {
      const host = container();
      host.innerHTML = "";
      const timer = window.setTimeout(() => resolve(undefined), 15000);
      const done = (token?: string) => {
        window.clearTimeout(timer);
        resolve(token);
      };
      if (PROVIDER === "turnstile") {
        api.render(host, {
          sitekey: SITE_KEY,
          size: "invisible",
          callback: (token: string) => done(token),
          "error-callback": () => done(undefined),
        });
      } else {
        const id = api.render(host, {
          sitekey: SITE_KEY,
          size: "invisible",
          callback: (token: string) => done(token),
          "error-callback": () => done(undefined),
          "close-callback": () => done(undefined),
        });
        api.execute(id);
      }
    });
  } catch {
    return undefined;
  }
}
