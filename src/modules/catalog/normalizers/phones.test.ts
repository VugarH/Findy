import { describe, expect, it } from "vitest";
import { matchKeysOf } from "../matching";
import { parsePhoneTitle } from "./phones";

const key = (title: string) => {
  const phone = parsePhoneTitle(title)!;
  return matchKeysOf({ title, brand: phone.brand, model: phone.model }).modelKey;
};

describe("parsePhoneTitle", () => {
  it("reads brand, model, memory and colour", () => {
    expect(parsePhoneTitle("Smartfon HONOR X8e 6GB/256GB Gold")).toEqual({
      brand: "Honor",
      model: "X8e 6/256GB",
      color: "Gold",
    });
  });

  it("handles phones sold by storage only", () => {
    expect(parsePhoneTitle("Smartfon Apple iPhone 17 Pro 256GB COSMIC ORANGE")).toEqual({
      brand: "Apple",
      model: "iPhone 17 Pro 256GB",
      color: "Cosmic Orange",
    });
    expect(parsePhoneTitle("Apple iPhone 18 Pro 2 TB Burgundy")?.model).toBe("iPhone 18 Pro 2TB");
  });

  it("maps sub-brands to their parent brand", () => {
    expect(parsePhoneTitle("Smartfon Redmi Note 17 Pro 5G 8GB/512GB Sky Blue")).toMatchObject({
      brand: "Xiaomi",
      model: "Redmi Note 17 Pro 5G 8/512GB",
    });
  });

  it("gives the same key to the same phone named by different stores", () => {
    expect(key("Smartfon HONOR X8e 6GB/256GB Gold")).toBe(key("HONOR X8E 6/256GB ORANGE"));
    expect(key("Smartfon Redmi Note 15 Pro 5G 12GB/512GB Black")).toBe(key("XIAOMI REDMI NOTE 15 PRO 5G 12/512GB BLACK"));
    expect(key("Smartfon Samsung Galaxy A27 8GB/256GB Black")).toBe(key("SAMSUNG GALAXY A27 (SM-A276) 8/256GB BLACK"));
    expect(key("Smartfon Motorola Razr 60 8GB/256GB Gibraltar Sea")).toBe(key("MOTOROLA RAZR 60 8/256GB GIBRALTAR SEA"));
  });

  it("keeps different memory variants apart", () => {
    expect(key("HONOR 600 8/256GB ORANGE")).not.toBe(key("HONOR 600 8/512GB ORANGE"));
  });

  it("returns null when it cannot identify a phone", () => {
    expect(parsePhoneTitle("Smart Paket")).toBeNull();
    expect(parsePhoneTitle("Nokia 105 Charcoal")).toBeNull();
  });
});
