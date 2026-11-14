import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { UserRole, UserStatus } from '../../generated/prisma/client.js';

export interface AuthContext {
  readonly userId: string;
  readonly sessionId: string;
  readonly role: UserRole;
  readonly status: UserStatus;
}

export type AuthenticatedRequest = Request & { auth?: AuthContext };

export const IS_PUBLIC = 'vyra:isPublic';
/** Marks a route as reachable without an access token. Everything else requires one. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = 'vyra:roles';
/** Restricts a route to the given roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);

/** The authenticated caller. Only valid on non-public routes. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const { auth } = context.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!auth) throw new Error('@CurrentUser() used on a route without authentication');
  return auth;
});
