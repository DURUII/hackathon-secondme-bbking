import { NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-helper';
import { QuestionManager } from '@/lib/question-manager';

const VALID_ARENA_TYPES = ['toxic', 'comfort', 'rational'];

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
      { success: false, error: 'Failed to publish question' },
      { status: 500 }
    );
  }
}
