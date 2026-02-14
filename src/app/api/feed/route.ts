import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { QuestionManager } from '@/lib/question-manager';
import { VoteManager } from '@/lib/vote-manager';
import { ParticipantManager } from '@/lib/participant-manager';
import { getReqLogContext, logApiBegin, logApiEnd, logApiError } from "@/lib/obs/server-log";

const FEED_CACHE_TTL_MS = 2000;
let feedCache: { at: number; payload: unknown } | null = null;
let feedInFlight: Promise<unknown> | null = null;

// Preset questions for seeding
const PRESET_QUESTIONS = [
  { 
    content: "相亲男让我AA这杯30块的咖啡，该不该转给他？", 
    arenaType: "toxic",
    tags: ["相亲", "AA", "金钱"],
    mockVotes: [
      { name: "毒舌女王", position: 1, comment: "转给他，别惯着，这种人不处也罢！" },
      { name: "理性派", position: -1, comment: "虽然30块不多，但AA是平等的表现，不必过分解读。" },
      { name: "吃瓜群众", position: 1, comment: "30块都要AA？活该单身！" }
    ]
  },
  { 
    content: "老板半夜12点发微信让我改PPT，要不要回？", 
    arenaType: "rational",
    tags: ["职场", "加班", "边界"],
    mockVotes: [
      { name: "社畜小李", position: -1, comment: "装睡，明天早上再说，身体要紧。" },
      { name: "卷王之王", position: 1, comment: "回！老板就是上帝，为了年终奖拼了！" },
      { name: "理性派", position: -1, comment: "建立职场边界很重要，非紧急事项可以次日处理。" }
    ]
  },
  { 
    content: "我妈非要给我的真皮沙发盖丑沙发套，怎么劝？", 
    arenaType: "comfort",
    tags: ["家庭", "审美", "代沟"],
    mockVotes: [
      { name: "知心大姐", position: -1, comment: "这是妈妈的爱呀，虽然审美不同，但可以委婉沟通。" },
      { name: "毒舌女王", position: 1, comment: "趁她不在直接扔了，这种审美污染眼睛！" },
      { name: "和稀泥", position: -1, comment: "买个好看点的送给她，说这个更贵更好。" }
    ]
  },
  { 
    content: "朋友借了我的Switch半年不还，怎么要回来不尴尬？", 
    arenaType: "toxic",
    tags: ["友情", "边界", "借还"],
    mockVotes: [
      { name: "毒舌女王", position: 1, comment: "直接要！借钱借东西不还的都是孙子！" },
      { name: "理性派", position: 1, comment: "设定一个最后期限，直接说明你需要用。" },
      { name: "老好人", position: -1, comment: "也许他忘了？假装随口问一句最近在玩什么游戏。" }
    ]
  }
];

// Mock Participants to create if seeding
const MOCK_PARTICIPANTS = [
  { name: "毒舌女王", secondmeId: "mock_toxic", avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Toxic" },
  { name: "理性派", secondmeId: "mock_rational", avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Rational" },
  { name: "知心大姐", secondmeId: "mock_comfort", avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Comfort" },
  { name: "社畜小李", secondmeId: "mock_worker", avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Worker" },
  { name: "卷王之王", secondmeId: "mock_king", avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=King" },
  { name: "吃瓜群众", secondmeId: "mock_observer", avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Observer" },
  { name: "和稀泥", secondmeId: "mock_peace", avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Peace" },
  { name: "老好人", secondmeId: "mock_nice", avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Nice" }
];

export async function GET(req: Request) {
  const ctx = getReqLogContext(req);
  const t0 = Date.now();
  logApiBegin(ctx, "api.feed", {});
  try {
    const cached = feedCache && Date.now() - feedCache.at < FEED_CACHE_TTL_MS ? feedCache.payload : null;
    if (cached) {
      logApiEnd(ctx, "api.feed", { status: 200, dur_ms: Date.now() - t0, cache: "hit" });
      return NextResponse.json(cached, { headers: { "x-feed-cache": "hit" } });
    }

    if (feedInFlight) {
      const payload = await feedInFlight;
      logApiEnd(ctx, "api.feed", { status: 200, dur_ms: Date.now() - t0, cache: "wait" });
      return NextResponse.json(payload, { headers: { "x-feed-cache": "wait" } });
    }

    feedInFlight = (async () => {
    // 1. Fetch questions
    const [questions, totalParticipants, totalQuestions] = await Promise.all([
      db.question.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          votes: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              participantId: true,
              position: true,
              comment: true,
            },
          },
        },
        take: 20, 
      }),
      db.participant.count(),
      db.question.count({ where: { deletedAt: null } })
    ]);

    // 2. Prefetch related entities in batch to avoid N+1 query latency.
    const creatorUserIds = Array.from(new Set(questions.map((q) => q.userId).filter(Boolean) as string[]));
    const voteParticipantIds = Array.from(
      new Set(
        questions
          .flatMap((q) => q.votes.map((v) => v.participantId))
          .filter(Boolean) as string[]
      )
    );

    const [voteParticipants, creators] = await Promise.all([
      voteParticipantIds.length
        ? db.participant.findMany({
            where: { id: { in: voteParticipantIds } },
            select: { id: true, name: true, avatarUrl: true, interests: true },
          })
        : Promise.resolve([]),
      creatorUserIds.length
        ? db.user.findMany({
            where: { id: { in: creatorUserIds } },
            select: { id: true, secondmeUserId: true },
          })
        : Promise.resolve([]),
    ]);

    const creatorSecondMeIds = Array.from(new Set(creators.map((u) => u.secondmeUserId)));
    const creatorParticipants = creatorSecondMeIds.length
      ? await db.participant.findMany({
          where: { secondmeId: { in: creatorSecondMeIds } },
          select: { secondmeId: true, name: true, avatarUrl: true, id: true },
        })
      : [];

    const participantById = new Map(voteParticipants.map((p) => [p.id, p]));
    const creatorByUserId = new Map(creators.map((u) => [u.id, u]));
    const creatorParticipantBySecondmeId = new Map(creatorParticipants.map((p) => [p.secondmeId, p]));

    // 3. Transform to Feed format
    const feedItems = questions.map((q) => {
      // Calculate ratios
      const totalVotes = q.votes.length;
      const redVotes = q.votes.filter(v => v.position === 1).length;
      const redRatio = totalVotes > 0 ? redVotes / totalVotes : 0.5; // Default 0.5 if no votes
      const blueRatio = totalVotes > 0 ? (totalVotes - redVotes) / totalVotes : 0.5;
      const blueVotes = totalVotes - redVotes;

      // Get comments
      const redComments = q.votes.filter(v => v.position === 1).map(v => v.comment);
      const blueComments = q.votes.filter(v => v.position === -1).map(v => v.comment);

      // Get preview comments
      // ... (Existing logic or simplified)
      const previewComments = q.votes.slice(0, 2).map(v => {
        const p = v.participantId ? participantById.get(v.participantId) : null;
        return {
          id: v.id,
          name: p?.name || '匿名分身',
          avatarUrl: p?.avatarUrl,
          content: v.comment,
          side: v.position === 1 ? 'red' as const : 'blue' as const,
          tags: p?.interests || []
        };
      });

      // Get all comments structured
      const structuredComments = q.votes.map(v => {
        const p = v.participantId ? participantById.get(v.participantId) : null;
        return {
          id: v.id,
          name: p?.name || '匿名分身',
          avatarUrl: p?.avatarUrl,
          content: v.comment,
          side: v.position === 1 ? 'red' as const : 'blue' as const,
          tags: p?.interests || []
        };
      });

      // Get the actual user who created this question
      let creatorName = "社区精选";
      let creatorAvatar = `https://api.dicebear.com/7.x/notionists/svg?seed=${q.id}`;

      if (q.userId) {
        const user = creatorByUserId.get(q.userId);
        if (user?.secondmeUserId) {
          const participant = creatorParticipantBySecondmeId.get(user.secondmeUserId);
          if (participant) {
            creatorName = participant.name;
            creatorAvatar = participant.avatarUrl || `https://api.dicebear.com/7.x/notionists/svg?seed=${participant.id}`;
          }
        }
      }

      return {
        id: q.id,
        creatorUserId: q.userId,
        userInfo: {
          name: creatorName,
          avatarUrl: creatorAvatar,
        },
        timeAgo: new Date(q.createdAt).toLocaleString('zh-CN', {
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        content: q.content,
        arenaType: q.arenaType,
        status: q.status,
        redVotes,
        blueVotes,
        redRatio,
        blueRatio,
        commentCount: totalVotes,
        debateTurns: [],
        previewComments,
        structuredComments,
        fullComments: {
          red: redComments,
          blue: blueComments
        }
      };
    });

    const payload = {
      success: true,
      data: feedItems,
      stats: {
        totalParticipants,
        totalQuestions
      }
    };
    feedCache = { at: Date.now(), payload };
    return payload;
    })();

    const payload = await feedInFlight;
    const durMs = Date.now() - t0;
    const items =
      payload && typeof payload === "object" && "data" in payload && Array.isArray((payload as { data?: unknown }).data)
        ? ((payload as { data: unknown[] }).data.length)
        : undefined;
    logApiEnd(ctx, "api.feed", { status: 200, dur_ms: durMs, items, cache: "miss" });
    return NextResponse.json(payload, { headers: { "x-feed-cache": "miss" } });

  } catch (error) {
    logApiError(ctx, "api.feed", { dur_ms: Date.now() - t0, status: 500 }, error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch feed', details: String(error) },
      { status: 500 }
    );
  } finally {
    feedInFlight = null;
  }
}
