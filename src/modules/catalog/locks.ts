/**
 * Product fields a person can set by hand in the admin panel. Once set, the
 * field is "locked": the automatic rules (subcategory and audience detection
 * in the daily job) leave it alone, so a correction is never undone overnight.
 * Resetting a lock hands the field back to the rules.
 */
export const LOCKABLE_FIELDS = ["title", "brand", "categorySlug", "subcategorySlug", "audience", "imageUrl"] as const;
export type LockableField = (typeof LOCKABLE_FIELDS)[number];

export function isLockableField(value: string): value is LockableField {
  return (LOCKABLE_FIELDS as readonly string[]).includes(value);
}

export function isLocked(lockedFields: readonly string[], field: LockableField): boolean {
  return lockedFields.includes(field);
}

/** The lock list after setting `fields` by hand: sorted and without duplicates. */
export function withLocks(lockedFields: readonly string[], fields: readonly LockableField[]): string[] {
  return [...new Set([...lockedFields, ...fields])].sort();
}

export function withoutLocks(lockedFields: readonly string[], fields: readonly LockableField[]): string[] {
  return lockedFields.filter((field) => !(fields as readonly string[]).includes(field));
}
