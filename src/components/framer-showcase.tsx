import ProductCardFramerComponent from "@/framer/menu-products/product-card";
import ButtonFramerComponent from "@/framer/button";
import CityCardFramerComponent from "@/framer/locations-and-delivery/city-card";
import DeliveryFaqFramerComponent from "@/framer/locations-and-delivery/delivery-faq";
import CloseFramerComponent from "@/framer/close";

/**
 * Showcase of the imported Framer (Unframer) components.
 * Preserves the exact layout, spacing and props from the original App.tsx.
 */
export function FramerShowcase() {
  return (
    <div className="flex flex-col items-center gap-3 bg-white">
      <ProductCardFramerComponent.Responsive
        FZjwTwKXl={"Nutella Pizza"}
        GTORt8VJU={""}
        JV7xTZLzb={"<p>Nutritional Info</p>"}
        JoZ2UEEJT={"<p>Dairy, Gluten</p>"}
        ZaUVK_Zrs={"<p>Content</p>"}
        gWA6po3g9={"$7.99"}
        mxkLNJQZN={"Dairy, Gluten"}
      />
      <ButtonFramerComponent.Responsive
        O5tlPGRu3={"View Our Menu"}
        lJNtxFrg5={"/menu/full-menu"}
      />
      <CityCardFramerComponent.Responsive
        GxcvqcosD={"rgba(255, 0, 59, 0.5)"}
        vyZs0CzOx={"New York"}
      />
      <DeliveryFaqFramerComponent.Responsive />
      <CloseFramerComponent.Responsive />
    </div>
  );
}