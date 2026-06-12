import { prisma } from "@/lib/prisma";

import { TRAINING_2026_EVENT_SLUG } from "./current-event";
import { canAccessTrainingCase, canAccessTrainingGroup, type TrainingAccessParticipant } from "./access";

export async function getCurrentTrainingEvent() {
  return prisma.trainingEvent.findUnique({
    where: { slug: TRAINING_2026_EVENT_SLUG },
  });
}

export async function getCurrentTrainingParticipant(userId: string | undefined | null) {
  if (!userId) return null;
  const event = await getCurrentTrainingEvent();
  if (!event) return null;

  return prisma.trainingParticipant.findUnique({
    where: {
      eventId_userId: {
        eventId: event.id,
        userId,
      },
    },
    include: {
      group: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });
}

export async function listAccessibleTrainingCases(
  participant: TrainingAccessParticipant | null | undefined,
) {
  const event = await getCurrentTrainingEvent();
  if (!event || !participant) return [];

  const cases = await prisma.trainingCase.findMany({
    where: { eventId: event.id },
    orderBy: [{ classNo: "asc" }, { groupNo: "asc" }],
  });

  return cases.filter((item) =>
    canAccessTrainingCase(participant, {
      classNo: item.classNo,
      groupNo: item.groupNo,
    }),
  );
}

export async function getAccessibleTrainingCaseBySlug(
  slug: string,
  participant: TrainingAccessParticipant | null | undefined,
) {
  const event = await getCurrentTrainingEvent();
  if (!event || !participant) return null;

  const item = await prisma.trainingCase.findUnique({
    where: {
      eventId_slug: {
        eventId: event.id,
        slug,
      },
    },
  });
  if (!item) return null;

  return canAccessTrainingCase(participant, {
    classNo: item.classNo,
    groupNo: item.groupNo,
  })
    ? item
    : null;
}

export async function getTrainingWorkspace(participant: TrainingAccessParticipant | null | undefined) {
  const event = await getCurrentTrainingEvent();
  if (!event || !participant) {
    return null;
  }

  const [groups, cases, tasks, participants] = await Promise.all([
    prisma.trainingGroup.findMany({
      where: { eventId: event.id },
      orderBy: [{ classNo: "asc" }, { groupNo: "asc" }],
    }),
    prisma.trainingCase.findMany({
      where: { eventId: event.id },
      orderBy: [{ classNo: "asc" }, { groupNo: "asc" }],
    }),
    prisma.trainingTask.findMany({
      where: { eventId: event.id },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.trainingParticipant.findMany({
      where: { eventId: event.id },
      orderBy: [{ classNo: "asc" }, { groupNo: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const accessibleGroups = groups.filter((group) =>
    canAccessTrainingGroup(participant, {
      classNo: group.classNo,
      groupNo: group.groupNo,
    }),
  );
  const accessibleCases = cases.filter((item) =>
    canAccessTrainingCase(participant, {
      classNo: item.classNo,
      groupNo: item.groupNo,
    }),
  );
  const accessibleGroupKeys = new Set(accessibleGroups.map((group) => `${group.classNo}-${group.groupNo}`));
  const accessibleParticipants = participants.filter((item) => {
    if (item.role === "mentor") {
      return item.classNo !== null && accessibleGroups.some((group) => group.classNo === item.classNo);
    }
    return accessibleGroupKeys.has(`${item.classNo}-${item.groupNo}`);
  });
  const accessibleGroupIds = accessibleGroups.map((group) => group.id);
  const records = accessibleGroupIds.length
    ? await prisma.trainingRecord.findMany({
        where: {
          eventId: event.id,
          groupId: { in: accessibleGroupIds },
        },
        include: {
          authorParticipant: {
            select: {
              id: true,
              role: true,
              displayName: true,
              user: {
                select: {
                  name: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  return {
    event,
    groups: accessibleGroups,
    cases: accessibleCases,
    tasks,
    participants: accessibleParticipants,
    records,
  };
}
