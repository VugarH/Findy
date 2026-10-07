import { count, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { offers, suppliers, type Supplier } from "@/db/schema";
import { getMarket } from "@/config/markets";
import type { CategorySlug } from "@/config/categories";
import type { CurrencyCode } from "@/config/currencies";
import { registerSupplier, supplierColumns } from "@/modules/catalog/ingest";
import { freshSince } from "@/modules/catalog/offer-view";
import { customDefinition, toCustomStore, trustScoreFor, type CustomStore } from "@/modules/suppliers/custom";
import { getAdapters, isCodeSupplier } from "@/modules/suppliers/registry";
import type { SupplierDefinition } from "@/modules/suppliers/types";
import { slugify } from "@/lib/slug";

/**
 * Stores as the admin panel sees them: the ones defined in code (whether or
 * not they have returned data yet) and the ones added in the panel.
 */
export const STORE_STATUSES = ["ok", "failing", "waiting", "off", "retired"] as const;
/**
 * ok: collected fine last time · failing: the last collection failed ·
 * waiting: never collected yet · off: switched off · retired: removed from code.
 */
export type StoreStatus = (typeof STORE_STATUSES)[number];

export interface AdminStore {
  id: string;
  name: string;
  websiteUrl: string;
  source: "code" | "admin";
  /** How it is read: an access-method kind ("shopify-json", "manual-entry"…). */
  connection: string;
  status: StoreStatus;
  active: boolean;
  /** Has a row in the suppliers table (code stores get one on their first successful run). */
  registered: boolean;
  scope: "local" | "global";
  originCountry: string;
  currency: string;
  categories: CategorySlug[];
  lastSuccessAt: Date | null;
  lastError: string | null;
  lastErrorAt: Date | null;
  lastOfferCount: number;
  offers: number;
  liveOffers: number;
  manualOffers: number;
  notes: string | null;
}

export function storeStatus(
  store: Pick<AdminStore, "active" | "lastSuccessAt" | "lastErrorAt"> & { retired: boolean },
): StoreStatus {
  if (!store.active) return "off";
  if (store.retired) return "retired";
  if (store.lastErrorAt && (!store.lastSuccessAt || store.lastErrorAt >= store.lastSuccessAt)) return "failing";
  if (!store.lastSuccessAt) return "waiting";
  return "ok";
}

async function offerCounts(): Promise<Map<string, { total: number; live: number; manual: number }>> {
  const since = freshSince(getMarket());
  const rows = await db
    .select({
      supplierId: offers.supplierId,
      total: count(),
      live: sql<number>`(count(*) filter (where ${gte(offers.lastSeenAt, since)}))::int`,
      manual: sql<number>`(count(*) filter (where ${offers.manual}))::int`,
    })
    .from(offers)
    .groupBy(offers.supplierId);
  return new Map(rows.map((row) => [row.supplierId, row]));
}

function toAdminStore(
  definition: SupplierDefinition | null,
  row: Supplier | undefined,
  counts: { total: number; live: number; manual: number } | undefined,
): AdminStore {
  const source = row?.source ?? "code";
  const active = row?.active ?? true;
  const lastSuccessAt = row?.lastSuccessAt ?? null;
  const lastErrorAt = row?.lastErrorAt ?? null;
  return {
    id: definition?.id ?? row!.id,
    name: row?.name ?? definition!.name,
    websiteUrl: row?.websiteUrl ?? definition!.websiteUrl,
    source,
    connection: definition?.access.kind ?? row?.accessMethod?.kind ?? "unknown",
    status: storeStatus({ active, lastSuccessAt, lastErrorAt, retired: source === "code" && !definition }),
    active,
    registered: !!row,
    scope: (row?.scope ?? definition!.scope) as "local" | "global",
    originCountry: row?.originCountry ?? definition!.originCountry,
    currency: row?.currency ?? definition!.currency,
    categories: [...(definition?.categories ?? [])],
    lastSuccessAt,
    lastError: row?.lastError ?? null,
    lastErrorAt,
    lastOfferCount: row?.lastOfferCount ?? 0,
    offers: counts?.total ?? 0,
    liveOffers: counts?.live ?? 0,
    manualOffers: counts?.manual ?? 0,
    notes: row?.notes ?? null,
  };
}

/** The definition a store is collected with: from code, or from its admin settings. */
function definitionOf(row: Supplier | undefined, id: string): SupplierDefinition | null {
  const code = getAdapters().find((adapter) => adapter.definition.id === id);
  if (code) return code.definition;
  const custom = row ? toCustomStore(row) : null;
  return custom ? customDefinition(custom) : null;
}

export interface StoreFilters {
  q?: string;
  status?: StoreStatus;
  source?: "code" | "admin";
  category?: CategorySlug;
}

export async function listAdminStores(filters: StoreFilters = {}): Promise<AdminStore[]> {
  const [rows, counts] = await Promise.all([db.select().from(suppliers), offerCounts()]);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ids = new Set([...getAdapters().map((adapter) => adapter.definition.id), ...byId.keys()]);

  const q = filters.q?.toLowerCase();
  return [...ids]
    .map((id) => toAdminStore(definitionOf(byId.get(id), id), byId.get(id), counts.get(id)))
    .filter(
      (store) =>
        (!q || store.name.toLowerCase().includes(q) || store.id.includes(q) || store.websiteUrl.includes(q)) &&
        (!filters.status || store.status === filters.status) &&
        (!filters.source || store.source === filters.source) &&
        (!filters.category || store.categories.includes(filters.category)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface StoreRunResult {
  runId: string;
  startedAt: Date;
  ok: boolean;
  offers: number;
  error: string | null;
}

export interface AdminStoreDetail extends AdminStore {
  definition: SupplierDefinition | null;
  customStore: CustomStore | null;
  runs: StoreRunResult[];
}

export async function getAdminStore(id: string): Promise<AdminStoreDetail | null> {
  const [row] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  const definition = definitionOf(row, id);
  if (!row && !definition) return null;

  const counts = (await offerCounts()).get(id);
  const runs = await db.execute<{
    run_id: string;
    started_at: string;
    stat: { ok: boolean; offers: number; error?: string };
  }>(sql`
    select r.id as run_id, r.started_at, e as stat
    from pipeline_runs r cross join lateral jsonb_array_elements(r.stats->'suppliers') e
    where e->>'supplierId' = ${id}
    order by r.started_at desc
    limit 10`);

  return {
    ...toAdminStore(definition, row, counts),
    definition,
    customStore: row ? toCustomStore(row) : null,
    runs: runs.map((run) => ({
      runId: run.run_id,
      startedAt: new Date(run.started_at),
      ok: run.stat.ok,
      offers: run.stat.offers,
      error: run.stat.error ?? null,
    })),
  };
}

/**
 * Switches a store on or off. A code store that has never returned data has
 * no row yet, so one is written from its definition first.
 */
export async function setStoreActive(id: string, active: boolean): Promise<{ name: string } | null> {
  const [existing] = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.id, id)).limit(1);
  if (!existing) {
    const definition = getAdapters().find((adapter) => adapter.definition.id === id)?.definition;
    if (!definition) return null;
    await registerSupplier(definition);
  }
  const [updated] = await db
    .update(suppliers)
    .set({ active, updatedAt: new Date() })
    .where(eq(suppliers.id, id))
    .returning({ name: suppliers.name });
  return updated ?? null;
}

export async function setStoreNotes(id: string, notes: string | null): Promise<{ name: string } | null> {
  const [existing] = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.id, id)).limit(1);
  if (!existing) {
    const definition = getAdapters().find((adapter) => adapter.definition.id === id)?.definition;
    if (!definition) return null;
    await registerSupplier(definition);
  }
  const [updated] = await db
    .update(suppliers)
    .set({ notes, updatedAt: new Date() })
    .where(eq(suppliers.id, id))
    .returning({ name: suppliers.name });
  return updated ?? null;
}

/** A free id for a new store, from its name: "Nike Store" -> "nike-store", or "nike-store-2". */
export async function newStoreId(name: string): Promise<string> {
  const base = slugify(name).slice(0, 40).replace(/-+$/, "") || "store";
  const taken = new Set((await db.select({ id: suppliers.id }).from(suppliers)).map((row) => row.id));
  for (let n = 1; ; n++) {
    const id = n === 1 ? base : `${base}-${n}`;
    if (!taken.has(id) && !isCodeSupplier(id)) return id;
  }
}

export interface CustomStoreInput {
  name: string;
  websiteUrl: string;
  originCountry: string;
  currency: CurrencyCode;
  config: CustomStore["config"];
}

/** Adds a store from the admin panel. The daily job collects it from its next run. */
export async function createCustomStore(input: CustomStoreInput): Promise<string> {
  const store: CustomStore = { id: await newStoreId(input.name), ...input };
  await db.insert(suppliers).values({
    ...supplierColumns(customDefinition(store)),
    trustScore: trustScoreFor(store.config.reliability.basis),
    source: "admin",
    customConfig: store.config,
  });
  return store.id;
}

/** Changes the settings of a store added in the admin panel. Code stores are changed in code. */
export async function updateCustomStore(id: string, input: CustomStoreInput): Promise<boolean> {
  const [row] = await db.select({ source: suppliers.source }).from(suppliers).where(eq(suppliers.id, id)).limit(1);
  if (row?.source !== "admin") return false;
  const store: CustomStore = { id, ...input };
  await db
    .update(suppliers)
    .set({
      ...supplierColumns(customDefinition(store)),
      trustScore: trustScoreFor(store.config.reliability.basis),
      customConfig: store.config,
      updatedAt: new Date(),
    })
    .where(eq(suppliers.id, id));
  return true;
}

/** Switched-on stores whose last collection failed, for the menu badge. */
export async function countFailingStores(): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(suppliers)
    .where(
      sql`${suppliers.active} and ${suppliers.lastErrorAt} is not null and (${suppliers.lastSuccessAt} is null or ${suppliers.lastErrorAt} >= ${suppliers.lastSuccessAt})`,
    );
  return row.total;
}

/** Stores that can take manual offers (every registered, switched-on store), for pickers. */
export async function listStoreChoices(): Promise<
  { id: string; name: string; currency: string; manualOnly: boolean }[]
> {
  const rows = await db
    .select({ id: suppliers.id, name: suppliers.name, currency: suppliers.currency, config: suppliers.customConfig })
    .from(suppliers)
    .where(eq(suppliers.active, true))
    .orderBy(suppliers.name);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    currency: row.currency,
    manualOnly: row.config?.connection.type === "manual",
  }));
}

/** Every registered store's id and name, for filter menus. */
export async function listStoreNames(): Promise<{ id: string; name: string }[]> {
  return db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).orderBy(suppliers.name);
}

export async function storeName(id: string): Promise<string> {
  const [row] = await db.select({ name: suppliers.name }).from(suppliers).where(eq(suppliers.id, id)).limit(1);
  return row?.name ?? id;
}
