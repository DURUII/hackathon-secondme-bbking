import { NextResponse } from 'next/server';
import { ParticipantManager } from '@/lib/participant-manager';
import { SecondMePollEngine } from '@/lib/secondme-poll-engine';
import { VoteManager } from '@/lib/vote-manager';
import { QuestionManager } from '@/lib/question-manager';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { questionId } = body;

    // Validate questionId
    if (!questionId || typeof questionId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Question ID is required' },
        { status: 400 }
      );
    }

    // Find the question
    const question = await QuestionManager.findById(questionId);
    if (!question) {
      return NextResponse.json(
        { success: false, error: 'Question not found' },
        { status: 404 }
      );
    }

    // Get active participants
    const participants = await ParticipantManager.getActiveParticipants();
    if (participants.length === 0) {
      // No participants, return empty result
      return NextResponse.json({
        success: true,
        data: {
          questionId: question.id,
          totalVotes: 0,
          redRatio: 0,
          blueRatio: 0,
          topRedComments: [],
          topBlueComments: [],
        },
      });
    }

    console.log('[POLL] Starting poll with', participants.length, 'participants');

    // Collect votes from each participant
    let votesCollected = 0;
    let votesFailed = 0;

    for (const participant of participants) {
      try {
        // Get fresh token for participant
        const token = await SecondMePollEngine.getFreshToken(participant.id);

        // If no valid token (mock mode in development), generate mock vote
        if (!token) {
          const mockVote = await SecondMePollEngine.generateMockVote({
            question: question.content,
            arenaType: question.arenaType,
          });

          await VoteManager.createVote({
            questionId: question.id,
            participantId: participant.id,
            position: mockVote.position,
            comment: mockVote.comment,
          });

          await ParticipantManager.updateActivity(participant.id);
          votesCollected++;
          console.log('[POLL] Mock vote from', participant.name, ':', mockVote.position === 1 ? 'RED' : 'BLUE');
          continue;
        }

        // Call SecondMe API for vote
        const voteResult = await SecondMePollEngine.callSecondMeForVote({
          participantToken: token,
          question: question.content,
          arenaType: question.arenaType,
        });

        // Create vote record
        await VoteManager.createVote({
          questionId: question.id,
          participantId: participant.id,
          position: voteResult.position,
          comment: voteResult.comment,
        });

        // Update participant activity
        await ParticipantManager.updateActivity(participant.id);

        votesCollected++;
        console.log('[POLL] Vote collected from', participant.name, ':', voteResult.position === 1 ? 'RED' : 'BLUE');
      } catch (error) {
        console.error('[POLL] Failed to collect vote from participant:', participant.id, error);
        votesFailed++;
        // Continue with other participants
      }
    }

    console.log('[POLL] Poll complete:', votesCollected, 'collected,', votesFailed, 'failed');

    // Aggregate results
    const aggregation = await VoteManager.aggregateByQuestionId(question.id);

    // Update question status
    await QuestionManager.updateStatus(question.id, 'collected');

    return NextResponse.json({
      success: true,
      data: {
        questionId: question.id,
        totalVotes: aggregation.total,
        redRatio: aggregation.redRatio,
        blueRatio: aggregation.blueRatio,
        topRedComments: aggregation.topRedComments,
        topBlueComments: aggregation.topBlueComments,
      },
    });
  } catch (error) {
    console.error('[POLL] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to collect votes' },
      { status: 500 }
    );
  }
}
