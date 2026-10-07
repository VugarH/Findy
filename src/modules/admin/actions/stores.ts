"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { localePath } from "@/i18n/format";
import { getMarket } from "@/config/markets";
import { runDailyPipeline } from "@/modules/deals/pipeline";
import { withdrawSupplierDeals } from "@/modules/deals/publish";
import { previewCustomStore } from "@/modules/suppliers/custom";
import { getAllAdapters } from "@/modules/suppliers/registry";
import { recordAdminEvent } from "../audit";
import { formValues, localeOf, text, type AdminFormState } from "../forms";
import { requireAdmin } from "../guard";
import { createCustomStore, setStoreActive, setStoreNotes, updateCustomStore } from "../stores";
import { parseStoreForm } from "../validation";

/** Switches a store on or off. Off: the daily job stops contacting it and its offers leave the site at once. */
export async function setStoreActiveAction(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = text(form, "id");
  const active = text(form, "active") === "true";
  const store = await setStoreActive(id, active);
  if (!store) return;
  if (!active) await withdrawSupplierDeals(id);
  await recordAdminEvent(admin, {
    action: active ? "store.switch-on" : "store.switch-off",
    entityType: "store",
    entityId: id,
    entityLabel: store.name,
    // Switching on brings the store's offers back only with the next publish.
    needsPublish: active,
  });
  refresh();
}

export async function saveStoreNotesAction(_previous: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const id = text(form, "id");
  const notes = text(form, "notes").slice(0, 2000) || null;
  const store = await setStoreNotes(id, notes);
  if (!store) return { formError: "notFound" };
  await recordAdminEvent(admin, { action: "store.notes", entityType: "store", entityId: id, entityLabel: store.name });
  refresh();
  return { notice: "saved" };
}

/** Adds a store (no id in the form) or changes the settings of one added in the panel. */
export async function saveCustomStoreAction(_previous: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const values = formValues(form);
  const parsed = parseStoreForm(form);
  if (!parsed.ok) return { errors: parsed.errors, values };

  const id = text(form, "id");
  if (id) {
    const updated = await updateCustomStore(id, parsed.data);
    if (!updated) return { formError: "notEditable", values };
    await recordAdminEvent(admin, {
      action: "store.update",
      entityType: "store",
      entityId: id,
      entityLabel: parsed.data.name,
      details: { connection: parsed.data.config.connection.type },
    });
    refresh();
    return { notice: "saved", values };
  }

  let created: string;
  try {
    created = await createCustomStore(parsed.data);
  } catch (error) {
    console.error("Adding a store failed", error);
    return { formError: "unexpected", values };
  }
  await recordAdminEvent(admin, {
    action: "store.create",
    entityType: "store",
    entityId: created,
    entityLabel: parsed.data.name,
    details: { connection: parsed.data.config.connection.type, website: parsed.data.websiteUrl },
  });
  redirect(`${localePath(localeOf(form), `/admin/stores/${created}`)}?notice=created`);
}

/** The store form has two buttons: "Test connection" (intent=test) and save. */
export async function storeFormAction(previous: AdminFormState, form: FormData): Promise<AdminFormState> {
  return text(form, "intent") === "test" ? previewStoreAction(previous, form) : saveCustomStoreAction(previous, form);
}

/** "Test connection": reads the store once with the typed settings and shows what a run would save. Saves nothing. */
export async function previewStoreAction(_previous: AdminFormState, form: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const values = formValues(form);
  const parsed = parseStoreForm(form);
  if (!parsed.ok) return { errors: parsed.errors, values };
  const preview = await previewCustomStore({ id: "preview", ...parsed.data });
  return { preview, values, notice: preview.ok ? "previewOk" : undefined };
}

/**
 * Collects one store now instead of waiting for the daily job, then
 * publishes deals. Runs after the response, because a large store takes
 * minutes; the result appears in the run log and on the store's page.
 */
export async function collectStoreAction(_previous: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const id = text(form, "id");
  const adapter = (await getAllAdapters()).find((candidate) => candidate.definition.id === id);
  if (!adapter) return { formError: "notEditable" };

  await recordAdminEvent(admin, {
    action: "store.collect",
    entityType: "store",
    entityId: id,
    entityLabel: adapter.definition.name,
  });
  after(async () => {
    try {
      await runDailyPipeline(getMarket(), new Date(), { supplierIds: [id], refreshSearches: false });
    } catch (error) {
      console.error(`Collecting ${id} failed`, error);
    }
  });
  return { notice: "collecting" };
}
