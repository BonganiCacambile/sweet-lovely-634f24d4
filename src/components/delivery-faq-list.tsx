import DeliveryFaqFramerComponent from "@/framer/locations-and-delivery/delivery-faq";

/** Stack of the Framer delivery FAQ accordion blocks. */
export function DeliveryFaqList() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-4">
      <DeliveryFaqFramerComponent.Responsive
        variants={{
          base: "Delivery Zones - Default - Desktop",
          mobile: "Delivery Zones - Default - Mobile",
        } as never}
      />
      <DeliveryFaqFramerComponent.Responsive
        variants={{
          base: "Delivery Methods and Fees - Default - Desktop",
          mobile: "Delivery Methods and Fees - Default - Mobile",
        } as never}
      />
      <DeliveryFaqFramerComponent.Responsive
        variants={{
          base: "Pickup Info - Default - Desktop",
          mobile: "Pickup Info - Default - Mobile",
        } as never}
      />
    </div>
  );
}