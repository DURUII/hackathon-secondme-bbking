/**
 * SecondMe Poll Engine
 * Handles calling SecondMe API to collect votes from participants
 */

export interface VoteResult {
  position: number; // 1 = red, -1 = blue
  comment: string;
}

export interface PollRequest {
  participantToken: string;
  question: string;
  arenaType: string;
}

export class SecondMePollEngine {
  /**
   * Generate a mock vote for development/testing
   */
  static async generateMockVote(request: { question: string; arenaType: string }): Promise<VoteResult> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Mock responses based on arena type
    const mockResponses = {
      toxic: [
        { position: 1, comment: '转给他，别惯着，这种人不处也罢' },
        { position: 1, comment: '30块都不肯付？拜拜了您嘞' },
        { position: -1, comment: '就30块而已，别太上纲上线' },
        { position: -1, comment: '人家可能只是习惯AA，你太敏感了' },
      ],
      comfort: [
        { position: 1, comment: '你的感受很重要，不舒服就说出来' },
        { position: -1, comment: '也许他只是不太会表达，给个机会？' },
        { position: 1, comment: '不喜欢就下一个，你值得更好的' },
        { position: -1, comment: '沟通一下看看是不是误会' },
      ],
      rational: [
        { position: 1, comment: '从约会心理学看，第一次约会就让AA通常是减分项' },
        { position: -1, comment: 'AA不代表不尊重，要看整体表现' },
        { position: 1, comment: '经济独立和愿意付出是两回事，建议观察' },
        { position: -1, comment: '价值观契合更重要，30块不是重点' },
      ],
    };

    const responses = mockResponses[request.arenaType as keyof typeof mockResponses] || mockResponses.toxic;
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];

    return randomResponse;
  }

  /**
   * Call SecondMe API to get a vote from a participant
   */
  static async callSecondMeForVote(request: PollRequest): Promise<VoteResult> {
    const SECONDME_API_BASE_URL = process.env.SECONDME_API_BASE_URL ?? 'https://app.mindos.com/gate/lab';

    const prompt = this.buildVotePrompt(request.question, request.arenaType);

    try {
      const response = await fetch(`${SECONDME_API_BASE_URL}/api/secondme/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${request.participantToken}`,
        },
        body: JSON.stringify({
          message: prompt,
          stream: false, // Get full response for voting
        }),
      });

      if (!response.ok) {
        throw new Error(`SecondMe API error: ${response.status}`);
      }

      const data = await response.json();
      return this.parseVoteResponse(data);
    } catch (error) {
      console.error('[SecondMePollEngine] API call failed:', error);
      throw error;
    }
  }

  /**
   * Build a prompt for voting
   */
  private static buildVotePrompt(question: string, arenaType: string): string {
    const arenaInstructions = {
      toxic: '请用毒舌、直接的方式评价，给出尖锐的建议。',
      comfort: '请用温暖、理解的方式评价，给出安慰和建议。',
      rational: '请用理性、客观的方式评价，给出分析。',
    };

    return `
请对以下社交场景进行投票和评论：

场景：${question}

要求：
1. 请在 1-10 秒内做出判断并给出一句话评论
2. ${arenaInstructions[arenaType as keyof typeof arenaInstructions] || arenaInstructions.toxic}
3. 你的回复格式必须是 JSON：
   {"position": 1, "comment": "你的评论"}

其中 position 为 1 表示"红方"(支持/激进)，-1 表示"蓝方"(反对/保守)

请直接返回 JSON，不要有其他内容。
`.trim();
  }

  /**
   * Parse the vote response from SecondMe
   */
  private static parseVoteResponse(data: any): VoteResult {
    try {
      // Try to parse from the response
      const content = data?.resp?.content || data?.content || data?.message || JSON.stringify(data);

      // Extract JSON from response
      const jsonMatch = content.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (typeof parsed.position === 'number' && typeof parsed.comment === 'string') {
          // Normalize position
          const position = parsed.position > 0 ? 1 : -1;
          return {
            position,
            comment: parsed.comment,
          };
        }
      }

      // Fallback: default to red with a generic comment
      return {
        position: 1,
        comment: '我支持这个观点',
      };
    } catch {
      return {
        position: 1,
        comment: '我支持这个观点',
      };
    }
  }

  /**
   * Get fresh token for a participant
   * In production, this would refresh the token if expired
   */
  static async getFreshToken(participantId: string): Promise<string | null> {
    const { db } = await import('@/lib/db');

    const participant = await db.participant.findUnique({
      where: { id: participantId },
    });

    if (!participant) {
      console.warn('[SecondMePollEngine] Participant not found:', participantId);
      return null;
    }

    // Get the user's token from users table
    const user = await db.user.findFirst({
      where: { secondmeUserId: participant.secondmeId },
    });

    // Return token if available and not a mock token
    if (user?.accessToken && user.accessToken !== 'demo-token') {
      return user.accessToken;
    }

    // Mock token in development - return null to trigger mock response
    if (process.env.NODE_ENV === 'development' || !user) {
      console.log('[SecondMePollEngine] Using mock mode for participant:', participant.name);
      return null;
    }

    return null;
  }
}
