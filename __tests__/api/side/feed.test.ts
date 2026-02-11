
import { describe, it, expect, vi } from 'vitest';
import { GET } from '@/app/api/feed/route';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    question: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    participant: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    }
  },
}));

// Mock QuestionManager, VoteManager
vi.mock('@/lib/question-manager', () => ({
  QuestionManager: {
    createQuestion: vi.fn(),
  }
}));

vi.mock('@/lib/vote-manager', () => ({
  VoteManager: {
    createVote: vi.fn(),
  }
}));

describe('GET /api/side/feed', () => {
  it('should return feed items and stats', async () => {
    // Mock db responses
    (db.question.count as any).mockResolvedValue(5); // 5 questions
    (db.participant.count as any).mockResolvedValue(10); // 10 participants
    
    (db.question.findMany as any).mockResolvedValue([
      {
        id: 'q1',
        content: 'Test Question',
        createdAt: new Date(),
        userId: 'u1',
        votes: [],
        arenaType: 'toxic',
        status: 'collected'
      }
    ]);
    
    (db.participant.findMany as any).mockResolvedValue([]);

    const response = await GET();
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.stats).toBeDefined();
    expect(json.stats.totalParticipants).toBe(10);
    expect(json.stats.totalQuestions).toBe(5);
  });
});
