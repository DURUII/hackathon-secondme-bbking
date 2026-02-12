ALTER TABLE "questions" ADD COLUMN "deleted_at" TIMESTAMP(3);
CREATE INDEX "questions_deleted_at_idx" ON "questions"("deleted_at");
