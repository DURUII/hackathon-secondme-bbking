
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const NPCS = [
  { name: "毒舌女王", secondmeId: "npc_toxic", avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Toxic", interests: ["犀利", "直接", "不留情面"] },
  { name: "理性派", secondmeId: "npc_rational", avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Rational", interests: ["逻辑", "客观", "数据"] },
  { name: "知心大姐", secondmeId: "npc_comfort", avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Comfort", interests: ["温柔", "共情", "治愈"] },
  { name: "社畜小李", secondmeId: "npc_worker", avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Worker", interests: ["打工人", "无奈", "现实"] },
  { name: "卷王之王", secondmeId: "npc_king", avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=King", interests: ["奋斗", "内卷", "成功学"] },
  { name: "吃瓜群众", secondmeId: "npc_observer", avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Observer", interests: ["看戏", "中立", "吐槽"] },
  { name: "和稀泥", secondmeId: "npc_peace", avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Peace", interests: ["和平", "调解", "两边倒"] },
  { name: "老好人", secondmeId: "npc_nice", avatarUrl: "https://api.dicebear.com/7.x/notionists/svg?seed=Nice", interests: ["善良", "忍让", "吃亏"] }
];

async function main() {
  console.log('🤖 Filling NPCs...');
  
  for (const npc of NPCS) {
    await prisma.participant.upsert({
      where: { secondmeId: npc.secondmeId },
      update: {
        name: npc.name,
        avatarUrl: npc.avatarUrl,
        interests: npc.interests,
        isActive: true
      },
      create: {
        secondmeId: npc.secondmeId,
        name: npc.name,
        avatarUrl: npc.avatarUrl,
        interests: npc.interests,
        isActive: true
      }
    });
    console.log(`✅ Upserted NPC: ${npc.name}`);
  }
  
  const count = await prisma.participant.count();
  console.log(`🎉 Total participants: ${count}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
