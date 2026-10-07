import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

const { namesDescribeSameItem } = await import("./similar");

describe("namesDescribeSameItem", () => {
  it("accepts the same model named differently", () => {
    expect(namesDescribeSameItem("Honor 600 12/256GB", "HONOR 600 Smartphone 12GB 256GB")).toBe(true);
    expect(namesDescribeSameItem("Dior Sauvage EDT 100ml", "Sauvage Eau de Toilette 100 ml – Dior")).toBe(true);
  });

  it("rejects a different variant or size", () => {
    expect(namesDescribeSameItem("Honor 600 12/256GB", "Honor 600 Pro 12/256GB")).toBe(false);
    expect(namesDescribeSameItem("Honor 600 12/256GB", "Honor 600 8/256GB")).toBe(false);
    expect(namesDescribeSameItem("Dior Sauvage EDT 100ml", "Dior Sauvage EDT 60ml")).toBe(false);
  });
});

describe("pageWindow", async () => {
  const { pageWindow } = await import("@/components/deals/pagination");
  it("keeps the ends and the pages around the current one", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(6, 20)).toEqual([1, "gap", 4, 5, 6, 7, 8, "gap", 20]);
    expect(pageWindow(20, 20)).toEqual([1, "gap", 18, 19, 20]);
  });
});
