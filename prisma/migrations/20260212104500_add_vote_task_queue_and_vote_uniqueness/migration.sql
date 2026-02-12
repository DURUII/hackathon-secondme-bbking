-- CreateTable
CREATE TABLE "vote_tasks" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "next_retry_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vote_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vote_tasks_status_next_retry_at_idx" ON "vote_tasks"("status", "next_retry_at");

-- CreateIndex
CREATE UNIQUE INDEX "vote_tasks_question_id_participant_id_key" ON "vote_tasks"("question_id", "participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "votes_question_id_participant_id_key" ON "votes"("question_id", "participant_id");

-- AddForeignKey
ALTER TABLE "vote_tasks" ADD CONSTRAINT "vote_tasks_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_tasks" ADD CONSTRAINT "vote_tasks_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

