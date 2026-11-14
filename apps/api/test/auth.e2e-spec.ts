import {
  authTokensSchema,
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  meSchema,
} from '@vyra/validation';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { TokenService } from '../src/modules/auth/token.service.js';
import {
  ADULT_DOB,
  createTestApp,
  registerUser,
  requestCode,
  uniqueEmail,
  uniquePhone,
  type TestApp,
} from './support/app.js';

const consent = {
  acceptedTermsVersion: CURRENT_TERMS_VERSION,
  acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
};

describe('Authentication (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => {
    await app.close();
  });

  async function verify(email: string) {
    const { challengeId, devCode } = await requestCode(app, email);
    return http()
      .post('/v1/auth/otp/verify')
      .send({ channel: 'email', destination: email, challengeId, code: devCode });
  }

  describe('requesting a code', () => {
    it('stores only hashes of the code and destination', async () => {
      const email = uniqueEmail();
      const { challengeId, devCode } = await requestCode(app, email);
      const row = await prisma.otpChallenge.findUniqueOrThrow({ where: { id: challengeId } });
      expect(devCode).toMatch(/^\d{6}$/);
      expect(JSON.stringify(row)).not.toContain(devCode);
      expect(JSON.stringify(row)).not.toContain(email);
    });

    it('answers identically for known and unknown destinations', async () => {
      const known = await registerUser(app);
      const a = await http()
        .post('/v1/auth/otp/request')
        .send({ channel: 'email', destination: known.email });
      const b = await http()
        .post('/v1/auth/otp/request')
        .send({ channel: 'email', destination: uniqueEmail() });
      expect(a.status).toBe(202);
      expect(b.status).toBe(202);
      expect(Object.keys(a.body).toSorted()).toEqual(Object.keys(b.body).toSorted());
    });

    it('limits codes per destination', async () => {
      const email = uniqueEmail();
      for (let i = 0; i < 3; i += 1) await requestCode(app, email);
      const response = await http()
        .post('/v1/auth/otp/request')
        .send({ channel: 'email', destination: email });
      expect(response.status).toBe(429);
      expect(response.body.error.code).toBe('RATE_LIMITED');
    });

    it('rejects malformed destinations with field details', async () => {
      const response = await http()
        .post('/v1/auth/otp/request')
        .send({ channel: 'phone', destination: '12345' });
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(response.body.error.details[0].path).toBe('destination');
    });

    it('accepts phone numbers', async () => {
      const response = await http()
        .post('/v1/auth/otp/request')
        .send({ channel: 'phone', destination: uniquePhone() });
      expect(response.status).toBe(202);
    });
  });

  describe('verifying a code', () => {
    it('rejects a wrong code and locks the challenge after five attempts', async () => {
      const email = uniqueEmail();
      const { challengeId, devCode } = await requestCode(app, email);
      const wrong = devCode === '000000' ? '111111' : '000000';
      for (let i = 0; i < 5; i += 1) {
        await http()
          .post('/v1/auth/otp/verify')
          .send({ channel: 'email', destination: email, challengeId, code: wrong })
          .expect(401);
      }
      // The right code no longer works once the attempts are used up.
      await http()
        .post('/v1/auth/otp/verify')
        .send({ channel: 'email', destination: email, challengeId, code: devCode })
        .expect(401);
    });

    it('rejects a code replayed after success', async () => {
      const email = uniqueEmail();
      const { challengeId, devCode } = await requestCode(app, email);
      const body = { channel: 'email', destination: email, challengeId, code: devCode };
      await http().post('/v1/auth/otp/verify').send(body).expect(200);
      await http().post('/v1/auth/otp/verify').send(body).expect(401);
    });

    it('rejects a code presented for a different destination', async () => {
      const { challengeId, devCode } = await requestCode(app, uniqueEmail());
      await http()
        .post('/v1/auth/otp/verify')
        .send({ channel: 'email', destination: uniqueEmail(), challengeId, code: devCode })
        .expect(401);
    });

    it('rejects an expired code', async () => {
      const email = uniqueEmail();
      const { challengeId, devCode } = await requestCode(app, email);
      await prisma.otpChallenge.update({
        where: { id: challengeId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await http()
        .post('/v1/auth/otp/verify')
        .send({ channel: 'email', destination: email, challengeId, code: devCode })
        .expect(401);
    });

    it('a newer code invalidates the older one', async () => {
      const email = uniqueEmail();
      const first = await requestCode(app, email);
      await requestCode(app, email);
      await http()
        .post('/v1/auth/otp/verify')
        .send({
          channel: 'email',
          destination: email,
          challengeId: first.challengeId,
          code: first.devCode,
        })
        .expect(401);
    });
  });

  describe('registration', () => {
    it('asks a new person to register and creates no account before that', async () => {
      const email = uniqueEmail();
      const response = await verify(email);
      expect(response.body.status).toBe('registration_required');
      expect(await prisma.user.count({ where: { email } })).toBe(0);
    });

    it('creates the account with age verification and recorded consent', async () => {
      const user = await registerUser(app);
      authTokensSchema.parse(user.tokens);
      const row = await prisma.user.findUniqueOrThrow({
        where: { email: user.email },
        include: { consents: true },
      });
      expect(row.status).toBe('ONBOARDING');
      expect(row.ageVerifiedAt).not.toBeNull();
      expect(row.consents.map((c) => c.type).toSorted()).toEqual([
        'PRIVACY_POLICY',
        'TERMS_OF_SERVICE',
      ]);
    });

    it('refuses anyone under 18 and stores nothing about them', async () => {
      const email = uniqueEmail();
      const { body } = await verify(email);
      const seventeen = new Date();
      seventeen.setUTCFullYear(seventeen.getUTCFullYear() - 18);
      seventeen.setUTCDate(seventeen.getUTCDate() + 1);
      const response = await http()
        .post('/v1/auth/register')
        .send({
          registrationToken: body.registrationToken,
          dateOfBirth: seventeen.toISOString().slice(0, 10),
          ...consent,
        });
      expect(response.status).toBe(403);
      expect(await prisma.user.count({ where: { email } })).toBe(0);
    });

    it('accepts someone who turns 18 today', async () => {
      const { body } = await verify(uniqueEmail());
      const today = new Date();
      today.setUTCFullYear(today.getUTCFullYear() - 18);
      await http()
        .post('/v1/auth/register')
        .send({
          registrationToken: body.registrationToken,
          dateOfBirth: today.toISOString().slice(0, 10),
          ...consent,
        })
        .expect(201);
    });

    it('requires consent to the current terms and privacy policy', async () => {
      const { body } = await verify(uniqueEmail());
      const response = await http().post('/v1/auth/register').send({
        registrationToken: body.registrationToken,
        dateOfBirth: ADULT_DOB,
        acceptedTermsVersion: '1999-01',
      });
      expect(response.status).toBe(422);
    });

    it('rejects forged registration tokens and access tokens used as one', async () => {
      const user = await registerUser(app);
      for (const registrationToken of ['not-a-token', user.tokens.accessToken]) {
        await http()
          .post('/v1/auth/register')
          .send({ registrationToken, dateOfBirth: ADULT_DOB, ...consent })
          .expect(401);
      }
    });

    it('cannot register the same destination twice', async () => {
      const email = uniqueEmail();
      const { body } = await verify(email);
      const payload = {
        registrationToken: body.registrationToken,
        dateOfBirth: ADULT_DOB,
        ...consent,
      };
      await http().post('/v1/auth/register').send(payload).expect(201);
      await http().post('/v1/auth/register').send(payload).expect(409);
    });

    it('signs a returning person straight in', async () => {
      const user = await registerUser(app);
      const response = await verify(user.email);
      expect(response.body.status).toBe('authenticated');
      authTokensSchema.parse(response.body.tokens);
    });
  });

  describe('sessions', () => {
    it('requires a token on protected routes', async () => {
      const response = await http().get('/v1/me');
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it.each(['garbage', 'Bearer', 'Bearer not.a.jwt', 'Basic abc'])(
      'rejects Authorization "%s"',
      async (value) => {
        await http().get('/v1/me').set('Authorization', value).expect(401);
      },
    );

    it('rejects a token signed with another key or carrying a registration audience', async () => {
      const user = await registerUser(app);
      const [header, payload] = user.tokens.accessToken.split('.');
      await http()
        .get('/v1/me')
        .set('Authorization', `Bearer ${header}.${payload}.AAAA`)
        .expect(401);
      const registration = await app
        .get(TokenService)
        .signRegistration({ channel: 'email', destination: user.email });
      await http().get('/v1/me').set('Authorization', `Bearer ${registration}`).expect(401);
    });

    it('never stores the refresh token itself', async () => {
      const user = await registerUser(app);
      const sessions = await prisma.authSession.findMany({
        where: { user: { email: user.email } },
      });
      expect(JSON.stringify(sessions)).not.toContain(user.tokens.refreshToken);
    });

    it('rotates refresh tokens', async () => {
      const user = await registerUser(app);
      const response = await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: user.tokens.refreshToken })
        .expect(200);
      const next = authTokensSchema.parse(response.body);
      expect(next.refreshToken).not.toBe(user.tokens.refreshToken);
      const me = await http()
        .get('/v1/me')
        .set('Authorization', `Bearer ${next.accessToken}`)
        .expect(200);
      meSchema.parse(me.body);
    });

    it('revokes every session when a rotated refresh token is reused', async () => {
      const user = await registerUser(app);
      const rotated = await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: user.tokens.refreshToken })
        .expect(200);
      // An attacker (or the victim) presents the old token again.
      await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: user.tokens.refreshToken })
        .expect(401);
      const audit = await prisma.auditLog.count({
        where: { action: 'auth.refresh_reuse_detected', actor: { email: user.email } },
      });
      expect(audit).toBe(1);
      // Everything issued to that account is now dead, including the newest pair.
      await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: rotated.body.refreshToken })
        .expect(401);
      await http()
        .get('/v1/me')
        .set('Authorization', `Bearer ${rotated.body.accessToken}`)
        .expect(401);
    });

    it('rejects unknown and expired refresh tokens', async () => {
      await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: 'x'.repeat(43) })
        .expect(401);
      const user = await registerUser(app);
      await prisma.authSession.updateMany({
        where: { user: { email: user.email } },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: user.tokens.refreshToken })
        .expect(401);
      await http().get('/v1/me').set(user.auth).expect(401);
    });

    it('logout ends the session immediately, for access and refresh tokens', async () => {
      const user = await registerUser(app);
      await http().post('/v1/auth/logout').set(user.auth).expect(204);
      await http().get('/v1/me').set(user.auth).expect(401);
      await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: user.tokens.refreshToken })
        .expect(401);
    });

    it('a suspended account cannot sign in or use existing tokens', async () => {
      const user = await registerUser(app);
      await prisma.user.update({ where: { email: user.email }, data: { status: 'SUSPENDED' } });
      await http().get('/v1/me').set(user.auth).expect(401);
      const response = await verify(user.email);
      expect(response.status).toBe(403);
    });
  });
});
