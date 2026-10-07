import { describe, expect, it } from "vitest";
import { parseCbarRates } from "./cbar";

describe("parseCbarRates", () => {
  it("reads rates per single unit and ignores currencies we do not use", () => {
    const xml = `<ValCurs><ValType Type="Xarici valyutalar">
      <Valute Code="USD"><Nominal>1</Nominal><Name>1 ABŞ dolları</Name><Value>1.7</Value></Valute>
      <Valute Code="TRY"><Nominal>1</Nominal><Name>1 Türkiyə lirəsi</Name><Value>0.0412</Value></Valute>
      <Valute Code="JPY"><Nominal>100</Nominal><Name>100 Yapon yeni</Name><Value>1.15</Value></Valute>
      <Valute Code="XAU"><Nominal>1 t.u.</Nominal><Name>Qızıl</Name><Value>4500</Value></Valute>
    </ValType></ValCurs>`;
    expect(parseCbarRates(xml)).toEqual({ USD: 1.7, TRY: 0.0412 });
  });
});
