"use client";

import { Check, Plus } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { cn } from "@/lib/cn";
import { brandKey } from "@/modules/catalog/brand";
import { followId, type FollowKind } from "@/modules/follows/keys";
import { useFollows } from "./follow-provider";

interface Props {
  kind: FollowKind;
  /** The brand's name (any spelling), the store id or the category slug. */
  value: string;
  /** Shown on the button: "Follow adidas". */
  name: string;
  className?: string;
}

/** Follows a brand, store or category for its new deals; pressed again, unfollows. */
export function FollowButton({ kind, value, name, className }: Props) {
  const { t } = useI18n();
  const { isFollowing, toggle, pendingId } = useFollows();
  const key = kind === "brand" ? brandKey(value) : value;
  const following = isFollowing(kind, key);
  const Icon = following ? Check : Plus;

  return (
    <button
      type="button"
      aria-pressed={following}
      title={t.follows.followHint}
      disabled={pendingId === followId(kind, key)}
      onClick={() => toggle(kind, key)}
      className={cn(
        "inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-60",
        following ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-surface text-ink hover:bg-surface-2",
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{fmt(following ? t.follows.following : t.follows.follow, { name })}</span>
    </button>
  );
}
