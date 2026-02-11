import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/publish/route';
import { cookies } from 'next/headers';

// Mock dependencies
const mockCreateQuestion = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/question-manager', () => ({
  QuestionManager: {
    createQuestion: (...args: any[]) => mockCreateQuestion(...args),
  },
}));

vi.mock('@/lib/auth-helper', () => ({
  getUserFromToken: (...args: any[]) => mockGetUser(...args),
}));

// Mock cookies
const mockCookiesGet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: mockCookiesGet,
  })),
}));

describe('POST /api/side/publish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a question successfully', async () => {
    const mockUser = { id: 'user1', secondmeUserId: 'sm123' };
    const mockQuestion = {
      id: 'q1',
      content: '相亲男让我AA这杯30块的咖啡',
      arenaType: 'toxic',
      status: 'pending',
      createdAt: new Date(),
    };

    mockGetUser.mockResolvedValue(mockUser);
    mockCreateQuestion.mockResolvedValue(mockQuestion);
    mockCookiesGet.mockReturnValue({
      name: 'sm_access_token',
      value: 'test-token',
    });

    const request = new Request('http://localhost/api/side/publish', {
      method: 'POST',
      body: JSON.stringify({
        content: '相亲男让我AA这杯30块的咖啡',
        arenaType: 'toxic',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('q1');
    expect(mockCreateQuestion).toHaveBeenCalledWith({
      userId: 'user1',
      content: '相亲男让我AA这杯30块的咖啡',
      arenaType: 'toxic',
      imageUrl: undefined,
    });
  });

  it('should create question with image URL', async () => {
    const mockUser = { id: 'user1', secondmeUserId: 'sm123' };
    const mockQuestion = {
      id: 'q1',
      content: 'test',
      arenaType: 'comfort',
      imageUrl: 'https://example.com/image.jpg',
      status: 'pending',
      createdAt: new Date(),
    };

    mockGetUser.mockResolvedValue(mockUser);
    mockCreateQuestion.mockResolvedValue(mockQuestion);
    mockCookiesGet.mockReturnValue({
      name: 'sm_access_token',
      value: 'test-token',
    });

    const request = new Request('http://localhost/api/side/publish', {
      method: 'POST',
      body: JSON.stringify({
        content: 'test',
        arenaType: 'comfort',
        imageUrl: 'https://example.com/image.jpg',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.imageUrl).toBe('https://example.com/image.jpg');
  });

  it('should return 401 when user not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    mockCookiesGet.mockReturnValue({
      name: 'sm_access_token',
      value: 'invalid-token',
    });

    const request = new Request('http://localhost/api/side/publish', {
      method: 'POST',
      body: JSON.stringify({
        content: 'test',
        arenaType: 'toxic',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 when content is missing', async () => {
    const mockUser = { id: 'user1', secondmeUserId: 'sm123' };
    mockGetUser.mockResolvedValue(mockUser);
    mockCookiesGet.mockReturnValue({
      name: 'sm_access_token',
      value: 'test-token',
    });

    const request = new Request('http://localhost/api/side/publish', {
      method: 'POST',
      body: JSON.stringify({
        arenaType: 'toxic',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Content is required');
  });

  it('should return 400 when arenaType is invalid', async () => {
    const mockUser = { id: 'user1', secondmeUserId: 'sm123' };
    mockGetUser.mockResolvedValue(mockUser);
    mockCookiesGet.mockReturnValue({
      name: 'sm_access_token',
      value: 'test-token',
    });

    const request = new Request('http://localhost/api/side/publish', {
      method: 'POST',
      body: JSON.stringify({
        content: 'test',
        arenaType: 'invalid',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid arena type');
  });

  it('should use default arenaType when not provided', async () => {
    const mockUser = { id: 'user1', secondmeUserId: 'sm123' };
    const mockQuestion = {
      id: 'q1',
      content: 'test',
      arenaType: 'toxic',
      status: 'pending',
      createdAt: new Date(),
    };

    mockGetUser.mockResolvedValue(mockUser);
    mockCreateQuestion.mockResolvedValue(mockQuestion);
    mockCookiesGet.mockReturnValue({
      name: 'sm_access_token',
      value: 'test-token',
    });

    const request = new Request('http://localhost/api/side/publish', {
      method: 'POST',
      body: JSON.stringify({
        content: 'test',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockCreateQuestion).toHaveBeenCalledWith({
      userId: 'user1',
      content: 'test',
      arenaType: 'toxic',
      imageUrl: undefined,
    });
  });
});
