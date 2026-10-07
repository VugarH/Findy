"use client";

import { RefreshCw } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { collectStoreAction, saveStoreNotesAction } from "@/modules/admin/actions/stores";
import { useAdminT } from "./admin-i18n";
import { FormMessage, HiddenFields, SubmitButton, TextAreaField, useAdminForm } from "./fields";

/** "Collect now" on a store's page. */
export function CollectButton({ storeId }: { storeId: string }) {
  const t = useAdminT();
  const [state, action] = useAdminForm(collectStoreAction);
  return (
    <form action={action} className="space-y-2">
      <HiddenFields values={{ id: storeId }} />
      <SubmitButton variant="secondary" size="sm" pendingLabel={t.stores.detail.collecting}>
        <RefreshCw className="size-4" aria-hidden />
        {t.stores.detail.collectNow}
      </SubmitButton>
      <p className="text-xs text-muted">{t.stores.detail.collectHint}</p>
      <FormMessage state={state} />
    </form>
  );
}

/** The team's notes on a store. */
export function StoreNotes({ storeId, notes }: { storeId: string; notes: string | null }) {
  const t = useAdminT();
  const { locale } = useI18n();
  const [state, action, key] = useAdminForm(saveStoreNotesAction);
  return (
    <form key={key} action={action} className="space-y-3">
      <HiddenFields values={{ id: storeId, locale }} />
      <TextAreaField
        label={t.stores.detail.notes}
        name="notes"
        defaultValue={notes ?? ""}
        hint={t.stores.detail.notesHint}
        placeholder={t.stores.detail.notesPlaceholder}
        maxLength={2000}
      />
      <div className="flex items-center gap-3">
        <SubmitButton variant="secondary" size="sm" pendingLabel={t.common.saving}>
          {t.stores.detail.saveNotes}
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
