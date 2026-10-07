import { describe, expect, it } from "vitest";
import { articleNumberOf, detectBrand, sameBrand, stripBrand } from "./fashion";

describe("detectBrand", () => {
  it.each([
    ["adidas Ultrarun 5 Erkek Beyaz Spor Ayakkabı", "adidas"],
    ["ADIDAS ORIGINALS SAMBA", "adidas"],
    ["Tommy Hilfiger Kadın Kol Saati", "Tommy Hilfiger"],
    ["Hugo Boss Erkek Gömlek", "Hugo Boss"],
    ["Dr. Martens 1460 Boot", "Dr. Martens"],
    ["converse-chuck-taylor-all-star-lift-kadin-sari-sneaker", "Converse"],
  ])("%s -> %s", (title, brand) => {
    expect(detectBrand(title)).toBe(brand);
  });

  it("ignores everyday words that are also brand names", () => {
    expect(detectBrand("Erkek Mavi Tişört")).toBeNull();
    expect(detectBrand("Champions League Ball")).toBeNull();
  });
});

describe("articleNumberOf", () => {
  it("reads each brand's own format from the most reliable source first", () => {
    expect(articleNumberOf("adidas", ["6591994", "/urun/adidas-ultrarun-5-erkek-beyaz-spor-ayakkabi/ih2639-1/"])).toBe("IH2639");
    expect(articleNumberOf("adidas", ["HZ0872-001"])).toBe("HZ0872");
    expect(articleNumberOf("Nike", ["/urun/nike-fc-barcelona-2024-25-forma/fn8797-456/"])).toBe("FN8797-456");
    expect(articleNumberOf("Puma", ["puma-suede-classic-374915-01"])).toBe("374915-01");
    expect(articleNumberOf("VANS", ["VN000EHDFPR"])).toBe("VN000EHDFPR");
    expect(articleNumberOf("Converse", ["/urun/converse-chuck-taylor/a16106c-1/"])).toBe("A16106C");
    expect(articleNumberOf("New Balance", ["/urun/new-balance-9060-unisex-gri-sneaker/u9060eeb/"])).toBe("U9060EEB");
    expect(articleNumberOf("ASICS", ["asics-gel-kayano-14-1201a019-108"])).toBe("1201A019-108");
  });

  it("reads watch reference numbers only for watches", () => {
    expect(articleNumberOf("Lacoste", ["LAC2001301"], "watches")).toBe("2001301");
    expect(articleNumberOf("Tommy Hilfiger", ["TH1782572 Kadın Kol Saati"], "watches")).toBe("1782572");
    expect(articleNumberOf("Casio", ["casio-g-shock-ga-2100-1adr-erkek-kol-saati"], "watches")).toBe("GA-2100-1A");
    expect(articleNumberOf("Tissot", ["Tissot PRX T137.410.11.041.00"], "watches")).toBe("T137.410.11.041.00");
    expect(articleNumberOf("Seiko", ["seiko-5-sports-srpd55k1"], "watches")).toBe("SRPD55");
    expect(articleNumberOf("Citizen", ["BM7108-81L"], "watches")).toBe("BM7108-81L");
    expect(articleNumberOf("Lacoste", ["LAC2001301"])).toBeNull();
  });

  it("returns null for brands without a known format and for look-alikes", () => {
    expect(articleNumberOf("Lacoste", ["LAC2001301"])).toBeNull();
    expect(articleNumberOf(undefined, ["IH2639"])).toBeNull();
    expect(articleNumberOf("adidas", ["adidas Samba OG SS2025"])).toBeNull();
  });
});

describe("helpers", () => {
  it("compares brand spellings and strips the brand from titles", () => {
    expect(sameBrand("SuperStep", "Superstep")).toBe(true);
    expect(sameBrand("adidas", "Puma")).toBe(false);
    expect(stripBrand("adidas Samba OG", "adidas")).toBe("Samba OG");
    expect(stripBrand("Samba OG", "adidas")).toBe("Samba OG");
  });
});
