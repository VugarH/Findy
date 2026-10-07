"use client";

import { setUserRoleAction } from "@/modules/admin/actions/general";
import { useAdminT } from "./admin-i18n";
import { FormMessage, HiddenFields, SubmitButton, useAdminForm } from "./fields";

/** Gives or takes away admin rights, after asking. */
export function RoleButton({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const t = useAdminT();
  const [state, action] = useAdminForm(setUserRoleAction);
  return (
    <form action={action} className="space-y-1">
      <HiddenFields values={{ id: userId, role: isAdmin ? "user" : "admin" }} />
      <SubmitButton
        size="sm"
        variant={isAdmin ? "ghost" : "secondary"}
        confirm={isAdmin ? t.users.confirmRemove : t.users.confirmMake}
        className="h-8 px-3 text-xs"
      >
        {isAdmin ? t.users.removeAdmin : t.users.makeAdmin}
      </SubmitButton>
      {state.formError && <FormMessage state={state} />}
    </form>
  );
}
