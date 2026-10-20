import { describe, expect, it } from "vitest";
import { azMarket } from "@/config/markets/az";
import type { CartPlan } from "@/modules/cart/plan";
import { detailLines, requestDetails } from "./details";

const plan = {
  parcels: [
    {
      store: { id: "nike", name: "Nike TR", websiteUrl: "https://nike.test" },
      cost: { totalMinor: 20_000 },
      lines: [
        {
          offerId: "o1",
          url: "https://nike.test/pegasus",
          quantity: 2,
          product: { productId: "p1", slug: "pegasus", title: "Pegasus 41" },
          itemsMinor: 15_000,
        },
      ],
    },
  ],
  totalMinor: 20_000,
} as unknown as CartPlan;

describe("requestDetails", () => {
  it("keeps each parcel's lines with their store links, the totals and our fee", () => {
    const details = requestDetails(plan, azMarket)!;
    expect(details.parcels[0]).toEqual({
      store: "Nike TR",
      storeUrl: "https://nike.test",
      totalMinor: 20_000,
      lines: [{ title: "Pegasus 41", slug: "pegasus", url: "https://nike.test/pegasus", quantity: 2, itemsMinor: 15_000 }],
    });
    expect(details.totalMinor).toBe(20_000);
    expect(details.feeMinor).toBe(Math.max(azMarket.assistedOrder.minFee * 100, Math.round(20_000 * azMarket.assistedOrder.feeRate)));
    expect(detailLines(details)).toHaveLength(1);
  });

  it("is null without items", () => {
    expect(requestDetails({ ...plan, parcels: [] }, azMarket)).toBeNull();
    expect(detailLines(null)).toEqual([]);
  });
});
