import { NextResponse } from 'next/server';
import { getUserFromToken, getOrCreateParticipant } from '@/lib/auth-helper';
import { QuestionManager } from '@/lib/question-manager';
import { VoteManager } from '@/lib/vote-manager';
import { db } from '@/lib/db';
import { VoteTaskManager } from '@/lib/vote-task-manager';
import { SecondMePollEngine } from '@/lib/secondme-poll-engine';

const VALID_ARENA_TYPES = ['toxic', 'comfort', 'rational'];
const QUESTION_FANOUT_LIMIT = 50;

export async function POST(request: Request) {
  try {
    // Authenticate user
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { content, arenaType = 'toxic', imageUrl } = body;

    // Validate content
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Content is required' },
        { status: 400 }
      );
    }

    // Validate arenaType
    const normalizedArenaType = arenaType?.toLowerCase() ?? 'toxic';
    if (!VALID_ARENA_TYPES.includes(normalizedArenaType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid arena type' },
        { status: 400 }
      );
    }

    console.log('[PUBLISH] Creating question for user:', user.id);

    // Create question
    const question = await QuestionManager.createQuestion({
      userId: user.id,
      content: content.trim(),
      arenaType: normalizedArenaType,
      imageUrl: imageUrl ?? undefined,
    });

    console.log('[PUBLISH] Question created:', {
      id: question.id,
      arenaType: normalizedArenaType,
    });

    // Immediately have user's AI分身 cast one structured vote on their own question.
    let selfParticipantId: string | null = null;
    try {
      const participant = await getOrCreateParticipant(user);
      selfParticipantId = participant.id;
      const voteResult = await SecondMePollEngine.callSecondMeForVote({
        participantToken: user.accessToken,
        question: content.trim(),
        arenaType: normalizedArenaType,
      });

      await VoteManager.createVote({
        questionId: question.id,
        participantId: participant.id,
        position: voteResult.position,
        comment: voteResult.comment,
      });

      console.log('[PUBLISH] AI vote cast:', voteResult);
    } catch (voteError) {
      console.error('[PUBLISH] Failed to cast AI vote:', voteError);
      // Don't fail the publish if voting fails
    }

    // Queue async votes for other active participants.
    try {
      const participants = await db.participant.findMany({
        where: {
          isActive: true,
          ...(selfParticipantId ? { id: { not: selfParticipantId } } : {}),
        },
        select: { id: true },
        take: QUESTION_FANOUT_LIMIT,
      });
      const participantIds = participants.map((p) => p.id);
      const queueResult = await VoteTaskManager.enqueueForQuestion(question.id, participantIds);
      console.log('[PUBLISH] vote_tasks enqueued:', {
        questionId: question.id,
        participants: participantIds.length,
        enqueued: queueResult.enqueued,
      });
    } catch (queueError) {
      console.error('[PUBLISH] Failed to enqueue vote tasks:', queueError);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: question.id,
        content: question.content,
        arenaType: question.arenaType,
        imageUrl: question.imageUrl,
        status: question.status,
        createdAt: question.createdAt,
      },
    });
  } catch (error) {
    console.error('[PUBLISH] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to publish question', details: String(error) },
      { status: 500 }
    );
  }
}
