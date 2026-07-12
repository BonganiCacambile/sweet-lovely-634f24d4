import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type PublicZone = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  fee_zar: number;
  min_order_zar: number;
  free_delivery_threshold_zar: number;
  eta_minutes: number;
  hours_text: string | null;
  color: string | null;
  postal_codes: string[];
  sort_order: number;
  image_url: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  delivery_enabled: boolean;
  collection_enabled: boolean;
  collection_instructions: string | null;
  collection_prep_minutes: number;
  collection_address: string | null;
};

/** Public list of currently-active delivery zones for the customer app. */
export const listActiveZones = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase
    .from("delivery_zones")
    .select(
      "id, slug, name, description, fee_zar, min_order_zar, free_delivery_threshold_zar, eta_minutes, hours_text, color, postal_codes, sort_order, image_url, contact_phone, contact_email, delivery_enabled, collection_enabled, collection_instructions, collection_prep_minutes, collection_address",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((z) => ({
    ...z,
    fee_zar: Number(z.fee_zar),
    min_order_zar: Number(z.min_order_zar),
    free_delivery_threshold_zar: Number(
      (z as { free_delivery_threshold_zar: number | null }).free_delivery_threshold_zar ?? 0,
    ),
    delivery_enabled: (z as { delivery_enabled: boolean | null }).delivery_enabled ?? true,
    collection_enabled: (z as { collection_enabled: boolean | null }).collection_enabled ?? false,
    collection_instructions:
      (z as { collection_instructions: string | null }).collection_instructions ?? null,
    collection_prep_minutes: Number(
      (z as { collection_prep_minutes: number | null }).collection_prep_minutes ?? 20,
    ),
    collection_address:
      (z as { collection_address: string | null }).collection_address ?? null,
  })) as PublicZone[];
});