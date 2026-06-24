/**
 * Plays a short, premium-feeling notification ping using the Web Audio API
 * so we don't need to ship an audio asset. Safe to call repeatedly; the
 * AudioContext is created lazily and reused.
 */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

export function playNotificationPing(): void {
  const ac = getCtx();
  if (!ac) return;
  // Some browsers suspend until user gesture; ignore if still suspended.
  if (ac.state === "suspended") {
    void ac.resume().catch(() => {});
  }

  const now = ac.currentTime;
  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.connect(ac.destination);

  // Two soft sine "bell" notes — modern, friendly, not aggressive.
  const notes: Array<{ f: number; t: number }> = [
    { f: 880, t: 0 },
    { f: 1320, t: 0.12 },
  ];
  for (const n of notes) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = n.f;
    g.gain.setValueAtTime(0.0001, now + n.t);
    g.gain.exponentialRampToValueAtTime(0.18, now + n.t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + n.t + 0.35);
    osc.connect(g).connect(master);
    osc.start(now + n.t);
    osc.stop(now + n.t + 0.4);
  }

  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(1, now + 0.01);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
}

export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  if (typeof nav.vibrate === "function") {
    try {
      nav.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }
}