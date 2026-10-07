import { describe, expect, it } from "vitest";
import { expandQuery } from "./synonyms";

describe("expandQuery", () => {
  it("widens Azerbaijani words to the Turkish and English words titles use", () => {
    const [who, what] = expandQuery("Qadın krossovka");
    expect(who.audience).toBe("women");
    expect(who.alternatives).toEqual(expect.arrayContaining(["kadin", "women"]));
    expect(what.alternatives).toEqual(expect.arrayContaining(["sneaker", "spor ayakkab"]));
  });

  it("understands inflected Russian words by their stem", () => {
    const [who, what] = expandQuery("женские кроссовки");
    expect(who.audience).toBe("women");
    expect(what.alternatives).toContain("sneaker");
    expect(expandQuery("мужские часы")[1].alternatives).toEqual(expect.arrayContaining(["saat", "watch"]));
    expect(expandQuery("адидас")[0].alternatives).toContain("adidas");
  });

  it("keeps words it does not know as they are", () => {
    expect(expandQuery("Samba OG")).toEqual([{ alternatives: ["samba"] }, { alternatives: ["og"] }]);
  });

  it("folds Turkish letters the way titles are folded", () => {
    expect(expandQuery("çanta")[0].alternatives).toEqual(expect.arrayContaining(["canta", "bag"]));
    const [metal, ring] = expandQuery("gümüş üzük");
    expect(metal.alternatives).toEqual(expect.arrayContaining(["gumus", "silver"]));
    expect(ring.alternatives).toEqual(expect.arrayContaining(["uzuk", "yuzuk", " ring"]));
  });
});
