import DeliveryFaqFramerComponent from "@/framer/locations-and-delivery/delivery-faq";

/** Stack of the Framer delivery FAQ accordion blocks. */
export function DeliveryFaqList() {
  const Faq = DeliveryFaqFramerComponent as unknown as React.ComponentType<{ variant: string }>;
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-4">
      <Faq variant="Delivery Zones - Default - Desktop" />
      <Faq variant="Delivery Methods and Fees - Default - Desktop" />
      <Faq variant="Pickup Info - Default - Desktop" />
    </div>
  );
}