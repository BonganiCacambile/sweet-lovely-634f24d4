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
  eta_minutes: number;
  hours_text: string | null;
  color: string | null;
  postal_codes: string[];
  sort_order: number;
  image_url: string | null;
  contact_phone: string | null;
  contact_email: string | null;
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
      "id, slug, name, description, fee_zar, min_order_zar, eta_minutes, hours_text, color, postal_codes, sort_order, image_url, contact_phone, contact_email",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((z) => ({
    ...z,
    fee_zar: Number(z.fee_zar),
    min_order_zar: Number(z.min_order_zar),
  })) as PublicZone[];
});