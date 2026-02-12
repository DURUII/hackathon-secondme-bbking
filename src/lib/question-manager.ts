export interface CreateQuestionInput {
  userId?: string | null;
  content: string;
  arenaType?: string;
  imageUrl?: string;
  status?: string;
}

export class QuestionManager {
  /**
   * Create a new question
   */
  static async createQuestion(input: CreateQuestionInput) {
    const { db } = await import('@/lib/db');

    return db.question.create({
      data: {
        userId: input.userId,
        content: input.content,
        arenaType: input.arenaType ?? 'toxic',
        imageUrl: input.imageUrl ?? null,
        status: input.status ?? 'pending',
      },
    });
  }

  /**
   * Find question by ID
   */
  static async findById(id: string) {
    const { db } = await import('@/lib/db');

    return db.question.findFirst({
      where: { id, deletedAt: null },
      include: {
        votes: true,
      },
    });
  }

  /**
   * Get questions by user
   */
  static async getByUserId(userId: string, limit = 10) {
    const { db } = await import('@/lib/db');

    return db.question.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Update question status
   */
  static async updateStatus(id: string, status: string) {
    const { db } = await import('@/lib/db');

    return db.question.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Delete question
   */
  static async delete(id: string) {
    const { db } = await import('@/lib/db');

    return db.question.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
