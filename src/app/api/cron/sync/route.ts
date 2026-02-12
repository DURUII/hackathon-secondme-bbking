import { NextResponse } from 'next/server';
import { processVoteTaskBatch } from '@/lib/vote-task-worker';

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

    console.log('[CRON] Starting queue sync...');
    const data = await processVoteTaskBatch(20);
    console.log(
      `[CRON] Queue sync complete. claimed=${data.claimed}, processed=${data.processed}, failed=${data.failed}, skipped=${data.skipped}`
    );

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('[CRON] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
