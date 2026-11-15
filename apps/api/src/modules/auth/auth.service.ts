import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ageInYears,
  MINIMUM_AGE_YEARS,
  OTP_LENGTH,
  type AuthTokens,
  type OtpChannel,
  type OtpRequestResponse,
  type OtpVerifyResponse,
} from '@vyra/validation';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { hmacHex, randomOtp, randomToken, safeEqualHex, sha256Hex } from './crypto.js';
import { OTP_SENDER, type OtpSender } from './otp-sender.js';
import { TokenService } from './token.service.js';

export const OTP_TTL_SECONDS = 10 * 60;
export const OTP_MAX_ATTEMPTS = 5;
/** Codes one destination may request inside the window below. */
export const OTP_MAX_REQUESTS_PER_WINDOW = 3;
export const OTP_REQUEST_WINDOW_SECONDS = 10 * 60;

const INVALID_CODE = 'That code is incorrect or has expired. Request a new one.';
const INVALID_SESSION = 'Your session has ended. Sign in again.';

interface Contact {
  readonly channel: OtpChannel;
  readonly destination: string;
}

interface RegistrationInput {
  readonly registrationToken: string;
  readonly dateOfBirth: string;
  readonly acceptedTermsVersion: string;
  readonly acceptedPrivacyVersion: string;
}

interface RequestContext {
  readonly requestId?: string;
  readonly userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(OTP_SENDER) private readonly otpSender: OtpSender,
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
  ) {}

  private destinationHash(contact: Contact): string {
    return hmacHex(this.env.OTP_PEPPER, `${contact.channel}:${contact.destination}`);
  }

  private codeHash(challengeId: string, code: string): string {
    return hmacHex(this.env.OTP_PEPPER, `${challengeId}:${code}`);
  }

  /**
   * Issues a one-time code. The response is identical whether or not an account
   * exists for the destination, so this endpoint cannot be used to enumerate users.
   */
  async requestOtp(contact: Contact): Promise<OtpRequestResponse> {
    const destinationHash = this.destinationHash(contact);
    const windowStart = new Date(Date.now() - OTP_REQUEST_WINDOW_SECONDS * 1000);
    const recent = await this.prisma.otpChallenge.count({
      where: { destinationHash, createdAt: { gte: windowStart } },
    });
    if (recent >= OTP_MAX_REQUESTS_PER_WINDOW) {
      throw new HttpException(
        'Too many codes requested. Wait a few minutes and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = randomOtp(OTP_LENGTH);
    const id = crypto.randomUUID();
    const now = new Date();
    await this.prisma.$transaction([
      // A new code supersedes any earlier unused one for the same destination.
      this.prisma.otpChallenge.updateMany({
        where: { destinationHash, consumedAt: null },
        data: { consumedAt: now },
      }),
      this.prisma.otpChallenge.create({
        data: {
          id,
          channel: contact.channel === 'email' ? 'EMAIL' : 'PHONE',
          destinationHash,
          codeHash: this.codeHash(id, code),
          expiresAt: new Date(now.getTime() + OTP_TTL_SECONDS * 1000),
        },
      }),
    ]);
    await this.otpSender.send(contact.channel, contact.destination, code);

    return {
      challengeId: id,
      expiresInSeconds: OTP_TTL_SECONDS,
      ...(this.otpSender.revealsCode ? { devCode: code } : {}),
    };
  }

  async verifyOtp(
    input: Contact & { challengeId: string; code: string },
    context: RequestContext,
  ): Promise<OtpVerifyResponse> {
    // Count the attempt first, atomically, so parallel guesses cannot exceed the cap.
    const claimed = await this.prisma.otpChallenge.updateMany({
      where: {
        id: input.challengeId,
        destinationHash: this.destinationHash(input),
        consumedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: OTP_MAX_ATTEMPTS },
      },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) throw new UnauthorizedException(INVALID_CODE);

    const challenge = await this.prisma.otpChallenge.findUniqueOrThrow({
      where: { id: input.challengeId },
    });
    if (!safeEqualHex(challenge.codeHash, this.codeHash(challenge.id, input.code))) {
      throw new UnauthorizedException(INVALID_CODE);
    }
    const consumed = await this.prisma.otpChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw new UnauthorizedException(INVALID_CODE);

    const user = await this.prisma.user.findFirst({
      where:
        input.channel === 'email' ? { email: input.destination } : { phone: input.destination },
    });
    if (!user) {
      return {
        status: 'registration_required',
        registrationToken: await this.tokens.signRegistration(input),
      };
    }
    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException('This account is suspended.');
    }
    const tokens = await this.startSession(user.id, context);
    await this.audit.record({
      action: 'auth.signed_in',
      actorId: user.id,
      requestId: context.requestId,
    });
    return { status: 'authenticated', tokens };
  }

  /** Creates the account. Nothing is stored for anyone under the minimum age. */
  async register(input: RegistrationInput, context: RequestContext): Promise<AuthTokens> {
    const claims = await this.tokens.verifyRegistration(input.registrationToken);
    if (!claims) {
      throw new UnauthorizedException('Your verification has expired. Start again.');
    }
    if (ageInYears(input.dateOfBirth) < MINIMUM_AGE_YEARS) {
      await this.audit.record({
        action: 'auth.registration_refused_underage',
        requestId: context.requestId,
      });
      throw new ForbiddenException(`VYRA is only for people aged ${MINIMUM_AGE_YEARS} or over.`);
    }

    const now = new Date();
    let userId: string;
    try {
      const user = await this.prisma.user.create({
        data: {
          ...(claims.channel === 'email'
            ? { email: claims.destination }
            : { phone: claims.destination }),
          dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00Z`),
          ageVerifiedAt: now,
          consents: {
            create: [
              { type: 'TERMS_OF_SERVICE', policyVersion: input.acceptedTermsVersion },
              { type: 'PRIVACY_POLICY', policyVersion: input.acceptedPrivacyVersion },
            ],
          },
        },
      });
      userId = user.id;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account already exists. Sign in instead.');
      }
      throw error;
    }
    await this.audit.record({
      action: 'auth.registered',
      actorId: userId,
      requestId: context.requestId,
    });
    return this.startSession(userId, context);
  }

  /**
   * Rotates a refresh token. Presenting a token that was already rotated means it
   * leaked, so every session of that account is revoked.
   */
  async refresh(refreshToken: string, context: RequestContext): Promise<AuthTokens> {
    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: sha256Hex(refreshToken) },
      include: { user: { select: { status: true } } },
    });
    if (!session) throw new UnauthorizedException(INVALID_SESSION);

    if (session.revokedAt) {
      await this.revokeAllSessions(session.userId);
      await this.audit.record({
        action: 'auth.refresh_reuse_detected',
        actorId: session.userId,
        requestId: context.requestId,
      });
      throw new UnauthorizedException(INVALID_SESSION);
    }
    if (session.expiresAt <= new Date() || !isUsable(session.user.status)) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    const revoked = await this.prisma.authSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count !== 1) {
      await this.revokeAllSessions(session.userId);
      throw new UnauthorizedException(INVALID_SESSION);
    }
    return this.startSession(session.userId, context);
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.realtime.disconnectSession(sessionId);
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.realtime.disconnectUsers([userId]);
  }

  private async startSession(userId: string, context: RequestContext): Promise<AuthTokens> {
    const refreshToken = randomToken();
    const session = await this.prisma.authSession.create({
      data: {
        userId,
        refreshTokenHash: sha256Hex(refreshToken),
        userAgent: context.userAgent?.slice(0, 200) ?? null,
        expiresAt: new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
      },
    });
    await this.prisma.user.update({ where: { id: userId }, data: { lastActiveAt: new Date() } });
    return {
      accessToken: await this.tokens.signAccess({ userId, sessionId: session.id }),
      refreshToken,
      accessTokenExpiresInSeconds: this.env.ACCESS_TOKEN_TTL_SECONDS,
    };
  }
}

export function isUsable(status: string): boolean {
  return status === 'ONBOARDING' || status === 'ACTIVE' || status === 'PAUSED';
}
