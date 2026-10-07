import { describe, expect, it } from "vitest";
import { detectCategory } from "./categories";

describe("detectCategory", () => {
  const sneakerShop = ["shoes", "bags", "fashion"] as const;

  it.each([
    ["adidas Ultrarun 5 Erkek Beyaz Spor Ayakkabı", "shoes"],
    ["ADIDAS SAMBA OG SNEAKER", "shoes"],
    ["Vans Old Skool Drop V Unisex Siyah Sırt Çantası", "bags"],
    ["Nike Strike Erkek Pembe Futbol T-Shirt", "fashion"],
    ["Kadın Siyah İç Giyim Seti", "fashion"],
    ["New Era Seasoned Camo Snapback", "bags"],
  ] as const)("sneaker shop: %s -> %s", (title, expected) => {
    expect(detectCategory(sneakerShop, title)).toBe(expected);
  });

  it("prefers the more specific category when a title fits two", () => {
    const allowed = ["bags", "watches", "jewelry", "fashion"] as const;
    expect(detectCategory(allowed, "Quilted Chain Bag")).toBe("bags");
    expect(detectCategory(allowed, "Leather Watch Strap")).toBe("watches");
    expect(detectCategory(allowed, "Gold Chain Necklace")).toBe("jewelry");
  });

  it("only returns categories the store sells, and null when nothing fits", () => {
    expect(detectCategory(["watches", "jewelry"], "Lacoste Erkek Güneş Gözlüğü")).toBeNull();
    expect(detectCategory(["fashion"], "Braun MultiGrill 9 Pro")).toBeNull();
  });

  it("places home, baby and sports goods in department stores", () => {
    const all = ["shoes", "bags", "watches", "jewelry", "home", "baby", "fashion", "sports"] as const;
    expect(detectCategory(all, "Fakir Chop'N Blend Smoothie Blender")).toBe("home");
    expect(detectCategory(all, "Tefal Expertise 5X Tava 20 Cm")).toBe("home");
    expect(detectCategory(all, "Inglesina Trilogy Bebek Arabası")).toBe("baby");
    expect(detectCategory(all, "Joie i-Spin 360 Oto Koltuğu")).toBe("baby");
    expect(detectCategory(all, "Manduka PRO Yoga Mat 6mm")).toBe("sports");
    expect(detectCategory(all, "NEMO Dagger 2P Tent")).toBe("sports");
    // Clothing words win over the sport they are for.
    expect(detectCategory(all, "Salomon Transfer Puff Erkek Kayak Ceketi")).toBe("fashion");
    // Baby clothes are clothing (audience: kids), not baby gear.
    expect(detectCategory(all, "U.S. Polo Assn Bebek Takım")).toBe("fashion");
  });

  it("reads URL slugs, which have no Turkish letters", () => {
    expect(detectCategory(["shoes", "fashion"], "urun nike revolution 8 kadin spor ayakkabi")).toBe("shoes");
    expect(detectCategory(["bags", "fashion"], "erkek deri cuzdan")).toBe("bags");
  });
});
