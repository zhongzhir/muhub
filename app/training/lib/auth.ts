import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { isTrainingAdminUser } from "./admin-auth";
import { getCurrentTrainingParticipant } from "./queries";

export async function getTrainingSessionContext() {
  const session = await auth();
  const userId = session?.user?.id;
  const participant = await getCurrentTrainingParticipant(userId);
  const isTrainingAdmin = isTrainingAdminUser({
    id: session?.user?.id,
    email: session?.user?.email,
    phone: (session?.user as { phone?: string | null } | undefined)?.phone ?? null,
    role: (session?.user as { role?: string | null } | undefined)?.role ?? null,
  });

  return {
    session,
    userId,
    participant,
    isMuHubAdmin: isTrainingAdmin,
    accessParticipant: participant
      ? {
          role: participant.role,
          classNo: participant.classNo,
          groupNo: participant.groupNo,
        }
      : isTrainingAdmin
        ? {
            role: "admin",
            classNo: null,
            groupNo: null,
          }
        : null,
  };
}

export async function requireTrainingLogin(redirectTo = "/training/register") {
  const context = await getTrainingSessionContext();
  if (!context.userId) {
    redirect(`/login?redirect=${encodeURIComponent(redirectTo)}`);
  }
  return context;
}
