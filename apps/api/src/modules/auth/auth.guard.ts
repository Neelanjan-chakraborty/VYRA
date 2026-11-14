import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service.js';
import type { UserRole } from '../../generated/prisma/client.js';
import { type AuthenticatedRequest, IS_PUBLIC, ROLES } from './auth.decorators.js';
import { isUsable } from './auth.service.js';
import { TokenService } from './token.service.js';

const UNAUTHENTICATED = 'Sign in to continue.';

/**
 * Global guard: every route needs a valid access token unless marked `@Public()`.
 * The session is checked against the database on each request, so logout,
 * token-reuse revocation and account deletion take effect immediately.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const claims = token ? await this.tokens.verifyAccess(token) : null;
    if (!claims) throw new UnauthorizedException(UNAUTHENTICATED);

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
      throw new UnauthorizedException(UNAUTHENTICATED);
    }

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, targets);
    if (roles && !roles.includes(session.user.role)) {
      throw new ForbiddenException('You do not have access to this.');
    }

    request.auth = {
      userId: claims.userId,
      sessionId: claims.sessionId,
      role: session.user.role,
      status: session.user.status,
    };
    return true;
  }
}
