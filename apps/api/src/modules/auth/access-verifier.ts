import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { AuthContext } from './auth.decorators.js';
import { isUsable } from './auth.service.js';
import { TokenService } from './token.service.js';

/**
 * Turns an access token into the signed-in person, checking the session in the
 * database every time so logout, token-reuse revocation and account deletion
 * take effect immediately. Shared by HTTP requests and socket connections.
 */
@Injectable()
export class AccessVerifier {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async verify(token: string | undefined): Promise<AuthContext | null> {
    const claims = token ? await this.tokens.verifyAccess(token) : null;
    if (!claims) return null;
    const session = await this.prisma.authSession.findUnique({
      where: { id: claims.sessionId },
      select: {
        userId: true,
        revokedAt: true,
        expiresAt: true,
        user: { select: { role: true, status: true } },
      },
    });
    if (
      !session ||
      session.userId !== claims.userId ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date() ||
      !isUsable(session.user.status)
    ) {
      return null;
    }
    return {
      userId: claims.userId,
      sessionId: claims.sessionId,
      role: session.user.role,
      status: session.user.status,
    };
  }
}
