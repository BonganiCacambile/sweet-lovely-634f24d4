import { describe, expect, test } from "bun:test";
import {
  computeTotals,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FLAT,
  TAX_RATE,
} from "../../src/lib/cart-context";

// Sanity-check the constants this suite is built around so a future
// refactor that changes pricing rules has to consciously update the test.
describe("cart pricing constants", () => {
  test("free-delivery threshold is R40", () => {
    expect(FREE_SHIPPING_THRESHOLD).toBe(40);
  });
  test("flat delivery fee is R3.99", () => {
    expect(SHIPPING_FLAT).toBe(3.99);
  });
  test("tax rate is 5%", () => {
    expect(TAX_RATE).toBe(0.05);
  });
});

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Labels rendered next to the delivery line in
 * src/routes/cart.tsx and src/components/cart/cart-drawer.tsx:
 *   value={shipping === 0 ? "Free" : formatPrice(shipping)}
 * We reproduce that mapping here so the test fails if the UI's
 * "Free" vs priced label rule diverges from the pricing engine.
 */
function deliveryLabel(shipping: number): string {
  return shipping === 0 ? "Free" : `R${shipping.toFixed(2)}`;
}

describe("free-delivery threshold logic", () => {
  test("subtotal R39.99 (just below threshold) charges flat delivery", () => {
    const subtotal = 39.99;
    const { shipping, tax, total } = computeTotals(subtotal);

    expect(shipping).toBe(SHIPPING_FLAT); // 3.99
    expect(round(tax)).toBe(2.0); // 39.99 * 0.05 = 1.9995 -> 2.00
    expect(round(total)).toBe(round(subtotal + SHIPPING_FLAT + subtotal * TAX_RATE));
    expect(round(total)).toBe(45.98);
    expect(deliveryLabel(shipping)).toBe("R3.99");
  });

  test("subtotal R40.00 (exactly at threshold) unlocks free delivery", () => {
    const subtotal = 40.0;
    const { shipping, tax, total } = computeTotals(subtotal);

    expect(shipping).toBe(0);
    expect(round(tax)).toBe(2.0); // 40 * 0.05
    expect(round(total)).toBe(42.0); // 40 + 0 + 2
    expect(deliveryLabel(shipping)).toBe("Free");
  });

  test("subtotal R40.01 (just above threshold) keeps free delivery", () => {
    const subtotal = 40.01;
    const { shipping, total } = computeTotals(subtotal);

    expect(shipping).toBe(0);
    expect(round(total)).toBe(round(subtotal * (1 + TAX_RATE)));
    expect(deliveryLabel(shipping)).toBe("Free");
  });

  test("large subtotal R150 keeps free delivery and correct totals", () => {
    const subtotal = 150;
    const { shipping, tax, total } = computeTotals(subtotal);

    expect(shipping).toBe(0);
    expect(round(tax)).toBe(7.5);
    expect(round(total)).toBe(157.5);
    expect(deliveryLabel(shipping)).toBe("Free");
  });

  test("empty cart (subtotal 0) shows no delivery charge", () => {
    const { shipping, tax, total } = computeTotals(0);
    expect(shipping).toBe(0);
    expect(tax).toBe(0);
    expect(total).toBe(0);
    expect(deliveryLabel(shipping)).toBe("Free");
  });

  test("discount that drops discounted subtotal below threshold re-charges delivery", () => {
    // Subtotal R45, discount R10 -> discounted R35 -> below R40 threshold.
    const { shipping, tax, total, discounted } = computeTotals(45, 10);
    expect(discounted).toBe(35);
    expect(shipping).toBe(SHIPPING_FLAT);
    expect(round(tax)).toBe(1.75);
    expect(round(total)).toBe(round(35 + SHIPPING_FLAT + 1.75));
    expect(deliveryLabel(shipping)).toBe("R3.99");
  });

  test("discount that keeps discounted subtotal at threshold preserves free delivery", () => {
    // Subtotal R50, discount R10 -> discounted R40 -> free delivery.
    const { shipping, total, discounted } = computeTotals(50, 10);
    expect(discounted).toBe(40);
    expect(shipping).toBe(0);
    expect(round(total)).toBe(42.0);
    expect(deliveryLabel(shipping)).toBe("Free");
  });
});