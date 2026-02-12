import { db } from '@/lib/db';
import { SecondMePollEngine } from './secondme-poll-engine';

const ROLES_ORDER = ['PRO_1', 'CON_1', 'PRO_2', 'CON_2', 'PRO_3', 'CON_3'];
const MAX_ROUNDS = 2; // Simple MVP: 1 round of arguments, 1 round of closing

export class DebateEngine {
  
  // 1. Recruiting Phase
  static async processRecruiting() {
    const pendingQuestions = await db.question.findMany({
      where: { status: 'pending' },
      include: { debateRoles: true },
      take: 1
    });

    if (pendingQuestions.length === 0) return { recruited: 0 };

    // Check active participants
    const participants = await db.participant.findMany({
      where: { isActive: true },
      take: 10
    });

    const question = pendingQuestions[0];

    // Idempotency: if roles already exist (e.g. previous partial run), just move forward.
    if (question.debateRoles.length > 0) {
      await db.question.update({
        where: { id: question.id },
        data: {
          status: 'DEBATING_R1',
          round: 1,
          nextTurnAt: new Date(),
        },
      });
      return { recruited: 0, resumed: 1 };
    }

    // For MVP: If we have at least 1 participant and the question owner, we can start
    // This allows single-user testing while still having a "debate"
    const minParticipants = 1;

    if (participants.length < minParticipants) {
      console.log(`[DebateEngine] Not enough participants. Need ${minParticipants}, have ${participants.length}`);
      return { recruited: 0, waitingFor: minParticipants - participants.length };
    }

    // Shuffle and pick up to 6 participants
    const shuffled = participants.sort(() => 0.5 - Math.random()).slice(0, 6);
    if (shuffled.length === 0) {
      return { recruited: 0, waitingFor: 1 };
    }
    
    // Assign roles (bounded by available participants)
    for (let i = 0; i < shuffled.length; i++) {
      await db.debateRole.upsert({
        where: {
          questionId_participantId: {
            questionId: question.id,
            participantId: shuffled[i].id,
          },
        },
        update: {
          role: ROLES_ORDER[i],
          initialStance: i % 2 === 0 ? 100 : -100,
          currentStance: i % 2 === 0 ? 100 : -100,
        },
        create: {
          questionId: question.id,
          participantId: shuffled[i].id,
          role: ROLES_ORDER[i],
          initialStance: i % 2 === 0 ? 100 : -100, // Pro = 100, Con = -100
          currentStance: i % 2 === 0 ? 100 : -100,
        },
      });
    }

    // Update Question
    await db.question.update({
      where: { id: question.id },
      data: {
        status: 'DEBATING_R1',
        round: 1,
        nextTurnAt: new Date() // Start immediately
      }
    });

    console.log(`[DebateEngine] Started debate for question ${question.id}`);
    return { recruited: 1 };
  }

  // 2. Debating Phase
  static async processDebating() {
    const activeQuestions = await db.question.findMany({
      where: {
        status: { startsWith: 'DEBATING' },
        nextTurnAt: { lte: new Date() }
      },
      include: {
        debateRoles: { include: { participant: true } },
        debateTurns: true
      }
    });

    let processed = 0;

    for (const q of activeQuestions) {
      await this.processTurn(q);
      processed++;
    }

    return { processedTurns: processed };
  }

  private static async processTurn(question: any) {
    // Determine next speaker
    // Logic: Check existing turns in this round, find who hasn't spoken
    const currentRoundTurns = question.debateTurns.filter((t: any) => t.round === question.round);
    const turnsCount = currentRoundTurns.length;

    if (turnsCount >= ROLES_ORDER.length) {
      // Round complete
      if (question.round >= MAX_ROUNDS) {
        // All rounds complete -> Close
        await db.question.update({
          where: { id: question.id },
          data: { status: 'CLOSED', nextTurnAt: null }
        });
        return;
      } else {
        // Next round
        await db.question.update({
          where: { id: question.id },
          data: { 
            round: question.round + 1,
            // status: `DEBATING_R${question.round + 1}`, // Optional: update status string
            nextTurnAt: new Date(Date.now() + 5000) // 5s break
          }
        });
        return;
      }
    }

    // Who is next?
    const nextRole = ROLES_ORDER[turnsCount];
    const debater = question.debateRoles.find((r: any) => r.role === nextRole);

    if (!debater) {
      console.error(`[DebateEngine] Missing debater for role ${nextRole}`);
      return;
    }

    // Get User Token
    const user = await db.user.findUnique({
      where: { secondmeUserId: debater.participant.secondmeId }
    });

    if (!user) {
      console.error(`[DebateEngine] User not found for participant ${debater.participant.name}`);
      // Skip this turn or mock it? For "Real User" requirement, we might have to skip or fail.
      // But to keep flow going, maybe skip.
      return;
    }

    // Generate Content
    console.log(`[DebateEngine] Generating turn for ${debater.role} (${debater.participant.name})...`);
    
    // Construct Prompt
    const prompt = `
      You are participating in a debate.
      Topic: "${question.content}"
      Your Role: ${debater.role.startsWith('PRO') ? 'Proponent (Support)' : 'Opponent (Oppose)'}.
      Your Style: ${debater.participant.interests.join(', ')}.
      
      Current Stage: Round ${question.round}.
      
      Context:
      ${question.debateTurns.map((t: any) => `${t.speakerId}: ${t.content}`).join('\n').slice(-500)}
      
      Please provide a short, punchy argument (max 100 words).
    `;

    // Call API using /act/stream which is more suitable for agent actions
    let content = "";
    try {
        content = await this.fetchActCompletion(user.accessToken, prompt);
    } catch (e) {
        console.error("API Call failed", e);
        content = "(AI Connection Failed) I stand by my point!";
    }

    // Save Turn
    await db.debateTurn.create({
      data: {
        questionId: question.id,
        speakerId: debater.participantId,
        round: question.round,
        type: 'ARGUMENT',
        content: content,
        voteSwing: (Math.random() * 10) - 5 // Random swing for visual effect
      }
    });

    // Schedule next turn
    await db.question.update({
      where: { id: question.id },
      data: {
        nextTurnAt: new Date(Date.now() + 5000) // 5s delay for reading
      }
    });
  }

  private static async fetchActCompletion(token: string, prompt: string): Promise<string> {
    try {
        const res = await fetch('https://app.mindos.com/gate/lab/api/secondme/act/stream', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                topic: "debate",
                action: "argument",
                context: { prompt } // Pass prompt in context for act API
            })
        });

        if (!res.ok) throw new Error(res.statusText);

        // Parse act stream response (similar to chat but structure might differ)
        // Assuming similar SSE format for MVP
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let result = '';

        if (!reader) return "Error: No response body";

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
                        // Adjust parsing based on Act API response structure
                        // Usually it returns a 'thought' or 'action' content
                        if (json.data?.content) {
                            result += json.data.content;
                        } else if (json.choices?.[0]?.delta?.content) {
                             result += json.choices[0].delta.content;
                        }
                    } catch (e) {}
                }
            }
        }
        return result || "I have a point to make.";
    } catch (e) {
        console.error("Act Error", e);
        // Fallback to chat if act fails
        return this.fetchChatCompletion(token, prompt);
    }
  }

  private static async fetchChatCompletion(token: string, prompt: string): Promise<string> {
    // Simplified SSE reader for MVP
    // In real prod, use a proper parser.
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

        if (!res.ok) throw new Error(res.statusText);

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let result = '';

        if (!reader) return "Error: No response body";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            // Parse SSE format: data: {...}
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
        return result || "I have no words.";
    } catch (e) {
        console.error("Chat Error", e);
        return "I am speechless.";
    }
  }
}
