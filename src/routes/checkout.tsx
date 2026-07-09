import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowLeft, ArrowRight, Lock, CreditCard, Loader2, PartyPopper } from "lucide-react";
import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useCart, formatPrice, computeTotals } from "@/lib/cart-context";
import { checkCartStock, getPaystackConfig, verifyAndCreateOrder } from "@/lib/paystack.functions";
import { supabase } from "@/integrations/supabase/client";
import { useZone } from "@/lib/zone-context";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Sweet & Lovely" },
      { name: "description", content: "Complete your order securely." },
    ],
  }),
  component: CheckoutPage,
});

// Paystack inline types
declare global {
  interface Window {
    PaystackPop?: {
      setup: (opts: PaystackSetupOptions) => { openIframe: () => void };
    };
  }
}
interface PaystackSetupOptions {
  key: string;
  email: string;
  amount: number;
  currency?: string;
  ref?: string;
  metadata?: Record<string, unknown>;
  callback: (response: { reference: string }) => void;
  onClose: () => void;
}

const STEPS = ["Customer", "Delivery", "Payment"] as const;

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  address: string;
  postal: string;
}

const initialForm: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  country: "",
  state: "",
  city: "",
  address: "",
  postal: "",
};

function CheckoutPage() {
  const navigate = useNavigate();
  const { items, subtotal, clear } = useCart();
  const { selected: zone, openPicker } = useZone();
  // Zone delivery fee replaces the default flat shipping. If the zone has a
  // free-delivery threshold configured (> 0) and the subtotal meets it, we
  // waive the fee automatically — the same rule is re-enforced server-side
  // before Paystack verification so it can't be bypassed client-side.
  const freeDeliveryThreshold = zone?.free_delivery_threshold_zar ?? 0;
  const qualifiesForFreeDelivery =
    !!zone && freeDeliveryThreshold > 0 && subtotal >= freeDeliveryThreshold;
  const zoneFee = zone ? (qualifiesForFreeDelivery ? 0 : zone.fee_zar) : 0;
  const { shipping, tax, total } = computeTotals(subtotal, 0, zoneFee);
  const belowMin = !!zone && subtotal < zone.min_order_zar;
  const [step, setStep] = React.useState(0);
  const [form, setForm] = React.useState<FormState>(initialForm);
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({});
  const [paying, setPaying] = React.useState(false);
  // Once the order is placed we navigate to /checkout/success. Prevent the
  // "empty cart" effect below from racing that navigation back to /cart.
  const orderPlacedRef = React.useRef(false);
  const [config, setConfig] = React.useState<{ publicKey: string; configured: boolean } | null>(
    null,
  );

  const fetchConfig = useServerFn(getPaystackConfig);
  const placeOrder = useServerFn(verifyAndCreateOrder);
  const checkStock = useServerFn(checkCartStock);

  React.useEffect(() => {
    fetchConfig().then(setConfig).catch(() => setConfig({ publicKey: "", configured: false }));
  }, [fetchConfig]);

  // Load Paystack inline script once
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.PaystackPop) return;
    const existing = document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]');
    if (existing) return;
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  // Redirect to /cart if empty (but only after mount so we don't fight SSR)
  React.useEffect(() => {
    if (orderPlacedRef.current) return;
    if (items.length === 0) {
      navigate({ to: "/cart" });
    }
  }, [items.length, navigate]);

  const update = (k: keyof FormState, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const validateStep = (s: number) => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (s === 0) {
      if (!form.firstName.trim()) e.firstName = "Required";
      if (!form.lastName.trim()) e.lastName = "Required";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Valid email required";
      if (!form.phone.trim() || form.phone.replace(/\D/g, "").length < 6) e.phone = "Valid phone required";
    } else if (s === 1) {
      if (!form.country.trim()) e.country = "Required";
      if (!form.state.trim()) e.state = "Required";
      if (!form.city.trim()) e.city = "Required";
      if (!form.address.trim()) e.address = "Required";
      if (!form.postal.trim()) e.postal = "Required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const handlePay = async () => {
    if (!validateStep(0) || !validateStep(1)) {
      toast.error("Please complete all required fields");
      setStep(0);
      return;
    }
    if (!zone) {
      toast.error("Please choose a delivery zone");
      openPicker();
      return;
    }
    if (subtotal < zone.min_order_zar) {
      toast.error(`Order below ${zone.name} minimum (${formatPrice(zone.min_order_zar)})`);
      return;
    }
    if (!config?.configured || !window.PaystackPop) {
      toast.error("Payment is not configured. Please try again shortly.");
      return;
    }
    setPaying(true);
    // Block oversells BEFORE we open Paystack.
    try {
      const stock = await checkStock({
        data: {
          items: items.map((it) => ({
            id: it.id,
            title: it.title,
            price: it.price,
            quantity: it.quantity,
          })),
        },
      });
      if (!stock.ok) {
        const msg = stock.shortages?.length
          ? `Out of stock: ${stock.shortages
              .map((s) => `${s.slug} (have ${s.available}, need ${s.requested})`)
              .join(", ")}`
          : "One or more items are out of stock.";
        toast.error(msg);
        setPaying(false);
        return;
      }
    } catch (err) {
      console.error("Stock check failed:", err);
      toast.error("Could not verify stock. Please try again.");
      setPaying(false);
      return;
    }
    // Paystack amount: smallest unit (cents/kobo).
    const amount = Math.round(total * 100);
    const handler = window.PaystackPop.setup({
      key: config.publicKey,
      email: form.email,
      amount,
      currency: "ZAR",
      metadata: {
        custom_fields: [
          {
            display_name: "Customer",
            variable_name: "customer",
            value: `${form.firstName} ${form.lastName}`,
          },
          {
            display_name: "Phone",
            variable_name: "phone",
            value: form.phone,
          },
          {
            display_name: "Address",
            variable_name: "address",
            value: `${form.address}, ${form.city}, ${form.state}, ${form.country} ${form.postal}`,
          },
        ],
      },
      callback: (response) => {
        // Verify on the server, persist the order, then go to success
        (async () => {
          // Retry verification a few times to ride out transient network errors —
          // the payment has already been captured at this point, so we can't bail
          // on the first failed fetch.
          const callPlaceOrder = async (payload: Parameters<typeof placeOrder>[0]) => {
            let lastErr: unknown;
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                return await placeOrder(payload);
              } catch (err) {
                lastErr = err;
                await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
              }
            }
            throw lastErr;
          };
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const userId = sessionData.session?.user.id ?? null;
            const res = await callPlaceOrder({
              data: {
                reference: response.reference,
                customer: {
                  firstName: form.firstName,
                  lastName: form.lastName,
                  email: form.email,
                  phone: form.phone,
                  address: form.address,
                  city: form.city,
                  state: form.state,
                  country: form.country,
                  postal: form.postal,
                },
                items: items.map((it) => ({
                  id: it.id,
                  title: it.title,
                  price: it.price,
                  quantity: it.quantity,
                })),
                subtotal,
                shipping,
                tax,
                total,
                userId,
                deliveryZoneId: zone.id,
              },
            });
            if (res.success) {
              if ("warning" in res && res.warning) toast.warning(res.warning);
              toast.success(
                `Order ${res.orderNumber ? `#${res.orderNumber} ` : ""}confirmed — thank you!`,
              );
              orderPlacedRef.current = true;
              clear();
              // Send the customer to the dedicated confirmation page so they
              // see their order number, ETA, and receipt — not an empty cart.
              navigate({
                to: "/checkout/success",
                search: {
                  ref: response.reference,
                  ...(res.orderNumber ? { order: res.orderNumber } : {}),
                },
              });
            } else {
              toast.error(res.error || "We couldn't confirm your order. Please contact support.");
              setPaying(false);
            }
          } catch (err) {
            console.error(err);
            toast.error(
              "Network error confirming your payment. Your payment reference is " +
                response.reference +
                " — please contact support if your order doesn't appear shortly.",
            );
            setPaying(false);
          }
        })();
      },
      onClose: () => {
        setPaying(false);
        toast("Payment cancelled");
      },
    });
    handler.openIframe();
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-neutral-900">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Checkout</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Secure checkout. Your details stay private.
            </p>
          </div>
          <div className="hidden items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 shadow-sm sm:inline-flex">
            <Lock className="h-3.5 w-3.5" />
            SSL secured
          </div>
        </div>

        <Stepper step={step} />

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Form panel */}
          <section className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.1)] md:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
              >
                {step === 0 && (
                  <StepCustomer form={form} errors={errors} update={update} />
                )}
                {step === 1 && (
                  <StepDelivery form={form} errors={errors} update={update} />
                )}
                {step === 2 && <StepPayment configured={config?.configured ?? false} />}
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={back}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              ) : (
                <Link
                  to="/cart"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to cart
                </Link>
              )}

              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={next}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-neutral-700"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={paying}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ff003c] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(255,0,60,0.7)] transition-all hover:-translate-y-0.5 hover:bg-[#e6003a] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {paying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing…
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      Pay {formatPrice(total)}
                    </>
                  )}
                </button>
              )}
            </div>
          </section>

          {/* Summary */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.1)]">
              <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl bg-neutral-50 p-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Delivery zone</p>
                  <p className="mt-0.5 text-sm font-semibold text-neutral-900">
                    {zone ? zone.name : "Not selected"}
                  </p>
                  {zone && (
                    <p className="text-[11px] text-neutral-500">
                      {formatPrice(zone.fee_zar)} · ~{zone.eta_minutes} min · min {formatPrice(zone.min_order_zar)}
                    </p>
                  )}
                </div>
                <button type="button" onClick={openPicker} className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-neutral-50">
                  {zone ? "Change" : "Choose"}
                </button>
              </div>
              {belowMin && zone && (
                <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Add {formatPrice(zone.min_order_zar - subtotal)} more to reach the {zone.name} minimum order.
                </p>
              )}
              {qualifiesForFreeDelivery && (
                <div className="mb-3 flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  <PartyPopper className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>
                    <span className="font-semibold">Congratulations! You've unlocked Free Delivery.</span>{" "}
                    Your delivery fee has been waived.
                  </p>
                </div>
              )}
              {zone && !qualifiesForFreeDelivery && freeDeliveryThreshold > 0 && subtotal > 0 && (
                <p className="mb-3 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
                  Add {formatPrice(freeDeliveryThreshold - subtotal)} more to unlock <span className="font-semibold">Free Delivery</span>.
                </p>
              )}
              <h2 className="text-lg font-bold">In your bag</h2>
              <ul className="mt-4 space-y-4">
                {items.map((it) => (
                  <li key={it.id} className="flex gap-3">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#fff5f7]">
                      {it.image && (
                        <img src={it.image} alt={it.title} className="h-full w-full object-cover" />
                      )}
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-900 px-1 text-[10px] font-bold text-white">
                        {it.quantity}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium leading-tight">{it.title}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {formatPrice(it.price)} each
                      </p>
                    </div>
                    <p className="text-sm font-semibold">
                      {formatPrice(it.price * it.quantity)}
                    </p>
                  </li>
                ))}
              </ul>
              <dl className="mt-6 space-y-2 border-t border-dashed border-neutral-200 pt-4 text-sm">
                <Row label="Subtotal" value={formatPrice(subtotal)} />
                <Row
                  label="Delivery"
                  value={
                    shipping === 0
                      ? qualifiesForFreeDelivery
                        ? "FREE (R0.00)"
                        : "Free"
                      : formatPrice(shipping)
                  }
                  highlight={shipping === 0 && qualifiesForFreeDelivery}
                />
                <Row label="Tax" value={formatPrice(tax)} muted />
              </dl>
              <div className="mt-3 flex items-center justify-between border-t border-dashed border-neutral-200 pt-3">
                <span className="text-sm font-medium text-neutral-600">Total</span>
                <span className="text-xl font-extrabold tracking-tight">
                  {formatPrice(total)}
                </span>
              </div>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-4">
      {STEPS.map((label, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <li key={label} className="flex flex-1 items-center gap-2 sm:gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
                done
                  ? "border-[#ff003c] bg-[#ff003c] text-white"
                  : active
                    ? "border-[#ff003c] bg-white text-[#ff003c]"
                    : "border-neutral-200 bg-white text-neutral-400"
              }`}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={`hidden text-sm font-medium sm:inline ${
                active || done ? "text-neutral-900" : "text-neutral-400"
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className="h-px flex-1 bg-neutral-200">
                <motion.div
                  initial={false}
                  animate={{ scaleX: done ? 1 : 0 }}
                  transition={{ duration: 0.4 }}
                  style={{ originX: 0 }}
                  className="h-full bg-[#ff003c]"
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={muted ? "text-neutral-500" : "text-neutral-600"}>{label}</dt>
      <dd className="font-medium text-neutral-900">{value}</dd>
    </div>
  );
}

/** Reusable input. */
function Field({
  label,
  id,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
  autoComplete,
  className = "",
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-xs font-semibold text-neutral-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`mt-1.5 w-full rounded-2xl border bg-white px-4 py-3 text-sm transition-colors focus:outline-none focus:ring-2 ${
          error
            ? "border-[#ff003c] focus:border-[#ff003c] focus:ring-[#ff003c]/20"
            : "border-neutral-200 focus:border-[#ff003c] focus:ring-[#ff003c]/15"
        }`}
        aria-invalid={error ? "true" : "false"}
      />
      {error && <p className="mt-1 text-xs text-[#ff003c]">{error}</p>}
    </div>
  );
}

function StepCustomer({
  form,
  errors,
  update,
}: {
  form: FormState;
  errors: Partial<Record<keyof FormState, string>>;
  update: (k: keyof FormState, v: string) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold">Customer information</h2>
      <p className="mt-1 text-sm text-neutral-500">We'll send your order updates here.</p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" id="firstName" value={form.firstName} onChange={(v) => update("firstName", v)} error={errors.firstName} autoComplete="given-name" />
        <Field label="Last name" id="lastName" value={form.lastName} onChange={(v) => update("lastName", v)} error={errors.lastName} autoComplete="family-name" />
        <Field label="Email" id="email" type="email" value={form.email} onChange={(v) => update("email", v)} error={errors.email} autoComplete="email" className="sm:col-span-2" />
        <Field label="Phone" id="phone" type="tel" value={form.phone} onChange={(v) => update("phone", v)} error={errors.phone} autoComplete="tel" className="sm:col-span-2" />
      </div>
    </div>
  );
}

function StepDelivery({
  form,
  errors,
  update,
}: {
  form: FormState;
  errors: Partial<Record<keyof FormState, string>>;
  update: (k: keyof FormState, v: string) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold">Delivery details</h2>
      <p className="mt-1 text-sm text-neutral-500">Where should we send your order?</p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Country" id="country" value={form.country} onChange={(v) => update("country", v)} error={errors.country} autoComplete="country-name" />
        <Field label="Province / State" id="state" value={form.state} onChange={(v) => update("state", v)} error={errors.state} autoComplete="address-level1" />
        <Field label="City" id="city" value={form.city} onChange={(v) => update("city", v)} error={errors.city} autoComplete="address-level2" />
        <Field label="Postal code" id="postal" value={form.postal} onChange={(v) => update("postal", v)} error={errors.postal} autoComplete="postal-code" />
        <Field label="Street address" id="address" value={form.address} onChange={(v) => update("address", v)} error={errors.address} autoComplete="street-address" className="sm:col-span-2" />
      </div>
    </div>
  );
}

function StepPayment({ configured }: { configured: boolean }) {
  return (
    <div>
      <h2 className="text-xl font-bold">Payment</h2>
      <p className="mt-1 text-sm text-neutral-500">
        You'll be redirected to a secure Paystack window to complete payment.
      </p>

      <div className="mt-6 rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-[#fffafb] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ff003c]/10 text-[#ff003c]">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Paystack</p>
              <p className="text-xs text-neutral-500">
                Cards, bank transfer, Apple Pay & more
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">
            Default
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {["Visa", "Mastercard", "Verve", "Apple Pay", "Bank"].map((label) => (
            <span
              key={label}
              className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {!configured && (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
          Payment provider not yet configured. Please contact support.
        </p>
      )}

      <div className="mt-6 flex items-start gap-2 text-xs text-neutral-500">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          Your payment is processed securely by Paystack. We never see or store your card
          details.
        </p>
      </div>
    </div>
  );
}