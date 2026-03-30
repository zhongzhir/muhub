-- AlterTable
ALTER TABLE "PhoneVerificationCode" ADD COLUMN "verifyAttempts" INTEGER NOT NULL DEFAULT 0;
