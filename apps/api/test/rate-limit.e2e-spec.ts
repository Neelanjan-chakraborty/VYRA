import request from 'supertest';
import { createTestApp, uniqueEmail, type TestApp } from './support/app.js';

// Other suites run with NODE_ENV=test, where per-IP limits are off. This one
// boots the app as it runs outside tests to prove the limits are really applied.
describe('Per-IP rate limits (e2e)', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp({ NODE_ENV: 'development' });
  });
  afterAll(async () => {
    await app.close();
  });

  it('allows five code requests a minute from one address, then refuses', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/otp/request')
        .send({ channel: 'email', destination: uniqueEmail() });
      statuses.push(response.status);
    }
    expect(statuses).toEqual([202, 202, 202, 202, 202, 429, 429]);
  });

  it('does not rate-limit health probes', async () => {
    for (let i = 0; i < 130; i += 1) {
      await request(app.getHttpServer()).get('/v1/health/live').expect(200);
    }
  });
});
