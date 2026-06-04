import ProductCardFramerComponent from "@/framer/menu-products/product-card";
import { Reveal } from "@/components/reveal";

export interface Product {
  id: string;
  title: string;
  price: string;
  allergens?: string;
  nutrition?: string;
  content?: string;
  image?: string;
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
      {products.map((p, i) => (
        <Reveal key={p.id} delay={Math.min(i, 8) * 70}>
          <ProductCardFramerComponent.Responsive
          variants={variants as never}
          FZjwTwKXl={p.title}
          gWA6po3g9={p.price}
          mxkLNJQZN={p.allergens ?? ""}
          JoZ2UEEJT={`<p>${p.allergens ?? ""}</p>`}
          JV7xTZLzb={`<p>${p.nutrition ?? "Nutritional Info"}</p>`}
          ZaUVK_Zrs={`<p>${p.content ?? ""}</p>`}
          GTORt8VJU={""}
          {...(p.image
            ? {
                EKtkBiqHP: {
                  src: p.image,
                  srcSet: `${p.image} 1024w`,
                  pixelWidth: 1024,
                  pixelHeight: 1024,
                  alt: p.title,
                },
              }
            : {})}
          />
        </Reveal>
      ))}
    </div>
  );
}