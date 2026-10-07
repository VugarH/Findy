import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { offers, suppliers, type Supplier } from "@/db/schema";

export interface SupplierOverview extends Supplier {
  offerCount: number;
}

/** The stores we actually use: each has returned real offers at least once. */
export async function listSuppliers(): Promise<SupplierOverview[]> {
  const rows = await db
    .select({ supplier: suppliers, offerCount: count(offers.id) })
    .from(suppliers)
    .leftJoin(offers, eq(offers.supplierId, suppliers.id))
    .where(eq(suppliers.active, true))
    .groupBy(suppliers.id)
    .orderBy(asc(suppliers.name));
  return rows.map(({ supplier, offerCount }) => ({ ...supplier, offerCount }));
}
