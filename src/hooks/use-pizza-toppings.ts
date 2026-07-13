import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pizza_toppings"], queryFn: fetchToppings, staleTime: 60_000 });

  useEffect(() => {
    const ch = supabase
      .channel(`rt:pizza_toppings:${Math.random().toString(36).slice(2, 8)}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "pizza_toppings" }, () => {
        qc.invalidateQueries({ queryKey: ["pizza_toppings"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);

  return q;
}