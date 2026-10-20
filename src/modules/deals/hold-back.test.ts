import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

const { holdBack, holdBackFor } = await import("./hold-back");

const row = (id: string, subcategory: string) => ({ id, subcategory });

describe("held-back types on an unfiltered category", () => {
  it("applies to Clothing with no filter and the default order only", () => {
    expect(holdBackFor({ category: "fashion" })).toEqual({ subcategory: "underwear-socks", after: 100 });
    expect(holdBackFor({ category: "fashion", sort: "best", limit: 20, offset: 0 })).not.toBeNull();
    expect(holdBackFor({ category: "fashion", brands: ["nike"] })).toBeNull();
    expect(holdBackFor({ category: "fashion", subcategory: "underwear-socks" })).toBeNull();
    expect(holdBackFor({ category: "fashion", sort: "price_asc" })).toBeNull();
    expect(holdBackFor({ category: "shoes" })).toBeNull();
    expect(holdBackFor({})).toBeNull();
  });

  it("keeps the type out until enough other items were shown, then spreads it evenly", () => {
    const rows = [
      ...["s1", "s2", "s3"].map((id) => row(id, "underwear-socks")),
      ...["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"].map((id) => row(id, "tops")),
    ];
    const ids = holdBack(rows, { subcategory: "underwear-socks", after: 2 }).map((r) => r.id);
    expect(ids.slice(0, 2)).toEqual(["t1", "t2"]);
    // After the first two: six tops and three socks, a sock about every third item.
    expect(ids.slice(2)).toEqual(["t3", "s1", "t4", "t5", "s2", "t6", "t7", "s3", "t8"]);
  });

  it("changes nothing when there are fewer other items than the limit", () => {
    const rows = [row("sock1", "underwear-socks"), row("tee1", "tops")];
    expect(holdBack(rows, { subcategory: "underwear-socks", after: 100 }).map((r) => r.id)).toEqual(["tee1", "sock1"]);
  });
});
