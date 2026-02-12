import { NextResponse } from 'next/server';
import { DebateEngine } from '@/lib/debate-engine';
import { processVoteTaskBatch } from '@/lib/vote-task-worker';

export async function POST() {
  try {
    // 1. Try to recruit for pending questions
    const recruitResult = await DebateEngine.processRecruiting();
    
    // 2. Advance debating questions
    const debateResult = await DebateEngine.processDebating();
    // 3. Also drain a tiny vote-task batch so Hobby plan can progress without frequent cron.
    const queueResult = await processVoteTaskBatch(2);

    return NextResponse.json({
      success: true,
      recruiting: recruitResult,
      debating: debateResult,
      queue: queueResult
    });
  } catch (error) {
    console.error('[HEARTBEAT] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Heartbeat failed', details: String(error) },
      { status: 500 }
    );
  }
}
