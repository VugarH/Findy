import { describe, expect, it } from "vitest";
import { matchKeysOf } from "../matching";
import { parseElectronicsTitle } from "./electronics";

const key = (title: string) => {
  const parsed = parseElectronicsTitle(title)!;
  return matchKeysOf({ title, brand: parsed.brand, model: parsed.model }).modelKey;
};

describe("parseElectronicsTitle", () => {
  it("still handles phones, including the spaced memory some stores write", () => {
    expect(parseElectronicsTitle("Apple iPhone 15 128 GB Black")).toEqual({
      brand: "Apple",
      model: "iPhone 15 128GB",
      color: "Black",
    });
    expect(key("Apple iPhone 15 128 GB Black")).toBe(key("Smartfon Apple iPhone 15 128GB BLACK"));
  });

  it("strips product-type words from other electronics", () => {
    expect(parseElectronicsTitle("Noutbuk Apple MacBook Air 13 M3")).toMatchObject({
      brand: "Apple",
      model: "MacBook Air 13 M3",
    });
    expect(key("Noutbuk Apple MacBook Air 13 M3")).toBe(key("Apple MacBook Air 13 M3"));
    expect(key("Simsiz qulaqlıq JBL Tune 520BT")).toBe(key("JBL Tune 520BT"));
  });

  it("infers the brand from a well-known product line", () => {
    expect(parseElectronicsTitle("Oyun konsolu PlayStation 5 Slim")).toMatchObject({ brand: "Sony" });
    expect(parseElectronicsTitle("AirPods Pro 3")).toMatchObject({ brand: "Apple", model: "AirPods Pro 3" });
  });

  it("gives up on titles with no recognisable brand", () => {
    expect(parseElectronicsTitle("Smart Paket")).toBeNull();
  });
});
