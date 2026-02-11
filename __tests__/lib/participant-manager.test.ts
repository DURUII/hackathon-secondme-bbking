import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParticipantManager } from '@/lib/participant-manager';

// Mock db module
const mockFindMany = vi.fn();
const mockfindUnique = vi.fn();
const mockcreate = vi.fn();
const mockupdate = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    participant: {
      findMany: (...args: any[]) => mockFindMany(...args),
      findUnique: (...args: any[]) => mockfindUnique(...args),
      create: (...args: any[]) => mockcreate(...args),
      update: (...args: any[]) => mockupdate(...args),
    },
  },
}));

describe('ParticipantManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getActiveParticipants', () => {
    it('should return active participants sorted by last active', async () => {
      const mockParticipants = [
        { id: '1', secondmeId: 'sm1', name: 'User1', isActive: true },
        { id: '2', secondmeId: 'sm2', name: 'User2', isActive: true },
      ];

      mockFindMany.mockResolvedValue(mockParticipants);

      const result = await ParticipantManager.getActiveParticipants();

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { lastActiveAt: 'desc' },
      });
      expect(result).toEqual(mockParticipants);
    });

    it('should return empty array when no active participants', async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await ParticipantManager.getActiveParticipants();

      expect(result).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      mockFindMany.mockResolvedValue([]);

      await ParticipantManager.getActiveParticipants({ limit: 5 });

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { lastActiveAt: 'desc' },
        take: 5,
      });
    });
  });

  describe('findBySecondmeId', () => {
    it('should return participant by secondmeId', async () => {
      const mockParticipant = { id: '1', name: 'TestUser', secondmeId: 'sm123' };
      mockfindUnique.mockResolvedValue(mockParticipant);

      const result = await ParticipantManager.findBySecondmeId('sm123');

      expect(mockfindUnique).toHaveBeenCalledWith({
        where: { secondmeId: 'sm123' },
      });
      expect(result).toEqual(mockParticipant);
    });

    it('should return null when participant not found', async () => {
      mockfindUnique.mockResolvedValue(null);

      const result = await ParticipantManager.findBySecondmeId('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createParticipant', () => {
    it('should create a new participant', async () => {
      const newParticipant = {
        id: 'new1',
        secondmeId: 'sm_new',
        name: 'NewUser',
        avatarUrl: null,
        interests: [],
        isActive: true,
        responseCount: 0,
        lastActiveAt: null,
      };

      mockcreate.mockResolvedValue(newParticipant);

      const result = await ParticipantManager.createParticipant({
        secondmeId: 'sm_new',
        name: 'NewUser',
      });

      expect(mockcreate).toHaveBeenCalledWith({
        data: {
          secondmeId: 'sm_new',
          name: 'NewUser',
          avatarUrl: null,
          interests: [],
          isActive: true,
        },
      });
      expect(result).toEqual(newParticipant);
    });

    it('should accept optional fields', async () => {
      const newParticipant = {
        id: 'new1',
        secondmeId: 'sm_new',
        name: 'NewUser',
        avatarUrl: 'https://avatar.url',
        interests: ['tech', 'music'],
        isActive: true,
        responseCount: 0,
      };

      mockcreate.mockResolvedValue(newParticipant);

      await ParticipantManager.createParticipant({
        secondmeId: 'sm_new',
        name: 'NewUser',
        avatarUrl: 'https://avatar.url',
        interests: ['tech', 'music'],
      });

      expect(mockcreate).toHaveBeenCalledWith({
        data: {
          secondmeId: 'sm_new',
          name: 'NewUser',
          avatarUrl: 'https://avatar.url',
          interests: ['tech', 'music'],
          isActive: true,
        },
      });
    });
  });

  describe('updateActivity', () => {
    it('should increment response count and update lastActiveAt', async () => {
      const updatedParticipant = {
        id: '1',
        name: 'User1',
        secondmeId: 'sm1',
        responseCount: 5,
        lastActiveAt: new Date(),
      };

      mockupdate.mockResolvedValue(updatedParticipant);

      const result = await ParticipantManager.updateActivity('1');

      expect(mockupdate).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          responseCount: { increment: 1 },
          lastActiveAt: expect.any(Date),
        },
      });
      expect(result).toEqual(updatedParticipant);
    });
  });
});
