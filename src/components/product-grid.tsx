import ProductCardFramerComponent from "@/framer/menu-products/product-card";

export interface Product {
  id: string;
  title: string;
  price: string;
  allergens?: string;
  nutrition?: string;
  content?: string;
}

interface ProductGridProps {
  products: Product[];
}

/** Responsive grid of Framer product cards. */
export function ProductGrid({ products }: ProductGridProps) {
  return (
    <div className="grid grid-cols-1 justify-items-center gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <ProductCardFramerComponent.Responsive
          key={p.id}
          FZjwTwKXl={p.title}
          gWA6po3g9={p.price}
          mxkLNJQZN={p.allergens ?? ""}
          JoZ2UEEJT={`<p>${p.allergens ?? ""}</p>`}
          JV7xTZLzb={`<p>${p.nutrition ?? "Nutritional Info"}</p>`}
          ZaUVK_Zrs={`<p>${p.content ?? ""}</p>`}
          GTORt8VJU={""}
        />
      ))}
    </div>
  );
}