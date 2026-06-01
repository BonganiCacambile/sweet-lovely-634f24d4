import type { Product } from "@/components/product-grid";

export interface Deal {
  id: string;
  variant:
    | "Spicy Duo Deal"
    | "Cheese Lovers Pair"
    | "Veggie Delight Duo"
    | "Sweet & Savory Combo"
    | "Meat Feast Combo";
}

export interface Testimonial {
  id: string;
  quote: string;
  name: string;
  title: string;
  avatar?: string;
}

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
  { id: "london", name: "London", color: "rgba(180, 160, 0, 0.5)" },
  { id: "ams", name: "Amsterdam", color: "rgba(0, 140, 90, 0.5)" },
  { id: "berlin", name: "Berlin", color: "rgba(40, 60, 90, 0.45)" },
  { id: "bucharest", name: "Bucharest", color: "rgba(220, 150, 40, 0.5)" },
];

export const DEALS: Deal[] = [
  { id: "spicy-duo", variant: "Spicy Duo Deal" },
  { id: "cheese-lovers", variant: "Cheese Lovers Pair" },
  { id: "meat-feast", variant: "Meat Feast Combo" },
  { id: "veggie-duo", variant: "Veggie Delight Duo" },
  { id: "sweet-savory", variant: "Sweet & Savory Combo" },
];

export const DESSERTS: Product[] = [
  {
    id: "nutella-dessert",
    title: "Nutella Pizza",
    price: "$7.99",
    allergens: "Dairy, Gluten, Nuts",
    content:
      "Pizza dough, Nutella spread, powdered sugar, strawberries (optional), whipped cream.",
  },
  {
    id: "cannoli",
    title: "Classic Cannoli",
    price: "$5.99",
    allergens: "Dairy, Gluten",
    content:
      "Cannoli shells (flour, sugar, eggs), ricotta cheese, powdered sugar, chocolate chips, vanilla extract.",
  },
  {
    id: "tiramisu",
    title: "Tiramisu Temptation",
    price: "$7.49",
    allergens: "Dairy, Gluten, Eggs",
    content:
      "Ladyfingers (flour, sugar, eggs), mascarpone cheese, espresso, cocoa powder, sugar, heavy cream.",
  },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "sophie",
    quote:
      "Few places combine traditional pizza-making techniques with modern creativity so effortlessly. The Garlic Supreme is a prime example of innovation in comfort food.",
    name: "Sophie Jensen",
    title: "Head of Culinary Arts, Gourmet Institute",
  },
  {
    id: "max",
    quote:
      "The Meat Lover's Feast is everything a carnivore dreams of, loaded with perfectly cooked meats and balanced with just the right amount of sauce. This is pizza at its finest.",
    name: "Maximilian Schneider",
    title: "Food Blogger, Berlin Bites",
  },
  {
    id: "andrea",
    quote:
      "In a city full of pizza, the Firecracker Inferno brings real heat with real flavor. It's a true gem on the menu.",
    name: "Andrea D'Amico",
    title: "Chef & Restaurateur",
  },
];