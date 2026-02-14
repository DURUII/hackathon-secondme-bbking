import { NextResponse } from 'next/server';
import { getUserFromToken, getOrCreateParticipant } from '@/lib/auth-helper';
import { db } from '@/lib/db';
import { VoteTaskManager } from '@/lib/vote-task-manager';
import { getReqLogContext, logApiBegin, logApiEnd, logApiError, logEvent } from "@/lib/obs/server-log";

const RECENT_QUESTION_LIMIT = 20;
const RECENT_WINDOW_HOURS = 72;

export async function POST(req: Request) {
  const ctx = getReqLogContext(req);
  const t0 = Date.now();
  logApiBegin(ctx, "api.register", {});
  try {
    // Get authenticated user
    const user = await getUserFromToken();
    if (!user) {
      logEvent("warn", "api.register.unauthorized", { requestId: ctx.requestId, clientTraceId: ctx.clientTraceId });
      return NextResponse.json(
        { success: false, error: 'Unauthorized', details: 'Could not fetch user info from SecondMe or DB' },
        { status: 401 }
      );
    }

    // Register or update participant
    const participant = await getOrCreateParticipant(user);

    // Queue this participant to vote on recent questions (async eventual consistency).
    const recentSince = new Date(Date.now() - RECENT_WINDOW_HOURS * 60 * 60 * 1000);
    const recentQuestions = await db.question.findMany({
      where: { createdAt: { gte: recentSince }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: RECENT_QUESTION_LIMIT,
      select: { id: true },
    });
    const questionIds = recentQuestions.map((q) => q.id);
    const queueResult = await VoteTaskManager.enqueueForParticipant(participant.id, questionIds);

    logApiEnd(ctx, "api.register", {
      status: 200,
      dur_ms: Date.now() - t0,
      participantId: participant.id,
      queuedTasks: queueResult.enqueued,
    });

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        id: participant.id,
        name: participant.name,
        isActive: participant.isActive,
        queuedTasks: queueResult.enqueued,
      },
    });
  } catch (error) {
    logApiError(ctx, "api.register", { dur_ms: Date.now() - t0, status: 500 }, error);
    return NextResponse.json(
      { success: false, error: 'Failed to register' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const ctx = getReqLogContext(req);
  const t0 = Date.now();
  logApiBegin(ctx, "api.register_get", {});
  try {
    const user = await getUserFromToken();
    if (!user) {
      logApiEnd(ctx, "api.register_get", { status: 401, dur_ms: Date.now() - t0 });
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const participant = await getOrCreateParticipant(user);

    logApiEnd(ctx, "api.register_get", { status: 200, dur_ms: Date.now() - t0, participantId: participant.id });
    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        id: participant.id,
        name: participant.name,
        isActive: participant.isActive,
        responseCount: participant.responseCount,
      },
    });
  } catch (error) {
    logApiError(ctx, "api.register_get", { dur_ms: Date.now() - t0, status: 500 }, error);
    return NextResponse.json(
      { success: false, error: 'Failed to get participant info' },
      { status: 500 }
    );
  }
}
