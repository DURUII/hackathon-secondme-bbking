import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { QuestionManager } from '@/lib/question-manager';
import { VoteManager } from '@/lib/vote-manager';
import { ParticipantManager } from '@/lib/participant-manager';

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

export async function GET() {
  try {
    // 1. Check if we need to seed
    const count = await db.question.count();
    
    if (count === 0) {
      console.log('[FEED] Seeding database with preset questions...');
      
      // Ensure Mock Participants exist
      const participantMap = new Map<string, string>(); // name -> id
      
      for (const p of MOCK_PARTICIPANTS) {
        // Try to find or create
        let participant = await db.participant.findUnique({ where: { secondmeId: p.secondmeId } });
        if (!participant) {
          participant = await db.participant.create({
            data: {
              secondmeId: p.secondmeId,
              name: p.name,
              avatarUrl: p.avatarUrl,
              isActive: true,
            }
          });
        }
        participantMap.set(p.name, participant.id);
      }

      // Get a seed user ID (optional)
      const firstUser = await db.user.findFirst();
      const seedUserId = firstUser?.id;

      // Create Questions and Votes
      for (const preset of PRESET_QUESTIONS) {
        const question = await QuestionManager.createQuestion({
          userId: seedUserId,
          content: preset.content,
          arenaType: preset.arenaType,
          status: 'collected'
        });

        // Add Mock Votes
        for (const vote of preset.mockVotes) {
          const pId = participantMap.get(vote.name);
          if (pId) {
            await VoteManager.createVote({
              questionId: question.id,
              participantId: pId,
              position: vote.position,
              comment: vote.comment
            });
          }
        }
      }
    }

    // 2. Fetch questions with votes
    const questions = await db.question.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        votes: true,
      },
      take: 20, 
    });

    // 3. Transform to Feed format
    const feedItems = await Promise.all(questions.map(async (q) => {
      // Calculate ratios
      const totalVotes = q.votes.length;
      const redVotes = q.votes.filter(v => v.position === 1).length;
      const redRatio = totalVotes > 0 ? redVotes / totalVotes : 0;
      const blueRatio = totalVotes > 0 ? (totalVotes - redVotes) / totalVotes : 0;

      // Get comments
      const redComments = q.votes.filter(v => v.position === 1).map(v => v.comment);
      const blueComments = q.votes.filter(v => v.position === -1).map(v => v.comment);

      // Get participant names for preview
      const participantIds = Array.from(new Set(q.votes.map(v => v.participantId).filter(Boolean) as string[]));
      const participants = await db.participant.findMany({
        where: { id: { in: participantIds } }
      });
      const participantMap = new Map(participants.map(p => [p.id, p]));

      // Get preview comments (top 2 distinct participants)
      const previewComments = q.votes.slice(0, 2).map(v => {
        const p = v.participantId ? participantMap.get(v.participantId) : null;
        return {
          name: p?.name || '匿名分身',
          content: v.comment,
          side: v.position === 1 ? 'red' as const : 'blue' as const
        };
      });

      // User info
      let posterName = "热门话题";
      let posterAvatar = `https://api.dicebear.com/7.x/notionists/svg?seed=${q.id}`;
      
      if (q.userId) {
         // In a real app we would fetch user info. 
         // For now, let's just make it look consistent if it's a seed user
         // If we had a User relation we could include it.
         // Let's assume seed user is "匿名用户" for now unless we fetched it.
      }

      return {
        id: q.id,
        userInfo: {
          name: posterName,
          avatarUrl: posterAvatar,
        },
        timeAgo: new Date(q.createdAt).toLocaleDateString(),
        content: q.content,
        arenaType: q.arenaType,
        status: q.status,
        redRatio,
        blueRatio,
        commentCount: totalVotes,
        previewComments,
        fullComments: {
          red: redComments,
          blue: blueComments
        }
      };
    }));

    return NextResponse.json({
      success: true,
      data: feedItems
    });

  } catch (error) {
    console.error('[FEED] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch feed' },
      { status: 500 }
    );
  }
}
