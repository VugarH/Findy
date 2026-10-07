"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/modules/auth/session";
import { isFollowKind } from "./keys";
import { toggleFollow } from "./service";

export type FollowActionResult = { following: boolean } | { error: "signIn" | "notFound" | "limit" };

export async function toggleFollowAction(kind: unknown, key: unknown): Promise<FollowActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "signIn" };
  if (!isFollowKind(kind) || typeof key !== "string" || key.length === 0 || key.length > 200) return { error: "notFound" };
  const result = await toggleFollow(user.id, kind, key);
  revalidatePath("/[lang]/alerts", "page");
  return result;
}
