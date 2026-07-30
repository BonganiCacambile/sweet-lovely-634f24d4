import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { logAuthEvent } from "@/lib/auth-events";

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
  const queryClient = useQueryClient();
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
    let active = true;
    const initializationTimeout = window.setTimeout(() => {
      if (!active) return;
      setLoading(false);
      setAuthTransition("idle");
      logAuthEvent("session_initialization", "timed_out");
    }, 8000);
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active) return;
      logAuthEvent("authentication_listener", "succeeded", { event });
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const userId = s.user.id;
        setTimeout(() => {
          void loadExtras(userId).catch(() => {
            logAuthEvent("profile_creation", "failed", { reason: "profile_or_role_unavailable" });
          }).finally(() => {
            if (!active) return;
            setLoading(false);
            if (event === "SIGNED_IN" || event === "USER_UPDATED") setAuthTransition("idle");
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
      if (!active) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        void loadExtras(data.session.user.id).catch(() => {
          logAuthEvent("session_initialization", "failed", { reason: "profile_or_role_unavailable" });
        }).finally(() => {
          if (!active) return;
          window.clearTimeout(initializationTimeout);
          setLoading(false);
          setAuthTransition("idle");
          logAuthEvent("session_initialization", "succeeded", { authenticated: true });
        });
      } else {
        window.clearTimeout(initializationTimeout);
        setLoading(false);
        setAuthTransition("idle");
        logAuthEvent("session_initialization", "succeeded", { authenticated: false });
      }
    }).catch(() => {
      if (!active) return;
      window.clearTimeout(initializationTimeout);
      setLoading(false);
      setAuthTransition("idle");
      logAuthEvent("session_initialization", "failed", { reason: "session_request_failed" });
    });
    return () => {
      active = false;
      window.clearTimeout(initializationTimeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (user) await loadExtras(user.id);
  };

  const signOut = useCallback(async () => {
    setAuthTransition("signing-out");
    logAuthEvent("logout", "started");
    await queryClient.cancelQueries();
    queryClient.clear();
    const { error } = await supabase.auth.signOut();
    logAuthEvent("logout", error ? "failed" : "succeeded");
    setAuthTransition("idle");
  }, [queryClient]);

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