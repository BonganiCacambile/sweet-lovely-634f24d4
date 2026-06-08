import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface FaqItem {
  title: string;
  body: React.ReactNode;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    title: "Delivery Zones",
    body: (
      <div className="space-y-2 text-neutral-700">
        <p>We deliver across all 5 of our cities — New York, London, Amsterdam, Berlin and Bucharest — within a 6&nbsp;mile / 10&nbsp;km radius of each Sweet & Lovely location.</p>
        <p>Enter your address at checkout to see live availability and estimated delivery time for your spot.</p>
      </div>
    ),
  },
  {
    title: "Delivery Methods & Fees",
    body: (
      <div className="space-y-2 text-neutral-700">
        <p>Standard delivery is <strong>$2.99</strong> and arrives in 30–45 minutes. Express delivery is <strong>$5.99</strong> and arrives in under 25 minutes.</p>
        <p>Orders over $35 ship free with standard delivery. We hand off through trusted partners (DoorDash, Uber Eats) and our own riders in select neighborhoods.</p>
      </div>
    ),
  },
  {
    title: "Pickup Info",
    body: (
      <div className="space-y-2 text-neutral-700">
        <p>Skip the fee — order online and collect from any Sweet & Lovely store. Most pickup orders are ready in 15 minutes.</p>
        <p>You&apos;ll get a text the moment your pizza leaves the oven so it&apos;s in your hands while it&apos;s still hot.</p>
      </div>
    ),
  },
];

export function DeliveryFaqList() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-2">
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={item.title}
            className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-neutral-50"
              aria-expanded={isOpen}
            >
              <span className="text-lg font-semibold text-neutral-900 md:text-xl">
                <span className="mr-2 text-neutral-400">{i + 1}.</span>
                {item.title}
              </span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-neutral-500 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="overflow-hidden">
                <div className="px-6 pb-6 pt-0 text-base leading-relaxed">
                  {item.body}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}