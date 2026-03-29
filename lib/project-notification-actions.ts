"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  markAllUserFollowingNotificationsRead,
  markUserNotificationAsRead,
} from "@/lib/project-notifications";

export async function markFollowingNotificationRead(notificationId: string): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false };
  }
  const ok = await markUserNotificationAsRead(session.user.id, notificationId);
  revalidatePath("/dashboard");
  return { ok };
}

export async function markAllFollowingNotificationsReadAction(): Promise<{ ok: boolean; count: number }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, count: 0 };
  }
  const count = await markAllUserFollowingNotificationsRead(session.user.id);
  revalidatePath("/dashboard");
  return { ok: true, count };
}
