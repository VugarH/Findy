# Supplier research

Checked on 2026-09-30. Category: electronics → smartphones first (model + memory identify a
phone, so cross-store matching is reliable).

Ground rules we follow for every store:

- Only reliable stores: a brand's official store or a long-established retailer. Being readable
  is never a reason to add a store.
- Read `robots.txt` first and stay inside it. Never call endpoints it disallows.
- Never work around bot protection (Cloudflare challenges, CAPTCHAs). A blocked store needs a
  partnership or a feed, not a workaround.
- Identify ourselves honestly (`FindyBot`, plus `BOT_CONTACT` from `.env`), one request at a
  time per store, with a delay and a per-run request cap.
- Prefer an official API or affiliate feed whenever one exists.

Connected stores, with their link and exact access method, are stored in the `suppliers` table
the first time they return real offers. Print them with `npm run suppliers:list`.

## Connected

| Store | Method | Notes |
|---|---|---|
| **Baku Electronics** — bakuelectronics.az | JSON embedded in catalog pages (`__NEXT_DATA__`) | ~19 requests for all smartphones. Gives price, discounted price, stock quantity, image. Search page is disallowed → no live search. |
| **Soliton** — soliton.az | XML sitemap → product pages → OpenGraph `product:*` meta tags | One request per product, capped at 140 per run, newest first. "Load more" pagination is disallowed, and the sitemap lags by weeks, so coverage of the newest and the oldest listings is partial. |

| **World Telecom** — w-t.az | HTML product cards on section and per-brand pages | Robots.txt allows everything. A page shows 20 products; the rest load through a script endpoint we do not call, so large brands are covered partially. No previous price is shown, so it never produces a "store claim" discount. |

Sections collected from the local stores: smartphones everywhere; at Baku Electronics and World
Telecom also tablets, smart watches, headphones, laptops and game consoles.

## Popular products

`src/config/popular.ts` lists the product families people in Azerbaijan look for most (iPhone,
Galaxy S and A, Redmi Note, Honor, iPad, MacBook, AirPods, watches, PlayStation). It is curated:
Apple, Samsung and Xiaomi hold about two thirds of the phone market, and local stores' own
"popular searches" lead with iPhone and Redmi. No Google Trends figures were available to us.
`npm run popular:coverage` shows, per family, how many variants we track and how many are sold
by two or more stores.

Collecting "by product" — asking each store for one product — is not possible within the rules:
every connected store disallows its search page. Coverage of a product therefore comes from
collecting the right sections of more stores and matching the listings afterwards.

## Local stores not connected

| Store | Finding | What it would take |
|---|---|---|
| Kontakt Home — kontakt.az | Cloudflare challenge on every request, including the sitemap | Ask them for a product feed / partnership |
| Irshad — irshad.az | Reachable; `Crawl-delay: 30`. Products load through `/az/list-products/…`, which returned an empty list to us (it appears to need the browser's session) | More investigation at 30 seconds per request, or ask them for a feed |
| Umico — umico.az | 403 to automated requests | Partnership / marketplace API |
| Optimal — optimal.az | 403 to automated requests | Partnership |
| Maxi.az | Server error (525) when checked | Re-check later |
| Texnomart, Barkod Electronics, Smarton, MG Store, Bytelecom | Reachable, not analysed in depth | Candidates for the next round |

## Stores abroad — connected

Probed 414 stores in the USA, China/Hong Kong, Turkey, the UK, Germany and the UAE. Two findings
shaped the result:

1. **Large marketplaces and chains cannot be read without an agreement.** Amazon, eBay,
   AliExpress, Temu, Trendyol, Hepsiburada, Walmart, Best Buy, Target, Sephora, Newegg, LEGO and
   similar either block automated requests or expose nothing usable. They need official API keys
   (see below).
2. **Stores built on Shopify publish their catalog as JSON** (`/products.json`) and their
   robots.txt allows it. 127 of the probed stores are like this, so one shared adapter covers all
   of them. 92 were kept.

**What "kept" means (reliability):** a store is listed only if it is a brand's own official
online store, or a long-established retailer. Anything unfamiliar, off-category, bulky to ship or
priced in a currency we do not handle was dropped. This is a judgement based on brand
recognition — nobody has audited these stores — so review the list in
`src/modules/suppliers/adapters/shopify/stores.ts` and delete any you are not comfortable with.

| Category | Stores | Examples |
|---|---|---|
| Electronics | 43 | Keychron, Spigen, OtterBox, Skullcandy, JLab, Roborock, Dreame, 8BitDo, BOOX, Amazfit, Blackview, Clove (UK retailer) |
| Beauty | 40 | Fenty Beauty, Rare Beauty, Huda Beauty, ColourPop, e.l.f., Tarte, Olaplex, Tatcha, Glossier, Bluemercury, Escentual |
| Toys | 9 | Mattel Creations, Toys"R"Us, Melissa & Doug, Magna-Tiles, tonies, Good Smile |

By country: mostly USA, then China/Hong Kong brand stores, a few UK, two Turkish beauty brands.

**Limits to know about**

- **Currency (fixed 2026-10-03).** Shopify "Markets" stores price each visitor in their own currency,
  so from Azerbaijan some returned AZN while we recorded USD — prices showed about 1.7× too high
  (Undefeated, MVMT). Every `/products.json` response names the currency it is priced in (its
  `cart_currency` cookie), and prices are now saved in that currency (Nordgreen lists EUR but serves
  USD). Price history before that date was deleted for all Shopify stores.

- Shopify rate-limits us as one visitor across *all* its stores. All 92 therefore share one queue
  (one request every 2.5 s, back off when told). A full run takes about 20 minutes, and a few
  stores are refused on any given day; they are retried on the next run. 89 of the 92 have
  returned data so far.
- Only the first 500 products of each store are read.
- The catalog JSON has no shipping price. 43 stores list Azerbaijan as a destination, the rest
  need a freight forwarder; in both cases delivery is *estimated* by weight and origin country
  using the rates in `src/config/markets/az.ts`. Replace those with your forwarder's real tariff.
- These stores sell mostly their own products, so there is little overlap with the local stores
  yet. Overlap comes from retailers and marketplaces that sell the same phones and perfumes.
- Refurbished items, gift cards, warranties, samples and "app only" prices are skipped.

## Turkey

Only two Turkish stores use the open format above (New Well, The Purest Solutions). The rest:

| Store | Finding |
|---|---|
| Trendyol, Amazon.com.tr | Reachable but no readable product data; need their affiliate/partner API |
| Hepsiburada, Teknosa, MediaMarkt TR, n11, Pazarama, İtopya, Sinerji, Watsons, Sephora TR, ebebek | Block automated requests |
| İncehesap, Gaming.gen.tr, PttAVM, Troy, Gratis, Rossmann TR, Flormar, Golden Rose, Toyzz Shop, Armağan Oyuncak | Reachable; each needs its own adapter (next round) |

## Clothing, shoes, bags, watches and jewelry (2026-10-01)

Brand items are rare on the big marketplaces, so these categories come from the brands' own
stores and from established retailers that are authorised to sell them.

**In Azerbaijan** there is no official online store for Zara, Koton, LC Waikiki, adidas, Puma or
Lumberjack. People order them from Turkey through a forwarder (Turkey warehouse → Baku in about
a week), which is exactly what our landed price models. Local sites checked and *not* used:

| Site | Why not |
|---|---|
| brendoo.com | Says "original products from premium brands", but its catalog is unbranded dropshipped goods (supplier codes, "Asian sizes") |
| pumaazerbaijan.az | Not Puma: the domain now shows gambling content. Do not link to it |
| geyin.az, birmarket.az / umico.az, ubuy.az | Unavailable (503) or block automated requests (403) |
| galeleo.az, prime-accessories.com, richmen.az, destim.az | Small shops; authorisation for the brands they sell could not be confirmed |

**Turkey — connected** through one shared adapter that reads the sitemap and each product page's
schema.org data (`src/modules/suppliers/adapters/structured-data/stores.ts`):

| Store | Kind | Sells | Crossed-out price from |
|---|---|---|---|
| SuperStep | Sneaker chain | adidas, Nike, Puma, New Balance, Converse… | product JSON `retail_price` |
| Sneaks Up | Sneaker retailer | adidas, Nike, Puma, Vans… | page JSON `oldPrice` |
| Intersport Türkiye | Sporting-goods chain | adidas, Nike, Puma, Skechers, Columbia… | Google Analytics `discount` |
| Barçın | Sneaker chain | adidas, Nike, Puma, Skechers… | product JSON `retail_price` |
| Beymen | Luxury department store | BOSS, Lacoste, Tommy, Michael Kors, designer brands | page JSON `old_price` |
| Network | Brand store | Network | — |
| Colin's | Brand store | Colin's | Google Analytics `discount` |
| Damat Tween | Brand store | Damat, Tween | — |
| Altınyıldız Classics | Brand store | Altınyıldız Classics | Google Analytics `discount` |
| Saat&Saat | Watch retailer | Casio, Tissot, Seiko, Lacoste, Tommy, Guess… | — |
| Atasay | Jeweler | Atasay gold and diamond jewelry | — |
| Altınbaş | Jeweler | Altınbaş gold and diamond jewelry | Google Analytics `discount` |
| Pierre Cardin Türkiye | Brand store | Pierre Cardin | product JSON `retail_price` |
| Mudo | Brand store | Mudo | product JSON `retail_price` |
| Özdilekteyim | Department store | Lumberjack, U.S. Polo Assn., Pierre Cardin… | — |

Added the same day, outside fashion (same adapter):

| Store | Category | Note |
|---|---|---|
| Gratis | Beauty | Turkey's largest personal-care chain; non-beauty items are skipped |
| Rossmann Türkiye | Beauty | Drugstore; non-beauty items are skipped |
| Flormar | Beauty | Brand store; its SKU is the barcode, so products match by GTIN |
| Troy | Electronics | Apple Premium Partner; its schema.org brand is always "Apple", so the brand is read from the title |
| Gaming.gen.tr | Electronics | Gaming hardware; publishes barcodes |
| Armağan Oyuncak | Toys | Toy-store chain |

Checked and not usable: Toyzz Shop (no product data on its pages), Hotiç and Yargıcı (product
sitemap lists no product pages), Golden Rose and Kemal Tanca (no sitemap), İncehesap (HTTP 403).

Matching across stores uses the maker's article number (adidas `IH2639`, Nike `FN8797-456`,
Puma `393279-01`, Vans, Converse, Skechers), found in the product data, URL or title. Stores
without a crossed-out price still feed price history, so their discounts become verifiable after
14 days.

**Turkey — blocked or challenged** (not worked around): Zara, Koton, LC Waikiki, DeFacto, Mango,
Boyner, Penti, Machka, Koray Spor, Lescon (HTTP 403); İpekyol, Twist, Suwen (HTTP 418);
Lumberjack, FLO, Kinetix (reCAPTCHA page); Skechers TR (bot challenge); adidas.com.tr (403 / time-out).
Getting these needs the brand's permission, usually as an affiliate product feed: Turkish
fashion brands often run affiliate programmes through networks such as Admitad, which give
registered publishers a feed. Not yet checked brand by brand.

**Abroad — connected** (Shopify, `shopify/stores.ts`):

- Watches: Nordgreen, Vincero, Daniel Wellington, Timex, MVMT, Lilienthal Berlin, Mondaine, Farer, CLUSE
- Jewelry: Missoma, Astrid & Miyu, PDPAOLA, gorjana, Pilgrim, BaubleBar
- Clothing & shoes (brands): Gymshark, Represent, Champion, Good American, Reebok, Steve Madden,
  Allbirds, Kiğılı (TR), Derimod (TR)
- Sneaker & streetwear retailers: Kith, Undefeated, Concepts, Bodega, Feature, Extra Butter,
  Shoe Palace, Culture Kings, Notre

**Abroad — blocked:** adidas, Puma, Nike, New Balance, Lacoste, Tommy Hilfiger, Calvin Klein,
The North Face, Vans, Converse, Columbia, Fossil, Kendra Scott, Monica Vinader, Crocs (all
Salesforce/Akamai-protected or HTTP 403).

## Home & kitchen, baby & kids gear, sports & outdoor (2026-10-02)

| Category | Turkey (sitemap + product data) | Abroad (Shopify brand stores) |
|---|---|---|
| Home & kitchen | Karaca, Fakir, Tefal Türkiye (Tefal, Rowenta, Moulinex, Krups); Beymen and Özdilekteyim also sell home goods | Our Place, Fellow, Ooni, Stanley, Ember, Levoit, Cosori, Dreo |
| Baby & kids gear | — (none readable, see below) | Silver Cross, Cosatto, Inglesina, Nanit, Owlet, Frida |
| Sports & outdoor | SPX (Salomon, The North Face, Stanley…); Intersport, Barçın and Özdilekteyim also sell equipment | Black Diamond, Big Agnes, NEMO, Helinox, Manduka, Liforme, Therabody, REP Fitness, Titan Fitness, Bowflex |

Checked and not usable: Arçelik, Beko, Paşabahçe, Dyson TR, ebebek, Decathlon TR (HTTP 403); English
Home (product pages 403); Arzum, Joker, Chicco TR, The North Face TR, Columbia TR (no product data on
their pages); Vestel, Hummel (robots.txt disallows the sitemap's URLs); Bosch Home TR (mostly built-in
appliances that cannot be shipped by a forwarder); De'Longhi (robots.txt unclear); Salomon.com (no
product type in its data, so items cannot be sorted into categories — SPX sells Salomon instead);
Dualit (robots.txt disallows /products.json) and Snow Peak (HTTP 403) were removed after the first run.
Spare parts and "scratch and dent" items from brand stores are skipped.

## Marketplaces that need your accounts

Each is an official API that issues keys to a registered affiliate or developer — accounts only
you can open.

| Store | Official access | What you need to do |
|---|---|---|
| eBay | Browse API (`item_summary/search`), OAuth client-credentials token. Scraping is explicitly prohibited by their robots.txt | Register at developer.ebay.com for an app key; join eBay Partner Network for commission |
| Amazon (US, TR, DE…) | Creators API (replaced the Product Advertising API, retired in May 2026) | Amazon Associates account, then Creators API credentials |
| AliExpress | Affiliate API on the AliExpress Open Platform; manual review, answer in 1–2 days | Apply at portals.aliexpress.com for an App Key and tracking id. **2026-10-01: application refused for Azerbaijan (country restriction)** |
| Trendyol | No public product API for price comparison found. Trendyol operates in Azerbaijan (joint venture with PASHA Holding) | Contact their affiliate / partner team |
| Temu | No official public product API; only unofficial scraping services | Not planned |

These are where the same iPhone, Samsung or Dior perfume is sold abroad, so they matter most for
the local-vs-abroad comparison. Each becomes one adapter with `liveSearch.supported: true`, which
also switches the live web search back on.

## Open questions to verify

- Delivery cost for both connected stores is assumed to be free. Confirm and put the real rule
  in the adapter.
- Soliton's `creditPrice` is treated as its regular price.
- We show the stores' own product photos by linking to them. Ask each store whether that is
  acceptable, or host licensed images.
- Neither store has been asked for permission. Both allow these pages in robots.txt, but a short
  email introducing the service (you send them buyers) is the right next step and the route to a
  proper feed.

## Turkish beauty brands (added 2026-10-08)

| Brand | Where we read it | Notes |
|---|---|---|
| Nascita | nascita.com.tr (Shopify, official) | also lists its sister brand Fenda |
| Urban Care | urbancare.com.tr (Shopify, official) | |
| Pastel, Show by Pastel | pastelshop.com (sitemap + schema.org, official) | whole catalog (~880) read each run; barcodes as GTIN |
| Sinoz | sinoz.com.tr (sitemap + schema.org, official) | ~45 products |
| The Purest Solutions | thepurestsolutions.com (Shopify, official) | connected earlier |
| Beaulis, LYKD, Bee Beauty, Benri | Gratis (gratis.com) | Gratis's own brands, no store of their own; read first among Gratis products (900 pages per run) |
| HC Care | — | no official online store; sold on Trendyol/Hepsiburada/Watsons (all block automated requests) and not on Gratis |

## More Turkish brands (2026-10-09)

Connected:

| Store | Read through | Category | Notes |
|---|---|---|---|
| Ramsey | Shopify (www.ramsey.com.tr) | Clothing | menswear |
| Marcomen | Shopify (www.marcomen.com.tr) | Shoes | leather shoes |
| Chakra | Shopify (mychakrastore.com, EUR) | Home | chakra.com.tr redirects to this international store |
| Desa | sitemap + schema.org | Bags, shoes, clothing | leather; reuses a SKU across pages (ingest keeps one listing per id) |
| Sarar | sitemap + schema.org | Clothing, home | also Interview and Sarar Home bedding; clothing pages read first |
| Roman | sitemap + schema.org | Clothing | womenswear, also jewelry and bags |
| Tergan | sitemap + schema.org | Shoes, bags | |
| Divarese | sitemap + schema.org | Shoes, bags | also George Hogg |
| Emsan | sitemap + schema.org | Home | tableware, cookware; barcodes as GTIN |
| Procsin | sitemap + schema.org | Beauty | |
| Siveno | sitemap + schema.org | Beauty | natural soaps; also cleaning products |

Already connected before this round: Flormar, Karaca, Derimod.

Checked and not usable: Mavi (mavi.com redirects visitors outside Turkey to mavicompany.com),
Greyder (Shopify store that publishes no products — empty /products.json, no product sitemap;
only an AI-agent commerce endpoint), Avva and Schafer (HTTP 403), Vakko, Hatemoğlu, Madame Coco,
Bernardo, Bioxcin, Panço (no schema.org Product data on product pages), Taç (robots.txt disallows
its sitemap), Korkmaz and Tudors (no answer), Jimmy Key (site is wholesale only).

## Toys and microdata stores (2026-10-09)

The structured-data adapter now also reads schema.org **microdata** (itemscope/itemprop in the
HTML, `structured-data/microdata.ts`) when a page has no JSON-LD, and a new crossed-out-price
source `strikethrough` (schema.org StrikethroughPrice). IdeaSoft shops use both.

| Store | Category | Notes |
|---|---|---|
| Pilsan (pilsanstore.com.tr) | Toys | Turkish toy maker; microdata; ~440 products; crossed-out prices |
| Bernardo (bernardo.com.tr) | Home | kitchenware; microdata with barcodes; crossed-out prices |

Not connected:
- **Toyzz Shop** (toyzzshop.com, ~21,000 products, Turkey's largest toy chain, owned by Sunman):
  robots.txt allows product pages, but they are a JavaScript app — the HTML has no product
  data; name and price come from the shop's own undocumented API. Waiting for the user's
  decision.
- **Sunman** (sunman.com.tr): toy distributor; no consumer shop, only a B2B portal. Its
  products are sold through Toyzz Shop.
- Still no product data (neither JSON-LD nor microdata): Madame Coco, Panço, Vakko, Hatemoğlu, Bioxcin.

## allbeauty sale collection (2026-10-11)

Shopify stores are read for their first 500 products only, and allbeauty's catalog is far
bigger, so only a few of its discounts showed. A Shopify store can now name its own sale
collection (`saleCollection` in `adapters/shopify/stores.ts`), read after the first pages:
allbeauty → `/collections/offers-outlet-70/products.json` (~4,100 products, robots.txt allows
it; 18 pages in the shared Shopify queue, ~45 s). First run: 4,184 offers, 3,863 deals.
Other big Shopify stores can get the same once their sale collection is found
(`/collections.json` lists them with product counts).

## SuperStep through category pages (2026-10-11)

SuperStep (Akinon) gives almost every discount as a cart offer ("SEPETTE %30 İNDİRİM"):
the product price equals the list price, so its JSON-LD showed no discount, and 300 product
pages a day covered ~1.5% of its ~17,000 products. It now has its own adapter
(`adapters/akinon/`): category pages /erkek/, /kadin/, /cocuk/ with ?page= (allowed by
robots.txt), 48 products each with price, cart offers, stock and sizes. The price is the
one-item cart price when that offer applies to every shopper. At the user's request only
discounted products are stored (max 3,000); a product without a discount only updates an
offer we already track (`RawOffer.updateOnly`). First run: 3,000 offers, 2,801 deals,
~11 minutes. Sneaks Up, Beymen, Network may hide cart offers the same way — not checked yet.

## Turkish stores, round 4 (2026-10-20)

Asked about: **Farmasi** — connected; Next.js pages without schema.org, read by a store-specific
reader (`adapters/structured-data/readers/farmasi.ts`: `__NEXT_DATA__` productData; previous price
= `referencePrice`/`retailPrice`), ~450 products, all read daily. **Golden Rose** — brand site
without a shop (no sitemap); already covered through Gratis/Rossmann (416 products). **Dolu** —
catalogue only (no prices, sold through chain stores). **Watsons TR** — robots.txt 403. **Toyzz
Shop** — still an empty JS shell; left out by the user's decision (2026-10-20).

New: **Sportive** (sportive.com.tr, ~12,800 products) — Akinon like SuperStep, connected through
the Akinon category reader (discounted only, max 3,000); brand from `integration_marka_label`.

Checked and not usable: Boyner, Penti, Lescon, Korayspor (403), İpekyol, Suwen (418), Vatan
Bilgisayar (sitemap 403), Linens, Kütahya Porselen, Note Cosmetique (robots.txt disallows product
pages), Lufian, Yataş (no sitemap), Mothercare TR (no answer). **Dermoeczanem** has full data
(Ticimax `PRODUCT_DATA`: barcode, regular and sale price) but its photos are WitCDN
hotlink-protected, so products would have no usable image; `usableImage` now refuses every
`witcdn.*` host.

## Round 5 (2026-10-21): Admitad affiliate network

Ad space "Findy.az" on store.admitad.com (website id 3013554). Programs are read from the
product feeds Admitad builds (adapters/admitad); links in them carry our tracking.

| Program | Feed | Verdict |
|---|---|---|
| AliExpress WW | "hot products", discounted only, ~480k offers / ~850 MB, USD; fields: name, price, oldprice, categoryId (with parentId tree), pictures, discount, commissionRate, shopId — no brand, stock, shipping or order count | **Connected** (`aliexpress`): streamed, 5,000 kept by category quota, $2–40, 10–85 % off, ≤20 per seller; shipping assumed free (direct to AZ), delivery 10–25 days |
| Geekbuying WW | "Main 2", 1,018 offers, 785 discounted; brand + topseller flag; mostly laser engravers, 3D printers, power stations (median $217); all marked unavailable | Not connected: wrong products for us, delivery to AZ doubtful |
| ChicMe WW | "main EN", 1,444 offers, **no old prices**, categories unresolved | Not connected: ships to 21 countries only (not AZ, not TR — its Shopify meta.json) |

Other Admitad programs open to Azerbaijan worth joining: iHerb (ships to AZ), CASETiFY,
G-Star Raw, Puma TR. Turkish retailers we already list are not on Admitad.

## Round 6 (2026-10-28): Turkey, Russia, nearby countries

Triaged ~160 stores (robots.txt, Shopify JSON, platform), then `store:probe` on the reachable ones.

Connected:

| Store | Read through | Category | Notes |
|---|---|---|---|
| Lacoste Türkiye | Akinon category pages (`/tum-urunler/`, ~2,100) | Clothing, shoes, bags | `allProducts`: whole catalog, not only discounts |
| Paşabahçe | Akinon category pages (4 listings, ~4,900) | Home | `allProducts`; names rarely match keywords, so `fallbackCategory: "home"` |
| KIKO Milano TR | sitemap + schema.org (~2,300) | Beauty | old price in `<div class="price -retail"><pz-price>` (new source `retail-element`) |
| Porland | sitemap + schema.org (~6,300) | Home | no store discounts seen |
| Under Armour TR | sitemap + schema.org (~12,000) | Sports, clothing, shoes | ProductGroup with one page per colour: the parser now keeps the page's own variant; `retail_price` written as `"`; ~70% of sitemap items sold out |

Evidea, Under Armour, Porland and KIKO are Akinon's older "Omnishop" pages: no Next.js data, so the Akinon
category reader cannot read them (each has different card markup).

Step 2, connected the same day (sitemap + schema.org): Cosmetica (beauty chain, barcodes as GTIN), LOFT
(`ga4-discount`), Hotiç (sitemap index written as a `<urlset>`; its `oldPrice` is always 2× the price, so it is
not used), Hummel TR (`ga4-discount`), ZEN Pırlanta, ttec (single-brand: "MagSafe" in a title no longer makes it
Apple), Smarton.az (local; robots.txt `Crawl-delay: 30` — now obeyed for every store — so 100 pages per run,
Azerbaijani `/mehsullar/` pages only; the sitemap lists each product in Russian too). Not connected: Texnomart.az
(9 of 10 sampled items sold out, no photos), Chicco TR (JSON-LD present but not parseable), MG Store (half the
sitemap is category pages, most products sold out), Dyson TR (sitemap products are mostly spare parts).

Since this round a sold-out listing only updates an offer we already track; sold-out pages we never saved are
remembered in `sold_out_pages`, and sitemap stores read sold-out pages last until the sitemap's lastmod changes.

Earlier list — readable, not connected yet: Cosmetica (5,200, multi-brand beauty), Loft (4,800, `ga4-discount`), Zen Pırlanta
(4,700), Hummel TR (2,800, `ga4-discount`), Dyson TR, Hotiç (`sitemap_products.xml`), Chicco TR, ttec, Game Garaj,
Doğtaş (decor only), re:Store and Befree (RUB: needs FX + delivery rate), Extra.ge (GEL). Local: Smarton.az
(JSON-LD), Texnomart.az, MG Store, Almali.az (USD prices), Irshad (crawl-delay 30). Need their own reader:
Casper (GA4 `view_item`), Columbia TR, Yargıcı, Arzum, İstikbal, Babymall (~18,000), Ugreen TR, Evidea.

Blocked (403 / Cloudflare / reCAPTCHA / 498) — partnership or feed only: Trendyol, Hepsiburada, n11 (no product
data), Amazon TR, Teknosa, MediaMarkt TR, Vatan, İtopya, İncehesap, PttAVM, Monster, Arçelik, Beko, Grundig,
Decathlon TR, adidas TR, New Balance TR, FLO/Kinetix/Lumberjack/Instreet (reCAPTCHA), LC Waikiki, Koton,
DeFacto, Boyner, Twist, Machka, Eve Shop, Yves Rocher, Kitapyurdu, e-bebek, Joker, Jumbo, English Home, Koçtaş
(product pages 403). Russia: Ozon (works in Azerbaijan since 2024, free delivery), Wildberries (in Azerbaijan
since 2023), Lamoda, DNS, M.Video (no product data), Gold Apple, L'Etoile (no schema.org), Detsky Mir. Azerbaijan:
Kontakt, Birmarket/Umico, Optimal. Georgia: Zoommer, Alta, Elit Electronics. UAE: Noon, Namshi, Sharaf DG.
