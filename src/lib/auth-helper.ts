import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export interface TokenUser {
  id: string;
  secondmeUserId: string;
  accessToken: string;
}

/**
 * Get user from access token cookie
 */
export async function getUserFromToken(): Promise<TokenUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('secondme_access_token');

  if (!token?.value) {
    return null;
  }

  try {
    // 在生产环境中，应该查询数据库获取用户信息
    // 这里先返回 mock 数据用于开发测试
    return {
      id: 'demo-user',
      secondmeUserId: 'demo-secondme-id',
      accessToken: token.value,
    };
  } catch {
    return null;
  }
}

/**
 * Get or create participant for authenticated user
 */
export async function getOrCreateParticipant(user: TokenUser) {
  // Try to find existing participant
  const existing = await db.participant.findUnique({
    where: { secondmeId: user.secondmeUserId },
  });

  if (existing) {
    // Update last active time
    return db.participant.update({
      where: { id: existing.id },
      data: { lastActiveAt: new Date() },
    });
  }

  // Create new participant
  return db.participant.create({
    data: {
      secondmeId: user.secondmeUserId,
      name: '用户', // 后续可以从 /user/info 获取真实姓名
      isActive: true,
    },
  });
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return Boolean(cookieStore.get('secondme_access_token')?.value);
}
