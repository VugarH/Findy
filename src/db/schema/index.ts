import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Money columns are integers in minor units (qəpik / cents). */

/** Same shape as AccessMethod in modules/suppliers; duplicated to keep the schema dependency-free. */
export interface StoredAccessMethod {
  kind: string;
  summary: string;
  steps: string[];
  entryPoints: string[];
  fields: Record<string, string>;
  robots: { checkedOn: string; notes: string };
  politeness: { delayMs: number; maxRequestsPerRun: number };
  liveSearch: { supported: boolean; reason?: string };
  assumptions?: string[];
  reliability?: { basis: string; note: string };
  shipsToMarket?: boolean;
}

/**
 * Settings of a store added in the admin panel, read by modules/suppliers/custom.ts.
 * Loosely typed here to keep the schema dependency-free; validated where it is read.
 */
export interface StoredCustomConfig {
  connection: { type: string } & Record<string, unknown>;
  [key: string]: unknown;
}

/** "code": defined in modules/suppliers (registry). "admin": added in the admin panel. */
export type SupplierSource = "code" | "admin";

export const suppliers = pgTable("suppliers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  scope: text("scope").$type<"local" | "global">().notNull(),
  originCountry: text("origin_country").notNull(),
  currency: text("currency").notNull(),
  websiteUrl: text("website_url").notNull(),
  trustScore: integer("trust_score").notNull(),
  integration: text("integration").notNull(),
  /** How we get this store's data — see AccessMethod in modules/suppliers/types. */
  accessMethod: jsonb("access_method").$type<StoredAccessMethod>(),
  active: boolean("active").notNull().default(true),
  source: text("source").$type<SupplierSource>().notNull().default("code"),
  /** Only for stores added in the admin panel: how to read them. */
  customConfig: jsonb("custom_config").$type<StoredCustomConfig>(),
  /** Internal notes from the team ("asked them for a feed on 3 Oct"). Never shown to visitors. */
  notes: text("notes"),
  /** A code store's row exists once a fetch has returned real offers; an admin store's from when it is added. */
  firstVerifiedAt: timestamp("first_verified_at", { withTimezone: true }).notNull().defaultNow(),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastOfferCount: integer("last_offer_count").notNull().default(0),
  lastError: text("last_error"),
  lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One row per real-world product, shared by every supplier that sells it. */
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    brand: text("brand"),
    model: text("model"),
    gtin: text("gtin"),
    /** Normalised brand+model, used for matching when there is no GTIN. */
    modelKey: text("model_key"),
    categorySlug: text("category_slug").notNull(),
    /** Assigned by the rules in config/subcategories.ts. */
    subcategorySlug: text("subcategory_slug").notNull().default("other"),
    /** Women / men / kids / unisex, from config/audience.ts; null when the title does not say. */
    audience: text("audience"),
    /** False hides the product everywhere and the daily job stops recording its prices. */
    active: boolean("active").notNull().default(true),
    /**
     * Fields someone set by hand in the admin panel (see catalog/locks.ts).
     * Automatic rules never change a locked field.
     */
    lockedFields: text("locked_fields").array().$type<string[]>().notNull().default(sql`'{}'::text[]`),
    /** Set when this product was merged into another as a duplicate: its offers now belong there. */
    mergedIntoId: uuid("merged_into_id").references((): AnyPgColumn => products.id, { onDelete: "set null" }),
    /** The product type the first store reported, kept as input for classification. */
    sourceType: text("source_type"),
    imageUrl: text("image_url"),
    weightKg: real("weight_kg"),
    attributes: jsonb("attributes").$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("products_slug_idx").on(t.slug),
    index("products_gtin_idx").on(t.gtin),
    index("products_model_key_idx").on(t.modelKey),
    index("products_category_idx").on(t.categorySlug),
    // Trigram index: powers "find this item in other stores" (needs the pg_trgm extension).
    index("products_title_trgm_idx").using("gin", t.title.op("gin_trgm_ops")),
  ],
);

/** A supplier's current listing of a product. */
export const offers = pgTable(
  "offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    priceMinor: integer("price_minor").notNull(),
    currency: text("currency").notNull(),
    /** The "was" price the supplier itself claims. Never trusted on its own. */
    listPriceMinor: integer("list_price_minor"),
    /** Shipping to the market in the offer currency; null = unknown (estimate it). */
    shippingMinor: integer("shipping_minor"),
    inStock: boolean("in_stock").notNull().default(true),
    /** Sizes the store lists (clothes, shoes) and which are in stock; null = not known or one size. */
    sizes: jsonb("sizes").$type<{ label: string; inStock: boolean }[]>(),
    deliveryMinDays: integer("delivery_min_days"),
    deliveryMaxDays: integer("delivery_max_days"),
    /** Entered in the admin panel, not read from the store: re-confirmed by every daily run until changed. */
    manual: boolean("manual").notNull().default(false),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    /**
     * Set when a complete, successful read of the store no longer listed this
     * offer (deleted or unpublished there): it stops showing at once instead of
     * after `staleAfterHours`. Cleared when the store lists it again.
     */
    removedAt: timestamp("removed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("offers_supplier_external_idx").on(t.supplierId, t.externalId),
    index("offers_product_idx").on(t.productId),
  ],
);

/** Daily price history — the asset that makes discount verification possible. */
export const priceObservations = pgTable(
  "price_observations",
  {
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    observedOn: date("observed_on", { mode: "string" }).notNull(),
    priceMinor: integer("price_minor").notNull(),
    currency: text("currency").notNull(),
  },
  (t) => [primaryKey({ columns: [t.offerId, t.observedOn] })],
);

/** Same shape as LandedCost in modules/pricing; duplicated to keep the schema dependency-free. */
export interface LandedBreakdown {
  itemMinor: number;
  shippingMinor: number;
  dutyMinor: number;
  vatMinor: number;
  feeMinor: number;
  totalMinor: number;
  shippingEstimated: boolean;
}

/** The published deal catalog. Rebuilt for a market by every pipeline run. */
export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketCode: text("market_code").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    categorySlug: text("category_slug").notNull(),
    subcategorySlug: text("subcategory_slug").notNull().default("other"),
    audience: text("audience"),
    /** Country the offer ships from (the supplier's origin). */
    originCountry: text("origin_country").notNull().default(""),
    scope: text("scope").$type<"local" | "global">().notNull(),
    /** Landed totals, in the market currency. */
    landedMinor: integer("landed_minor").notNull(),
    usualLandedMinor: integer("usual_landed_minor").notNull(),
    savingsMinor: integer("savings_minor").notNull(),
    breakdown: jsonb("breakdown").$type<LandedBreakdown>().notNull(),
    realDiscountPct: real("real_discount_pct").notNull(),
    /** False while the discount rests on the store's own "was" price, not our history. */
    verified: boolean("verified").notNull().default(true),
    claimedDiscountPct: real("claimed_discount_pct"),
    bestLocalLandedMinor: integer("best_local_landed_minor"),
    bestGlobalLandedMinor: integer("best_global_landed_minor"),
    offerCount: integer("offer_count").notNull(),
    deliveryMinDays: integer("delivery_min_days").notNull(),
    deliveryMaxDays: integer("delivery_max_days").notNull(),
    score: integer("score").notNull(),
    badges: jsonb("badges").$type<string[]>().notNull().default([]),
    runId: uuid("run_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /**
     * When the product became a deal. Kept across rebuilds while it stays a
     * deal, so "new deals" (modules/follows) are the ones whose time is recent.
     */
    dealSince: timestamp("deal_since", { withTimezone: true }).notNull().defaultNow(),
    /** Sizes in stock at the deal's store (sizeKey form, "42.5", "XXL"); null when it lists none. */
    sizes: text("sizes").array(),
  },
  (t) => [
    index("deals_market_score_idx").on(t.marketCode, t.score),
    index("deals_market_since_idx").on(t.marketCode, t.dealSince),
    index("deals_market_category_idx").on(t.marketCode, t.categorySlug),
  ],
);

export interface SupplierRunStat {
  supplierId: string;
  ok: boolean;
  offers: number;
  /** Offers the store no longer lists, hidden by this run (offers.removed_at). */
  removed?: number;
  error?: string;
}

export interface PipelineStats {
  suppliers: SupplierRunStat[];
  refreshedSearches: number;
  deals: number;
  fxError?: string;
  alerts?: { watches: number; notified: number; pushed: number; telegram?: number };
  /** The day's top deals (daily_digests); absent on partial runs. */
  digest?: { day: string; items: number; posted: boolean; error?: string };
}

export const pipelineRuns = pgTable("pipeline_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  marketCode: text("market_code").notNull(),
  status: text("status").$type<"running" | "success" | "partial" | "failed">().notNull(),
  stats: jsonb("stats").$type<PipelineStats>(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

/** Latest exchange rates per market: units of the market currency per one foreign unit. */
export const fxRates = pgTable(
  "fx_rates",
  {
    marketCode: text("market_code").notNull(),
    currency: text("currency").notNull(),
    rate: real("rate").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.marketCode, t.currency] })],
);

/** What users search for — feeds the daily job so the catalog follows demand. */
export const searchQueries = pgTable(
  "search_queries",
  {
    marketCode: text("market_code").notNull(),
    query: text("query").notNull(),
    count: integer("count").notNull().default(1),
    liveCount: integer("live_count").notNull().default(0),
    lastResultCount: integer("last_result_count").notNull().default(0),
    lastSearchedAt: timestamp("last_searched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.marketCode, t.query] })],
);

/** Click-outs to suppliers — the basis for affiliate and sponsored reporting. */
export const outboundClicks = pgTable(
  "outbound_clicks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    marketCode: text("market_code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("outbound_clicks_offer_idx").on(t.offerId)],
);

export type Supplier = typeof suppliers.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type Deal = typeof deals.$inferSelect;

export type UserRole = "user" | "admin";

/** People with an account. Emails are stored lower-cased. */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    /** scrypt hash in the format produced by modules/auth/password.ts — never the password. */
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    /** Optional, in international format (+994…). */
    phone: text("phone"),
    /** Language to write to this person in. */
    locale: text("locale").notNull(),
    marketCode: text("market_code").notNull(),
    /** "admin" opens the admin panel. Granted with `npm run admin -- grant <email>` or by another admin. */
    role: text("role").$type<UserRole>().notNull().default("user"),
    /** Agreed to receive deal and price-drop messages. */
    dealAlerts: boolean("deal_alerts").notNull().default(false),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }).notNull(),
    /** Null until the address is confirmed (needs an email provider). */
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    /** Private chat with our Telegram bot, once the person connected it (see modules/telegram/link.ts). */
    telegramChatId: text("telegram_chat_id"),
    /** "@name" shown as "Connected as …"; Telegram accounts need not have one. */
    telegramUsername: text("telegram_username"),
    telegramLinkedAt: timestamp("telegram_linked_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), uniqueIndex("users_telegram_chat_idx").on(t.telegramChatId)],
);

/** Signed-in browsers. Only a hash of the cookie token is stored. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("sessions_token_idx").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export type OrderRequestStatus = "new" | "contacted" | "confirmed" | "cancelled";

/**
 * "Order it for me" requests for items from abroad. A request is not an order:
 * no money is taken until someone has confirmed the final price with the person.
 * The product and price are copied in, because offers change every day.
 */
export const orderRequests = pgTable(
  "order_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Short human reference, e.g. "SR-7K2M9Q". */
    reference: text("reference").notNull(),
    marketCode: text("market_code").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    offerId: uuid("offer_id").references(() => offers.id, { onDelete: "set null" }),
    productTitle: text("product_title").notNull(),
    supplierName: text("supplier_name").notNull(),
    offerUrl: text("offer_url").notNull(),
    quantity: integer("quantity").notNull(),
    /** Estimates shown to the person when they asked, in the market currency (minor units). */
    estimatedLandedMinor: integer("estimated_landed_minor").notNull(),
    estimatedFeeMinor: integer("estimated_fee_minor").notNull(),
    contactName: text("contact_name").notNull(),
    contactPhone: text("contact_phone").notNull(),
    contactEmail: text("contact_email"),
    city: text("city").notNull(),
    note: text("note"),
    locale: text("locale").notNull(),
    status: text("status").$type<OrderRequestStatus>().notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("order_requests_reference_idx").on(t.reference),
    index("order_requests_user_idx").on(t.userId),
    index("order_requests_status_idx").on(t.status, t.createdAt),
  ],
);

/** Products a person asked to be told about when the price drops. */
export const priceWatches = pgTable(
  "price_watches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    marketCode: text("market_code").notNull(),
    /** Best landed price when the watch was set (minor units of the market currency). */
    startPriceMinor: integer("start_price_minor").notNull(),
    /** Best landed price at the last check; a drop is measured against this. */
    lastPriceMinor: integer("last_price_minor").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("price_watches_user_product_idx").on(t.userId, t.productId)],
);

/** Messages for a person, shown on the site and also sent as browser push. */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** price_drop: a watched product got cheaper; new_deal: something the person follows has a new deal. */
    type: text("type").$type<"price_drop" | "new_deal">().notNull(),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    /** Copied in, so the message still reads correctly if the product changes or goes away. */
    productTitle: text("product_title").notNull(),
    productSlug: text("product_slug").notNull(),
    supplierName: text("supplier_name").notNull(),
    /** price_drop: the price before; new_deal: the usual price. */
    oldPriceMinor: integer("old_price_minor").notNull(),
    newPriceMinor: integer("new_price_minor").notNull(),
    /** new_deal: what the person follows that brought it ("adidas", "SuperStep", "Shoes"). */
    followLabel: text("follow_label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

/** A browser that agreed to receive push messages for a person. */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("push_subscriptions_endpoint_idx").on(t.endpoint), index("push_subscriptions_user_idx").on(t.userId)],
);

/**
 * One-time links that connect a person's account to our Telegram bot. The
 * token travels in the bot's start link; only its hash is stored.
 */
export const telegramLinkTokens = pgTable(
  "telegram_link_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("telegram_link_tokens_user_idx").on(t.userId)],
);

/** A deal as it was picked for a digest. Same shape as ProductCardData; duplicated to keep the schema dependency-free. */
export interface DigestItem {
  productId: string;
  slug: string;
  title: string;
  brand: string | null;
  categorySlug: string;
  imageUrl: string | null;
  originCountry: string;
  scope: "local" | "global";
  supplierName: string;
  landedMinor: number;
  usualLandedMinor: number | null;
  discountPct: number | null;
  savingsMinor: number | null;
  verified: boolean;
}

/**
 * The day's top deals: picked once a day after the deals are built, shown on
 * the site (/top, the notification bell) and posted to the Telegram channel.
 * `items` is a snapshot, so a post can always be shown as it was made.
 */
export const dailyDigests = pgTable(
  "daily_digests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketCode: text("market_code").notNull(),
    /** The market's calendar day, YYYY-MM-DD. */
    day: date("day", { mode: "string" }).notNull(),
    items: jsonb("items").$type<DigestItem[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    telegramMessageId: integer("telegram_message_id"),
    telegramPostedAt: timestamp("telegram_posted_at", { withTimezone: true }),
    /** Why the last attempt to post failed; cleared by a successful post. */
    telegramError: text("telegram_error"),
  },
  (t) => [uniqueIndex("daily_digests_market_day_idx").on(t.marketCode, t.day)],
);

export type DailyDigest = typeof dailyDigests.$inferSelect;

export type FollowKind = "brand" | "store" | "category";

/** Brands, stores and categories a person follows, to hear about their new deals (modules/follows). */
export const follows = pgTable(
  "follows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<FollowKind>().notNull(),
    /** brandKey() for a brand, the supplier id for a store, the slug for a category. */
    key: text("key").notNull(),
    /** Display name at the time of following (brand spelling, store name); categories are named from the dictionaries. */
    label: text("label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("follows_user_kind_key_idx").on(t.userId, t.kind, t.key), index("follows_kind_key_idx").on(t.kind, t.key)],
);

export type Follow = typeof follows.$inferSelect;

/**
 * Each run of the "new deals for followers" job. A run covers the deals that
 * started between the previous run's windowEnd and its own, so none is sent twice
 * and none is missed when a day is skipped.
 */
export const followRuns = pgTable("follow_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  marketCode: text("market_code").notNull(),
  windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  stats: jsonb("stats").$type<{ follows: number; people: number; notifications: number; telegram: number }>(),
});
export type Notification = typeof notifications.$inferSelect;
export type OrderRequest = typeof orderRequests.$inferSelect;
export type User = typeof users.$inferSelect;

/**
 * Every change made in the admin panel: who, what, when. The basis for the
 * activity page and for knowing whether the published deals are out of date.
 */
export const adminEvents = pgTable(
  "admin_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** Copied in, so the log still says who it was if the account is deleted. */
    userEmail: text("user_email").notNull(),
    /** "store.switch-off", "product.move"… — see modules/admin/audit.ts. */
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    /** A readable name of the entity at the time (store name, product title). */
    entityLabel: text("entity_label").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    /** The change only reaches the deal pages after the deals are published again. */
    needsPublish: boolean("needs_publish").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_events_created_idx").on(t.createdAt), index("admin_events_entity_idx").on(t.entityType, t.entityId)],
);

export type AdminEvent = typeof adminEvents.$inferSelect;

/**
 * Site-wide settings changed in the admin panel (modules/settings). One row
 * per setting; the value's shape belongs to the module that owns the key.
 */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
});
