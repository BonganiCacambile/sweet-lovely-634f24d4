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

export interface MenuItem extends Product {
  image: string;
  category: MenuCategory;
  portion?: string;
  orderUrl?: string;
}

export type MenuCategory = "pizza" | "pasta" | "sides" | "deserts" | "drinks";

export const MENU_CATEGORIES: { id: MenuCategory; label: string; image: string }[] = [
  { id: "pizza", label: "Pizza", image: "https://framerusercontent.com/images/O35ad4eRtufs0gpp6JZXayT5IM.png?scale-down-to=512" },
  { id: "pasta", label: "Pasta", image: "https://framerusercontent.com/images/xd9Oo3dlguei8tJ9fP0wq4BtTtE.png" },
  { id: "sides", label: "Sides", image: "https://framerusercontent.com/images/8LagT2GMawnySp6zGEeZrsG4JJU.png" },
  { id: "deserts", label: "Deserts", image: "https://framerusercontent.com/images/8G7eGuuOmijUEO3VXSdPJ9i4VU.png" },
  { id: "drinks", label: "Drinks", image: "https://framerusercontent.com/images/eQS6ke7KFxu839Roxv77gisTY0Y.png" },
];

export const CATEGORY_INTRO: Record<MenuCategory, string> = {
  pizza:
    "From the classic simplicity of a traditional Margherita to the rich indulgence of gourmet truffle oil creations, we artfully blend the best of old-world charm with modern culinary innovation. Each pizza is hand-tossed with care, topped with fresh, high-quality ingredients, and baked to golden perfection.",
  pasta:
    "Twirl into comfort with our handcrafted pasta — slow-simmered sauces, al dente noodles, and bright, fresh ingredients in every bowl.",
  sides:
    "Crispy, cheesy, golden and dippable — the perfect supporting cast to any Pepper meal.",
  deserts:
    "End on a sweet note with warm, indulgent desserts made fresh in-house every day.",
  drinks:
    "Cool down, perk up or treat yourself with a curated lineup of sodas, juices, smoothies and coffee.",
};

export const ORDER_URL =
  "https://www.doordash.com/?srsltid=AfmBOooMK5uCbQ6Ohgafa0bm6OYZAhbWRLS-nrNo0prqBqwQkYTXdMDe";

const fr = (h: string) => `https://framerusercontent.com/images/${h}`;

export const MENU_ITEMS: MenuItem[] = [
  // Pizza
  { id: "cheese-avalanche", category: "pizza", title: "Cheese Avalanche", price: "$14.99", allergens: "Dairy, Gluten", nutrition: "Calories: 340 · Fat: 18g · Carbs: 29g · Protein: 16g", content: "Mozzarella, cheddar, Parmesan, gouda, ricotta, marinara sauce, oregano", image: fr("Q4djsExkm2dVJLND8pnRkbmHKy8.png"), portion: "from" },
  { id: "buffalo-bliss", category: "pizza", title: "Buffalo Bliss", price: "$15.99", allergens: "Dairy, Gluten, Eggs", nutrition: "Calories: 310 · Fat: 15g · Carbs: 28g · Protein: 14g", content: "Buffalo chicken, blue cheese crumbles, mozzarella, ranch dressing, red onions", image: fr("fOcW4cqVIKe7O6jovEeqZ46Cg.png"), portion: "from" },
  { id: "mediterranean-marvel", category: "pizza", title: "Mediterranean Marvel", price: "$15.99", allergens: "Dairy, Gluten", nutrition: "Calories: 260 · Fat: 12g · Carbs: 27g · Protein: 11g", content: "Feta, Kalamata olives, red onions, sun-dried tomatoes, spinach, mozzarella, olive oil, oregano", image: fr("vtNegrYfppnZJV5SpQd607Hls8.png"), portion: "from" },
  { id: "hawaiian-heatwave", category: "pizza", title: "Hawaiian Heatwave", price: "$14.99", allergens: "Dairy, Gluten", nutrition: "Calories: 270 · Fat: 11g · Carbs: 30g · Protein: 12g", content: "Grilled pineapple, Canadian bacon, mozzarella, marinara sauce, jalapeños", image: fr("z0tpcmuGY42myUTNyLF9LCXg.png"), portion: "from" },
  { id: "meat-lovers", category: "pizza", title: "Meat Lover's Feast", price: "$16.99", allergens: "Dairy, Gluten", nutrition: "Calories: 350 · Fat: 19g · Carbs: 29g · Protein: 18g", content: "Pepperoni, Italian sausage, bacon, ham, mozzarella, marinara sauce", image: fr("ilD3FzfskejkXM7jRyVgKSBEE5I.png"), portion: "from" },
  { id: "garden-delight", category: "pizza", title: "Garden Delight", price: "$13.99", allergens: "Dairy, Gluten, Nuts", nutrition: "Calories: 240 · Fat: 11g · Carbs: 27g · Protein: 10g", content: "Zucchini, bell peppers, cherry tomatoes, spinach, red onions, mozzarella, pesto sauce", image: fr("Jo0m3edxzWNVUCgzB4ukskOgTHw.png"), portion: "from" },
  { id: "pepperoni-popper", category: "pizza", title: "Pepperoni Popper", price: "$14.99", allergens: "Dairy, Gluten", nutrition: "Calories: 320 · Fat: 17g · Carbs: 29g · Protein: 14g", content: "Double pepperoni, mozzarella, spicy marinara sauce, crushed red pepper, black olives", image: fr("bo5PFGtg1mLU0lWO3J9CWKVAcM.png"), portion: "from" },
  { id: "truffle-temptation", category: "pizza", title: "Truffle Temptation", price: "$16.99", allergens: "Dairy, Gluten", nutrition: "Calories: 300 · Fat: 15g · Carbs: 28g · Protein: 12g", content: "Truffle oil, wild mushrooms, mozzarella, Parmesan, arugula, garlic cream sauce", image: fr("EvzWDEqJkdunx7f5YzmUVnArM4.png"), portion: "from" },
  { id: "bbq-blaze", category: "pizza", title: "BBQ Blaze", price: "$15.99", allergens: "Dairy, Gluten", nutrition: "Calories: 290 · Fat: 12g · Carbs: 29g · Protein: 15g", content: "Grilled chicken, red onions, smoky BBQ sauce, cheddar, mozzarella, cilantro", image: fr("dQKnVrygQTPBTqZDioB8akNs.png"), portion: "from" },
  { id: "garlic-supreme", category: "pizza", title: "Garlic Supreme", price: "$13.99", allergens: "Dairy, Gluten", nutrition: "Calories: 270 · Fat: 13g · Carbs: 27g · Protein: 11g", content: "Roasted garlic, caramelized onions, mozzarella, Parmesan, Alfredo, fresh parsley", image: fr("Q2rEr3IGpX893CKsEuhm5IGMKk.png"), portion: "from" },
  { id: "margarita-muse", category: "pizza", title: "Margarita Muse", price: "$12.99", allergens: "Dairy, Gluten", nutrition: "Calories: 220 · Fat: 10g · Carbs: 26g · Protein: 9g", content: "Fresh mozzarella, ripe tomatoes, basil, EVOO, sea salt, marinara sauce", image: fr("O35ad4eRtufs0gpp6JZXayT5IM.png"), portion: "from" },
  { id: "firecracker-inferno", category: "pizza", title: "Firecracker Inferno", price: "$14.99", allergens: "Dairy, Gluten", nutrition: "Calories: 280 · Fat: 14g · Carbs: 28g · Protein: 12g", content: "Spicy pepperoni, jalapeños, crushed red pepper, mozzarella, marinara, sriracha drizzle", image: fr("lp6wNgrYu7ClOrMG4ibaVQNDWLo.png"), portion: "from" },
  // Pasta
  { id: "veggie-primavera", category: "pasta", title: "Veggie Primavera", price: "$11.99", allergens: "Gluten, Dairy", nutrition: "Calories: 600 · Fat: 22g · Carbs: 80g · Protein: 16g", content: "Spaghetti, seasonal vegetables, garlic, olive oil, Parmesan", image: fr("QQhZmek5g8r84veBoeGYpfAtA.png") },
  { id: "shrimp-scampi", category: "pasta", title: "Shrimp Scampi Linguine", price: "$15.99", allergens: "Shellfish, Gluten, Dairy", nutrition: "Calories: 700 · Fat: 28g · Carbs: 72g · Protein: 32g", content: "Linguine, sautéed shrimp, garlic, white wine, butter, lemon juice, parsley", image: fr("yhhROFh0XVmvTgfHG75VtLFiCU.png") },
  { id: "baked-ziti", category: "pasta", title: "Cheesy Baked Ziti", price: "$13.49", allergens: "Dairy, Gluten", nutrition: "Calories: 850 · Fat: 40g · Carbs: 86g · Protein: 34g", content: "Penne, marinara, ricotta, mozzarella, Parmesan, baked golden", image: fr("yNtyemqpPEBb8vP6SUEqoTsd74.png") },
  { id: "pesto-penne", category: "pasta", title: "Pesto Penne Delight", price: "$12.49", allergens: "Dairy, Gluten, Nuts", nutrition: "Calories: 620 · Fat: 32g · Carbs: 65g · Protein: 18g", content: "Penne, basil pesto, cherry tomatoes, Parmesan", image: fr("2c91DIhm8wc9cAbmFFUBzc7ZAg.png") },
  { id: "spaghetti-bolognese", category: "pasta", title: "Spaghetti Bolognese Classic", price: "$13.99", allergens: "Gluten, Dairy", nutrition: "Calories: 690 · Fat: 22g · Carbs: 85g · Protein: 32g", content: "Spaghetti, ground beef, marinara, Parmesan", image: fr("5hnOM2Oj39MAVQMF4xIQDQBBvA.png") },
  { id: "alfredo-bliss", category: "pasta", title: "Creamy Alfredo Bliss", price: "$12.99", allergens: "Dairy, Gluten, Eggs", nutrition: "Calories: 780 · Fat: 48g · Carbs: 72g · Protein: 18g", content: "Fettuccine, butter, cream, Parmesan, black pepper, parsley", image: fr("7WJgsBXCnl7ov0Uhe1ZthASTgQc.png") },
  // Sides
  { id: "buffalo-wings", category: "sides", title: "Buffalo Wings", price: "$8.99", allergens: "Dairy (blue cheese dip)", nutrition: "Calories: 430 · Fat: 31g · Carbs: 6g · Protein: 32g", content: "Chicken wings, buffalo sauce, celery sticks, blue cheese dip", image: fr("5HkrLakvJ1QS8k9yeljgtboX9A.png"), portion: "/6 wings" },
  { id: "caesar-salad", category: "sides", title: "Classic Caesar Salad", price: "$6.49", allergens: "Dairy, Gluten, Eggs", nutrition: "Calories: 310 · Fat: 24g · Carbs: 17g · Protein: 8g", content: "Romaine, Parmesan, croutons, Caesar dressing", image: fr("8LagT2GMawnySp6zGEeZrsG4JJU.png") },
  { id: "potato-wedges", category: "sides", title: "Loaded Potato Wedges", price: "$6.99", allergens: "Dairy, Gluten", nutrition: "Calories: 520 · Fat: 28g · Carbs: 52g · Protein: 12g", content: "Crispy wedges, cheddar, bacon bits, sour cream, chives", image: fr("jiKYTXVS1dGzHHn9InYt6POHbT4.png") },
  { id: "jalapeno-poppers", category: "sides", title: "Zesty Jalapeño Poppers", price: "$6.99", allergens: "Dairy, Gluten, Eggs", nutrition: "Calories: 380 · Fat: 22g · Carbs: 35g · Protein: 8g", content: "Breaded jalapeños stuffed with cream cheese, ranch dressing", image: fr("v22l8NZfmOTbAFs0d5EbWfiMAg.png"), portion: "/6 pieces" },
  { id: "mozzarella-sticks", category: "sides", title: "Mozzarella Sticks", price: "$7.99", allergens: "Dairy, Gluten, Eggs", nutrition: "Calories: 450 · Fat: 25g · Carbs: 39g · Protein: 18g", content: "Breaded mozzarella sticks, marinara sauce", image: fr("B0jk06Tv3FYjGVJFSdifH3Zt2w.png"), portion: "/6 sticks" },
  { id: "garlic-breadsticks", category: "sides", title: "Garlic Parmesan Breadsticks", price: "$5.99", allergens: "Dairy, Gluten", nutrition: "Calories: 350 · Fat: 16g · Carbs: 42g · Protein: 9g", content: "Freshly baked breadsticks, garlic butter, Parmesan, parsley", image: fr("9j2NHhkAXP2iAtcjjDAsukDeTQY.png"), portion: "/6 pieces" },
  // Deserts
  { id: "nutella-pizza", category: "deserts", title: "Nutella Pizza", price: "$7.99", allergens: "Dairy, Gluten", nutrition: "Calories: 480 · Fat: 22g · Carbs: 62g · Protein: 7g", content: "Pizza dough, Nutella, powdered sugar, strawberries, whipped cream", image: fr("pRzalLce4KvcQSggYuXBvUC174.png") },
  { id: "apple-crumble", category: "deserts", title: "Warm Cinnamon Apple Crumble", price: "$6.49", allergens: "Dairy, Gluten", nutrition: "Calories: 430 · Fat: 18g · Carbs: 64g · Protein: 5g", content: "Apples, cinnamon, oats, brown sugar, butter, flour, vanilla ice cream", image: fr("QlVQ0YNHzBhb2nPfKPz2btr7A.png") },
  { id: "cannoli", category: "deserts", title: "Classic Cannoli", price: "$5.99", allergens: "Dairy, Gluten, Eggs", nutrition: "Calories: 350 · Fat: 18g · Carbs: 42g · Protein: 8g", content: "Cannoli shells, ricotta, powdered sugar, chocolate chips, vanilla", image: fr("Ru7hW8Qi1bQ8fHES0Gh6mmxA.png"), portion: "/2 cannoli" },
  { id: "strawberry-cheesecake", category: "deserts", title: "Strawberry Cheesecake Dream", price: "$6.99", allergens: "Dairy, Gluten, Eggs", nutrition: "Calories: 500 · Fat: 32g · Carbs: 46g · Protein: 7g", content: "Cream cheese, graham crust, vanilla, eggs, strawberries, glaze", image: fr("vMak0Ur0vXKMxZVQdWSEqHQ8.png") },
  { id: "tiramisu", category: "deserts", title: "Tiramisu Temptation", price: "$7.49", allergens: "Dairy, Gluten, Eggs", nutrition: "Calories: 420 · Fat: 27g · Carbs: 40g · Protein: 6g", content: "Ladyfingers, mascarpone, espresso, cocoa, sugar, heavy cream", image: fr("h1Hhi9tTURbTtNpS1UYhUefZ2o.png") },
  { id: "lava-cake", category: "deserts", title: "Chocolate Lava Cake", price: "$6.99", allergens: "Dairy, Gluten, Eggs", nutrition: "Calories: 450 · Fat: 28g · Carbs: 44g · Protein: 6g", content: "Dark chocolate, butter, eggs, sugar, flour, vanilla, powdered sugar", image: fr("oBhv3dWqSzhJiOXKFp8TTQYurWE.png") },
  // Drinks
  { id: "sparkling-water", category: "drinks", title: "Sparkling Water", price: "$2.50", allergens: "None", nutrition: "Calories: 0", content: "Carbonated water", image: fr("6Q81jFXnOd0aCCaxN40e6MaKAjw.png") },
  { id: "cola", category: "drinks", title: "Classic Cola", price: "$2.50", allergens: "None", nutrition: "Calories: 140 · Carbs: 39g", content: "Carbonated water, syrup, caramel color, caffeine", image: fr("EPNDN5Z7pJqFluBKR5CiYN6BCk.png") },
  { id: "peach-tea", category: "drinks", title: "Peach Iced Tea", price: "$3.50", allergens: "None", nutrition: "Calories: 130 · Carbs: 32g", content: "Brewed black tea, peach syrup, sugar, ice", image: fr("pP3gKt2J5BBczlpi1XsyafZRBo.png") },
  { id: "lemon-tea", category: "drinks", title: "Lemon Iced Tea", price: "$3.50", allergens: "None", nutrition: "Calories: 120 · Carbs: 30g", content: "Brewed black tea, lemon juice, sugar, ice", image: fr("GrMb28ZBimSdmMOxXPl9kD2dlE.png") },
  { id: "coconut-water", category: "drinks", title: "Coconut Water Cooler", price: "$3.99", allergens: "None", nutrition: "Calories: 60 · Carbs: 15g", content: "Fresh coconut water, lime juice, mint, ice", image: fr("T2Y59fsEAALVITHlwJ6Q6qIfXM.png") },
  { id: "limeade", category: "drinks", title: "Limeade Spritzer", price: "$3.99", allergens: "None", nutrition: "Calories: 110 · Carbs: 29g", content: "Lime juice, sparkling water, sugar, ice", image: fr("yGzPQ8ney2W9hfUPI3xLyZvCujI.png") },
  { id: "green-lemonade", category: "drinks", title: "Green Tea Lemonade", price: "$3.99", allergens: "None", nutrition: "Calories: 100 · Carbs: 25g", content: "Brewed green tea, lemon juice, sugar, ice", image: fr("npNVZEAs2uN3JKihJpXH4G5SLs.png") },
  { id: "orange-juice", category: "drinks", title: "Orange Juice", price: "$3.99", allergens: "None", nutrition: "Calories: 160 · Carbs: 38g · Protein: 2g", content: "Freshly squeezed oranges", image: fr("9Cicx54hrMJ97UB6dKmDk7nkA.png") },
  { id: "strawberry-smoothie", category: "drinks", title: "Strawberry Banana Smoothie", price: "$4.99", allergens: "Dairy", nutrition: "Calories: 210 · Fat: 2.5g · Carbs: 44g · Protein: 5g", content: "Strawberries, bananas, yogurt, honey, ice", image: fr("iK4nikPZd41d6ONam9M77AuwI.png") },
  { id: "mango-smoothie", category: "drinks", title: "Mango Smoothie", price: "$4.99", allergens: "Dairy", nutrition: "Calories: 220 · Fat: 3g · Carbs: 48g · Protein: 5g", content: "Fresh mango, yogurt, ice, honey", image: fr("M1MzsJOs5zYPAhZxzEc3a4ANDrw.png") },
  { id: "cold-brew", category: "drinks", title: "Cold Brew Coffee", price: "$3.99", allergens: "None", nutrition: "Calories: 5", content: "Cold-brewed coffee, ice", image: fr("tIfpe9e1OErjHRIbmmQBkDwQM1s.png") },
  { id: "chocolate-shake", category: "drinks", title: "Chocolate Milkshake", price: "$6.50", allergens: "Dairy", nutrition: "Calories: 350 · Fat: 15g · Carbs: 48g · Protein: 8g", content: "Chocolate ice cream, milk, chocolate syrup, whipped cream", image: fr("EkkZLIaKFdPxUlbZmBpnvY65CA.png") },
  { id: "matcha-latte", category: "drinks", title: "Matcha Latte", price: "$5.99", allergens: "Dairy", nutrition: "Calories: 170 · Fat: 6g · Carbs: 24g · Protein: 6g", content: "Matcha green tea powder, milk, honey, ice", image: fr("RU0prChVZMldKW9jnFH9P8QuXjc.png") },
  { id: "caramel-frappe", category: "drinks", title: "Caramel Frappé", price: "$5.99", allergens: "Dairy", nutrition: "Calories: 280 · Fat: 11g · Carbs: 41g · Protein: 5g", content: "Coffee, milk, caramel syrup, whipped cream, ice", image: fr("e6wGiwadjdC8f3V7LauaQ6HyT8.png") },
  { id: "hot-chocolate", category: "drinks", title: "Hot Chocolate", price: "$3.99", allergens: "Dairy", nutrition: "Calories: 250 · Fat: 11g · Carbs: 32g · Protein: 8g", content: "Milk, cocoa powder, sugar, whipped cream", image: fr("olKbdfRkDrsCIjYs4ZNyoDyZh8g.png") },
  { id: "vanilla-latte", category: "drinks", title: "Vanilla Iced Latte", price: "$5.49", allergens: "Dairy", nutrition: "Calories: 190 · Fat: 6g · Carbs: 28g · Protein: 6g", content: "Espresso, milk, vanilla syrup, ice", image: fr("rqsRZRQzpFTcZFnBQBRx54WG8Q.png") },
];

/** Static demo menu — replace with a backend query when Lovable Cloud is enabled. */
export const FEATURED_PRODUCTS: Product[] = [
  {
    id: "pepperoni-popper-fav",
    title: "Pepperoni Popper",
    price: "$14.99",
    allergens: "Dairy, Gluten",
    nutrition: "from",
    content:
      "Double pepperoni, mozzarella, spicy marinara sauce, crushed red pepper, black olives",
  },
  {
    id: "garlic-supreme-fav",
    title: "Garlic Supreme",
    price: "$13.99",
    allergens: "Dairy, Gluten",
    nutrition: "from",
    content:
      "Roasted garlic cloves, caramelized onions, mozzarella, Parmesan, Alfredo sauce, fresh parsley",
  },
  {
    id: "margarita-muse-fav",
    title: "Margarita Muse",
    price: "$12.99",
    allergens: "Dairy, Gluten",
    nutrition: "from",
    content:
      "Fresh mozzarella, ripe tomatoes, basil leaves, extra virgin olive oil, sea salt, marinara sauce",
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