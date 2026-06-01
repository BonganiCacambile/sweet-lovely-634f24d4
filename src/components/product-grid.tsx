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
  /** Use the "Only Pizza" variant set (image-only Fan Favorites style) instead of the full "Others" card. */
  imageOnly?: boolean;
}

/** Responsive grid of Framer product cards. */
export function ProductGrid({ products, imageOnly = false }: ProductGridProps) {
  const variants = imageOnly
    ? {
        base: "Only Pizza - Desktop",
        tablet: "Only Pizza - Tablet",
        mobile: "Only Pizza - Menu - Mobile",
      }
    : {
        base: "Others - Desktop",
        tablet: "Others - Tablet",
        mobile: "Others - Menu - Mobile",
      };
  return (
    <div className="grid grid-cols-1 justify-items-center gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <ProductCardFramerComponent.Responsive
          key={p.id}
          variants={variants as never}
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