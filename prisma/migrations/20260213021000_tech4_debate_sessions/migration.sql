-- TECH4: DebateSession + AudienceVote* + DebateSeat and migrate debate_turns to session-based timeline.
-- NOTE: We intentionally truncate old debate_turns rows since the schema is incompatible and this is hackathon MVP.

-- DropForeignKey
ALTER TABLE "debate_turns" DROP CONSTRAINT "debate_turns_question_id_fkey";

-- DropForeignKey
ALTER TABLE "debate_turns" DROP CONSTRAINT "debate_turns_speaker_id_fkey";

-- Prevent NOT NULL violations on new columns.
TRUNCATE TABLE "debate_turns";

-- AlterTable
ALTER TABLE "debate_turns"
  DROP COLUMN "question_id",
  DROP COLUMN "round",
  DROP COLUMN "speaker_id",
  DROP COLUMN "voteSwing",
  ADD COLUMN "meta" JSONB,
  ADD COLUMN "seq" INTEGER NOT NULL,
  ADD COLUMN "session_id" TEXT NOT NULL,
  ADD COLUMN "speaker_participant_id" TEXT,
  ADD COLUMN "speaker_seat" TEXT;

-- CreateTable
CREATE TABLE "debate_sessions" (
  "id" TEXT NOT NULL,
  "question_id" TEXT NOT NULL,
  "initiator_user_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECRUITING',
  "next_turn_at" TIMESTAMP(3),
  "seq" INTEGER NOT NULL DEFAULT 1,
  "cross_exam_enabled" BOOLEAN,
  "cross_exam_first_side" TEXT,
  "winner_side" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMP(3),
  "aborted_at" TIMESTAMP(3),

  CONSTRAINT "debate_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debate_seats" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "seat" TEXT NOT NULL,
  "participant_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "debate_seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audience_vote_events" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "position" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audience_vote_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audience_vote_snapshots" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "opening_position" TEXT NOT NULL,
  "current_position" TEXT NOT NULL,
  "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "audience_vote_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "debate_sessions_question_id_idx" ON "debate_sessions"("question_id");

-- CreateIndex
CREATE INDEX "debate_sessions_status_next_turn_at_idx" ON "debate_sessions"("status", "next_turn_at");

-- CreateIndex
CREATE UNIQUE INDEX "debate_sessions_question_id_initiator_user_id_key"
ON "debate_sessions"("question_id", "initiator_user_id");

-- CreateIndex
CREATE INDEX "debate_seats_participant_id_idx" ON "debate_seats"("participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "debate_seats_session_id_seat_key" ON "debate_seats"("session_id", "seat");

-- CreateIndex
CREATE INDEX "audience_vote_events_session_id_created_at_idx" ON "audience_vote_events"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "audience_vote_events_user_id_created_at_idx" ON "audience_vote_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audience_vote_snapshots_session_id_idx" ON "audience_vote_snapshots"("session_id");

-- CreateIndex
CREATE INDEX "audience_vote_snapshots_user_id_idx" ON "audience_vote_snapshots"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "audience_vote_snapshots_session_id_user_id_key"
ON "audience_vote_snapshots"("session_id", "user_id");

-- CreateIndex
CREATE INDEX "debate_turns_session_id_idx" ON "debate_turns"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "debate_turns_session_id_seq_key" ON "debate_turns"("session_id", "seq");

-- AddForeignKey
ALTER TABLE "debate_sessions"
  ADD CONSTRAINT "debate_sessions_question_id_fkey"
  FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_sessions"
  ADD CONSTRAINT "debate_sessions_initiator_user_id_fkey"
  FOREIGN KEY ("initiator_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_seats"
  ADD CONSTRAINT "debate_seats_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "debate_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_seats"
  ADD CONSTRAINT "debate_seats_participant_id_fkey"
  FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_turns"
  ADD CONSTRAINT "debate_turns_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "debate_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_turns"
  ADD CONSTRAINT "debate_turns_speaker_participant_id_fkey"
  FOREIGN KEY ("speaker_participant_id") REFERENCES "participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_vote_events"
  ADD CONSTRAINT "audience_vote_events_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "debate_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_vote_events"
  ADD CONSTRAINT "audience_vote_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_vote_snapshots"
  ADD CONSTRAINT "audience_vote_snapshots_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "debate_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_vote_snapshots"
  ADD CONSTRAINT "audience_vote_snapshots_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

