import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock functions
const mockFindQuestion = vi.fn();
const mockAggregateVotes = vi.fn();

// Mock before import
vi.mock('@/lib/question-manager', () => ({
  QuestionManager: {
    findById: mockFindQuestion,
  },
}));

vi.mock('@/lib/vote-manager', () => ({
  VoteManager: {
    aggregateByQuestionId: mockAggregateVotes,
  },
}));

// Import after mocking
const { GET } = await import('@/app/api/side/result/route');

describe('GET /api/side/result', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return result for a collected question', async () => {
    const mockQuestion = {
      id: 'q1',
      content: '相亲男让我AA',
      arenaType: 'toxic',
      status: 'collected',
      createdAt: new Date(),
    };

    const mockAggregation = {
      total: 10,
      red: 7,
      blue: 3,
      redRatio: 0.7,
      blueRatio: 0.3,
      topRedComments: ['转给他', '别惯着', 'AA就AA'],
      topBlueComments: ['算了', '别计较', '大度点'],
    };

    mockFindQuestion.mockResolvedValue(mockQuestion);
    mockAggregateVotes.mockResolvedValue(mockAggregation);

    const request = new Request('http://localhost/api/side/result?qid=q1');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.questionId).toBe('q1');
    expect(data.data.content).toBe('相亲男让我AA');
    expect(data.data.redRatio).toBe(0.7);
    expect(data.data.blueRatio).toBe(0.3);
    expect(data.data.topRedComments).toHaveLength(3);
    expect(data.data.topBlueComments).toHaveLength(3);
  });

  it('should return 404 when question not found', async () => {
    mockFindQuestion.mockResolvedValue(null);

    const request = new Request('http://localhost/api/side/result?qid=nonexistent');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Question not found');
  });

  it('should return 400 when qid is missing', async () => {
    const request = new Request('http://localhost/api/side/result');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Question ID is required');
  });

  it('should return pending status for uncollected question', async () => {
    const mockQuestion = {
      id: 'q1',
      content: 'test',
      arenaType: 'toxic',
      status: 'pending',
      createdAt: new Date(),
    };

    mockFindQuestion.mockResolvedValue(mockQuestion);

    const request = new Request('http://localhost/api/side/result?qid=q1');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.status).toBe('pending');
    expect(data.data.totalVotes).toBe(0);
  });

  it('should return empty comments when no votes', async () => {
    const mockQuestion = {
      id: 'q1',
      content: 'test',
      arenaType: 'toxic',
      status: 'collected',
      createdAt: new Date(),
    };

    const mockAggregation = {
      total: 0,
      red: 0,
      blue: 0,
      redRatio: 0,
      blueRatio: 0,
      topRedComments: [],
      topBlueComments: [],
    };

    mockFindQuestion.mockResolvedValue(mockQuestion);
    mockAggregateVotes.mockResolvedValue(mockAggregation);

    const request = new Request('http://localhost/api/side/result?qid=q1');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.topRedComments).toEqual([]);
    expect(data.data.topBlueComments).toEqual([]);
  });
});
