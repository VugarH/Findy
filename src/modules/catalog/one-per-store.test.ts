import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

const { onePerStore } = await import("./offer-view");

const offer = (id: string, store: string, inStock = true) => ({ id, supplier: { id: store }, inStock });

describe("one offer per store", () => {
  it("keeps each store's cheapest colour, in price order", () => {
    const offers = [offer("navy", "champion"), offer("tb", "trendyol"), offer("grey", "champion"), offer("red", "champion")];
    expect(onePerStore(offers).map((o) => o.id)).toEqual(["navy", "tb"]);
  });

  it("prefers a colour that is in stock over a cheaper one that is not", () => {
    const offers = [offer("navy", "champion", false), offer("grey", "champion", true)];
    expect(onePerStore(offers).map((o) => o.id)).toEqual(["grey"]);
  });

  it("keeps a store whose colours are all sold out (its cheapest)", () => {
    const offers = [offer("navy", "champion", false), offer("grey", "champion", false)];
    expect(onePerStore(offers).map((o) => o.id)).toEqual(["navy"]);
  });
});
