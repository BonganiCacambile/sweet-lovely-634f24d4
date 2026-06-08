import ProductCardFramerComponent from "@/framer/menu-products/product-card";
import { Reveal } from "@/components/reveal";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";

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
  /** Mark items as pizzas so the Add button opens a Medium/Large size picker. */
  isPizza?: boolean;
}

/** Responsive grid of Framer product cards. */
export function ProductGrid({ products, imageOnly = false, isPizza = false }: ProductGridProps) {
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
          <div className="group relative [&_a[href='#'],&_a:not([href])]:pointer-events-none">
            <ProductCardFramerComponent.Responsive
              variants={variants as never}
              FZjwTwKXl={p.title}
              gWA6po3g9={p.price}
              mxkLNJQZN={p.allergens ?? ""}
              JoZ2UEEJT={`<p>${p.allergens ?? ""}</p>`}
              JV7xTZLzb={`<p>${p.nutrition ?? "Nutritional Info"}</p>`}
              ZaUVK_Zrs={`<p>${p.content ?? ""}</p>`}
              GTORt8VJU={""}
              O5tlPGRu3={"Add"}
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
            {/* Overlay the real Add-to-cart button on top of the Framer "Order Now" CTA (bottom-left of card). */}
            <div className="pointer-events-none absolute bottom-5 left-5 z-20 sm:bottom-6 sm:left-6">
              <div className="pointer-events-auto">
                <AddToCartButton
                  item={p}
                  isPizza={isPizza}
                  className="h-10 px-6 text-sm sm:h-11 sm:px-7"
                />
              </div>
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}