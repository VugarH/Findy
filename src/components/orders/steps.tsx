import { ClipboardList, PackageCheck, PhoneCall, ShoppingBag } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";

/** The four steps of an assisted order. `compact` drops the descriptions. */
export function OrderSteps({ t, compact = false }: { t: Dictionary; compact?: boolean }) {
  const steps = [
    { icon: ClipboardList, title: t.order.step1Title, text: t.order.step1Text },
    { icon: PhoneCall, title: t.order.step2Title, text: t.order.step2Text },
    { icon: ShoppingBag, title: t.order.step3Title, text: t.order.step3Text },
    { icon: PackageCheck, title: t.order.step4Title, text: t.order.step4Text },
  ];

  return (
    <ol className={cn("grid gap-3", compact ? "grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-4")}>
      {steps.map((step, index) => (
        <li
          key={step.title}
          className={cn("rounded-2xl border border-line bg-surface", compact ? "flex items-center gap-3 p-3" : "p-5")}
        >
          <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-global-soft text-global">
            <step.icon className="size-5" aria-hidden />
            <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-ink text-[11px] font-bold text-bg">
              {index + 1}
            </span>
          </span>
          <div className={compact ? "min-w-0" : "mt-4"}>
            <h3 className={cn("font-bold", compact && "text-sm leading-5")}>{step.title}</h3>
            {!compact && <p className="mt-1.5 text-sm leading-6 text-muted">{step.text}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
