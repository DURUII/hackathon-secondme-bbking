import { NextResponse } from 'next/server';
import { getUserFromToken, getOrCreateParticipant } from '@/lib/auth-helper';
import { QuestionManager } from '@/lib/question-manager';
import { VoteManager } from '@/lib/vote-manager';
import { db } from '@/lib/db';

const VALID_ARENA_TYPES = ['toxic', 'comfort', 'rational'];

export async function POST(request: Request) {
  try {
    // Authenticate user
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { content, arenaType = 'toxic', imageUrl } = body;

    // Validate content
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Content is required' },
        { status: 400 }
      );
    }

    // Validate arenaType
    const normalizedArenaType = arenaType?.toLowerCase() ?? 'toxic';
    if (!VALID_ARENA_TYPES.includes(normalizedArenaType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid arena type' },
        { status: 400 }
      );
    }

    console.log('[PUBLISH] Creating question for user:', user.id);

    // Create question
    const question = await QuestionManager.createQuestion({
      userId: user.id,
      content: content.trim(),
      arenaType: normalizedArenaType,
      imageUrl: imageUrl ?? undefined,
    });

    console.log('[PUBLISH] Question created:', {
      id: question.id,
      arenaType: normalizedArenaType,
    });

    // MVP: Immediately have user's AI分身 vote on their own question
    try {
      const participant = await getOrCreateParticipant(user);
      const voteComment = await generateAIVote(user.accessToken, content.trim(), normalizedArenaType);

      // Randomly choose pro (+1) or con (-1) for debate
      const position = Math.random() > 0.5 ? 1 : -1;

      await VoteManager.createVote({
        questionId: question.id,
        participantId: participant.id,
        position,
        comment: voteComment,
      });

      console.log('[PUBLISH] AI vote cast:', { position, comment: voteComment });
    } catch (voteError) {
      console.error('[PUBLISH] Failed to cast AI vote:', voteError);
      // Don't fail the publish if voting fails
    }

    return NextResponse.json({
      success: true,
      data: {
        id: question.id,
        content: question.content,
        arenaType: question.arenaType,
        imageUrl: question.imageUrl,
        status: question.status,
        createdAt: question.createdAt,
      },
    });
  } catch (error) {
    console.error('[PUBLISH] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to publish question', details: String(error) },
      { status: 500 }
    );
  }
}

// Generate AI vote comment using SecondMe chat API
async function generateAIVote(token: string, question: string, arenaType: string): Promise<string> {
  const arenaPrompts: Record<string, string> = {
    toxic: '尖锐、直接、甚至有点毒舌地评价这个情况，给出让人清醒的建议。',
    comfort: '温暖、体贴地回应，表达理解和安慰，让人感到被支持。',
    rational: '客观、理性地分析利弊，给出平衡的建议。',
  };

  const prompt = `用户的问题："${question}"

请以你的身份，针对这个问题给出你的立场和简短评论（50字以内）。
场类型：${arenaType}
风格：${arenaPrompts[arenaType] || '给出你的建议'}
`;

  try {
    const res = await fetch('https://app.mindos.com/gate/lab/api/secondme/chat/stream', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!res.ok) throw new Error('Chat API failed');

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let result = '';

    if (!reader) return '我觉得这个问题...';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          if (dataStr === '[DONE]') continue;
          try {
            const json = JSON.parse(dataStr);
            if (json.choices?.[0]?.delta?.content) {
              result += json.choices[0].delta.content;
            }
          } catch (e) {}
        }
      }
    }

    return result.trim() || '我觉得这个问题值得深思。';
  } catch (e) {
    console.error('[PUBLISH] AI vote generation failed:', e);
    // Fallback comments
    const fallbacks: Record<string, string[]> = {
      toxic: ['清醒点吧，这就是现实。', '说实话，你想多了。', '别矫情了。'],
      comfort: ['我理解你的感受。', '没事，会好起来的。', '你已经很棒了。'],
      rational: ['建议从长远角度看这个问题。', '需要权衡利弊。', '可以考虑多种解决方案。'],
    };
    const options = fallbacks[arenaType] || fallbacks['rational'];
    return options[Math.floor(Math.random() * options.length)];
  }
}
