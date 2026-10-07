import type { ReactNode } from "react";
import { HiddenFields, SubmitButton } from "./fields";

/**
 * A one-button form that flips something on or off (a store, a product, an
 * order's status). The action receives `id` and `value` (or the given fields).
 */
export function ActionButton({
  action,
  fields,
  children,
  variant = "secondary",
  confirm,
}: {
  action: (form: FormData) => Promise<void>;
  fields: Record<string, string>;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  confirm?: string;
}) {
  return (
    <form action={action}>
      <HiddenFields values={fields} />
      <SubmitButton size="sm" variant={variant} confirm={confirm} className="h-8 px-3 text-xs">
        {children}
      </SubmitButton>
    </form>
  );
}
