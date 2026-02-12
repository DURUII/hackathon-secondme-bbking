CREATE TABLE "question_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "question_subscriptions_user_id_question_id_key" ON "question_subscriptions"("user_id", "question_id");
CREATE INDEX "question_subscriptions_user_id_idx" ON "question_subscriptions"("user_id");
CREATE INDEX "question_subscriptions_question_id_idx" ON "question_subscriptions"("question_id");

ALTER TABLE "question_subscriptions" ADD CONSTRAINT "question_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_subscriptions" ADD CONSTRAINT "question_subscriptions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
