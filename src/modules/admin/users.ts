import { asc, count, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db/client";
import { users, type UserRole } from "@/db/schema";

/** Accounts, and who may use the admin panel. */
export const USER_ROLES = ["user", "admin"] as const satisfies readonly UserRole[];

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

export interface AdminUserRow {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export const USER_PAGE_SIZE = 50;

export async function listUsers(q: string | undefined, page = 1): Promise<{ rows: AdminUserRow[]; total: number }> {
  const like = q ? `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%` : null;
  const where = like ? or(ilike(users.email, like), ilike(users.fullName, like)) : undefined;
  const columns = {
    id: users.id,
    email: users.email,
    fullName: users.fullName,
    phone: users.phone,
    role: users.role,
    createdAt: users.createdAt,
    lastLoginAt: users.lastLoginAt,
  };
  const [rows, [{ total }]] = await Promise.all([
    db
      .select(columns)
      .from(users)
      .where(where)
      // Admins first ("admin" sorts before "user").
      .orderBy(asc(users.role), desc(users.createdAt))
      .limit(USER_PAGE_SIZE)
      .offset((page - 1) * USER_PAGE_SIZE),
    db.select({ total: count() }).from(users).where(where),
  ]);
  return { rows, total };
}

/** Changes someone's role. The role is checked on every request, so it takes effect at once. */
export async function setUserRole(id: string, role: UserRole): Promise<{ email: string } | null> {
  const [updated] = await db.update(users).set({ role }).where(eq(users.id, id)).returning({ email: users.email });
  return updated ?? null;
}

export async function setUserRoleByEmail(email: string, role: UserRole): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  if (!row) return false;
  return !!(await setUserRole(row.id, role));
}
