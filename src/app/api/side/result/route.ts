import { NextResponse } from 'next/server';
import { QuestionManager } from '@/lib/question-manager';
import { VoteManager } from '@/lib/vote-manager';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get('qid');

    // Validate questionId
    if (!questionId) {
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

    // If not yet collected, return pending status
    if (question.status !== 'collected') {
      return NextResponse.json({
        success: true,
        data: {
          questionId: question.id,
          content: question.content,
          arenaType: question.arenaType,
          status: question.status,
          totalVotes: 0,
          redRatio: 0,
          blueRatio: 0,
          topRedComments: [],
          topBlueComments: [],
        },
      });
    }

    // Aggregate votes
    const aggregation = await VoteManager.aggregateByQuestionId(questionId);

    return NextResponse.json({
      success: true,
      data: {
        questionId: question.id,
        content: question.content,
        arenaType: question.arenaType,
        status: question.status,
        createdAt: question.createdAt,
        totalVotes: aggregation.total,
        redRatio: aggregation.redRatio,
        blueRatio: aggregation.blueRatio,
        topRedComments: aggregation.topRedComments,
        topBlueComments: aggregation.topBlueComments,
      },
    });
  } catch (error) {
    console.error('[RESULT] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get result' },
      { status: 500 }
    );
  }
}
