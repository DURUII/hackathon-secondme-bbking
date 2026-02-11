import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SecondMePollEngine } from '@/lib/secondme-poll-engine';
import { VoteManager } from '@/lib/vote-manager';
import { ParticipantManager } from '@/lib/participant-manager';

export const dynamic = 'force-dynamic'; // Prevent caching
export const maxDuration = 60; // Allow 60s execution (Pro plan) or 10s (Hobby)

export async function GET(request: Request) {
  try {
    // 1. Verify Authentication (Vercel Cron Header)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
      // Allow bypassing in development or if CRON_SECRET is not set
      if (process.env.CRON_SECRET) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    console.log('[CRON] Starting sync...');

    // 2. Fetch Active Questions (Recent 5)
    // We only care about recent questions to save resources
    const recentQuestions = await db.question.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        votes: {
          select: { participantId: true }
        }
      }
    });

    // 3. Fetch Active Participants
    const participants = await db.participant.findMany({
      where: { isActive: true },
      take: 50 // Limit participants to check
    });

    let operationsCount = 0;
    const MAX_OPERATIONS = 5; // Strict limit to prevent timeouts

    // 4. Find Missing Votes
    for (const question of recentQuestions) {
      if (operationsCount >= MAX_OPERATIONS) break;

      // Get set of participant IDs who already voted
      const votedParticipantIds = new Set(question.votes.map(v => v.participantId).filter(Boolean));

      // Find participants who haven't voted
      const missingParticipants = participants.filter(p => !votedParticipantIds.has(p.id));

      for (const participant of missingParticipants) {
        if (operationsCount >= MAX_OPERATIONS) break;

        try {
          console.log(`[CRON] Generating vote for Question ${question.id.slice(0,4)} from ${participant.name}`);
          
          // Get token (or mock)
          const token = await SecondMePollEngine.getFreshToken(participant.id);
          
          let voteResult;
          if (!token) {
             voteResult = await SecondMePollEngine.generateMockVote({
               question: question.content,
               arenaType: question.arenaType
             });
          } else {
             voteResult = await SecondMePollEngine.callSecondMeForVote({
               participantToken: token,
               question: question.content,
               arenaType: question.arenaType
             });
          }

          await VoteManager.createVote({
            questionId: question.id,
            participantId: participant.id,
            position: voteResult.position,
            comment: voteResult.comment
          });

          await ParticipantManager.updateActivity(participant.id);
          operationsCount++;

          // Tiny delay
          await new Promise(r => setTimeout(r, 200));

        } catch (err) {
          console.error('[CRON] Failed to vote:', err);
        }
      }
    }

    console.log(`[CRON] Sync complete. Processed ${operationsCount} votes.`);

    return NextResponse.json({
      success: true,
      data: {
        processed: operationsCount,
        activeQuestions: recentQuestions.length,
        activeParticipants: participants.length
      }
    });

  } catch (error) {
    console.error('[CRON] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
