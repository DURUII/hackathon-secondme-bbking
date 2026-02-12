import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { secondMeFetch } from '@/lib/secondme-server';
import { readJsonOrText } from '@/lib/secondme-http';

export interface TokenUser {
  id: string;
  secondmeUserId: string;
  accessToken: string;
  name?: string;
  avatarUrl?: string | null;
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
    // 1. Fetch User Info from SecondMe API
    const result = await secondMeFetch("/api/secondme/user/info");
    
    if (!result.hasAuth || !result.ok) {
      console.warn('[AuthHelper] Failed to fetch user info. Status:', result.status, 'Auth:', result.hasAuth);
      // If upstream fails, we might still have the user in DB?
      // Try to find user by parsing token (if JWT) or just fail?
      // Since we rely on SecondMe for identity, we probably have to fail or try to read from DB using the token?
      // But we don't store token->user mapping in a way that allows reverse lookup easily without `secondmeUserId`.
      // Actually, we store `accessToken` in DB. We COULD try to find user by accessToken!
      
      if (token.value) {
          try {
            const dbUser = await db.user.findFirst({
                where: { accessToken: token.value }
            });
            if (dbUser) {
                console.log('[AuthHelper] Recovered user from DB by token');
                // Also lookup participant for correct name
                const participant = await db.participant.findUnique({
                    where: { secondmeId: dbUser.secondmeUserId }
                });
                return {
                    id: dbUser.id,
                    secondmeUserId: dbUser.secondmeUserId,
                    accessToken: token.value,
                    name: participant?.name || dbUser.secondmeUserId,
                    avatarUrl: participant?.avatarUrl,
                };
            }
          } catch (dbError) {
             console.error('[AuthHelper] DB Lookup Failed:', dbError);
          }
      }
      
      // NO MOCK FALLBACK: Strict authentication required
      console.warn('[AuthHelper] Failed to recover user. Returning null.');
      return null;
    }

    const json = await readJsonOrText(result.resp) as {
      data?: {
        id?: string;
        userId?: string;
        name?: string;
        nickname?: string;
        avatar?: string;
        avatarUrl?: string;
      };
    } | undefined;
    const userInfo = json?.data;
    const secondmeUserId = userInfo?.id ?? userInfo?.userId;
    
    if (!userInfo || !secondmeUserId) {
       console.warn('[AuthHelper] Invalid user info structure', json);

       // Try DB recovery if API returns invalid data (rare)
       if (token.value) {
           const dbUser = await db.user.findFirst({ where: { accessToken: token.value } });
           if (dbUser) {
               const participant = await db.participant.findUnique({
                   where: { secondmeId: dbUser.secondmeUserId }
               });
               return {
                   id: dbUser.id,
                   secondmeUserId: dbUser.secondmeUserId,
                   accessToken: token.value,
                   name: participant?.name || dbUser.secondmeUserId,
                   avatarUrl: participant?.avatarUrl,
               };
           }
       }
       return null;
    }

    const normalizedSecondmeUserId = String(secondmeUserId);
    const name = userInfo.name || userInfo.nickname || '用户';
    const avatarUrl = userInfo.avatar || userInfo.avatarUrl;

    // 2. Upsert User in Database
    const user = await db.user.upsert({
        where: { secondmeUserId: normalizedSecondmeUserId },
        update: {
            accessToken: token.value,
            tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        create: {
            secondmeUserId: normalizedSecondmeUserId,
            accessToken: token.value,
            refreshToken: cookieStore.get('secondme_refresh_token')?.value || '',
            tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        }
    });

    return {
      id: user.id,
      secondmeUserId: user.secondmeUserId,
      accessToken: token.value,
      name,
      avatarUrl
    };
  } catch (error) {
    console.error('[AuthHelper] getUserFromToken error:', error);
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
    // Update last active time & info if changed
    return db.participant.update({
      where: { id: existing.id },
      data: { 
          lastActiveAt: new Date(),
          name: user.name || existing.name,
          avatarUrl: user.avatarUrl || existing.avatarUrl
      },
    });
  }

  // Create new participant
  return db.participant.create({
    data: {
      secondmeId: user.secondmeUserId,
      name: user.name || '用户',
      avatarUrl: user.avatarUrl,
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
