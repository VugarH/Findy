"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AdminDictionary } from "@/i18n/dictionaries/admin";

const AdminI18nContext = createContext<AdminDictionary | null>(null);

/** Gives the admin panel's client components its dictionary. Rendered by the admin layout. */
export function AdminI18nProvider({ t, children }: { t: AdminDictionary; children: ReactNode }) {
  return <AdminI18nContext.Provider value={t}>{children}</AdminI18nContext.Provider>;
}

export function useAdminT(): AdminDictionary {
  const value = useContext(AdminI18nContext);
  if (!value) throw new Error("useAdminT must be used inside <AdminI18nProvider>");
  return value;
}
