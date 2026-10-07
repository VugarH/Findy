import { describe, expect, it } from "vitest";
import { CATEGORY_SLUGS } from "./categories";
import { classifyProduct, MAX_SUBCATEGORIES, subcategoriesOf } from "./subcategories";

describe("classifyProduct", () => {
  it.each([
    ["electronics", "Smartfon HONOR X8e 6GB/256GB Gold", "phones"],
    ["electronics", "HONOR 600 12/256GB ORANGE", "phones"],
    ["electronics", "Apple iPhone 17 Pro 256GB", "phones"],
    ["electronics", "Ultra Hybrid Case for iPhone 17 Pro", "cases-protection"],
    ["electronics", "iPhone 18 Pro Camera Lens Protector", "cases-protection"],
    ["electronics", "Pocket GaN Charger PD 100W", "charging-power"],
    ["electronics", "Keychron K8 HE Wireless Keyboard", "keyboards-gaming"],
    ["electronics", "GO Sport ANC True Wireless Earbuds", "audio"],
    ["electronics", "Samsung Galaxy Watch 6 44mm", "wearables"],
    ["electronics", "Blackview Tab 9 Tablet 8GB+256GB", "tablets-computers"],
    ["electronics", "Roborock S8 Robot Vacuum", "smart-home"],
    ["electronics", "8BitDo Pro 2 Controller", "keyboards-gaming"],
    ["electronics", "Mystery gadget", "other"],
    ["beauty", "Dior Sauvage Eau de Toilette 100ml", "fragrance"],
    ["beauty", "Holiday Brush Set Duo", "tools-brushes"],
    ["beauty", "Best of Saie Vault", "sets-gifts"],
    ["beauty", "Gloss Bomb Universal Lip Luminizer", "makeup"],
    ["beauty", "Fullest Volumizing Mascara", "makeup"],
    ["beauty", "Soft Pinch Liquid Blush", "makeup"],
    ["beauty", "Watermelon Glow Niacinamide Serum", "skincare"],
    ["toys", "Dino World 40 Piece Magna-Tiles Set", "building"],
    ["toys", "Hot Wheels RLC 1993 Mazda RX-7", "vehicles"],
    ["toys", "Hatsune Miku Nendoroid Figure", "figures-dolls"],
    ["fashion", "adidas Own the Run Colorblock Erkek Yeşil Ceket", "jackets-coats"],
    ["fashion", "Nike Dri-Fit Kadın Pembe Antrenman T-Shirt", "tops-tshirts"],
    ["fashion", "Lacivert Polo Yaka Kısa Kollu Keten Triko", "knitwear-sweatshirts"],
    ["fashion", "Slim Fit Oxford Düğmeli Yaka Beyaz Gömlek", "shirts"],
    ["fashion", "Siyah Yün Karışımlı Smokin Takım Elbise", "suits-formal"],
    ["fashion", "Siyah Animal Desenli Mini Elbise", "dresses-skirts"],
    ["fashion", "Baggy Fit Erkek Grey Denim Jean Pantolon", "trousers-jeans"],
    ["fashion", "Erkek Boxer Şort 3'lü Paket", "underwear-socks"],
    ["shoes", "Puma Skyrocket Lite 2 Kadın Siyah Spor Ayakkabı", "sneakers"],
    ["shoes", "adidas Tensaur Run 3.0 Çocuk Koşu Ayakkabısı", "running-sports"],
    ["shoes", "Erkek Kahverengi Bağcıklı Süet Deri Casual Bot", "boots"],
    ["shoes", "Birkenstock Gizeh Kadın Siyah Terlik", "sandals-slippers"],
    ["shoes", "Kadın Siyah Topuklu Deri Loafer", "heels-flats"],
    ["bags", "Vans Old Skool Unisex Siyah Sırt Çantası", "backpacks"],
    ["bags", "Kadın Siyah Uzun Askılı Çapraz Çanta", "handbags"],
    ["bags", "Calvin Klein Foil Logo Kadın Mavi Kartlık", "wallets-cardholders"],
    ["bags", "Erkek Bel Çantası", "handbags"],
    ["watches", "LAC2001301 Kadın Kol Saati", "classic"],
    ["watches", "Seiko Presage Erkek Otomatik Kol Saati", "automatic"],
    ["watches", "Navy Leather Strap - Silver", "straps-accessories"],
    ["jewelry", "Monaco Chain 22 Ayar Sarı Altın Bilezik", "bracelets"],
    ["jewelry", "Trapez Koleksiyonu Sarı Altın Baget Taşlı Kolye", "necklaces"],
    ["jewelry", "Altın Nazar Kolye Ucu", "pendants-charms"],
    ["jewelry", "Beyaz Altın Alyans", "rings"],
    ["jewelry", "Molten Hoop Earrings", "earrings"],
    ["home", "Fellow Opus Conical Burr Coffee Grinder", "coffee-tea"],
    ["home", "Cosori Pro LE Air Fryer 4.7L", "kitchen-appliances"],
    ["home", "Rowenta Studio Dry Glow Saç Kurutma Makinesi", "personal-care"],
    ["home", "Our Place Always Pan 2.0", "cookware-knives"],
    ["home", "Fakir Shadow 7016 Kablosuz Şarjlı Elektrikli Süpürge", "floor-care"],
    ["home", "Levoit Core 300S Air Purifier", "climate-air"],
    ["home", "Stanley The Quencher H2.0 Tumbler 40 oz", "tableware-drinkware"],
    ["baby", "Silver Cross Reef Travel System", "strollers"],
    ["baby", "Cosatto All in All Rotate i-Size Car Seat", "car-seats"],
    ["baby", "Owlet Dream Sock", "monitors-safety"],
    ["baby", "Frida Baby NoseFrida Nasal Aspirator", "bath-care"],
    ["sports", "REP Fitness QuickDraw Adjustable Dumbbells", "fitness-strength"],
    ["sports", "Manduka PRO Yoga Mat 6mm", "yoga-pilates"],
    ["sports", "Theragun Prime Massage Gun", "recovery"],
    ["sports", "Big Agnes Copper Spur HV UL2 Tent", "camping-hiking"],
  ] as const)("%s: %s -> %s", (category, title, expected) => {
    expect(classifyProduct(category, title)).toBe(expected);
  });

  it("trusts the type our own adapters assign over words in the title", () => {
    const title = "Apple Watch Series 12 GPS, 46mm Space Grey Aluminium Case with Navy Blue Sport Band";
    expect(classifyProduct("electronics", title)).toBe("cases-protection");
    expect(classifyProduct("electronics", title, "smartwatch")).toBe("wearables");
  });

  it("uses the store's product type when the title says nothing", () => {
    expect(classifyProduct("electronics", "K8 HE", "Keyboard")).toBe("keyboards-gaming");
  });
});

describe("subcategory lists", () => {
  it.each(CATEGORY_SLUGS)("%s has at most 10 subcategories", (category) => {
    expect(subcategoriesOf(category).length).toBeLessThanOrEqual(MAX_SUBCATEGORIES);
  });
});
