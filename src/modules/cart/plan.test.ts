import { describe, expect, it } from "vitest";
import { azMarket } from "@/config/markets/az";
import { computeLandedCost, computeParcelCost, type LandedCostInput } from "@/modules/pricing/landed-cost";
import { CART_LIMITS, sanitizeCart } from "./items";
import { planParcels, type PlanInput } from "./plan";

// Fixed rates keep the numbers readable: USD 1.7, TRY 0.042.
const market = azMarket;

const turkish = (priceTry: number, weightKg = 0.5): LandedCostInput => ({
  priceMinor: priceTry * 100,
  currency: "TRY",
  shippingMinor: null,
  weightKg,
  scope: "global",
  originCountry: "TR",
});

const line = (offerId: string, storeId: string, cost: LandedCostInput, quantity = 1, days = { min: 4, max: 8 }): PlanInput => ({
  offerId,
  quantity,
  product: { productId: `p-${offerId}`, slug: offerId, title: offerId, brand: null, imageUrl: null, categorySlug: "shoes" },
  store: { id: storeId, name: storeId, scope: cost.scope, originCountry: cost.originCountry, websiteUrl: `https://${storeId}.test` },
  storePriceMinor: cost.priceMinor,
  currency: cost.currency,
  costInput: cost,
  delivery: days,
});

describe("computeParcelCost", () => {
  it("prices a single item exactly like computeLandedCost", () => {
    const input = turkish(2_000);
    expect(computeParcelCost([{ input, quantity: 1 }], market)).toEqual(computeLandedCost(input, market));
  });

  it("pays the forwarder's minimum charge once for a parcel, not once per item", () => {
    // 0.5 kg × $2.5 = $1.25, below the $3 minimum: alone, each item pays $3 (5.10 AZN).
    const parcel = computeParcelCost([{ input: turkish(500), quantity: 1 }, { input: turkish(700), quantity: 1 }], market);
    expect(parcel.shippingMinor).toBe(510);
  });

  it("counts customs on the parcel's total: two items under the limit can cross it together", () => {
    // 6,500 TRY = 273 AZN each, under the 510 AZN limit; together 546 AZN + delivery is over it.
    const alone = computeParcelCost([{ input: turkish(6_500), quantity: 1 }], market);
    const together = computeParcelCost([{ input: turkish(6_500), quantity: 2 }], market);
    expect(alone.dutyMinor).toBe(0);
    expect(together.dutyMinor).toBeGreaterThan(0);
    expect(together.vatMinor).toBeGreaterThan(0);
  });

  it("charges a local store's delivery once per order", () => {
    const local = (priceMinor: number, shippingMinor: number): LandedCostInput => ({
      priceMinor,
      currency: "AZN",
      shippingMinor,
      weightKg: 1,
      scope: "local",
      originCountry: "AZ",
    });
    const parcel = computeParcelCost([{ input: local(10_000, 500), quantity: 2 }, { input: local(5_000, 300), quantity: 1 }], market);
    expect(parcel).toMatchObject({ itemMinor: 25_000, shippingMinor: 500, dutyMinor: 0, totalMinor: 25_500 });
  });
});

describe("planParcels", () => {
  it("makes one parcel per store, in the order the stores were added", () => {
    const plan = planParcels(
      [line("a", "nike", turkish(1_000)), line("b", "zara", turkish(800)), line("c", "nike", turkish(600), 2)],
      market,
    );
    expect(plan.parcels.map((parcel) => [parcel.store.id, parcel.lines.map((l) => l.offerId)])).toEqual([
      ["nike", ["a", "c"]],
      ["zara", ["b"]],
    ]);
    expect(plan.itemCount).toBe(4);
    expect(plan.totalMinor).toBe(plan.parcels[0].cost.totalMinor + plan.parcels[1].cost.totalMinor);
  });

  it("shows what combining saves and when the parcel arrives (the slowest item decides)", () => {
    const plan = planParcels(
      [line("a", "nike", turkish(500), 1, { min: 3, max: 6 }), line("b", "nike", turkish(700), 1, { min: 5, max: 9 })],
      market,
    );
    const [parcel] = plan.parcels;
    expect(parcel.savingsMinor).toBe(510); // one $3 forwarder minimum instead of two
    expect(plan.savingsMinor).toBe(510);
    expect(parcel.delivery).toEqual({ min: 5, max: 9 });
    expect(parcel.weightKg).toBe(1);
  });

  it("says how much room is left under the duty-free limit, or how far over it the parcel is", () => {
    const under = planParcels([line("a", "nike", turkish(2_000))], market).parcels[0].customs!;
    expect(under.overMinor).toBe(0);
    expect(under.roomMinor).toBe(under.limitMinor - under.valueMinor);

    const over = planParcels([line("a", "nike", turkish(6_500)), line("b", "nike", turkish(6_500))], market).parcels[0];
    expect(over.customs!.overMinor).toBeGreaterThan(0);
    expect(over.customs!.chargedMinor).toBe(over.cost.dutyMinor + over.cost.vatMinor);
    // Ordered one by one each would stay under the limit, so combining costs more here.
    expect(over.savingsMinor).toBeLessThan(0);
  });

  it("has no customs for a store in the market", () => {
    const local: LandedCostInput = { priceMinor: 5_000, currency: "AZN", shippingMinor: 0, weightKg: 1, scope: "local", originCountry: "AZ" };
    expect(planParcels([line("a", "soliton", local)], market).parcels[0].customs).toBeNull();
  });
});

describe("sanitizeCart", () => {
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

  it("keeps valid lines, drops duplicates and junk, and clamps quantities", () => {
    expect(
      sanitizeCart([
        { offerId: id(1), quantity: 2 },
        { offerId: id(1), quantity: 5 },
        { offerId: "nope", quantity: 1 },
        { offerId: id(2), quantity: 99 },
        { offerId: id(3), quantity: -4 },
        null,
      ]),
    ).toEqual([
      { offerId: id(1), quantity: 2 },
      { offerId: id(2), quantity: CART_LIMITS.quantity },
      { offerId: id(3), quantity: 1 },
    ]);
    expect(sanitizeCart("[]")).toEqual([]);
  });

  it("stops at the line limit", () => {
    const many = Array.from({ length: CART_LIMITS.lines + 5 }, (_, n) => ({ offerId: id(n), quantity: 1 }));
    expect(sanitizeCart(many)).toHaveLength(CART_LIMITS.lines);
  });
});
