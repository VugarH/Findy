"use server";

import { refresh } from "next/cache";
import { formatDay, marketDay } from "@/modules/digest/pick";
import { buildDailyDigest, getDigest } from "@/modules/digest/service";
import { loadMarket } from "@/modules/pricing/fx";
import { postDigest } from "@/modules/telegram/channel";
import { channelId } from "@/modules/telegram/config";
import { recordAdminEvent } from "../audit";
import { text, type AdminFormState } from "../forms";
import { requireAdmin } from "../guard";

/** Picks today's top deals now (or again), from the deals currently published. */
export async function pickDigestAction(): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const market = await loadMarket();
  const existing = await getDigest(market.code, marketDay(new Date(), market.timeZone));
  if (existing?.telegramPostedAt) return { formError: "alreadyPosted" };

  const digest = await buildDailyDigest(market, new Date(), { replace: true });
  if (!digest) return { formError: "noDeals" };
  await recordAdminEvent(admin, {
    action: "digest.pick",
    entityType: "digest",
    entityId: digest.day,
    entityLabel: formatDay(digest.day, "en"),
    details: { deals: digest.items.length },
  });
  refresh();
  return { notice: "digestPicked", noticeVars: { count: digest.items.length } };
}

/** Posts today's list to the channel; `again` posts it a second time. */
export async function postDigestAction(_previous: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  if (!channelId()) return { formError: "telegramOff" };
  const market = await loadMarket();
  const digest = await getDigest(market.code, marketDay(new Date(), market.timeZone));
  if (!digest) return { formError: "notFound" };

  const result = await postDigest(digest, market, { force: text(form, "again") === "1" });
  if (result.status === "failed") {
    refresh();
    return { formError: "telegramFailed", noticeVars: { error: result.error } };
  }
  if (result.status === "posted") {
    await recordAdminEvent(admin, {
      action: "digest.post",
      entityType: "digest",
      entityId: digest.day,
      entityLabel: formatDay(digest.day, "en"),
      details: { messageId: result.messageId },
    });
  }
  refresh();
  return { notice: "digestPosted" };
}
