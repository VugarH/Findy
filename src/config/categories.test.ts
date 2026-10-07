import { describe, expect, it } from "vitest";
import { definiteCategory, detectCategory } from "./categories";

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

describe("definiteCategory", () => {
  it.each([
    ["jewelry", "Pilgrim AUSTEN sunglasses grey", "bags"],
    ["watches", "Lilienthal Berlin Eyewear Strap – Brown", "bags"],
    ["watches", "Lilienthal Berlin Virtuoso Wallet - Black", "bags"],
    ["fashion", "UNDEFEATED RACING STRAPBACK", "bags"],
    ["fashion", "Represent Doberman Pendant Necklace - Silver", "jewelry"],
    ["beauty", "Jeffree Star Cosmetics Engraved Cowgirl Hat Necklace", "jewelry"],
    ["beauty", "Glossier Terrazzo Hoodie", "fashion"],
    ["toys", "Barbie Signature Barbie Christmas Tree Red Ugly Sweater", "fashion"],
    ["electronics", "Peak Design City Backpack 22L", "bags"],
  ] as const)("%s: %s -> %s", (current, title, expected) => {
    expect(definiteCategory(current, title)).toBe(expected);
  });

  it.each([
    ["jewelry", "Missoma Calissa Sunglasses Chain | 18ct Gold Plated"],
    ["watches", "Timex Harry Potter x Timex Weekender Sorting Hat 37mm Leather Strap Watch"],
    ["watches", "Timex Atelier GMT24 M1a 40mm Swiss Made Automatic Stainless Steel Bracelet"],
    ["bags", "OAKLEY SPEED CAT EYE JACKET REDUX - YELLOW BENGAL"],
    ["toys", "Barbie Signature Barbie Holiday Sweater Doll with Long Blonde Hair"],
    ["toys", "Disney Prenses Belle Asa Kolye Bileklik Seti"],
    ["electronics", "Twelve South BackPack for iMac & Studio Display"],
    ["electronics", "Satechi Vegan-Leather FindAll™ Keychain"],
    ["home", "Fellow Stagg Tasting Glasses"],
    ["shoes", "Steve Madden GERONIMO CREAM"],
  ] as const)("keeps %s: %s", (current, title) => {
    expect(definiteCategory(current, title)).toBeNull();
  });
});
