import { NextResponse } from 'next/server';
import { getUserFromToken, getOrCreateParticipant } from '@/lib/auth-helper';
import { db } from '@/lib/db';
import { VoteTaskManager } from '@/lib/vote-task-manager';

export async function POST() {
  try {
    // 1. Authenticate & Get Participant
    const user = await getUserFromToken();
    if (!user) {
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
      return NextResponse.json({ success: true, message: 'No pending questions to queue', data: { queuedCount: 0 } });
    }

    console.log(`[BACKFILL] Queueing ${questionIds.length} tasks for ${participant.name}`);
    const queueResult = await VoteTaskManager.enqueueForParticipant(participant.id, questionIds);

    return NextResponse.json({
      success: true,
      data: {
        queuedCount: queueResult.enqueued,
        questionsProcessed: questionsToVote.length
      }
    });

  } catch (error) {
    console.error('[BACKFILL] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to backfill votes' },
      { status: 500 }
    );
  }
}
