import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
};

type AuthTransition = "idle" | "signing-in" | "signing-out";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isMainAdmin: boolean;
  isZoneAdmin: boolean;
  assignedZoneId: string | null;
  assignedZoneName: string | null;
  loading: boolean;
  authTransition: AuthTransition;
  setAuthTransition: (t: AuthTransition) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMainAdmin, setIsMainAdmin] = useState(false);
  const [isZoneAdmin, setIsZoneAdmin] = useState(false);
  const [assignedZoneId, setAssignedZoneId] = useState<string | null>(null);
  const [assignedZoneName, setAssignedZoneName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authTransition, setAuthTransition] = useState<AuthTransition>("idle");

  const loadExtras = async (uid: string) => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone, avatar_url").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role, assigned_zone_id").eq("user_id", uid),
    ]);
    setProfile((p as Profile) ?? null);
    const rows = (r ?? []) as Array<{ role: string; assigned_zone_id: string | null }>;
    const main = rows.some((x) => x.role === "admin");
    const zoneRow = rows.find((x) => x.assigned_zone_id);
    const zoneId = zoneRow?.assigned_zone_id ?? null;
    setIsMainAdmin(main);
    setIsZoneAdmin(!main && Boolean(zoneId));
    setIsAdmin(main || Boolean(zoneId));
    setAssignedZoneId(zoneId);
    if (zoneId) {
      const { data: z } = await supabase.from("delivery_zones").select("name").eq("id", zoneId).maybeSingle();
      setAssignedZoneName((z as { name?: string } | null)?.name ?? null);
    } else {
      setAssignedZoneName(null);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => {
          loadExtras(s.user!.id).finally(() => {
            if (event === "SIGNED_IN") setAuthTransition("idle");
          });
        }, 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
        setIsMainAdmin(false);
        setIsZoneAdmin(false);
        setAssignedZoneId(null);
        setAssignedZoneName(null);
        if (event === "SIGNED_OUT") setAuthTransition("idle");
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadExtras(data.session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (user) await loadExtras(user.id);
  };

  const signOut = useCallback(async () => {
    setAuthTransition("signing-out");
    await supabase.auth.signOut();
    setAuthTransition("idle");
  }, []);

  return (
    <Ctx.Provider value={{ user, session, profile, isAdmin, isMainAdmin, isZoneAdmin, assignedZoneId, assignedZoneName, loading, authTransition, setAuthTransition, signOut, refreshProfile }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}