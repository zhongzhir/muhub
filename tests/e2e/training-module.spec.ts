import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";
import {
  TRAINING_2026_EVENT_SLUG,
  training2026Cases,
  training2026Groups,
  training2026Invites,
  training2026Tasks,
} from "@/app/training/lib/seed-data";
import {
  canDownloadTrainingFile,
  canCreateTrainingRecord,
  canUploadTrainingFile,
  canUpdateTrainingRecord,
  canAccessTrainingCase,
  canAccessTrainingGroup,
  resolveTrainingAccessScope,
  type TrainingAccessParticipant,
} from "@/app/training/lib/access";
import {
  assertAllowedTrainingUpload,
  buildTrainingStorageKey,
  sanitizeTrainingFileName,
} from "@/app/training/lib/file-storage";
import { loginAsE2EUser, skipWithoutE2EAuthGate } from "./helpers/auth";

test.describe("training 2026 practice module", () => {
  test("seed data stays scoped to the 2026 practice event shape", () => {
    expect(TRAINING_2026_EVENT_SLUG).toBe("publishing-practice-2026-06");
    expect(training2026Groups).toHaveLength(6);
    expect(training2026Cases).toHaveLength(6);
    expect(training2026Tasks).toHaveLength(5);
    expect(training2026Invites).toHaveLength(10);

    expect(new Set(training2026Groups.map((group) => `${group.classNo}-${group.groupNo}`))).toEqual(
      new Set(["1-1", "1-2", "2-1", "2-2", "3-1", "3-2"]),
    );

    expect(training2026Cases.map((item) => item.slug)).toEqual([
      "phoenix-zhiling",
      "sanjin-culture-model",
      "sanlian-civilization-tracing",
      "lianhuanhua-ai-vertical-model",
      "phoenix-literature-ai-comic-drama",
      "china-treasure-hunt",
    ]);
  });

  test("access rules keep students in-group, mentors in-class, and admins global", () => {
    const student: TrainingAccessParticipant = {
      role: "student",
      classNo: 1,
      groupNo: 1,
    };
    const mentor: TrainingAccessParticipant = {
      role: "mentor",
      classNo: 1,
      groupNo: null,
    };
    const admin: TrainingAccessParticipant = {
      role: "admin",
      classNo: null,
      groupNo: null,
    };

    expect(resolveTrainingAccessScope(student)).toEqual({
      role: "student",
      classNo: 1,
      groupNo: 1,
      canSeeAll: false,
    });
    expect(resolveTrainingAccessScope(mentor)).toEqual({
      role: "mentor",
      classNo: 1,
      groupNo: null,
      canSeeAll: false,
    });
    expect(resolveTrainingAccessScope(admin)).toEqual({
      role: "admin",
      classNo: null,
      groupNo: null,
      canSeeAll: true,
    });

    expect(canAccessTrainingGroup(student, { classNo: 1, groupNo: 1 })).toBe(true);
    expect(canAccessTrainingGroup(student, { classNo: 1, groupNo: 2 })).toBe(false);
    expect(canAccessTrainingGroup(mentor, { classNo: 1, groupNo: 2 })).toBe(true);
    expect(canAccessTrainingGroup(mentor, { classNo: 2, groupNo: 1 })).toBe(false);
    expect(canAccessTrainingGroup(admin, { classNo: 3, groupNo: 2 })).toBe(true);

    expect(canAccessTrainingCase(student, { classNo: 1, groupNo: 1 })).toBe(true);
    expect(canAccessTrainingCase(student, { classNo: 2, groupNo: 1 })).toBe(false);
    expect(canAccessTrainingCase(mentor, { classNo: 1, groupNo: 1 })).toBe(true);
    expect(canAccessTrainingCase(admin, { classNo: 2, groupNo: 2 })).toBe(true);
  });

  test("record write rules keep student, mentor, and admin abilities narrow", () => {
    const student: TrainingAccessParticipant = {
      role: "student",
      classNo: 1,
      groupNo: 1,
    };
    const otherStudent: TrainingAccessParticipant = {
      role: "student",
      classNo: 1,
      groupNo: 2,
    };
    const mentor: TrainingAccessParticipant = {
      role: "mentor",
      classNo: 1,
      groupNo: null,
    };
    const admin: TrainingAccessParticipant = {
      role: "admin",
      classNo: null,
      groupNo: null,
    };
    const group = { classNo: 1, groupNo: 1 };

    expect(canCreateTrainingRecord(student, group, "discussion_note")).toBe(true);
    expect(canCreateTrainingRecord(student, group, "task_submission")).toBe(true);
    expect(canCreateTrainingRecord(student, group, "final_submission")).toBe(true);
    expect(canCreateTrainingRecord(student, group, "mentor_review")).toBe(false);
    expect(canCreateTrainingRecord(otherStudent, group, "discussion_note")).toBe(false);

    expect(canCreateTrainingRecord(mentor, group, "mentor_review")).toBe(true);
    expect(canCreateTrainingRecord(mentor, { classNo: 2, groupNo: 1 }, "mentor_review")).toBe(false);
    expect(canCreateTrainingRecord(mentor, group, "discussion_note")).toBe(false);

    expect(canCreateTrainingRecord(admin, group, "discussion_note")).toBe(false);
    expect(canCreateTrainingRecord(admin, group, "mentor_review")).toBe(false);

    expect(
      canUpdateTrainingRecord(student, group, {
        type: "discussion_note",
        authorParticipantId: "p1",
        requesterParticipantId: "p1",
      }),
    ).toBe(true);
    expect(
      canUpdateTrainingRecord(student, group, {
        type: "discussion_note",
        authorParticipantId: "p2",
        requesterParticipantId: "p1",
      }),
    ).toBe(false);
    expect(
      canUpdateTrainingRecord(student, group, {
        type: "final_submission",
        authorParticipantId: "p2",
        requesterParticipantId: "p1",
      }),
    ).toBe(true);
    expect(
      canUpdateTrainingRecord(mentor, group, {
        type: "mentor_review",
        authorParticipantId: "m1",
        requesterParticipantId: "m1",
      }),
    ).toBe(true);
  });

  test("file upload rules stay student-only while downloads follow group access", () => {
    const student: TrainingAccessParticipant = {
      role: "student",
      classNo: 1,
      groupNo: 1,
    };
    const otherStudent: TrainingAccessParticipant = {
      role: "student",
      classNo: 1,
      groupNo: 2,
    };
    const mentor: TrainingAccessParticipant = {
      role: "mentor",
      classNo: 1,
      groupNo: null,
    };
    const admin: TrainingAccessParticipant = {
      role: "admin",
      classNo: null,
      groupNo: null,
    };
    const group = { classNo: 1, groupNo: 1 };

    expect(canUploadTrainingFile(student, group)).toBe(true);
    expect(canUploadTrainingFile(otherStudent, group)).toBe(false);
    expect(canUploadTrainingFile(mentor, group)).toBe(false);
    expect(canUploadTrainingFile(admin, group)).toBe(false);

    expect(canDownloadTrainingFile(student, group)).toBe(true);
    expect(canDownloadTrainingFile(otherStudent, group)).toBe(false);
    expect(canDownloadTrainingFile(mentor, group)).toBe(true);
    expect(canDownloadTrainingFile(admin, group)).toBe(true);
  });

  test("file storage helpers sanitize names and block unsafe uploads", () => {
    expect(sanitizeTrainingFileName("..\\汇报 终稿.pptx")).toBe("汇报-终稿.pptx");
    expect(sanitizeTrainingFileName("")).toBe("upload");

    expect(
      buildTrainingStorageKey(
        {
          eventSlug: "publishing-practice-2026-06",
          classNo: 1,
          groupNo: 2,
        },
        "file-1",
        "成果.pptx",
        new Date("2026-06-30T00:00:00.000Z"),
      ),
    ).toBe("publishing-practice-2026-06/c1-g2/20260630/file-1-成果.pptx");

    expect(() => assertAllowedTrainingUpload({ name: "成果.pptx", size: 1024 })).not.toThrow();
    expect(() => assertAllowedTrainingUpload({ name: "run.exe", size: 1024 })).toThrow("不支持的文件类型");
    expect(() => assertAllowedTrainingUpload({ name: "too-large.pdf", size: 51 * 1024 * 1024 })).toThrow(
      "文件不能超过 50MB",
    );
  });
});

test.describe("training workspace browser flow", () => {
  test.beforeEach(() => {
    skipWithoutE2EAuthGate();
  });

  test("logged-in unbound user sees workspace binding prompt", async ({ page }) => {
    const { userId } = await loginAsE2EUser(page);
    await removeTrainingParticipant(userId);

    await page.goto("/training/workspace");

    await expect(page.getByRole("heading", { name: "我的工作台" })).toBeVisible();
    await expect(page.getByText("尚未绑定本次实践交流活动身份")).toBeVisible();
    await expect(page.getByRole("link", { name: "绑定活动身份" })).toBeVisible();
  });

  test("student sees task cards and no mentor review editor", async ({ page }) => {
    const { userId } = await loginAsE2EUser(page);
    await bindTrainingParticipant(userId, {
      role: "student",
      classNo: 1,
      groupNo: 1,
      inviteCode: "C1G1-STUDENT",
    });

    await page.goto("/training/workspace");

    await expect(page.getByRole("heading", { name: "我的工作台" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "组织建设与案例预习" })).toBeVisible();
    await expect(page.getByText("凤凰智灵平台")).toBeVisible();
    await expect(page.getByRole("button", { name: "保存导师点评" })).toHaveCount(0);
  });

  test("mentor sees both groups in the same class", async ({ page }) => {
    const { userId } = await loginAsE2EUser(page);
    await bindTrainingParticipant(userId, {
      role: "mentor",
      classNo: 1,
      groupNo: null,
      inviteCode: "C1-MENTOR",
    });

    await page.goto("/training/workspace");

    await expect(page.getByRole("link", { name: "1 班 1 组" })).toBeVisible();
    await expect(page.getByRole("link", { name: "1 班 2 组" })).toBeVisible();
    await expect(page.getByRole("button", { name: "保存导师点评" })).toBeVisible();
  });

  test("case filtering still keeps student within own group", async ({ page }) => {
    const { userId } = await loginAsE2EUser(page);
    await bindTrainingParticipant(userId, {
      role: "student",
      classNo: 1,
      groupNo: 1,
      inviteCode: "C1G1-STUDENT",
    });

    await page.goto("/training/cases");

    await expect(page.getByText("凤凰智灵平台")).toBeVisible();
    await expect(page.getByText("三晋文化大模型")).toHaveCount(0);
  });
});

async function removeTrainingParticipant(userId: string) {
  const event = await prisma.trainingEvent.findUnique({
    where: { slug: TRAINING_2026_EVENT_SLUG },
  });
  if (!event) return;
  await prisma.trainingParticipant.deleteMany({
    where: { eventId: event.id, userId },
  });
}

async function bindTrainingParticipant(
  userId: string,
  input: {
    role: string;
    classNo: number | null;
    groupNo: number | null;
    inviteCode: string;
  },
) {
  const event = await prisma.trainingEvent.findUniqueOrThrow({
    where: { slug: TRAINING_2026_EVENT_SLUG },
  });
  const group =
    input.classNo !== null && input.groupNo !== null
      ? await prisma.trainingGroup.findUnique({
          where: {
            eventId_classNo_groupNo: {
              eventId: event.id,
              classNo: input.classNo,
              groupNo: input.groupNo,
            },
          },
        })
      : null;

  await prisma.trainingParticipant.upsert({
    where: {
      eventId_userId: {
        eventId: event.id,
        userId,
      },
    },
    update: {
      role: input.role,
      classNo: input.classNo,
      groupNo: input.groupNo,
      groupId: group?.id ?? null,
      inviteCode: input.inviteCode,
    },
    create: {
      eventId: event.id,
      userId,
      role: input.role,
      classNo: input.classNo,
      groupNo: input.groupNo,
      groupId: group?.id ?? null,
      inviteCode: input.inviteCode,
      displayName: "E2E Training User",
    },
  });
}
