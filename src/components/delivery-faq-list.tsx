import DeliveryFaqFramerComponent from "@/framer/locations-and-delivery/delivery-faq";

/** Stack of the Framer delivery FAQ accordion blocks. */
export function DeliveryFaqList() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-4">
      <DeliveryFaqFramerComponent.Responsive
        variants={{
          base: "Delivery Zones - Default - Mobile",
          xl: "Delivery Zones - Default - Desktop",
        } as never}
      />
      <DeliveryFaqFramerComponent.Responsive
        variants={{
          base: "Delivery Methods and Fees - Default - Mobile",
          xl: "Delivery Methods and Fees - Default - Desktop",
        } as never}
      />
      <DeliveryFaqFramerComponent.Responsive
        variants={{
          base: "Pickup Info - Default - Mobile",
          xl: "Pickup Info - Default - Desktop",
        } as never}
      />
    </div>
  );
}