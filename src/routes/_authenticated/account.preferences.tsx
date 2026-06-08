import { createFileRoute } from "@tanstack/react-router";
import { AccountShell, Card } from "@/components/auth/account-shell";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Field, fieldCls } from "@/components/auth/login-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/account/preferences")({
  head: () => ({ meta: [{ title: "Preferences — Pepper" }] }),
  component: PrefsPage,
});

function PrefsPage() {
  const { profile, user, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone })
      .eq("id", user.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Preferences saved");
  };

  return (
    <AccountShell title="Preferences">
      <Card>
        <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={fieldCls} />
          </Field>
          <Field label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldCls} />
          </Field>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save changes
            </button>
          </div>
        </form>
      </Card>
    </AccountShell>
  );
}