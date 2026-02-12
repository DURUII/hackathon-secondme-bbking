import { db } from "@/lib/db";

const TASK_STATUS = {
  pending: "pending",
  running: "running",
  done: "done",
  failed: "failed",
} as const;

function computeBackoffMs(attempts: number) {
  const base = 15_000; // 15s
  const max = 15 * 60_000; // 15m
  return Math.min(base * 2 ** Math.max(0, attempts - 1), max);
}

export class VoteTaskManager {
  static async enqueue(questionId: string, participantId: string) {
    const existing = await db.voteTask.findUnique({
      where: { questionId_participantId: { questionId, participantId } },
    });

    if (!existing) {
      return db.voteTask.create({
        data: {
          questionId,
          participantId,
          status: TASK_STATUS.pending,
        },
      });
    }

    if (existing.status === TASK_STATUS.done) return existing;

    return db.voteTask.update({
      where: { id: existing.id },
      data: {
        status: TASK_STATUS.pending,
        nextRetryAt: null,
      },
    });
  }

  static async enqueueForQuestion(questionId: string, participantIds: string[]) {
    if (participantIds.length === 0) return { enqueued: 0 };
    let enqueued = 0;
    for (const participantId of participantIds) {
      await this.enqueue(questionId, participantId);
      enqueued++;
    }
    return { enqueued };
  }

  static async enqueueForParticipant(participantId: string, questionIds: string[]) {
    if (questionIds.length === 0) return { enqueued: 0 };
    let enqueued = 0;
    for (const questionId of questionIds) {
      await this.enqueue(questionId, participantId);
      enqueued++;
    }
    return { enqueued };
  }

  static async claimPending(limit: number) {
    const candidates = await db.voteTask.findMany({
      where: {
        status: TASK_STATUS.pending,
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    const claimed: typeof candidates = [];
    for (const task of candidates) {
      const res = await db.voteTask.updateMany({
        where: { id: task.id, status: TASK_STATUS.pending },
        data: { status: TASK_STATUS.running },
      });
      if (res.count === 1) claimed.push(task);
    }
    return claimed;
  }

  static async markDone(id: string) {
    return db.voteTask.update({
      where: { id },
      data: {
        status: TASK_STATUS.done,
        lastError: null,
        nextRetryAt: null,
      },
    });
  }

  static async markRetry(id: string, error: string, attempts: number, maxAttempts = 5) {
    if (attempts >= maxAttempts) {
      return db.voteTask.update({
        where: { id },
        data: {
          status: TASK_STATUS.failed,
          attempts,
          lastError: error.slice(0, 500),
          nextRetryAt: null,
        },
      });
    }

    const nextRetryAt = new Date(Date.now() + computeBackoffMs(attempts));
    return db.voteTask.update({
      where: { id },
      data: {
        status: TASK_STATUS.pending,
        attempts,
        lastError: error.slice(0, 500),
        nextRetryAt,
      },
    });
  }

  static async getStats() {
    const [pending, running, done, failed] = await Promise.all([
      db.voteTask.count({ where: { status: TASK_STATUS.pending } }),
      db.voteTask.count({ where: { status: TASK_STATUS.running } }),
      db.voteTask.count({ where: { status: TASK_STATUS.done } }),
      db.voteTask.count({ where: { status: TASK_STATUS.failed } }),
    ]);

    return { pending, running, done, failed };
  }
}
