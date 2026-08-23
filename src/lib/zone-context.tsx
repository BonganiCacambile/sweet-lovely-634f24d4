import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { zonesQueryOptions } from "@/lib/zones-query";
import { type PublicZone } from "@/lib/zones.functions";
import { setMySelectedZone, getMySelectedZone } from "@/lib/zone-selection.functions";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "sweet-lovely-zone-v1";

interface ZoneContextValue {
  zones: PublicZone[];
  loading: boolean;
  selected: PublicZone | null;
  setSelectedSlug: (slug: string | null) => void;
  pickerOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
}

const ZoneContext = React.createContext<ZoneContextValue | null>(null);

export function ZoneProvider({ children }: { children: React.ReactNode }) {
  const { data: zones = [], isLoading } = useQuery(zonesQueryOptions);

  const [selectedSlug, setSlug] = React.useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSlug(raw);
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      if (selectedSlug) localStorage.setItem(STORAGE_KEY, selectedSlug);
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }, [selectedSlug, hydrated]);

  // Mirror the selection onto the signed-in customer's profile so the server
  // (support requests, complaints routing) has an authoritative zone that the
  // browser cannot forge.
  React.useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled || !data.user) return;
      if (selectedSlug) {
        await setMySelectedZone({ data: { slug: selectedSlug } }).catch(() => undefined);
      } else {
        // No local selection yet — adopt the one stored on the profile.
        const remote = await getMySelectedZone().catch(() => null);
        if (!cancelled && remote) setSlug(remote.slug);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSlug, hydrated]);

  // If the saved slug is no longer active, clear it.
  React.useEffect(() => {
    if (!hydrated || isLoading || !selectedSlug) return;
    if (!zones.some((z) => z.slug === selectedSlug)) setSlug(null);
  }, [zones, selectedSlug, hydrated, isLoading]);

  const selected = React.useMemo(
    () => zones.find((z) => z.slug === selectedSlug) ?? null,
    [zones, selectedSlug],
  );

  const openPicker = React.useCallback(() => setPickerOpen(true), []);
  const closePicker = React.useCallback(() => setPickerOpen(false), []);

  // Context value is consumed by header, chip, picker, cart and checkout, so a
  // fresh object identity on every provider render re-renders all of them.
  const value = React.useMemo<ZoneContextValue>(
    () => ({
      zones,
      loading: isLoading,
      selected,
      setSelectedSlug: setSlug,
      pickerOpen,
      openPicker,
      closePicker,
    }),
    [zones, isLoading, selected, pickerOpen, openPicker, closePicker],
  );

  return <ZoneContext.Provider value={value}>{children}</ZoneContext.Provider>;
}

export function useZone() {
  const ctx = React.useContext(ZoneContext);
  if (!ctx) throw new Error("useZone must be used within ZoneProvider");
  return ctx;
}