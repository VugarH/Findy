import { ArrowLeftRight, Globe, MapPin } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SupplierScope } from "@/modules/suppliers/types";

/**
 * Local, abroad, or both — always icon + label, never colour alone.
 * "both" is for a product that is on sale in both markets.
 */
export function ScopeTag({
  scope,
  label,
  className,
}: {
  scope: SupplierScope | "both";
  label: string;
  className?: string;
}) {
  const Icon = scope === "local" ? MapPin : scope === "global" ? Globe : ArrowLeftRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        scope === "local" ? "bg-brand-soft text-brand-strong" : scope === "global" ? "bg-global-soft text-global" : "bg-surface-2 text-ink",
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}
