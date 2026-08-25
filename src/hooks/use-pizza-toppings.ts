import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/use-realtime-table";

export interface PizzaTopping {
  id: string;
  name: string;
  slug: string;
  price_zar: number;
  image_url: string | null;
  is_active: boolean;
  is_available: boolean;
  display_order: number;
}

async function fetchToppings(): Promise<PizzaTopping[]> {
  const { data, error } = await supabase
    .from("pizza_toppings")
    .select("id, name, slug, price_zar, image_url, is_active, is_available, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((t) => ({ ...t, price_zar: Number(t.price_zar) })) as PizzaTopping[];
}

/** Public list of pizza toppings with realtime updates from admin edits. */
export function usePizzaToppings() {
  const q = useQuery({ queryKey: ["pizza_toppings"], queryFn: fetchToppings, staleTime: 60_000 });
  useRealtimeTable("pizza_toppings", [["pizza_toppings"]]);
  return q;
}
