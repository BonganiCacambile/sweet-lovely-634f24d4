import { describe, expect, test } from "bun:test";
import { splitPizzaId, splitVariantId } from "../../src/lib/cart-id";

// Regression: pizzas with selected toppings produce cart ids of the form
//   `${slug}-${size}-x-<extras-hash>`
// (see src/components/cart/add-to-cart-button.tsx). Previously the server
// stock check only stripped a trailing `-medium`/`-large`, so ids with an
// `-x-…` suffix resolved to a bogus slug and the checkout failed with
// "Out of stock: buffalo-bliss-large-x-… (have 0, need 1)".
describe("splitPizzaId", () => {
  test("plain pizza id → slug + size", () => {
    expect(splitPizzaId("buffalo-bliss-large")).toEqual({
      slug: "buffalo-bliss",
      size: "large",
    });
    expect(splitPizzaId("buffalo-bliss-medium")).toEqual({
      slug: "buffalo-bliss",
      size: "medium",
    });
  });

  test("pizza id with extras hash → slug + size, extras stripped", () => {
    expect(
      splitPizzaId("buffalo-bliss-large-x-57eaf07c-7692cc64-8af8a8a7-9f14d682"),
    ).toEqual({ slug: "buffalo-bliss", size: "large" });
    expect(splitPizzaId("margherita-medium-x-abcd1234")).toEqual({
      slug: "margherita",
      size: "medium",
    });
  });

  test("multi-word slug with extras", () => {
    expect(splitPizzaId("four-cheese-supreme-large-x-deadbeef")).toEqual({
      slug: "four-cheese-supreme",
      size: "large",
    });
  });

  test("non-pizza id → slug only", () => {
    expect(splitPizzaId("chocolate-brownie")).toEqual({
      slug: "chocolate-brownie",
      size: null,
    });
  });
});

describe("splitVariantId (BBQ / dynamic sizes)", () => {
  test("plain slug → slug only", () => {
    expect(splitVariantId("chocolate-brownie")).toEqual({
      slug: "chocolate-brownie",
      size: null,
      sizeId: null,
    });
  });
  test("pizza suffix still parses", () => {
    expect(splitVariantId("buffalo-bliss-large")).toEqual({
      slug: "buffalo-bliss",
      size: "large",
      sizeId: null,
    });
  });
  test("BBQ --sz-<uuid> → slug + sizeId", () => {
    const uuid = "3f9c9a5e-1234-4abc-9def-abc123abc123";
    expect(splitVariantId(`full-chicken--sz-${uuid}`)).toEqual({
      slug: "full-chicken",
      size: null,
      sizeId: uuid,
    });
  });
});