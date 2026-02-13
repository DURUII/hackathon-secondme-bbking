import { NextResponse } from 'next/server';
import { DebateEngine } from '@/lib/debate-engine';
import { processVoteTaskBatch } from '@/lib/vote-task-worker';

export async function POST(request: Request) {
  try {
    // Verify Authentication (Cron Secret). This endpoint must not be called by browsers.
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
      if (process.env.CRON_SECRET) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    // 1. Advance debate sessions (Session-based state machine)
    const debateResult = await DebateEngine.processDueSessions(3);

    // 2. Also drain a tiny vote-task batch so Hobby plan can progress without frequent cron.
    const queueResult = await processVoteTaskBatch(2);

    return NextResponse.json({
      success: true,
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
