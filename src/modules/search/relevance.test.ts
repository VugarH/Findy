import { describe, expect, it } from "vitest";
import type { CategorySlug } from "@/config/categories";
import { relevanceScorer } from "./relevance";

const card = (title: string, subcategorySlug: string, categorySlug: CategorySlug = "electronics") => ({ title, subcategorySlug, categorySlug });

const order = (query: string, cards: ReturnType<typeof card>[]) => {
  const score = relevanceScorer(query);
  return [...cards].sort((a, b) => score(b) - score(a)).map((c) => c.title);
};

describe("search relevance", () => {
  const caseCard = card("OtterBox iPhone 16 Symmetry Series Case", "cases-protection");
  const phone = card("Apple iPhone 16 128GB Black", "phones");
  const glass = card("Spigen tempered glass for iPhone 16", "cases-protection");

  it("puts the phone before the accessories that mention it", () => {
    expect(order("iphone 16", [caseCard, glass, phone])[0]).toBe(phone.title);
  });

  it("puts accessories first when they are what was asked for", () => {
    expect(order("iphone 16 case", [phone, caseCard])[0]).toBe(caseCard.title);
  });

  it("prefers the words together in the name", () => {
    const together = card("Apple iPhone 16 Pro", "phones");
    const apart = card("Apple iPhone 15 and 16 compatible", "phones");
    expect(order("iphone 16", [apart, together])[0]).toBe(together.title);
  });

  it("understands synonyms (Russian)", () => {
    expect(order("айфон 16", [caseCard, phone])[0]).toBe(phone.title);
  });

  it("keeps the given order when nothing tells results apart", () => {
    const a = card("adidas Samba OG", "sneakers", "shoes");
    const b = card("adidas Samba XLG", "sneakers", "shoes");
    expect(order("samba", [a, b])).toEqual([a.title, b.title]);
  });
});
