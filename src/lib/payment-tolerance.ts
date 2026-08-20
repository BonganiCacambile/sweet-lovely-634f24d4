/**
 * Shared Paystack amount-matching tolerance.
 *
 * The client and the server derive tax/shipping independently, so a captured
 * amount can legitimately differ from the recomputed total by a few cents.
 * Refusing an already-captured payment over a rounding difference is the worst
 * possible outcome, so both the client verification path
 * (`verifyAndCreateOrder`) and the webhook safety net accept a shortfall up to
 * this amount (in minor units, i.e. cents).
 */
export const AMOUNT_TOLERANCE_MINOR = 100; // R1.00

/** True when the captured amount covers the expected amount within tolerance. */
export function amountWithinTolerance(capturedMinor: number, expectedMinor: number): boolean {
  return capturedMinor >= expectedMinor - AMOUNT_TOLERANCE_MINOR;
}
