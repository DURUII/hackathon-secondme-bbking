import { NextResponse } from 'next/server';
import { getUserFromToken, getOrCreateParticipant } from '@/lib/auth-helper';
import { db } from '@/lib/db';
import { VoteTaskManager } from '@/lib/vote-task-manager';
import { getReqLogContext, logApiBegin, logApiEnd, logApiError } from "@/lib/obs/server-log";

export async function POST(req: Request) {
  const ctx = getReqLogContext(req);
  const t0 = Date.now();
  logApiBegin(ctx, "api.backfill", {});
  try {
    // 1. Authenticate & Get Participant
    const user = await getUserFromToken();
    if (!user) {
      logApiEnd(ctx, "api.backfill", { status: 401, dur_ms: Date.now() - t0 });
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const participant = await getOrCreateParticipant(user);

    // 2. Find recent questions NOT voted by this participant
    const recentQuestions = await db.question.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10, // Limit to last 10 questions to avoid overloading
      include: {
        votes: {
          where: { participantId: participant.id },
          select: { id: true }
        }
      }
    });

    const questionsToVote = recentQuestions.filter(q => q.votes.length === 0);
    const questionIds = questionsToVote.map((q) => q.id);

    if (questionsToVote.length === 0) {
      logApiEnd(ctx, "api.backfill", { status: 200, dur_ms: Date.now() - t0, queuedCount: 0 });
      return NextResponse.json({ success: true, message: 'No pending questions to queue', data: { queuedCount: 0 } });
    }

    const queueResult = await VoteTaskManager.enqueueForParticipant(participant.id, questionIds);

    logApiEnd(ctx, "api.backfill", {
      status: 200,
      dur_ms: Date.now() - t0,
      queuedCount: queueResult.enqueued,
      questionsProcessed: questionsToVote.length,
      participantId: participant.id,
    });
    return NextResponse.json({
      success: true,
      data: {
        queuedCount: queueResult.enqueued,
        questionsProcessed: questionsToVote.length
      }
    });

  } catch (error) {
    logApiError(ctx, "api.backfill", { dur_ms: Date.now() - t0, status: 500 }, error);
    return NextResponse.json(
      { success: false, error: 'Failed to backfill votes' },
      { status: 500 }
    );
  }
}
