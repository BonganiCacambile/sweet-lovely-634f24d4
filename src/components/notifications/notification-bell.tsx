import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { useNotifications } from "@/lib/notifications-context";
import { useAuth } from "@/lib/auth-context";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function NotificationBell() {
  const { user } = useAuth();
  const { unread, recent, rtStatus, markAllRead, markOneRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!user) return null;

  return (
    <div ref={ref} className="pointer-events-auto relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        data-testid="notification-bell"
        data-rt-status={rtStatus}
        data-unread-count={unread}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-neutral-800 ring-1 ring-black/5 shadow-[0_6px_20px_-8px_rgba(0,0,0,0.25)] backdrop-blur-md transition hover:bg-white hover:scale-105 sm:h-10 sm:w-10"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#ff003c] px-1 text-[10px] font-bold leading-[18px] text-white shadow ring-2 ring-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[92vw] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl animate-in fade-in slide-in-from-top-1"
        >
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-neutral-900">Notifications</p>
              <p className="text-xs text-neutral-500">
                {unread > 0 ? `${unread} unread` : "You're all caught up"}
              </p>
            </div>
            <button
              onClick={() => void markAllRead()}
              disabled={unread === 0}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff0f3] text-[#ff003c]">
                  <Bell className="h-5 w-5" />
                </span>
                <p className="text-sm font-semibold text-neutral-900">No notifications yet</p>
                <p className="mt-1 text-xs text-neutral-500">We'll alert you the moment something happens.</p>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {recent.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!n.read) void markOneRead(n.id);
                      }}
                      className={
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-neutral-50 " +
                        (n.read ? "" : "bg-[#fff7f9]")
                      }
                    >
                      <span
                        className={
                          "mt-1.5 inline-block h-2 w-2 flex-none rounded-full " +
                          (n.read ? "bg-transparent" : "bg-[#ff003c]")
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span
                            className={
                              "truncate text-sm " +
                              (n.read ? "text-neutral-700" : "font-semibold text-neutral-900")
                            }
                          >
                            {n.title}
                          </span>
                          <span className="flex-none text-[10px] text-neutral-400">
                            {timeAgo(n.created_at)}
                          </span>
                        </span>
                        {n.body ? (
                          <span className="mt-0.5 block line-clamp-2 text-xs text-neutral-600">
                            {n.body}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            to="/account/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-neutral-100 px-4 py-2.5 text-center text-xs font-semibold text-[#ff003c] hover:bg-neutral-50"
          >
            View all notifications
          </Link>
        </div>
      ) : null}
    </div>
  );
}