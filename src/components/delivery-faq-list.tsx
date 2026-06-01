import type * as React from "react";
import DeliveryFaqFramerComponent from "@/framer/locations-and-delivery/delivery-faq";

/** Stack of the Framer delivery FAQ accordion blocks. */
export function DeliveryFaqList() {
  const Faq = DeliveryFaqFramerComponent as unknown as React.ComponentType<{ variant: string }>;
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-4">
      <Faq variant="QNL_KFUfD" />
      <Faq variant="epXno8iVq" />
      <Faq variant="L7hWoHrsn" />
    </div>
  );
}