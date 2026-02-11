import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies at the top level
const mockFindQuestion = vi.fn();
const mockGetActiveParticipants = vi.fn();
const mockCallSecondMeForVote = vi.fn();
const mockCreateVote = vi.fn();
const mockUpdateActivity = vi.fn();
const mockAggregateByQuestionId = vi.fn();
const mockUpdateStatus = vi.fn();
const mockGetFreshToken = vi.fn();

// Mock modules before importing
vi.mock('@/lib/question-manager', () => ({
  QuestionManager: {
    findById: mockFindQuestion,
    updateStatus: mockUpdateStatus,
  },
}));

vi.mock('@/lib/participant-manager', () => ({
  ParticipantManager: {
    getActiveParticipants: mockGetActiveParticipants,
    updateActivity: mockUpdateActivity,
  },
}));

vi.mock('@/lib/secondme-poll-engine', () => ({
  SecondMePollEngine: {
    callSecondMeForVote: mockCallSecondMeForVote,
    getFreshToken: mockGetFreshToken,
  },
}));

vi.mock('@/lib/vote-manager', () => ({
  VoteManager: {
    createVote: mockCreateVote,
    aggregateByQuestionId: mockAggregateByQuestionId,
  },
}));

// Import after mocking
const { POST } = await import('@/app/api/side/poll/route');

describe('POST /api/side/poll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should collect votes from participants', async () => {
    const mockQuestion = {
      id: 'q1',
      content: '相亲男让我AA',
      arenaType: 'toxic',
      status: 'pending',
    };

    const mockParticipants = [
      { id: 'p1', secondmeId: 'sm1', name: 'User1' },
      { id: 'p2', secondmeId: 'sm2', name: 'User2' },
    ];

    mockFindQuestion.mockResolvedValue(mockQuestion);
    mockGetActiveParticipants.mockResolvedValue(mockParticipants);
    mockGetFreshToken.mockResolvedValue('token1').mockResolvedValueOnce('token2');

    // First participant votes red
    mockCallSecondMeForVote.mockResolvedValueOnce({
      position: 1,
      comment: '转给他，别惯着',
    });
    mockCreateVote.mockResolvedValueOnce({});
    mockUpdateActivity.mockResolvedValue({});

    // Second participant votes blue
    mockCallSecondMeForVote.mockResolvedValueOnce({
      position: -1,
      comment: '算了，别计较',
    });
    mockCreateVote.mockResolvedValueOnce({});
    mockUpdateActivity.mockResolvedValue({});

    mockAggregateByQuestionId.mockResolvedValue({
      total: 2,
      red: 1,
      blue: 1,
      redRatio: 0.5,
      blueRatio: 0.5,
      topRedComments: ['转给他，别惯着'],
      topBlueComments: ['算了，别计较'],
    });

    const request = new Request('http://localhost/api/side/poll', {
      method: 'POST',
      body: JSON.stringify({ questionId: 'q1' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.questionId).toBe('q1');
    expect(data.data.redRatio).toBe(0.5);
    expect(data.data.blueRatio).toBe(0.5);
    expect(data.data.totalVotes).toBe(2);
  });

  it('should return 404 when question not found', async () => {
    mockFindQuestion.mockResolvedValue(null);

    const request = new Request('http://localhost/api/side/poll', {
      method: 'POST',
      body: JSON.stringify({ questionId: 'nonexistent' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Question not found');
  });

  it('should return empty result when no participants', async () => {
    const mockQuestion = {
      id: 'q1',
      content: 'test',
      arenaType: 'toxic',
      status: 'pending',
    };

    mockFindQuestion.mockResolvedValue(mockQuestion);
    mockGetActiveParticipants.mockResolvedValue([]);

    const request = new Request('http://localhost/api/side/poll', {
      method: 'POST',
      body: JSON.stringify({ questionId: 'q1' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.totalVotes).toBe(0);
    expect(data.data.redRatio).toBe(0);
    expect(data.data.blueRatio).toBe(0);
  });

  it('should skip participant when SecondMe API fails', async () => {
    const mockQuestion = {
      id: 'q1',
      content: 'test',
      arenaType: 'toxic',
      status: 'pending',
    };

    const mockParticipants = [
      { id: 'p1', secondmeId: 'sm1', name: 'User1' },
      { id: 'p2', secondmeId: 'sm2', name: 'User2' },
    ];

    mockFindQuestion.mockResolvedValue(mockQuestion);
    mockGetActiveParticipants.mockResolvedValue(mockParticipants);
    mockGetFreshToken.mockResolvedValue('token1').mockResolvedValueOnce('token2');

    // First participant API fails
    mockCallSecondMeForVote.mockRejectedValueOnce(new Error('API error'));
    mockUpdateActivity.mockResolvedValue({});

    // Second participant succeeds
    mockCallSecondMeForVote.mockResolvedValueOnce({
      position: 1,
      comment: '投票成功',
    });
    mockCreateVote.mockResolvedValueOnce({});
    mockUpdateActivity.mockResolvedValue({});

    mockAggregateByQuestionId.mockResolvedValue({
      total: 1,
      red: 1,
      blue: 0,
      redRatio: 1,
      blueRatio: 0,
      topRedComments: ['投票成功'],
      topBlueComments: [],
    });

    const request = new Request('http://localhost/api/side/poll', {
      method: 'POST',
      body: JSON.stringify({ questionId: 'q1' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.totalVotes).toBe(1);
  });

  it('should return 400 when questionId is missing', async () => {
    const request = new Request('http://localhost/api/side/poll', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Question ID is required');
  });
});
