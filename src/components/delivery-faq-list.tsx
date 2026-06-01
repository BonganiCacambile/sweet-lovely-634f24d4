import DeliveryFaqFramerComponent from "@/framer/locations-and-delivery/delivery-faq";

/** Stack of the Framer delivery FAQ accordion blocks. */
export function DeliveryFaqList() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-4">
      <DeliveryFaqFramerComponent.Responsive />
    </div>
  );
}