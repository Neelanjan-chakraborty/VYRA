import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION, type AuthTokens } from '@vyra/validation';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { ENV } from '../../src/config/config.module.js';
import type { Env } from '../../src/config/env.js';
import { configureApp } from '../../src/configure-app.js';

export type TestApp = INestApplication<App>;

export async function createTestApp(envOverride: Partial<Env> = {}): Promise<TestApp> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (Object.keys(envOverride).length > 0) {
    const { parseEnv } = await import('../../src/config/env.js');
    builder.overrideProvider(ENV).useValue({ ...parseEnv(process.env), ...envOverride });
  }
  const moduleRef = await builder.compile();
  const app: TestApp = moduleRef.createNestApplication();
  configureApp(app, app.get<Env>(ENV));
  await app.init();
  return app;
}

let counter = 0;
/** A fresh e-mail address per call so tests never collide, even across runs. */
export function uniqueEmail(): string {
  counter += 1;
  return `test-${Date.now()}-${process.pid}-${counter}@example.test`;
}

export function uniquePhone(): string {
  counter += 1;
  return `+9198${String(Date.now() + counter).slice(-8)}`;
}

export const ADULT_DOB = '1998-04-12';

export interface TestUser {
  readonly email: string;
  readonly tokens: AuthTokens;
  readonly auth: { Authorization: string };
}

export async function requestCode(app: TestApp, email: string) {
  const response = await request(app.getHttpServer())
    .post('/v1/auth/otp/request')
    .send({ channel: 'email', destination: email })
    .expect(202);
  return response.body as { challengeId: string; devCode: string };
}

/** Registers a brand-new adult through the real HTTP flow. */
export async function registerUser(
  app: TestApp,
  email = uniqueEmail(),
  dateOfBirth = ADULT_DOB,
): Promise<TestUser> {
  const { challengeId, devCode } = await requestCode(app, email);
  const verified = await request(app.getHttpServer())
    .post('/v1/auth/otp/verify')
    .send({ channel: 'email', destination: email, challengeId, code: devCode })
    .expect(200);
  const registered = await request(app.getHttpServer())
    .post('/v1/auth/register')
    .send({
      registrationToken: verified.body.registrationToken,
      dateOfBirth,
      acceptedTermsVersion: CURRENT_TERMS_VERSION,
      acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
    })
    .expect(201);
  const tokens = registered.body as AuthTokens;
  return { email, tokens, auth: { Authorization: `Bearer ${tokens.accessToken}` } };
}

/** Waits until moderation has moved one of the user's photos out of PENDING. */
export async function waitForPhoto(
  app: TestApp,
  user: { auth: { Authorization: string } },
  photoId: string,
  status: 'APPROVED' | 'REJECTED' | 'REVIEW_REQUIRED' = 'APPROVED',
): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    const me = await request(app.getHttpServer()).get('/v1/me').set(user.auth);
    const photo = (me.body.photos as { id: string; status: string }[] | undefined)?.find(
      (p) => p.id === photoId,
    );
    if (photo?.status === status) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Photo ${photoId} never reached ${status}`);
}
