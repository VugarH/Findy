"use server";

import { z } from "zod";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { getCurrentUser } from "@/modules/auth/session";
import { normalizePhone } from "@/modules/auth/validation";
import { loadMarket } from "@/modules/pricing/fx";
import { createOrderRequest, getOrderableOffer } from "./service";

export type OrderErrorKey =
  | "nameRequired"
  | "phoneRequired"
  | "emailInvalid"
  | "cityRequired"
  | "noteLong"
  | "offerGone"
  | "unexpected";

export interface OrderFormState {
  errors?: Record<string, OrderErrorKey>;
  formError?: OrderErrorKey;
  values?: Record<string, string>;
  /** Set once the request is saved; the form is replaced by a confirmation. */
  reference?: string;
}

const key = (value: OrderErrorKey) => value;

const schema = z.object({
  offerId: z.uuid(),
  quantity: z.coerce.number().int().min(1).max(99),
  contactName: z.string().trim().min(2, key("nameRequired")).max(100, key("nameRequired")),
  // A phone number is how the request gets confirmed, so here it is required.
  contactPhone: z
    .string()
    .transform((value) => normalizePhone(value))
    .refine((value): value is string => Boolean(value), key("phoneRequired")),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .transform((value) => value || null)
    .pipe(z.email(key("emailInvalid")).nullable()),
  city: z.string().trim().min(2, key("cityRequired")).max(80, key("cityRequired")),
  note: z
    .string()
    .trim()
    .max(500, key("noteLong"))
    .transform((value) => value || null),
});

export async function createOrderRequestAction(_previous: OrderFormState, form: FormData): Promise<OrderFormState> {
  const text = (name: string) => String(form.get(name) ?? "");
  const values = {
    quantity: text("quantity"),
    contactName: text("contactName"),
    contactPhone: text("contactPhone"),
    contactEmail: text("contactEmail"),
    city: text("city"),
    note: text("note"),
  };

  const parsed = schema.safeParse({ offerId: text("offerId"), ...values });
  if (!parsed.success) {
    const errors: Record<string, OrderErrorKey> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);
      if (field === "offerId" || field === "quantity") return { formError: "offerGone", values };
      errors[field] ??= issue.message as OrderErrorKey;
    }
    return { errors, values };
  }

  try {
    const market = await loadMarket();
    const target = await getOrderableOffer(parsed.data.offerId, market);
    if (!target) return { formError: "offerGone", values };

    const locale = text("locale");
    const user = await getCurrentUser();
    const reference = await createOrderRequest(target, parsed.data, {
      market,
      locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
      userId: user?.id ?? null,
    });
    return { reference };
  } catch (error) {
    console.error("Order request failed", error);
    return { formError: "unexpected", values };
  }
}
