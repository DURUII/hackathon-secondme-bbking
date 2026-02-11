import { db } from '@/lib/db';

export interface CreateParticipantInput {
  secondmeId: string;
  name: string;
  avatarUrl?: string;
  interests?: string[];
}

export interface ParticipantQueryOptions {
  limit?: number;
}

export class ParticipantManager {
  /**
   * Get all active participants sorted by last active time
   */
  static async getActiveParticipants(options?: ParticipantQueryOptions) {
    return db.participant.findMany({
      where: { isActive: true },
      orderBy: { lastActiveAt: 'desc' },
      take: options?.limit,
    });
  }

  /**
   * Find a participant by SecondMe ID
   */
  static async findBySecondmeId(secondmeId: string) {
    return db.participant.findUnique({
      where: { secondmeId },
    });
  }

  /**
   * Create a new participant
   */
  static async createParticipant(input: CreateParticipantInput) {
    return db.participant.create({
      data: {
        secondmeId: input.secondmeId,
        name: input.name,
        avatarUrl: input.avatarUrl ?? null,
        interests: input.interests ?? [],
        isActive: true,
      },
    });
  }

  /**
   * Update participant activity (increment response count, update last active)
   */
  static async updateActivity(participantId: string) {
    return db.participant.update({
      where: { id: participantId },
      data: {
        responseCount: { increment: 1 },
        lastActiveAt: new Date(),
      },
    });
  }

  /**
   * Deactivate a participant
   */
  static async deactivate(participantId: string) {
    return db.participant.update({
      where: { id: participantId },
      data: { isActive: false },
    });
  }
}
