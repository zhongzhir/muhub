-- CreateTable
CREATE TABLE "TrainingEvent" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingGroup" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "classNo" INTEGER NOT NULL,
    "groupNo" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "caseSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingCase" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "classNo" INTEGER NOT NULL,
    "groupNo" INTEGER NOT NULL,
    "track" TEXT NOT NULL,
    "traits" TEXT,
    "summary" TEXT,
    "needAndUsers" TEXT,
    "competitors" TEXT,
    "technologyAdoption" TEXT,
    "marketAndBenefits" TEXT,
    "teamMechanism" TEXT,
    "challenges" TEXT,
    "touchpointExperience" TEXT,
    "attachmentsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingParticipant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "classNo" INTEGER,
    "groupNo" INTEGER,
    "groupId" TEXT,
    "inviteCode" TEXT NOT NULL,
    "displayName" TEXT,
    "organization" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingInvite" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "classNo" INTEGER,
    "groupNo" INTEGER,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingTask" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "activitiesJson" JSONB NOT NULL,
    "deliverablesJson" JSONB NOT NULL,
    "promptPackJson" JSONB,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingRecord" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "taskId" TEXT,
    "authorParticipantId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "contentJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingFile" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "taskId" TEXT,
    "uploaderParticipantId" TEXT,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'task_file',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSurveyResponse" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "participantId" TEXT,
    "name" TEXT NOT NULL,
    "classNo" INTEGER NOT NULL,
    "groupNo" INTEGER NOT NULL,
    "caseQualityScore" INTEGER NOT NULL,
    "mentorScore" INTEGER NOT NULL,
    "platformScore" INTEGER NOT NULL,
    "mostValuablePart" TEXT NOT NULL,
    "improvementPart" TEXT NOT NULL,
    "willingToContinue" BOOLEAN NOT NULL,
    "muhubSuggestion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingSurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingEvent_slug_key" ON "TrainingEvent"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingGroup_eventId_classNo_groupNo_key" ON "TrainingGroup"("eventId", "classNo", "groupNo");

-- CreateIndex
CREATE INDEX "TrainingGroup_eventId_classNo_idx" ON "TrainingGroup"("eventId", "classNo");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingCase_eventId_slug_key" ON "TrainingCase"("eventId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingCase_eventId_classNo_groupNo_key" ON "TrainingCase"("eventId", "classNo", "groupNo");

-- CreateIndex
CREATE INDEX "TrainingCase_eventId_classNo_groupNo_idx" ON "TrainingCase"("eventId", "classNo", "groupNo");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingParticipant_eventId_userId_key" ON "TrainingParticipant"("eventId", "userId");

-- CreateIndex
CREATE INDEX "TrainingParticipant_eventId_role_idx" ON "TrainingParticipant"("eventId", "role");

-- CreateIndex
CREATE INDEX "TrainingParticipant_eventId_classNo_groupNo_idx" ON "TrainingParticipant"("eventId", "classNo", "groupNo");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingInvite_code_key" ON "TrainingInvite"("code");

-- CreateIndex
CREATE INDEX "TrainingInvite_eventId_role_idx" ON "TrainingInvite"("eventId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingTask_eventId_key_key" ON "TrainingTask"("eventId", "key");

-- CreateIndex
CREATE INDEX "TrainingTask_eventId_sortOrder_idx" ON "TrainingTask"("eventId", "sortOrder");

-- CreateIndex
CREATE INDEX "TrainingRecord_eventId_groupId_taskId_idx" ON "TrainingRecord"("eventId", "groupId", "taskId");

-- CreateIndex
CREATE INDEX "TrainingRecord_eventId_type_idx" ON "TrainingRecord"("eventId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingFile_storageKey_key" ON "TrainingFile"("storageKey");

-- CreateIndex
CREATE INDEX "TrainingFile_eventId_groupId_taskId_idx" ON "TrainingFile"("eventId", "groupId", "taskId");

-- CreateIndex
CREATE INDEX "TrainingFile_storageKey_idx" ON "TrainingFile"("storageKey");

-- CreateIndex
CREATE INDEX "TrainingSurveyResponse_eventId_classNo_groupNo_idx" ON "TrainingSurveyResponse"("eventId", "classNo", "groupNo");

-- CreateIndex
CREATE INDEX "TrainingSurveyResponse_participantId_idx" ON "TrainingSurveyResponse"("participantId");

-- AddForeignKey
ALTER TABLE "TrainingGroup" ADD CONSTRAINT "TrainingGroup_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TrainingEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCase" ADD CONSTRAINT "TrainingCase_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TrainingEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingParticipant" ADD CONSTRAINT "TrainingParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TrainingEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingParticipant" ADD CONSTRAINT "TrainingParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingParticipant" ADD CONSTRAINT "TrainingParticipant_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TrainingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingInvite" ADD CONSTRAINT "TrainingInvite_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TrainingEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingTask" ADD CONSTRAINT "TrainingTask_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TrainingEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TrainingEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TrainingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TrainingTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_authorParticipantId_fkey" FOREIGN KEY ("authorParticipantId") REFERENCES "TrainingParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingFile" ADD CONSTRAINT "TrainingFile_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TrainingEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingFile" ADD CONSTRAINT "TrainingFile_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TrainingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingFile" ADD CONSTRAINT "TrainingFile_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TrainingTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingFile" ADD CONSTRAINT "TrainingFile_uploaderParticipantId_fkey" FOREIGN KEY ("uploaderParticipantId") REFERENCES "TrainingParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSurveyResponse" ADD CONSTRAINT "TrainingSurveyResponse_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TrainingEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSurveyResponse" ADD CONSTRAINT "TrainingSurveyResponse_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "TrainingParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
