import { describe, expect, it, vi } from "vitest";
import type { RawOffer } from "@/modules/suppliers/types";

vi.mock("@/db/client", () => ({ db: {} }));

const { uniqueListings } = await import("./ingest");

const listing = (externalId: string, inStock: boolean, url: string): RawOffer => ({
  externalId,
  url,
  title: "Bag",
  categorySlug: "bags",
  priceMinor: 100,
  currency: "TRY",
  shippingMinor: null,
  inStock,
});

describe("uniqueListings", () => {
  it("keeps one listing per store id, preferring one in stock", () => {
    const kept = uniqueListings([listing("A", false, "/a-1"), listing("B", true, "/b"), listing("A", true, "/a-2"), listing("A", true, "/a-3")]);
    expect(kept.map((offer) => offer.url)).toEqual(["/a-2", "/b"]);
  });
});
