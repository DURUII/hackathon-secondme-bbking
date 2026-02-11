import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const SEED_QUESTIONS = [
  {
    content: "刚相亲的男生让我AA这杯30块钱的咖啡，我该转给他吗？",
    arenaType: "toxic",
    imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80"
  },
  {
    content: "男朋友生日，我送了他一个手写的‘愿望兑换券’，他居然问我这个能折现吗？我想分手。",
    arenaType: "toxic",
    imageUrl: "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?w=800&q=80"
  },
  {
    content: "我妈非要给我那个丑得要死的沙发套盖在我的真皮沙发上。我扔了，她哭了。",
    arenaType: "toxic",
    imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80"
  },
  {
    content: "老板半夜让加班，该不该回？",
    arenaType: "toxic",
    imageUrl: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=800&q=80"
  },
  {
    content: "女朋友不让我打游戏，但我工作压力很大，我该听她的吗？",
    arenaType: "toxic",
    imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80"
  }
];

export async function GET() {
  return POST();
}

export async function POST() {
  try {
    console.log('[SEED] Keys:', Object.keys(db));
    
    // Check if db.question exists
    if (!db.question) {
       throw new Error(`db.question is missing. Available keys: ${Object.keys(db).join(', ')}`);
    }

    console.log('[SEED] Starting RESET process...');
    
    // 1. Clear Database (Reverse Order)
    await db.debateTurn.deleteMany({});
    await db.debateRole.deleteMany({});
    await db.vote.deleteMany({});
    await db.question.deleteMany({});
    // We keep User/Session/Participant to avoid logging everyone out, unless explicitly requested to nuke EVERYTHING.
    // The user said "clear supabase database... then re-add questions".
    // If I delete users, they will be logged out. But the user said "why user table is empty", so maybe they want it cleared to see it refill.
    // Let's clear Participant but maybe keep User/Session so they don't lose login cookie?
    // Actually, if User table is empty (as they claim), deleting it does nothing.
    // But if I fixed auth-helper, the next login/visit will recreate User.
    // Let's play safe and delete Participant but keep User/Session to avoid "Invalid Session" errors immediately.
    // Wait, the user said "why I authorized but user table empty".
    // If I clear User table, they have to re-login. That's fine for a "reset".
    await db.participant.deleteMany({});
    // await db.session.deleteMany({}); // Optional
    // await db.user.deleteMany({});    // Optional

    console.log('[SEED] Database cleared (Questions/Participants/Votes). Starting SEED...');
    
    // 2. Fill NPCs
    const { PrismaClient } = require('@prisma/client');
    const NPCS = [
      { name: "毒舌女王", secondmeId: "npc_toxic", avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Toxic", interests: ["犀利", "直接", "不留情面"] },
      { name: "理性派", secondmeId: "npc_rational", avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Rational", interests: ["逻辑", "客观", "数据"] },
      { name: "知心大姐", secondmeId: "npc_comfort", avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Comfort", interests: ["温柔", "共情", "治愈"] },
      { name: "社畜小李", secondmeId: "npc_worker", avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Worker", interests: ["打工人", "无奈", "现实"] },
      { name: "卷王之王", secondmeId: "npc_king", avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=King", interests: ["奋斗", "内卷", "成功学"] },
      { name: "吃瓜群众", secondmeId: "npc_observer", avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Observer", interests: ["看戏", "中立", "吐槽"] }
    ];
    
    for (const npc of NPCS) {
      await db.participant.upsert({
        where: { secondmeId: npc.secondmeId },
        update: { isActive: true },
        create: {
          secondmeId: npc.secondmeId,
          name: npc.name,
          avatarUrl: npc.avatarUrl,
          interests: npc.interests,
          isActive: true
        }
      });
    }
    console.log('[SEED] NPCs Filled.');

    let createdCount = 0;

    for (const q of SEED_QUESTIONS) {
      // Check if exists
      const existing = await db.question.findFirst({
        where: { content: q.content }
      });

      if (!existing) {
        await db.question.create({
          data: {
            content: q.content,
            arenaType: q.arenaType,
            imageUrl: q.imageUrl,
            status: 'pending',
            round: 0
          }
        });
        createdCount++;
      }
    }

    console.log(`[SEED] Completed. Created ${createdCount} questions.`);

    return NextResponse.json({
      success: true,
      data: { createdCount }
    });
  } catch (error) {
    console.error('[SEED] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to seed questions', details: String(error) },
      { status: 500 }
    );
  }
}
