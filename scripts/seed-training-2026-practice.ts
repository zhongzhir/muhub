import { PrismaClient } from "@prisma/client";

import {
  TRAINING_2026_EVENT,
  training2026Cases,
  training2026Groups,
  training2026Invites,
  training2026Tasks,
} from "../app/training/lib/seed-data";

const prisma = new PrismaClient();

async function main() {
  const event = await prisma.trainingEvent.upsert({
    where: { slug: TRAINING_2026_EVENT.slug },
    update: {
      name: TRAINING_2026_EVENT.name,
      startsAt: TRAINING_2026_EVENT.startsAt,
      endsAt: TRAINING_2026_EVENT.endsAt,
      status: TRAINING_2026_EVENT.status,
    },
    create: {
      slug: TRAINING_2026_EVENT.slug,
      name: TRAINING_2026_EVENT.name,
      startsAt: TRAINING_2026_EVENT.startsAt,
      endsAt: TRAINING_2026_EVENT.endsAt,
      status: TRAINING_2026_EVENT.status,
    },
  });

  for (const group of training2026Groups) {
    await prisma.trainingGroup.upsert({
      where: {
        eventId_classNo_groupNo: {
          eventId: event.id,
          classNo: group.classNo,
          groupNo: group.groupNo,
        },
      },
      update: {
        name: group.name,
        caseSlug: group.caseSlug,
      },
      create: {
        eventId: event.id,
        classNo: group.classNo,
        groupNo: group.groupNo,
        name: group.name,
        caseSlug: group.caseSlug,
      },
    });
  }

  for (const item of training2026Cases) {
    await prisma.trainingCase.upsert({
      where: {
        eventId_slug: {
          eventId: event.id,
          slug: item.slug,
        },
      },
      update: {
        name: item.name,
        organization: item.organization,
        classNo: item.classNo,
        groupNo: item.groupNo,
        track: item.track,
        traits: item.traits,
        summary: item.summary,
        needAndUsers: item.needAndUsers,
        competitors: item.competitors,
        technologyAdoption: item.technologyAdoption,
        marketAndBenefits: item.marketAndBenefits,
        teamMechanism: item.teamMechanism,
        challenges: item.challenges,
        touchpointExperience: item.touchpointExperience,
        attachmentsJson: item.attachmentsJson,
      },
      create: {
        eventId: event.id,
        slug: item.slug,
        name: item.name,
        organization: item.organization,
        classNo: item.classNo,
        groupNo: item.groupNo,
        track: item.track,
        traits: item.traits,
        summary: item.summary,
        needAndUsers: item.needAndUsers,
        competitors: item.competitors,
        technologyAdoption: item.technologyAdoption,
        marketAndBenefits: item.marketAndBenefits,
        teamMechanism: item.teamMechanism,
        challenges: item.challenges,
        touchpointExperience: item.touchpointExperience,
        attachmentsJson: item.attachmentsJson,
      },
    });
  }

  for (const task of training2026Tasks) {
    await prisma.trainingTask.upsert({
      where: {
        eventId_key: {
          eventId: event.id,
          key: task.key,
        },
      },
      update: {
        dayIndex: task.dayIndex,
        title: task.title,
        description: task.description,
        activitiesJson: task.activitiesJson,
        deliverablesJson: task.deliverablesJson,
        promptPackJson: task.promptPackJson,
        sortOrder: task.sortOrder,
      },
      create: {
        eventId: event.id,
        key: task.key,
        dayIndex: task.dayIndex,
        title: task.title,
        description: task.description,
        activitiesJson: task.activitiesJson,
        deliverablesJson: task.deliverablesJson,
        promptPackJson: task.promptPackJson,
        sortOrder: task.sortOrder,
      },
    });
  }

  for (const invite of training2026Invites) {
    await prisma.trainingInvite.upsert({
      where: { code: invite.code },
      update: {
        eventId: event.id,
        role: invite.role,
        classNo: invite.classNo,
        groupNo: invite.groupNo,
        maxUses: invite.maxUses,
        isActive: true,
        note: invite.note,
      },
      create: {
        eventId: event.id,
        code: invite.code,
        role: invite.role,
        classNo: invite.classNo,
        groupNo: invite.groupNo,
        maxUses: invite.maxUses,
        note: invite.note,
      },
    });
  }

  console.log(
    `Seeded training event ${event.slug}: ${training2026Groups.length} groups, ${training2026Cases.length} cases, ${training2026Tasks.length} tasks, ${training2026Invites.length} invites.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
