import type { FollowKind } from "@/db/schema";

/**
 * What a person can follow, as the browser and the server both name it.
 * Client-safe (types only from the schema).
 */

export type { FollowKind };

export const FOLLOW_KINDS: readonly FollowKind[] = ["brand", "store", "category"];

/** Most brands, stores and categories one person may follow. */
export const MAX_FOLLOWS = 50;

export const isFollowKind = (value: unknown): value is FollowKind =>
  typeof value === "string" && (FOLLOW_KINDS as readonly string[]).includes(value);

/** One string per follow ("brand:adidas"), for sets on the client. */
export const followId = (kind: FollowKind, key: string) => `${kind}:${key}`;
