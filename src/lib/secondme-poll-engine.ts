/**
 * SecondMe Poll Engine
 * Handles calling SecondMe API to collect votes from participants
 */
import { readFileSync } from "node:fs";
import path from "node:path";

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
    const actionControl = this.buildVoteActionControl(request.arenaType);

    try {
      const response = await fetch(`${SECONDME_API_BASE_URL}/api/secondme/act/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${request.participantToken}`,
        },
        body: JSON.stringify({
          message: request.question,
          actionControl,
        }),
      });

      if (!response.ok) {
        throw new Error(`SecondMe API error: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        return this.parseVoteResponse(data);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('SecondMe API stream missing body');
      }

      const decoder = new TextDecoder();
      let buffered = '';
      let aggregate = '';

      while (true) {
        const { done, value } = await reader.read();
        buffered += decoder.decode(value, { stream: !done });
        const lines = buffered.split(/\r?\n/);
        buffered = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || line.startsWith('event:')) {
            continue;
          }
          if (!line.startsWith('data:')) {
            continue;
          }

          const dataStr = line.slice(5).trim();
          if (dataStr === '[DONE]') {
            continue;
          }

          try {
            const payload = JSON.parse(dataStr);
            const chunk =
              payload?.choices?.[0]?.delta?.content ??
              payload?.choices?.[0]?.message?.content ??
              payload?.data?.content ??
              payload?.content;
            if (typeof chunk === 'string' && chunk.length > 0) {
              aggregate += chunk;
            }
          } catch {
            // Some SSE providers stream plain text in `data:` lines.
            if (dataStr && !dataStr.startsWith('{')) {
              aggregate += dataStr;
            }
          }
        }

        if (done) break;
      }

      return this.parseVoteResponse({ content: aggregate });
    } catch (error) {
      console.error('[SecondMePollEngine] API call failed:', error);
      throw error;
    }
  }

  /**
   * Build actionControl for structured vote output.
   */
  private static buildVoteActionControl(arenaType: string): string {
    const cfg = this.getVotePromptConfig();
    const arenaStyle = cfg.arenaStyles[arenaType] ?? cfg.arenaStyles.toxic ?? "";
    return cfg.template
      .replaceAll("{{schema}}", cfg.schema)
      .replaceAll("{{arena_style}}", arenaStyle)
      .replaceAll("{{banned_phrases}}", cfg.bannedPhrases.join("、"))
      .replaceAll("{{example_output}}", cfg.exampleOutput)
      .trim();
  }

  /**
   * Parse the vote response from SecondMe
   */
  private static parseVoteResponse(data: any): VoteResult {
    const content = data?.resp?.content || data?.content || data?.message || '';
    const text = String(content).trim();
    if (!text) {
      throw new Error('SecondMe vote response is empty');
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const comment =
          typeof parsed.comment === 'string'
            ? parsed.comment.trim()
            : typeof parsed.content === 'string'
            ? parsed.content.trim()
            : '';
        if (comment) {
          this.assertCommentQuality(comment);
          const position = typeof parsed.position === 'number'
            ? (parsed.position > 0 ? 1 : -1)
            : this.inferPositionFromText(comment);
          return { position, comment: comment.slice(0, 220) };
        }
      } catch {
        // Continue to plain-text fallback.
      }
    }

    throw new Error(`SecondMe vote response is not valid JSON: ${text.slice(0, 220)}`);
  }

  private static inferPositionFromText(text: string): number {
    const negativeHints = ['不应该', '不要', '不建议', '反对', '算了', '别'];
    return negativeHints.some((hint) => text.includes(hint)) ? -1 : 1;
  }

  private static assertCommentQuality(comment: string) {
    const normalized = comment.replace(/\s+/g, '');
    if (normalized.length < 12) {
      throw new Error(`SecondMe vote comment too short: ${comment}`);
    }
    const bannedPhrases = [
      '我支持这个观点',
      '值得深思',
      '看情况',
      '都可以',
      '不好说',
    ];
    if (bannedPhrases.some((phrase) => normalized.includes(phrase))) {
      throw new Error(`SecondMe vote comment too generic: ${comment}`);
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

  private static getVotePromptConfig() {
    const fallback: {
      schema: string;
      bannedPhrases: string[];
      arenaStyles: Record<string, string>;
      exampleOutput: string;
      template: string;
    } = {
      schema: '{"position": 1|-1, "comment": "具体理由"}',
      bannedPhrases: ['我支持这个观点', '值得深思', '看情况', '都可以', '不好说'],
      arenaStyles: {
        toxic: '评论风格偏毒舌直接，允许尖锐但不能辱骂。',
        comfort: '评论风格偏温暖安慰，突出理解与支持。',
        rational: '评论风格偏理性客观，突出利弊分析。',
      },
      exampleOutput:
        '{"position":-1,"comment":"对方突然冷淡说明投入不稳定，你此时突然升温会失去议价空间，先观察并降低投入更稳妥。"}',
      template:
        '仅输出合法 JSON 对象。输出结构：{{schema}}。风格要求：{{arena_style}}。禁止输出：{{banned_phrases}}。示例：{{example_output}}',
    };

    try {
      const file = readFileSync(path.join(process.cwd(), "config/vote-act-prompt.yaml"), "utf8");
      const parts = file.split("---");
      if (parts.length < 3) {
        return fallback;
      }

      const frontmatter = parts[1];
      const template = parts.slice(2).join("---").trim();
      const kv: Record<string, string> = {};

      for (const rawLine of frontmatter.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const idx = line.indexOf(":");
        if (idx < 0) continue;
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        kv[key] = value;
      }

      const schema = this.parseYamlScalar(kv.schema) || fallback.schema;
      const exampleOutput = this.parseYamlScalar(kv.example_output) || fallback.exampleOutput;
      const bannedPhrases = this.parseYamlJsonArray(kv.banned_phrases) || fallback.bannedPhrases;
      const arenaStyles = this.parseYamlJsonObject(kv.arena_styles) || fallback.arenaStyles;

      return {
        schema,
        bannedPhrases,
        arenaStyles,
        exampleOutput,
        template: template || fallback.template,
      };
    } catch (error) {
      console.warn("[SecondMePollEngine] Failed to load vote prompt yaml, using fallback:", error);
      return fallback;
    }
  }

  private static parseYamlScalar(raw?: string): string | null {
    if (!raw) return null;
    const val = raw.trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      return val.slice(1, -1);
    }
    return val || null;
  }

  private static parseYamlJsonArray(raw?: string): string[] | null {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((v) => String(v)) : null;
    } catch {
      return null;
    }
  }

  private static parseYamlJsonObject(raw?: string): Record<string, string> | null {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        result[k] = String(v);
      }
      return result;
    } catch {
      return null;
    }
  }
}
