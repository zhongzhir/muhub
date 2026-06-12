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
  const [records, files] = accessibleGroupIds.length
    ? await Promise.all([
        prisma.trainingRecord.findMany({
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
        }),
        prisma.trainingFile.findMany({
          where: {
            eventId: event.id,
            groupId: { in: accessibleGroupIds },
          },
          include: {
            uploaderParticipant: {
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
          orderBy: { createdAt: "desc" },
        }),
      ])
    : [[], []];

  return {
    event,
    groups: accessibleGroups,
    cases: accessibleCases,
    tasks,
    participants: accessibleParticipants,
    records,
    files,
  };
}

export async function getTrainingSurveyResponseForParticipant(userId: string | undefined | null) {
  if (!userId) return null;
  const participant = await getCurrentTrainingParticipant(userId);
  if (!participant) return null;

  return prisma.trainingSurveyResponse.findFirst({
    where: {
      eventId: participant.eventId,
      participantId: participant.id,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTrainingAdminOverview() {
  const event = await getCurrentTrainingEvent();
  if (!event) return null;

  const [groups, cases, recordCounts, fileCounts, surveyCounts] = await Promise.all([
    prisma.trainingGroup.findMany({
      where: { eventId: event.id },
      orderBy: [{ classNo: "asc" }, { groupNo: "asc" }],
    }),
    prisma.trainingCase.findMany({
      where: { eventId: event.id },
      orderBy: [{ classNo: "asc" }, { groupNo: "asc" }],
    }),
    prisma.trainingRecord.groupBy({
      by: ["groupId", "type"],
      where: { eventId: event.id },
      _count: { _all: true },
    }),
    prisma.trainingFile.groupBy({
      by: ["groupId"],
      where: { eventId: event.id },
      _count: { _all: true },
    }),
    prisma.trainingSurveyResponse.groupBy({
      by: ["classNo", "groupNo"],
      where: { eventId: event.id },
      _count: { _all: true },
    }),
  ]);

  return { event, groups, cases, recordCounts, fileCounts, surveyCounts };
}

export async function listTrainingSurveyResponsesForAdmin() {
  const event = await getCurrentTrainingEvent();
  if (!event) return [];

  return prisma.trainingSurveyResponse.findMany({
    where: { eventId: event.id },
    include: {
      participant: {
        include: {
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
    orderBy: [{ classNo: "asc" }, { groupNo: "asc" }, { createdAt: "desc" }],
  });
}

export async function listTrainingAdminGroups() {
  const event = await getCurrentTrainingEvent();
  if (!event) return null;

  const [groups, cases, participants, recordCounts, fileCounts, surveyCounts] = await Promise.all([
    prisma.trainingGroup.findMany({
      where: { eventId: event.id },
      orderBy: [{ classNo: "asc" }, { groupNo: "asc" }],
    }),
    prisma.trainingCase.findMany({
      where: { eventId: event.id },
      orderBy: [{ classNo: "asc" }, { groupNo: "asc" }],
    }),
    prisma.trainingParticipant.findMany({
      where: { eventId: event.id },
      orderBy: [{ classNo: "asc" }, { groupNo: "asc" }, { createdAt: "asc" }],
    }),
    prisma.trainingRecord.groupBy({
      by: ["groupId"],
      where: { eventId: event.id },
      _count: { _all: true },
    }),
    prisma.trainingFile.groupBy({
      by: ["groupId"],
      where: { eventId: event.id },
      _count: { _all: true },
    }),
    prisma.trainingSurveyResponse.groupBy({
      by: ["classNo", "groupNo"],
      where: { eventId: event.id },
      _count: { _all: true },
    }),
  ]);

  return { event, groups, cases, participants, recordCounts, fileCounts, surveyCounts };
}

export async function getTrainingAdminGroupDetail(groupId: string) {
  const event = await getCurrentTrainingEvent();
  if (!event) return null;

  const group = await prisma.trainingGroup.findFirst({
    where: { id: groupId, eventId: event.id },
  });
  if (!group) return null;

  const [trainingCase, tasks, participants, records, files, surveys] = await Promise.all([
    prisma.trainingCase.findFirst({
      where: {
        eventId: event.id,
        classNo: group.classNo,
        groupNo: group.groupNo,
      },
    }),
    prisma.trainingTask.findMany({
      where: { eventId: event.id },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.trainingParticipant.findMany({
      where: {
        eventId: event.id,
        OR: [
          { classNo: group.classNo, groupNo: group.groupNo },
          { role: "mentor", classNo: group.classNo },
        ],
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    prisma.trainingRecord.findMany({
      where: {
        eventId: event.id,
        groupId: group.id,
      },
      include: {
        authorParticipant: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        task: true,
      },
      orderBy: [{ taskId: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.trainingFile.findMany({
      where: {
        eventId: event.id,
        groupId: group.id,
      },
      include: {
        task: true,
        uploaderParticipant: {
          include: {
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
      orderBy: { createdAt: "desc" },
    }),
    prisma.trainingSurveyResponse.findMany({
      where: {
        eventId: event.id,
        classNo: group.classNo,
        groupNo: group.groupNo,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { event, group, trainingCase, tasks, participants, records, files, surveys };
}
