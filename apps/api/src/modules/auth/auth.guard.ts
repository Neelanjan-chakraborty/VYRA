import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '../../generated/prisma/client.js';
import { type AuthenticatedRequest, IS_PUBLIC, ROLES } from './auth.decorators.js';
import { AccessVerifier } from './access-verifier.js';

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
    private readonly access: AccessVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const auth = await this.access.verify(
      header?.startsWith('Bearer ') ? header.slice(7) : undefined,
    );
    if (!auth) throw new UnauthorizedException(UNAUTHENTICATED);

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, targets);
    if (roles && !roles.includes(auth.role)) {
      throw new ForbiddenException('You do not have access to this.');
    }

    request.auth = auth;
    return true;
  }
}
