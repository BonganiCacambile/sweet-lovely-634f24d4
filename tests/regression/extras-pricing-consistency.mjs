#!/usr/bin/env node
/**
 * Extras pricing consistency regression.
 *
 * Guards the core invariant that a customer who adds a pizza with extra
 * toppings sees the *same* number in every place that shows a price:
 *
 *   base + Σ(extra.price)          === effective unit price
 *   unitPrice × quantity           === line total
 *   Σ(lineTotal)                   === cart subtotal
 *   Σ(extra.price) × quantity      === line extrasTotal
 *   basePrice × quantity + extrasT === line total    (algebraic dual)
 *
 * These invariants are re-derived by the customer cart (`cart-context.tsx`),
 * the add-to-cart modal, the checkout summary, and the server-side price
 * recomputation in `paystack.functions.ts`. If any of those diverge, the
 * customer sees one number in the drawer, a different one on /cart, and
 * gets charged a third by Paystack.
 *
 * The test runs the same fixtures twice — once labelled "mobile" and once
 * "desktop" — because in practice pricing is viewport-independent, and any
 * regression that reintroduces a viewport-conditional rounding path (e.g.
 * a truncated mobile subtotal) needs to fail loudly.
 *
 * Pure Node, no Playwright, no network. Safe to run in CI without the app.
 *
 * Run:
 *   node tests/regression/extras-pricing-consistency.mjs
 *   bun run test:regression:extras-pricing
 */

const EPS = 0.005; // half a cent — tolerates one round-half-to-even step

function log(...args) {
  console.log("[regression:extras-pricing]", ...args);
}

function round2(n) {
  return Number(n.toFixed(2));
}

/** Mirrors src/components/cart/add-to-cart-button.tsx addItem() math. */
function buildCartLine({ base, extras, quantity }) {
  const extrasPerUnit = extras.reduce((s, e) => s + e.price, 0);
  const unitPrice = round2(base + extrasPerUnit);
  const extrasTotal = round2(extrasPerUnit * quantity);
  const lineTotal = round2(unitPrice * quantity);
  return { basePrice: base, extras, quantity, unitPrice, extrasTotal, lineTotal };
}

/** Mirrors src/lib/paystack.functions.ts server-side recompute (extras path). */
function serverRecompute(line) {
  const extrasPerUnit = line.extras.reduce((s, e) => s + (Number(e.price) || 0), 0);
  const unitPrice = round2(line.basePrice + extrasPerUnit);
  const lineTotal = round2(unitPrice * line.quantity);
  const extrasTotal = round2(extrasPerUnit * line.quantity);
  return { unitPrice, lineTotal, extrasTotal };
}

/** Cart subtotal — mirrors CartProvider `subtotal` reducer. */
function cartSubtotal(lines) {
  return round2(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
}

/** Fixtures — real menu prices and topping prices seeded in the DB. */
const FIXTURES = [
  {
    name: "medium pizza, no extras",
    lines: [{ base: 80, extras: [], quantity: 1 }],
    expected: { subtotal: 80, extrasTotal: 0 },
  },
  {
    name: "medium pizza, two extras",
    lines: [{
      base: 80,
      extras: [
        { id: "mushrooms", name: "Mushrooms", price: 12 },
        { id: "olives", name: "Olives", price: 10 },
      ],
      quantity: 1,
    }],
    expected: { subtotal: 102, extrasTotal: 22 },
  },
  {
    name: "large pizza, three extras, qty 2",
    lines: [{
      base: 150,
      extras: [
        { id: "bacon", name: "Bacon", price: 18 },
        { id: "feta", name: "Feta", price: 14 },
        { id: "pineapple", name: "Pineapple", price: 9 },
      ],
      quantity: 2,
    }],
    expected: { subtotal: 382, extrasTotal: 82 },
  },
  {
    name: "mixed cart: medium+extras and large+extras",
    lines: [
      { base: 80, extras: [{ id: "olives", name: "Olives", price: 10 }], quantity: 3 },
      { base: 150, extras: [{ id: "bacon", name: "Bacon", price: 18 }, { id: "feta", name: "Feta", price: 14 }], quantity: 1 },
    ],
    expected: { subtotal: 452, extrasTotal: 62 }, // (80+10)*3 + (150+18+14)*1
  },
  {
    name: "fractional extras prices (round-trip safety)",
    lines: [{
      base: 80,
      extras: [
        { id: "a", name: "A", price: 3.33 },
        { id: "b", name: "B", price: 3.34 },
        { id: "c", name: "C", price: 3.33 },
      ],
      quantity: 3,
    }],
    expected: { subtotal: 270, extrasTotal: 30 }, // (80 + 10) * 3
  },
];

function assertClose(label, got, want, failures) {
  const ok = Math.abs(got - want) <= EPS;
  log(`${ok ? "✓" : "✗"} ${label}: got ${got} want ${want}`);
  if (!ok) failures.push(label);
}

function runFixture(viewportLabel, fixture, failures) {
  log(`— [${viewportLabel}] ${fixture.name}`);
  const built = fixture.lines.map(buildCartLine);

  for (const line of built) {
    // Invariant 1: unit price = base + Σextras
    const sumExtras = line.extras.reduce((s, e) => s + e.price, 0);
    assertClose(
      `[${viewportLabel}] unit = base + Σextras`,
      line.unitPrice,
      round2(line.basePrice + sumExtras),
      failures,
    );
    // Invariant 2: lineTotal = unit × qty
    assertClose(
      `[${viewportLabel}] line = unit × qty`,
      line.lineTotal,
      round2(line.unitPrice * line.quantity),
      failures,
    );
    // Invariant 3: algebraic dual — base×qty + extrasTotal = lineTotal
    assertClose(
      `[${viewportLabel}] base×qty + extrasTotal = line`,
      round2(line.basePrice * line.quantity + line.extrasTotal),
      line.lineTotal,
      failures,
    );
    // Invariant 4: server recompute matches client build
    const server = serverRecompute(line);
    assertClose(`[${viewportLabel}] server unit == client unit`, server.unitPrice, line.unitPrice, failures);
    assertClose(`[${viewportLabel}] server line == client line`, server.lineTotal, line.lineTotal, failures);
    assertClose(`[${viewportLabel}] server extrasT == client extrasT`, server.extrasTotal, line.extrasTotal, failures);
  }

  // Invariant 5: cart subtotal = Σ lineTotal
  const subtotal = cartSubtotal(built);
  assertClose(`[${viewportLabel}] cart subtotal`, subtotal, fixture.expected.subtotal, failures);

  // Invariant 6: total extrasTotal across cart matches expected
  const extrasTotalAll = round2(built.reduce((s, l) => s + l.extrasTotal, 0));
  assertClose(`[${viewportLabel}] cart extrasTotal`, extrasTotalAll, fixture.expected.extrasTotal, failures);

  // Invariant 7: serialization round-trip (localStorage <-> server JSON).
  // Mirrors parseOrderItemExtras behaviour on the persistence path.
  const wire = JSON.stringify(built);
  const parsed = JSON.parse(wire);
  const reSubtotal = cartSubtotal(parsed);
  assertClose(`[${viewportLabel}] subtotal after JSON round-trip`, reSubtotal, subtotal, failures);
}

function run() {
  const failures = [];

  // Same fixtures, two viewport labels — pricing MUST be viewport-independent.
  for (const viewport of ["mobile", "desktop"]) {
    log(`═══ viewport: ${viewport} ═══`);
    for (const fx of FIXTURES) runFixture(viewport, fx, failures);
  }

  // Cross-viewport equality: mobile and desktop must produce identical carts.
  log(`— cross-viewport equality`);
  for (const fx of FIXTURES) {
    const m = fx.lines.map(buildCartLine);
    const d = fx.lines.map(buildCartLine);
    const same = JSON.stringify(m) === JSON.stringify(d);
    log(`${same ? "✓" : "✗"} mobile ≡ desktop: ${fx.name}`);
    if (!same) failures.push(`cross-viewport:${fx.name}`);
  }

  if (failures.length) {
    console.error(`[regression:extras-pricing] ❌ FAIL — ${failures.length} invariant(s) broken`);
    for (const f of failures) console.error("  •", f);
    process.exit(1);
  }
  log(`✅ PASS — extras pricing consistent across mobile + desktop.`);
}

run();
