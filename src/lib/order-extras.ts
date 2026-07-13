/**
 * Shared helpers for reading persisted order line-item extras (pizza toppings)
 * off records that come from the Supabase Data API as `Json`.
 */
export interface OrderItemExtra {
  id: string;
  name: string;
  price: number;
}

export function parseOrderItemExtras(raw: unknown): OrderItemExtra[] {
  if (!Array.isArray(raw)) return [];
  const out: OrderItemExtra[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const rec = r as Record<string, unknown>;
    const name = typeof rec.name === "string" ? rec.name : null;
    if (!name) continue;
    out.push({
      id: typeof rec.id === "string" ? rec.id : name,
      name,
      price: Number(rec.price) || 0,
    });
  }
  return out;
}

export function formatExtrasLabel(raw: unknown): string {
  const list = parseOrderItemExtras(raw);
  return list.length === 0 ? "" : list.map((e) => e.name).join(", ");
}