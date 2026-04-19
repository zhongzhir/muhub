-- CreateEnum
CREATE TYPE "ProjectNotificationEventType" AS ENUM ('UPDATE_POSTED');

-- CreateTable
CREATE TABLE "ProjectNotificationEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "ProjectNotificationEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sourceUpdateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectNotificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectNotificationEventId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectNotificationEvent_projectId_idx" ON "ProjectNotificationEvent"("projectId");

-- CreateIndex
CREATE INDEX "ProjectNotificationEvent_projectId_createdAt_idx" ON "ProjectNotificationEvent"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ProjectNotificationEvent_sourceUpdateId_idx" ON "ProjectNotificationEvent"("sourceUpdateId");

-- CreateIndex
CREATE INDEX "UserNotification_userId_idx" ON "UserNotification"("userId");

-- CreateIndex
CREATE INDEX "UserNotification_userId_readAt_idx" ON "UserNotification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "UserNotification_projectId_idx" ON "UserNotification"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "UserNotification_userId_projectNotificationEventId_key" ON "UserNotification"("userId", "projectNotificationEventId");

-- AddForeignKey
ALTER TABLE "ProjectNotificationEvent" ADD CONSTRAINT "ProjectNotificationEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectNotificationEvent" ADD CONSTRAINT "ProjectNotificationEvent_sourceUpdateId_fkey" FOREIGN KEY ("sourceUpdateId") REFERENCES "ProjectUpdate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_projectNotificationEventId_fkey" FOREIGN KEY ("projectNotificationEventId") REFERENCES "ProjectNotificationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
