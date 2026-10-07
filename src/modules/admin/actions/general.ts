"use server";

import { refresh } from "next/cache";
import { publishDeals } from "@/modules/deals/publish";
import { recordAdminEvent } from "../audit";
import { text, type AdminFormState } from "../forms";
import { requireAdmin } from "../guard";
import { isOrderStatus, setOrderStatus } from "../orders";
import { isUserRole, setUserRole } from "../users";

/** Rebuilds the published deals from the saved offers, so every change made in the panel shows on the site. */
export async function publishDealsAction(): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const count = await publishDeals();
  await recordAdminEvent(admin, {
    action: "deals.publish",
    entityType: "deals",
    entityId: "all",
    entityLabel: "Deals",
    details: { deals: count },
  });
  refresh();
  return { notice: "published", noticeVars: { count } };
}

export async function setOrderStatusAction(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = text(form, "id");
  const status = text(form, "status");
  if (!isOrderStatus(status)) return;
  const order = await setOrderStatus(id, status);
  if (!order) return;
  await recordAdminEvent(admin, {
    action: "order.status",
    entityType: "order",
    entityId: id,
    entityLabel: `${order.reference} · ${order.productTitle}`,
    details: { status },
  });
  refresh();
}

/** Gives or takes admin rights. Nobody can change their own role, so the last admin cannot lock everyone out. */
export async function setUserRoleAction(_previous: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const id = text(form, "id");
  const role = text(form, "role");
  if (!isUserRole(role)) return { formError: "invalid" };
  if (id === admin.id) return { formError: "ownRole" };
  const user = await setUserRole(id, role);
  if (!user) return { formError: "notFound" };
  await recordAdminEvent(admin, {
    action: "user.role",
    entityType: "user",
    entityId: id,
    entityLabel: user.email,
    details: { role },
  });
  refresh();
  return { notice: "saved" };
}
