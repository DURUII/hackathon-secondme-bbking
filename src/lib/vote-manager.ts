export interface CreateVoteInput {
  questionId: string;
  participantId: string;
  position: number;
  comment: string;
}

export class VoteManager {
  /**
   * Create a new vote
   */
  static async createVote(input: CreateVoteInput) {
    const { db } = await import('@/lib/db');

    return db.vote.upsert({
      where: {
        questionId_participantId: {
          questionId: input.questionId,
          participantId: input.participantId,
        },
      },
      update: {
        position: input.position,
        comment: input.comment,
      },
      create: {
        questionId: input.questionId,
        participantId: input.participantId,
        position: input.position,
        comment: input.comment,
      },
    });
  }

  /**
   * Get all votes for a question
   */
  static async getByQuestionId(questionId: string) {
    const { db } = await import('@/lib/db');

    return db.vote.findMany({
      where: { questionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete all votes for a question
   */
  static async deleteByQuestionId(questionId: string) {
    const { db } = await import('@/lib/db');

    return db.vote.deleteMany({
      where: { questionId },
    });
  }

  /**
   * Aggregate votes for a question
   */
  static async aggregateByQuestionId(questionId: string) {
    const { db } = await import('@/lib/db');

    const votes = await db.vote.findMany({
      where: { questionId },
    });

    const total = votes.length;
    const red = votes.filter((v) => v.position === 1).length;
    const blue = votes.filter((v) => v.position === -1).length;

    // Get top comments for each side
    const redComments = votes
      .filter((v) => v.position === 1)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, 3)
      .map((v) => v.comment);

    const blueComments = votes
      .filter((v) => v.position === -1)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, 3)
      .map((v) => v.comment);

    return {
      total,
      red,
      blue,
      redRatio: total > 0 ? red / total : 0,
      blueRatio: total > 0 ? blue / total : 0,
      topRedComments: redComments,
      topBlueComments: blueComments,
    };
  }
}
