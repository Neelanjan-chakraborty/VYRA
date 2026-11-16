import request from 'supertest';
import { createTestApp, registerUser, type TestApp } from './support/app.js';

describe('Client events (e2e)', () => {
  let app: TestApp;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('accepts a known event from a signed-in person and nothing else', async () => {
    const user = await registerUser(app);
    await http()
      .post('/v1/me/client-events')
      .set(user.auth)
      .send({ event: 'push_registration_crash' })
      .expect(204);
    await http()
      .post('/v1/me/client-events')
      .set(user.auth)
      .send({ event: 'anything' })
      .expect(422);
    await http()
      .post('/v1/me/client-events')
      .send({ event: 'push_registration_crash' })
      .expect(401);
  });
});
