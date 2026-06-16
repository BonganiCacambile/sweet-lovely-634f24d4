import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listActiveZones, type PublicZone } from "@/lib/zones.functions";

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
  const fetchZones = useServerFn(listActiveZones);
  const { data: zones = [], isLoading } = useQuery({
    queryKey: ["zones", "active"],
    queryFn: () => fetchZones(),
    staleTime: 60_000,
  });

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

  // If the saved slug is no longer active, clear it.
  React.useEffect(() => {
    if (!hydrated || isLoading || !selectedSlug) return;
    if (!zones.some((z) => z.slug === selectedSlug)) setSlug(null);
  }, [zones, selectedSlug, hydrated, isLoading]);

  const selected = React.useMemo(
    () => zones.find((z) => z.slug === selectedSlug) ?? null,
    [zones, selectedSlug],
  );

  const value: ZoneContextValue = {
    zones,
    loading: isLoading,
    selected,
    setSelectedSlug: setSlug,
    pickerOpen,
    openPicker: () => setPickerOpen(true),
    closePicker: () => setPickerOpen(false),
  };

  return <ZoneContext.Provider value={value}>{children}</ZoneContext.Provider>;
}

export function useZone() {
  const ctx = React.useContext(ZoneContext);
  if (!ctx) throw new Error("useZone must be used within ZoneProvider");
  return ctx;
}