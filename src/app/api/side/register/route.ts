import { NextResponse } from 'next/server';
import { getUserFromToken, getOrCreateParticipant } from '@/lib/auth-helper';

export async function POST() {
  try {
    // Get authenticated user
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Register or update participant
    const participant = await getOrCreateParticipant(user);

    console.log('[REGISTER] Participant registered:', {
      id: participant.id,
      secondmeId: participant.secondmeId,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: participant.id,
        name: participant.name,
        isActive: participant.isActive,
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
