"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { isCategorySlug } from "@/config/categories";
import { localePath } from "@/i18n/format";
import { createManualOffer, deleteManualOffer, updateManualOffer } from "@/modules/catalog/manual-offers";
import { recordAdminEvent, type AdminEventInput } from "../audit";
import { formValues, localeOf, text, type AdminFormState } from "../forms";
import { requireAdmin } from "../guard";
import {
  createProduct,
  getAdminProduct,
  mergeProductInto,
  moveProducts,
  setProductsActive,
  setProductsAudience,
  updateProduct,
} from "../products";
import { storeName } from "../stores";
import {
  parseAudience,
  parseNewProductForm,
  parseOfferForm,
  parseProductForm,
  parseSubcategory,
  selectedIds,
} from "../validation";

const productEvent = (
  action: AdminEventInput["action"],
  product: { id: string; title: string },
  extra: Partial<AdminEventInput> = {},
): AdminEventInput => ({ action, entityType: "product", entityId: product.id, entityLabel: product.title, ...extra });

export async function saveProductAction(_previous: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const values = formValues(form);
  const parsed = parseProductForm(form);
  if (!parsed.ok) return { errors: parsed.errors, values };

  const id = text(form, "id");
  const result = await updateProduct(id, parsed.data);
  if (!result.ok) return { formError: "notFound", values };
  if (result.changed.length > 0) {
    await recordAdminEvent(
      admin,
      productEvent("product.update", { id, title: parsed.data.title }, { details: { changed: result.changed } }),
    );
  }
  refresh();
  return { notice: "saved" };
}

/** The action bar of the product list: move, set audience, switch on or off — for every ticked product. */
export async function bulkProductsAction(_previous: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const ids = selectedIds(form);
  if (ids.length === 0) return { formError: "noSelection" };

  const operation = text(form, "operation");
  let changed: { id: string; title: string }[] = [];
  let events: AdminEventInput[] = [];

  if (operation === "move") {
    const category = text(form, "categorySlug");
    const subcategory = isCategorySlug(category)
      ? parseSubcategory(category, text(form, "subcategory") || "auto")
      : null;
    if (!isCategorySlug(category) || !subcategory) return { formError: "chooseCategory" };
    changed = await moveProducts(ids, category, subcategory);
    events = changed.map((p) => productEvent("product.move", p, { details: { category, subcategory } }));
  } else if (operation === "audience") {
    const audience = parseAudience(text(form, "audience"));
    if (!audience) return { formError: "invalid" };
    changed = await setProductsAudience(ids, audience);
    events = changed.map((p) => productEvent("product.audience", p, { details: { audience } }));
  } else if (operation === "on" || operation === "off") {
    changed = await setProductsActive(ids, operation === "on");
    events = changed.map((p) =>
      productEvent(operation === "on" ? "product.switch-on" : "product.switch-off", p, {
        needsPublish: operation === "on",
      }),
    );
  } else {
    return { formError: "invalid" };
  }

  await recordAdminEvent(admin, events);
  refresh();
  return { notice: "bulkDone", noticeVars: { count: changed.length } };
}

export async function setProductActiveAction(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = text(form, "id");
  const active = text(form, "active") === "true";
  const [changed] = await setProductsActive([id], active);
  if (changed) {
    await recordAdminEvent(
      admin,
      productEvent(active ? "product.switch-on" : "product.switch-off", changed, { needsPublish: active }),
    );
  }
  refresh();
}

/** Merges this product (a duplicate) into another one, given by its page address, slug or id. */
export async function mergeProductAction(_previous: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const id = text(form, "id");
  const values = formValues(form);
  const source = await getAdminProduct(id);
  if (!source) return { formError: "notFound", values };

  const result = await mergeProductInto(id, text(form, "target"));
  if (!result.ok) {
    const error =
      result.error === "same" ? "mergeSame" : result.error === "targetMerged" ? "mergeTargetMerged" : "notFound";
    return { errors: { target: error }, values };
  }
  await recordAdminEvent(
    admin,
    productEvent(
      "product.merge",
      { id, title: source.product.title },
      {
        details: { into: result.target.id, intoTitle: result.target.title, offers: result.movedOffers },
        needsPublish: true,
      },
    ),
  );
  redirect(`${localePath(localeOf(form), `/admin/products/${result.target.id}`)}?notice=merged`);
}

/** Adds a product by hand, with its first price. */
export async function createProductAction(_previous: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const values = formValues(form);
  const parsed = parseNewProductForm(form);
  if (!parsed.ok) return { errors: parsed.errors, values };

  const result = await createProduct(parsed.data);
  if (!result.ok) {
    return { formError: "productExists", noticeVars: { id: result.existing.id, title: result.existing.title }, values };
  }
  await recordAdminEvent(
    admin,
    productEvent("product.create", { id: result.id, title: parsed.data.title }, { needsPublish: true }),
  );
  redirect(`${localePath(localeOf(form), `/admin/products/${result.id}`)}?notice=created`);
}

/** Adds a hand-entered price to a product (no offer id) or changes one. */
export async function saveOfferAction(_previous: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const values = formValues(form);
  const parsed = parseOfferForm(form);
  if (!parsed.ok) return { errors: parsed.errors, values };

  const productId = text(form, "productId");
  const offerId = text(form, "offerId");
  const detail = await getAdminProduct(productId);
  if (!detail) return { formError: "notFound", values };

  const input = { ...parsed.data, title: detail.product.title };
  if (offerId) {
    const updated = await updateManualOffer(offerId, input);
    if (!updated) return { formError: "notEditable", values };
  } else {
    await createManualOffer({ ...input, productId });
  }
  await recordAdminEvent(admin, {
    action: offerId ? "offer.update" : "offer.create",
    entityType: "product",
    entityId: productId,
    entityLabel: detail.product.title,
    details: {
      store: await storeName(parsed.data.supplierId),
      price: parsed.data.priceMinor,
      currency: parsed.data.currency,
    },
    needsPublish: true,
  });
  refresh();
  return { notice: "saved" };
}

export async function deleteOfferAction(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const productId = text(form, "productId");
  const offerId = text(form, "offerId");
  const detail = await getAdminProduct(productId);
  const offer = detail?.offers.find((candidate) => candidate.id === offerId);
  if (!detail || !offer || !(await deleteManualOffer(offerId))) return;
  await recordAdminEvent(admin, {
    action: "offer.delete",
    entityType: "product",
    entityId: productId,
    entityLabel: detail.product.title,
    details: { store: offer.supplierName, price: offer.priceMinor, currency: offer.currency },
    needsPublish: true,
  });
  refresh();
}
