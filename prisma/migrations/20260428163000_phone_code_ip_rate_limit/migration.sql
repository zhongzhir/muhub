ALTER TABLE "PhoneVerificationCode" ADD COLUMN "ipHash" TEXT;

CREATE INDEX "PhoneVerificationCode_ipHash_purpose_createdAt_idx"
  ON "PhoneVerificationCode"("ipHash", "purpose", "createdAt");
