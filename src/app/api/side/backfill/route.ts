import { NextResponse } from 'next/server';
import { getUserFromToken, getOrCreateParticipant } from '@/lib/auth-helper';
import { db } from '@/lib/db';
import { SecondMePollEngine } from '@/lib/secondme-poll-engine';
import { VoteManager } from '@/lib/vote-manager';
import { ParticipantManager } from '@/lib/participant-manager';

export async function POST() {
  try {
    // 1. Authenticate & Get Participant
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const participant = await getOrCreateParticipant(user);

    // 2. Find recent questions NOT voted by this participant
    // Prisma doesn't support "where not in" relations easily in one go without raw query or separate fetch
    // We'll fetch recent questions and their votes, then filter in memory for MVP simplicity (assuming < 100 questions)
    const recentQuestions = await db.question.findMany({
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

    if (questionsToVote.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending questions to vote on', data: { votedCount: 0 } });
    }

    console.log(`[BACKFILL] Participant ${participant.name} needs to vote on ${questionsToVote.length} questions`);

    // 3. Vote on each question
    let votedCount = 0;
    const token = await SecondMePollEngine.getFreshToken(participant.id);

    // Run in sequence to avoid rate limits, or parallel if confident
    for (const question of questionsToVote) {
      try {
        let voteResult;
        
        if (!token) {
           // Mock vote
           voteResult = await SecondMePollEngine.generateMockVote({
             question: question.content,
             arenaType: question.arenaType
           });
           console.log(`[BACKFILL] Mock vote for ${question.id}:`, voteResult.position);
        } else {
           // Real vote
           voteResult = await SecondMePollEngine.callSecondMeForVote({
             participantToken: token,
             question: question.content,
             arenaType: question.arenaType
           });
           console.log(`[BACKFILL] Real vote for ${question.id}:`, voteResult.position);
        }

        await VoteManager.createVote({
          questionId: question.id,
          participantId: participant.id,
          position: voteResult.position,
          comment: voteResult.comment
        });

        votedCount++;
        
        // Small delay to be nice to APIs
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err) {
        console.error(`[BACKFILL] Failed to vote on ${question.id}`, err);
      }
    }

    // Update activity
    if (votedCount > 0) {
      await ParticipantManager.updateActivity(participant.id);
    }

    return NextResponse.json({
      success: true,
      data: {
        votedCount,
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
