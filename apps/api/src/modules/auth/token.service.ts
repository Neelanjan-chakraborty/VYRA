import { Inject, Injectable } from '@nestjs/common';
import type { OtpChannel } from '@vyra/validation';
import { jwtVerify, SignJWT } from 'jose';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';

const ISSUER = 'vyra-api';
const ACCESS_AUDIENCE = 'vyra:access';
const REGISTRATION_AUDIENCE = 'vyra:registration';
const REGISTRATION_TTL_SECONDS = 15 * 60;

export interface AccessClaims {
  readonly userId: string;
  readonly sessionId: string;
}

export interface RegistrationClaims {
  readonly channel: OtpChannel;
  readonly destination: string;
}

@Injectable()
export class TokenService {
  private readonly key: Uint8Array;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.key = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
  }

  signAccess(claims: AccessClaims): Promise<string> {
    return new SignJWT({ sid: claims.sessionId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.userId)
      .setIssuer(ISSUER)
      .setAudience(ACCESS_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${this.env.ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.key);
  }

  /** Returns null for any token that is malformed, expired, or not an access token. */
  async verifyAccess(token: string): Promise<AccessClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        audience: ACCESS_AUDIENCE,
        algorithms: ['HS256'],
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null;
      return { userId: payload.sub, sessionId: payload.sid };
    } catch {
      return null;
    }
  }

  /** Proof that a destination passed OTP verification and may now register. */
  signRegistration(claims: RegistrationClaims): Promise<string> {
    return new SignJWT({ ch: claims.channel, dst: claims.destination })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(ISSUER)
      .setAudience(REGISTRATION_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${REGISTRATION_TTL_SECONDS}s`)
      .sign(this.key);
  }

  async verifyRegistration(token: string): Promise<RegistrationClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        audience: REGISTRATION_AUDIENCE,
        algorithms: ['HS256'],
      });
      const { ch, dst } = payload;
      if ((ch !== 'email' && ch !== 'phone') || typeof dst !== 'string') return null;
      return { channel: ch, destination: dst };
    } catch {
      return null;
    }
  }
}
