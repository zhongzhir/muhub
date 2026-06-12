import type { TrainingRole } from "./seed-data";

export type TrainingAccessParticipant = {
  role: TrainingRole | string;
  classNo: number | null;
  groupNo: number | null;
};

export type TrainingAccessTarget = {
  classNo: number | null;
  groupNo: number | null;
};

export type TrainingRecordType =
  | "discussion_note"
  | "task_submission"
  | "mentor_review"
  | "final_submission";

export type TrainingAccessScope = {
  role: string;
  classNo: number | null;
  groupNo: number | null;
  canSeeAll: boolean;
};

export function resolveTrainingAccessScope(
  participant: TrainingAccessParticipant | null | undefined,
): TrainingAccessScope | null {
  if (!participant) return null;
  const role = participant.role;
  return {
    role,
    classNo: participant.classNo ?? null,
    groupNo: participant.groupNo ?? null,
    canSeeAll: role === "admin",
  };
}

export function canAccessTrainingGroup(
  participant: TrainingAccessParticipant | null | undefined,
  target: TrainingAccessTarget,
): boolean {
  if (!participant) return false;
  if (participant.role === "admin") return true;
  if (participant.role === "mentor") {
    return participant.classNo !== null && participant.classNo === target.classNo;
  }
  if (participant.role === "student") {
    return participant.classNo === target.classNo && participant.groupNo === target.groupNo;
  }
  return false;
}

export function canAccessTrainingCase(
  participant: TrainingAccessParticipant | null | undefined,
  target: TrainingAccessTarget,
): boolean {
  return canAccessTrainingGroup(participant, target);
}

export function isTrainingRecordType(value: string): value is TrainingRecordType {
  return (
    value === "discussion_note" ||
    value === "task_submission" ||
    value === "mentor_review" ||
    value === "final_submission"
  );
}

export function canCreateTrainingRecord(
  participant: TrainingAccessParticipant | null | undefined,
  target: TrainingAccessTarget,
  type: TrainingRecordType,
): boolean {
  if (!participant || !canAccessTrainingGroup(participant, target)) return false;
  if (participant.role === "student") {
    return type === "discussion_note" || type === "task_submission" || type === "final_submission";
  }
  if (participant.role === "mentor") {
    return type === "mentor_review";
  }
  return false;
}

export function canUpdateTrainingRecord(
  participant: TrainingAccessParticipant | null | undefined,
  target: TrainingAccessTarget,
  record: {
    type: TrainingRecordType | string;
    authorParticipantId: string | null;
    requesterParticipantId: string | null;
  },
): boolean {
  if (!participant || !canAccessTrainingGroup(participant, target)) return false;
  if (participant.role === "student") {
    if (record.type === "final_submission") return true;
    return (
      (record.type === "discussion_note" || record.type === "task_submission") &&
      record.authorParticipantId !== null &&
      record.authorParticipantId === record.requesterParticipantId
    );
  }
  if (participant.role === "mentor") {
    return (
      record.type === "mentor_review" &&
      record.authorParticipantId !== null &&
      record.authorParticipantId === record.requesterParticipantId
    );
  }
  return false;
}
