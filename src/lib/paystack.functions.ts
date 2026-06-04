import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Returns the Paystack public key for client-side inline checkout. */
export const getPaystackConfig = createServerFn({ method: "GET" }).handler(async () => {
  const publicKey = process.env.PAYSTACK_PUBLIC_KEY || "";
  return {
    publicKey,
    configured: Boolean(publicKey && process.env.PAYSTACK_SECRET_KEY),
  };
});

/** Verifies a Paystack transaction by reference using the secret key. */
export const verifyPaystackTransaction = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ reference: z.string().min(3).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      return { success: false, error: "Paystack is not configured" as const };
    }
    try {
      const res = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`,
        { headers: { Authorization: `Bearer ${secret}` } },
      );
      const json = (await res.json()) as {
        status: boolean;
        data?: { status: string; amount: number; currency: string; reference: string };
      };
      if (!res.ok || !json.status || !json.data) {
        return { success: false, error: "Verification failed" as const };
      }
      return {
        success: json.data.status === "success",
        status: json.data.status,
        amount: json.data.amount,
        currency: json.data.currency,
        reference: json.data.reference,
      };
    } catch (err) {
      console.error("Paystack verify error:", err);
      return { success: false, error: "Network error" as const };
    }
  });