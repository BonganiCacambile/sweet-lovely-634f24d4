import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AccountShell, Card } from "@/components/auth/account-shell";
import { Field, fieldCls } from "@/components/auth/login-form";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { updatePreferences } from "@/lib/account/account.functions";
import { toast } from "sonner";
import { Loader2, Upload, Sun, Moon, Monitor, Globe } from "lucide-react";

export const Route = createFileRoute("/_authenticated/account/preferences")({
  head: () => ({ meta: [{ title: "Preferences — Sweet & Lovely" }] }),
  component: PrefsPage,
});

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "af", label: "Afrikaans" },
  { value: "zu", label: "isiZulu" },
  { value: "xh", label: "isiXhosa" },
] as const;

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

function PrefsPage() {
  const { profile, user, refreshProfile } = useAuth();
  const save = useServerFn(updatePreferences);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [locale, setLocale] = useState<string>("en");
  const [theme, setTheme] = useState<string>("system");
  const [marketing, setMarketing] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const p = profile as any;
    setFullName(p?.full_name ?? "");
    setPhone(p?.phone ?? "");
    setLocale(p?.locale ?? "en");
    setTheme(p?.theme ?? "system");
    setMarketing(Boolean(p?.marketing_opt_in));
    setAvatar(p?.avatar_url ?? null);
  }, [profile]);

  // Apply theme immediately
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const apply = (t: string) => {
      const isDark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", isDark);
    };
    apply(theme);
  }, [theme]);

  const onUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) {
      setUploading(false);
      return toast.error(upErr.message);
    }
    const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
    setAvatar(signed?.signedUrl ?? null);
    setUploading(false);
    toast.success("Photo uploaded — remember to save");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await save({
        data: {
          full_name: fullName,
          phone,
          avatar_url: avatar,
          locale: locale as any,
          theme: theme as any,
          marketing_opt_in: marketing,
        },
      });
      await refreshProfile();
      toast.success("Preferences saved");
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AccountShell title="Preferences">
      <form onSubmit={submit} className="space-y-4">
        {/* Profile */}
        <Card>
          <p className="text-sm font-semibold text-neutral-900">Profile</p>
          <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row">
            <div className="flex flex-col items-center gap-2">
              <div className="h-20 w-20 overflow-hidden rounded-full border border-neutral-200 bg-neutral-100">
                {avatar ? (
                  <img src={avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-xl font-semibold text-white"
                    style={{ background: "linear-gradient(135deg,#ff003c,#ff5a36)" }}
                  >
                    {(fullName || user?.email || "U").slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? "Uploading…" : "Upload"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
                />
              </label>
            </div>
            <div className="grid w-full flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Full name">
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={fieldCls} />
              </Field>
              <Field label="Phone">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldCls} />
              </Field>
              <Field label="Email">
                <input value={user?.email ?? ""} disabled className={fieldCls + " bg-neutral-50"} />
              </Field>
            </div>
          </div>
        </Card>

        {/* Language */}
        <Card>
          <p className="text-sm font-semibold text-neutral-900">Language</p>
          <div className="mt-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-neutral-500" />
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className={fieldCls + " max-w-xs"}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
        </Card>

        {/* Theme */}
        <Card>
          <p className="text-sm font-semibold text-neutral-900">Theme</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {THEMES.map((t) => {
              const Icon = t.icon;
              const active = theme === t.value;
              return (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => setTheme(t.value)}
                  className={
                    "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition-colors " +
                    (active
                      ? "border-[#ff003c] bg-[#fff0f3] text-[#ff003c]"
                      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50")
                  }
                >
                  <Icon className="h-4 w-4" /> {t.label}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Marketing & privacy */}
        <Card>
          <p className="text-sm font-semibold text-neutral-900">Marketing & privacy</p>
          <label className="mt-3 flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3 text-sm">
            <span>
              <span className="font-medium text-neutral-900">Marketing emails</span>
              <span className="ml-2 text-xs text-neutral-500">Deals, new menu drops, and member offers</span>
            </span>
            <input
              type="checkbox"
              className="h-5 w-5 accent-[#ff003c]"
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
            />
          </label>
        </Card>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </button>
      </form>
    </AccountShell>
  );
}