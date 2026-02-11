
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const qCount = await prisma.question.count();
    const uCount = await prisma.user.count();
    const pCount = await prisma.participant.count();
    
    console.log(JSON.stringify({
      success: true,
      counts: {
        questions: qCount,
        users: uCount,
        participants: pCount
      }
    }));
  } catch (e) {
    console.log(JSON.stringify({
      success: false,
      error: e.message
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main();
