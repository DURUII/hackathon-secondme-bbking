import { NextResponse } from 'next/server';
import { DebateEngine } from '@/lib/debate-engine';

export async function POST() {
  try {
    // 1. Try to recruit for pending questions
    const recruitResult = await DebateEngine.processRecruiting();
    
    // 2. Advance debating questions
    const debateResult = await DebateEngine.processDebating();

    return NextResponse.json({
      success: true,
      recruiting: recruitResult,
      debating: debateResult
    });
  } catch (error) {
    console.error('[HEARTBEAT] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Heartbeat failed', details: String(error) },
      { status: 500 }
    );
  }
}
