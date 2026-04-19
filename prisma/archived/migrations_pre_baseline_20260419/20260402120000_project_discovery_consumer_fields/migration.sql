-- Project 消费 Discovery V2：类目、主类型筛选位、布尔标记

ALTER TABLE "Project" ADD COLUMN "categoriesJson" JSONB;
ALTER TABLE "Project" ADD COLUMN "primaryCategory" TEXT;
ALTER TABLE "Project" ADD COLUMN "isAiRelated" BOOLEAN;
ALTER TABLE "Project" ADD COLUMN "isChineseTool" BOOLEAN;

CREATE INDEX "Project_primaryCategory_idx" ON "Project"("primaryCategory");
CREATE INDEX "Project_isAiRelated_idx" ON "Project"("isAiRelated");
CREATE INDEX "Project_isChineseTool_idx" ON "Project"("isChineseTool");
