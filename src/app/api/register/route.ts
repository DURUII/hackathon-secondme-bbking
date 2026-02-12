import { NextResponse } from 'next/server';
import { getUserFromToken, getOrCreateParticipant } from '@/lib/auth-helper';
import { db } from '@/lib/db';
import { VoteTaskManager } from '@/lib/vote-task-manager';

const RECENT_QUESTION_LIMIT = 20;
const RECENT_WINDOW_HOURS = 72;

export async function POST() {
  try {
    // Get authenticated user
    const user = await getUserFromToken();
    if (!user) {
      console.warn('[REGISTER] Unauthorized: getUserFromToken returned null');
      return NextResponse.json(
        { success: false, error: 'Unauthorized', details: 'Could not fetch user info from SecondMe or DB' },
        { status: 401 }
      );
    }

    // Register or update participant
    const participant = await getOrCreateParticipant(user);

    // Queue this participant to vote on recent questions (async eventual consistency).
    const recentSince = new Date(Date.now() - RECENT_WINDOW_HOURS * 60 * 60 * 1000);
    const recentQuestions = await db.question.findMany({
      where: { createdAt: { gte: recentSince } },
      orderBy: { createdAt: 'desc' },
      take: RECENT_QUESTION_LIMIT,
      select: { id: true },
    });
    const questionIds = recentQuestions.map((q) => q.id);
    const queueResult = await VoteTaskManager.enqueueForParticipant(participant.id, questionIds);

    console.log('[REGISTER] Participant registered:', {
      id: participant.id,
      secondmeId: participant.secondmeId,
      queuedTasks: queueResult.enqueued,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: participant.id,
        name: participant.name,
        isActive: participant.isActive,
        queuedTasks: queueResult.enqueued,
      },
    });
  } catch (error) {
    console.error('[REGISTER] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to register' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const participant = await getOrCreateParticipant(user);

    return NextResponse.json({
      success: true,
      data: {
        id: participant.id,
        name: participant.name,
        isActive: participant.isActive,
        responseCount: participant.responseCount,
      },
    });
  } catch (error) {
    console.error('[REGISTER] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get participant info' },
      { status: 500 }
    );
  }
}
