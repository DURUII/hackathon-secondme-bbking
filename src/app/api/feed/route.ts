import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { QuestionManager } from '@/lib/question-manager';
import { VoteManager } from '@/lib/vote-manager';
import { ParticipantManager } from '@/lib/participant-manager';
import { getReqLogContext, logApiBegin, logApiEnd, logApiError } from "@/lib/obs/server-log";

// Cache goals (per TECH-V0.md):
// - Avoid hammering DB on home feed polling / burst traffic (TTL + singleflight).
// - Make caching work across instances by enabling Vercel CDN caching too (s-maxage + SWR).
const FEED_CACHE_TTL_MS = 10_000;
const FEED_S_MAXAGE_SEC = 10;
const FEED_SWR_SEC = 30;
const FEED_STALE_OK_MS = FEED_SWR_SEC * 1000;

let feedCache: { at: number; payload: unknown; etag: string } | null = null;
let feedInFlight: Promise<unknown> | null = null;

function cacheControlValue() {
  return `public, s-maxage=${FEED_S_MAXAGE_SEC}, stale-while-revalidate=${FEED_SWR_SEC}`;
}

function buildFallbackFeedPayload() {
  const avatarByName = new Map(MOCK_PARTICIPANTS.map((p) => [p.name, p.avatarUrl] as const));
  const feedItems = PRESET_QUESTIONS.map((q, idx) => {
    const id = `preset_${idx}`;
    const votes = q.mockVotes || [];
    const totalVotes = votes.length;
    const redVotes = votes.filter((v) => v.position === 1).length;
    const blueVotes = totalVotes - redVotes;
    const redRatio = totalVotes > 0 ? redVotes / totalVotes : 0.5;
    const blueRatio = totalVotes > 0 ? blueVotes / totalVotes : 0.5;

    const structuredComments = votes.map((v, vIdx) => ({
      id: `${id}_v${vIdx}`,
      name: v.name,
      avatarUrl: avatarByName.get(v.name),
      content: v.comment,
      side: v.position === 1 ? ("red" as const) : ("blue" as const),
      tags: [],
    }));

    const previewComments = structuredComments.slice(0, 2);
    const redComments = structuredComments.filter((c) => c.side === "red").map((c) => c.content);
    const blueComments = structuredComments.filter((c) => c.side === "blue").map((c) => c.content);

    return {
      id,
      creatorUserId: null as string | null,
      userInfo: { name: "社区精选", avatarUrl: `https://api.dicebear.com/7.x/notionists/svg?seed=${id}` },
      timeAgo: "刚刚",
      content: q.content,
      arenaType: q.arenaType,
      status: "collected" as const,
      redVotes,
      blueVotes,
      redRatio,
      blueRatio,
      commentCount: totalVotes,
      debateTurns: [],
      previewComments,
      structuredComments,
      fullComments: { red: redComments, blue: blueComments },
    };
  });

  return {
    success: true,
    data: feedItems,
    stats: { totalParticipants: MOCK_PARTICIPANTS.length, totalQuestions: PRESET_QUESTIONS.length },
    fallback: true,
  };
}

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
    const ifNoneMatch = req.headers.get("if-none-match");
    const now = Date.now();
    const cache = feedCache;
    const ageMs = cache ? now - cache.at : Number.POSITIVE_INFINITY;
    const isFresh = Boolean(cache && ageMs < FEED_CACHE_TTL_MS);
    const isStaleOk = Boolean(cache && ageMs < FEED_CACHE_TTL_MS + FEED_STALE_OK_MS);

    if (cache && isFresh) {
      if (ifNoneMatch && cache.etag && ifNoneMatch === cache.etag) {
        logApiEnd(ctx, "api.feed", { status: 304, dur_ms: now - t0, cache: "hit" });
        return new Response(null, {
          status: 304,
          headers: {
            etag: cache.etag,
            "cache-control": cacheControlValue(),
            "x-feed-cache": "hit",
          },
        });
      }
      logApiEnd(ctx, "api.feed", { status: 200, dur_ms: now - t0, cache: "hit" });
      return NextResponse.json(cache.payload, {
        headers: {
          etag: cache.etag,
          "cache-control": cacheControlValue(),
          "x-feed-cache": "hit",
        },
      });
    }

    // Stale-while-revalidate: if we have a stale cache, return it immediately and refresh in background.
    // This avoids "slow 304" where we wait on DB just to confirm nothing changed.
    if (cache && isStaleOk) {
      if (!feedInFlight) {
        const p = (async () => {
          // Force refresh (same body as miss path).
          try {
            // 1. Fetch questions
            const [questions, totalParticipants, totalQuestions] = await Promise.all([
              db.question.findMany({
                where: { deletedAt: null },
                orderBy: { createdAt: "desc" },
                include: {
                  votes: {
                    orderBy: { createdAt: "asc" },
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
              db.question.count({ where: { deletedAt: null } }),
            ]);

          const creatorUserIds = Array.from(new Set(questions.map((q) => q.userId).filter(Boolean) as string[]));
          const voteParticipantIds = Array.from(
            new Set(questions.flatMap((q) => q.votes.map((v) => v.participantId)).filter(Boolean) as string[])
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

          const feedItems = questions.map((q) => {
            const totalVotes = q.votes.length;
            const redVotes = q.votes.filter((v) => v.position === 1).length;
            const redRatio = totalVotes > 0 ? redVotes / totalVotes : 0.5;
            const blueRatio = totalVotes > 0 ? (totalVotes - redVotes) / totalVotes : 0.5;
            const blueVotes = totalVotes - redVotes;

            const redComments = q.votes.filter((v) => v.position === 1).map((v) => v.comment);
            const blueComments = q.votes.filter((v) => v.position === -1).map((v) => v.comment);

            const previewComments = q.votes.slice(0, 2).map((v) => {
              const p = v.participantId ? participantById.get(v.participantId) : null;
              return {
                id: v.id,
                name: p?.name || "匿名分身",
                avatarUrl: p?.avatarUrl,
                content: v.comment,
                side: v.position === 1 ? ("red" as const) : ("blue" as const),
                tags: p?.interests || [],
              };
            });

            const structuredComments = q.votes.map((v) => {
              const p = v.participantId ? participantById.get(v.participantId) : null;
              return {
                id: v.id,
                name: p?.name || "匿名分身",
                avatarUrl: p?.avatarUrl,
                content: v.comment,
                side: v.position === 1 ? ("red" as const) : ("blue" as const),
                tags: p?.interests || [],
              };
            });

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
              userInfo: { name: creatorName, avatarUrl: creatorAvatar },
              timeAgo: new Date(q.createdAt).toLocaleString("zh-CN", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
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
              fullComments: { red: redComments, blue: blueComments },
            };
          });

          const payload = {
            success: true,
            data: feedItems,
            stats: { totalParticipants, totalQuestions },
          };

          let maxTs = 0;
          for (const q of questions) {
            const qTs = q.createdAt instanceof Date ? q.createdAt.getTime() : 0;
            if (qTs > maxTs) maxTs = qTs;
          }
          const etag = `W/"feed-${totalQuestions}-${maxTs}"`;
          feedCache = { at: Date.now(), payload, etag };
          return payload;
          } catch (err) {
            // Background refresh must not crash the handler (and must not trigger unhandled rejections).
            console.warn("[FEED] Background refresh failed; keeping stale cache:", err);
            return null;
          }
        })();
        feedInFlight = p.finally(() => {
          if (feedInFlight === p) feedInFlight = null;
        });
      }

      if (ifNoneMatch && cache.etag && ifNoneMatch === cache.etag) {
        logApiEnd(ctx, "api.feed", { status: 304, dur_ms: Date.now() - t0, cache: "stale_304" });
        return new Response(null, {
          status: 304,
          headers: {
            etag: cache.etag,
            "cache-control": cacheControlValue(),
            "x-feed-cache": "stale",
          },
        });
      }

      logApiEnd(ctx, "api.feed", { status: 200, dur_ms: Date.now() - t0, cache: "stale" });
      return NextResponse.json(cache.payload, {
        headers: {
          etag: cache.etag,
          "cache-control": cacheControlValue(),
          "x-feed-cache": "stale",
        },
      });
    }

    if (feedInFlight) {
      const payload = await feedInFlight;
      const etag = feedCache?.etag || "";
      if (ifNoneMatch && etag && ifNoneMatch === etag) {
        logApiEnd(ctx, "api.feed", { status: 304, dur_ms: Date.now() - t0, cache: "wait" });
        return new Response(null, {
          status: 304,
          headers: {
            etag,
            "cache-control": `public, s-maxage=${FEED_S_MAXAGE_SEC}, stale-while-revalidate=${FEED_SWR_SEC}`,
            "x-feed-cache": "wait",
          },
        });
      }
      logApiEnd(ctx, "api.feed", { status: 200, dur_ms: Date.now() - t0, cache: "wait" });
      return NextResponse.json(payload, {
        headers: {
          etag,
          "cache-control": cacheControlValue(),
          "x-feed-cache": "wait",
        },
      });
    }

    const p = (async () => {
    try {
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
    // Compute a cheap weak ETag based on "most recent activity" in the returned window.
    // This is not a cryptographic hash; it's meant for conditional requests (304) and CDN caching.
    let maxTs = 0;
    for (const q of questions) {
      const qTs = q.createdAt instanceof Date ? q.createdAt.getTime() : 0;
      if (qTs > maxTs) maxTs = qTs;
    }
    const etag = `W/"feed-${totalQuestions}-${maxTs}"`;
    feedCache = { at: Date.now(), payload, etag };
    return payload;
    } catch (err) {
      // Local dev often has DB connectivity issues; keep home usable with preset feed.
      console.warn("[FEED] DB query failed; falling back to preset feed:", err);
      const payload = buildFallbackFeedPayload();
      const etag = `W/"feed-fallback-${PRESET_QUESTIONS.length}"`;
      feedCache = { at: Date.now(), payload, etag };
      return payload;
    }
    })();
    feedInFlight = p.finally(() => {
      if (feedInFlight === p) feedInFlight = null;
    });

    const payload = await feedInFlight;
    const durMs = Date.now() - t0;
    const items =
      payload && typeof payload === "object" && "data" in payload && Array.isArray((payload as { data?: unknown }).data)
        ? ((payload as { data: unknown[] }).data.length)
        : undefined;
    const etag = feedCache?.etag || "";
    if (ifNoneMatch && etag && ifNoneMatch === etag) {
      logApiEnd(ctx, "api.feed", { status: 304, dur_ms: durMs, items, cache: "miss_304" });
      return new Response(null, {
        status: 304,
        headers: {
          etag,
          "cache-control": cacheControlValue(),
          "x-feed-cache": "miss",
        },
      });
    }

    logApiEnd(ctx, "api.feed", { status: 200, dur_ms: durMs, items, cache: "miss" });
    return NextResponse.json(payload, {
      headers: {
        etag,
        "cache-control": cacheControlValue(),
        "x-feed-cache": "miss",
      },
    });

  } catch (error) {
    logApiError(ctx, "api.feed", { dur_ms: Date.now() - t0, status: 500 }, error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch feed', details: String(error) },
      { status: 500 }
    );
  }
}
