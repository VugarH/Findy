import type { CategorySlug } from "@/config/categories";

/**
 * DEMO DATA. A fixed universe of real product names with invented prices, used
 * by the demo adapters until real supplier integrations are connected.
 */
export interface DemoProduct {
  key: string;
  brand: string;
  model: string;
  category: CategorySlug;
  baseUsd: number;
  weightKg: number;
  /** Only returned by live search, never by the daily catalog fetch. */
  webOnly?: boolean;
}

const p = (
  brand: string,
  model: string,
  category: CategorySlug,
  baseUsd: number,
  weightKg: number,
  webOnly = false,
): DemoProduct => ({
  key: `${brand} ${model}`.toLowerCase(),
  brand,
  model,
  category,
  baseUsd,
  weightKg,
  webOnly,
});

export const DEMO_PRODUCTS: DemoProduct[] = [
  // Electronics
  p("Apple", "iPhone 15 128GB", "electronics", 799, 0.4),
  p("Samsung", "Galaxy S24 256GB", "electronics", 859, 0.4),
  p("Xiaomi", "Redmi Note 13 Pro 256GB", "electronics", 299, 0.45),
  p("Sony", "WH-1000XM5 Headphones", "electronics", 349, 0.5),
  p("Apple", "AirPods Pro 2", "electronics", 229, 0.2),
  p("JBL", "Flip 6 Bluetooth Speaker", "electronics", 119, 0.7),
  p("Apple", "MacBook Air 13 M3 256GB", "electronics", 1099, 1.8),
  p("Lenovo", "IdeaPad Slim 5 14", "electronics", 649, 2),
  p("Apple", "iPad 10th Gen 64GB", "electronics", 349, 0.8),
  p("Samsung", "Galaxy Watch 6 44mm", "electronics", 269, 0.3),
  p("Apple", "Watch SE 2 40mm", "electronics", 249, 0.3),
  p("Sony", "PlayStation 5 Slim", "electronics", 499, 4.5),
  p("Nintendo", "Switch OLED", "electronics", 349, 1),
  p("Amazon", "Kindle Paperwhite 16GB", "electronics", 149, 0.3),
  p("GoPro", "HERO12 Black", "electronics", 349, 0.4),
  p("Logitech", "MX Master 3S Mouse", "electronics", 99, 0.2),
  p("Anker", "737 Power Bank 24000mAh", "electronics", 109, 0.7),
  // Beauty
  p("Dior", "Sauvage EDT 100ml", "beauty", 115, 0.4),
  p("Chanel", "Bleu de Chanel EDP 100ml", "beauty", 150, 0.4),
  p("Yves Saint Laurent", "Libre EDP 50ml", "beauty", 120, 0.3),
  p("Lancôme", "La Vie Est Belle EDP 50ml", "beauty", 105, 0.3),
  p("Versace", "Eros EDT 100ml", "beauty", 95, 0.4),
  p("The Ordinary", "Niacinamide 10% + Zinc 1% 30ml", "beauty", 8, 0.1),
  p("CeraVe", "Moisturizing Cream 340g", "beauty", 18, 0.45),
  p("La Roche-Posay", "Anthelios UVMune 400 SPF50+ 50ml", "beauty", 25, 0.1),
  p("Estée Lauder", "Advanced Night Repair Serum 50ml", "beauty", 115, 0.2),
  p("Dyson", "Airwrap Multi-Styler Complete", "beauty", 599, 1.5),
  p("Dyson", "Supersonic Hair Dryer", "beauty", 429, 1.2),
  p("Olaplex", "No.3 Hair Perfector 100ml", "beauty", 30, 0.15),
  p("Maybelline", "Lash Sensational Sky High Mascara", "beauty", 12, 0.05),
  p("Clinique", "Moisture Surge 100H 50ml", "beauty", 44, 0.15),
  // Toys
  p("LEGO", "Star Wars Millennium Falcon 75192", "toys", 849, 13),
  p("LEGO", "Technic Lamborghini Sián FKP 37 42115", "toys", 449, 6),
  p("LEGO", "Icons Titanic 10294", "toys", 679, 14),
  p("LEGO", "Harry Potter Hogwarts Castle 71043", "toys", 469, 7.5),
  p("LEGO", "Technic McLaren Formula 1 42141", "toys", 199, 3),
  p("LEGO", "City Police Station 60316", "toys", 69, 1.5),
  p("Barbie", "Dreamhouse 2023", "toys", 199, 9),
  p("Hot Wheels", "Ultimate Garage", "toys", 129, 6),
  p("Nerf", "Elite 2.0 Commander RD-6", "toys", 19, 0.6),
  p("Hasbro", "Monopoly Classic", "toys", 22, 1),
  p("Magna-Tiles", "Clear Colors 100-Piece Set", "toys", 119, 2.5),
  // Only reachable through live search
  p("DJI", "Mini 4 Pro Drone", "electronics", 759, 0.9, true),
  p("Bose", "QuietComfort Ultra Headphones", "electronics", 429, 0.5, true),
  p("Garmin", "Forerunner 265", "electronics", 449, 0.2, true),
  p("Valve", "Steam Deck OLED 512GB", "electronics", 549, 1.2, true),
  p("Samsung", "Galaxy Buds2 Pro", "electronics", 189, 0.15, true),
  p("Marshall", "Emberton II Speaker", "electronics", 169, 0.8, true),
  p("Fujifilm", "Instax Mini 12", "electronics", 79, 0.5, true),
  p("Tom Ford", "Black Orchid EDP 50ml", "beauty", 150, 0.3, true),
  p("Paco Rabanne", "1 Million EDT 100ml", "beauty", 98, 0.4, true),
  p("Oral-B", "iO Series 9 Electric Toothbrush", "beauty", 279, 0.6, true),
  p("LEGO", "Ideas Tree House 21318", "toys", 249, 4, true),
  p("LEGO", "Technic Ferrari Daytona SP3 42143", "toys", 449, 6.5, true),
];

/** Demo GTINs use the 200–299 prefix, which is reserved for internal use. */
export function demoGtin(product: DemoProduct): string {
  const index = DEMO_PRODUCTS.indexOf(product);
  return `2000000${String(index + 1).padStart(6, "0")}`;
}
