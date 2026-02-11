
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

async function main() {
  console.log('Starting seed...');
  let count = 0;
  for (const q of SEED_QUESTIONS) {
    const existing = await prisma.question.findFirst({
      where: { content: q.content }
    });
    if (!existing) {
      await prisma.question.create({
        data: {
          content: q.content,
          arenaType: q.arenaType,
          imageUrl: q.imageUrl,
          status: 'pending',
          round: 0
        }
      });
      console.log(`Created: ${q.content.substring(0, 10)}...`);
      count++;
    } else {
      console.log(`Skipped: ${q.content.substring(0, 10)}...`);
    }
  }
  console.log(`Seed completed. Created ${count} questions.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
