import { notFound, redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { getCurrentUser, type CurrentUser } from "@/modules/auth/session";

/**
 * Who may use the admin panel: signed-in people whose role is "admin".
 * Pages call requireAdminPage(); every Server Action calls requireAdmin()
 * itself, because actions can be posted to directly, without the page.
 */
export const isAdmin = (user: Pick<CurrentUser, "role"> | null): boolean => user?.role === "admin";

/** For admin pages: sends signed-out visitors to sign in; to everyone else the panel does not exist. */
export async function requireAdminPage(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const { href } = await getI18n();
    redirect(`${href("/login")}?next=${encodeURIComponent(href("/admin"))}`);
  }
  if (!isAdmin(user)) notFound();
  return user;
}

export class ForbiddenError extends Error {
  constructor() {
    super("Admin access required");
  }
}

/** For Server Actions: the signed-in admin, or an error that ends the action. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!isAdmin(user)) throw new ForbiddenError();
  return user!;
}
