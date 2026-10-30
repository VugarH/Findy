import { asc, count, eq , getTableColumns } from "drizzle-orm";
import { db } from "@/db/client";
import { offers, suppliers, type Supplier } from "@/db/schema";

export interface SupplierOverview extends Omit<Supplier, "offReason" | "offAt"> {
  offerCount: number;
}

// Why a store is off is for the team only.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { offReason: _offReason, offAt: _offAt, ...publicColumns } = getTableColumns(suppliers);

/** The stores we actually use: each has returned real offers at least once. */
export async function listSuppliers(): Promise<SupplierOverview[]> {
  const rows = await db
    .select({ supplier: publicColumns, offerCount: count(offers.id) })
    .from(suppliers)
    .leftJoin(offers, eq(offers.supplierId, suppliers.id))
    .where(eq(suppliers.active, true))
    .groupBy(suppliers.id)
    .orderBy(asc(suppliers.name));
  return rows.map(({ supplier, offerCount }) => ({ ...supplier, offerCount }));
}
