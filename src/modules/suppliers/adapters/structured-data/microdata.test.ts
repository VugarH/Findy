import { describe, expect, it } from "vitest";
import { readListPrice, readStructuredProduct } from "./parse";

// Trimmed from a Pilsan (IdeaSoft) product page.
const PAGE = `<html><body><div class="x">menu</div>
<div style="display:none;" itemscope itemtype="https://schema.org/Product">
    <span itemprop="name">Doktor Seti (11 Parça)</span>
    <span itemprop="description">Rol yapma oyunu.</span>
    <span itemprop="sku">03 232</span>
    <span itemprop='category' content='Rol Yapma ve Taklit Oyunu'></span>
    <img itemprop="image" alt="Doktor Seti" src="//www.pilsanstore.com.tr/idea/03-232.jpg" />
    <div itemprop='offers' itemscope itemtype='https://schema.org/Offer'>
        <meta itemprop='priceCurrency' content="TRY" />
        <meta itemprop='price' content="449.10" />
        <div itemprop="priceSpecification" itemscope itemtype="https://schema.org/UnitPriceSpecification">
            <meta itemprop="priceType" content="https://schema.org/StrikethroughPrice" />
            <meta itemprop="price" content="499.00" />
            <meta itemprop="priceCurrency" content="TRY" />
        </div>
        <link itemprop='availability' href='https://schema.org/InStock'>
        <span itemprop="url">https://www.pilsanstore.com.tr/urun/doktor-seti</span>
    </div>
</div>
<span itemprop="name">Not the product</span></body></html>`;

describe("schema.org microdata", () => {
  it("reads a product written as microdata, with the offer's own price", () => {
    expect(readStructuredProduct(PAGE)).toMatchObject({
      name: "Doktor Seti (11 Parça)",
      sku: "03 232",
      price: 449.1,
      currency: "TRY",
      inStock: true,
    });
  });

  it("reads the StrikethroughPrice as the crossed-out price", () => {
    expect(readListPrice(PAGE, 449.1, "strikethrough")).toBe(499);
  });

  it("knows a sold-out product", () => {
    expect(readStructuredProduct(PAGE.replace("InStock", "OutOfStock"))?.inStock).toBe(false);
  });

  it("prefers JSON-LD when a page has both", () => {
    const both = `<script type="application/ld+json">{"@type":"Product","name":"From JSON","offers":{"price":"10","priceCurrency":"TRY"}}</script>${PAGE}`;
    expect(readStructuredProduct(both)?.name).toBe("From JSON");
  });
});
