import type { Product } from "@/components/product-grid";

/** Static demo menu — replace with a backend query when Lovable Cloud is enabled. */
export const FEATURED_PRODUCTS: Product[] = [
  {
    id: "nutella-pizza",
    title: "Nutella Pizza",
    price: "$7.99",
    allergens: "Dairy, Gluten",
    nutrition: "Nutritional Info",
    content: "Sweet dessert pizza with a generous Nutella spread.",
  },
  {
    id: "margherita",
    title: "Margherita",
    price: "$9.99",
    allergens: "Dairy, Gluten",
    nutrition: "Nutritional Info",
    content: "Classic tomato, mozzarella and fresh basil.",
  },
  {
    id: "pepperoni",
    title: "Pepperoni",
    price: "$11.49",
    allergens: "Dairy, Gluten",
    nutrition: "Nutritional Info",
    content: "Spicy pepperoni over melted mozzarella.",
  },
];

export const FULL_MENU: Product[] = [
  ...FEATURED_PRODUCTS,
  {
    id: "veggie-supreme",
    title: "Veggie Supreme",
    price: "$10.99",
    allergens: "Dairy, Gluten",
    content: "Peppers, onions, olives, mushrooms.",
  },
  {
    id: "four-cheese",
    title: "Four Cheese",
    price: "$12.49",
    allergens: "Dairy, Gluten",
    content: "Mozzarella, gorgonzola, parmesan, ricotta.",
  },
  {
    id: "bbq-chicken",
    title: "BBQ Chicken",
    price: "$13.49",
    allergens: "Dairy, Gluten",
    content: "Smoky BBQ sauce, grilled chicken, red onion.",
  },
];

export const CITIES = [
  { id: "nyc", name: "New York", color: "rgba(255, 0, 59, 0.5)" },
  { id: "la", name: "Los Angeles", color: "rgba(255, 145, 0, 0.5)" },
  { id: "chi", name: "Chicago", color: "rgba(0, 128, 255, 0.5)" },
];