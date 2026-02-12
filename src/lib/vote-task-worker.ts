import { db } from "@/lib/db";
import { ParticipantManager } from "@/lib/participant-manager";
import { SecondMePollEngine } from "@/lib/secondme-poll-engine";
import { VoteTaskManager } from "@/lib/vote-task-manager";
import { VoteManager } from "@/lib/vote-manager";

export async function processVoteTaskBatch(limit: number) {
  const tasks = await VoteTaskManager.claimPending(limit);

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const task of tasks) {
    try {
      const [question, participant, existingVote] = await Promise.all([
        db.question.findUnique({ where: { id: task.questionId } }),
        db.participant.findUnique({ where: { id: task.participantId } }),
        db.vote.findFirst({
          where: {
            questionId: task.questionId,
            participantId: task.participantId,
          },
          select: { id: true },
        }),
      ]);

      if (!question || !participant) {
        await VoteTaskManager.markRetry(task.id, "Question or participant not found", task.attempts + 1, 1);
        failed++;
        continue;
      }

      if (existingVote) {
        await VoteTaskManager.markDone(task.id);
        skipped++;
        continue;
      }

      const token = await SecondMePollEngine.getFreshToken(participant.id);
      const voteResult = token
        ? await SecondMePollEngine.callSecondMeForVote({
            participantToken: token,
            question: question.content,
            arenaType: question.arenaType,
          })
        : await SecondMePollEngine.generateMockVote({
            question: question.content,
            arenaType: question.arenaType,
          });

      await VoteManager.createVote({
        questionId: question.id,
        participantId: participant.id,
        position: voteResult.position,
        comment: voteResult.comment,
      });
      await ParticipantManager.updateActivity(participant.id);
      await VoteTaskManager.markDone(task.id);
      processed++;
    } catch (err) {
      failed++;
      await VoteTaskManager.markRetry(task.id, String(err), task.attempts + 1);
      console.error("[VoteTaskWorker] Failed task:", task.id, err);
    }
  }

  const queueStats = await VoteTaskManager.getStats();

  return {
    claimed: tasks.length,
    processed,
    failed,
    skipped,
    queue: queueStats,
  };
}
