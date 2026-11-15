import {
  blockedListSchema,
  connectionsSchema,
  connectResultSchema,
  recommendationListSchema,
  relationshipStateSchema,
} from '@vyra/validation';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTestApp, type TestApp, type TestUser } from './support/app.js';
import { createPerson } from './support/people.js';

type Person = TestUser & { id: string; photoId: string };

describe('Connections (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  const person = (spec: Parameters<typeof createPerson>[1] = {}) =>
    createPerson(app, spec) as Promise<Person>;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    // Earlier suites leave many active people behind; hide them so rankings
    // here are about the people this suite creates.
    await prisma.userProfile.updateMany({ data: { isDiscoverable: false } });
  });
  afterAll(async () => {
    await app.close();
  });

  const connections = async (user: TestUser) =>
    connectionsSchema.parse((await http().get('/v1/connections').set(user.auth).expect(200)).body);
  const relationship = async (user: TestUser, other: { id: string }) =>
    relationshipStateSchema.parse(
      (await http().get(`/v1/people/${other.id}/relationship`).set(user.auth).expect(200)).body,
    );
  const recommendedIds = async (user: TestUser) =>
    recommendationListSchema
      .parse(
        (await http().get('/v1/discovery/recommendations?limit=50').set(user.auth).expect(200))
          .body,
      )
      .recommendations.map((r) => r.userId);
  const ask = (from: TestUser, to: { id: string }, note?: string) =>
    http()
      .post('/v1/connections/requests')
      .set(from.auth)
      .send({ recipientId: to.id, ...(note ? { note } : {}) });

  describe('save and pass', () => {
    it('saving moves someone from recommendations to Connections › Saved; unsaving brings them back', async () => {
      const [a, b] = [await person(), await person()];
      expect(await recommendedIds(a)).toContain(b.id);
      await http().put(`/v1/saved/${b.id}`).set(a.auth).expect(204);
      await http().put(`/v1/saved/${b.id}`).set(a.auth).expect(204); // idempotent
      expect(await recommendedIds(a)).not.toContain(b.id);
      const list = await connections(a);
      expect(list.saved.map((s) => s.person.userId)).toEqual([b.id]);
      expect((await relationship(a, b)).saved).toBe(true);
      await http().delete(`/v1/saved/${b.id}`).set(a.auth).expect(204);
      expect(await recommendedIds(a)).toContain(b.id);
    });

    it('a pass hides someone for 30 days, then they can appear again', async () => {
      const [a, b] = [await person(), await person()];
      await http().post(`/v1/discovery/pass/${b.id}`).set(a.auth).expect(204);
      expect(await recommendedIds(a)).not.toContain(b.id);
      await prisma.discoveryEvent.updateMany({
        where: { userId: a.id, targetUserId: b.id, type: 'PASSED' },
        data: { createdAt: new Date(Date.now() - 31 * 86_400_000) },
      });
      expect(await recommendedIds(a)).toContain(b.id);
    });

    it('cannot save or pass someone you may not see', async () => {
      const a = await person({ showGenders: ['MAN'], includeUnlistedGenders: false });
      const b = await person({ gender: 'WOMAN' });
      await http().put(`/v1/saved/${b.id}`).set(a.auth).expect(404);
      await http().post(`/v1/discovery/pass/${b.id}`).set(a.auth).expect(404);
    });
  });

  describe('requests', () => {
    it('a request is pending for both; accepting makes it mutual', async () => {
      const [a, b] = [await person(), await person()];
      const sent = connectResultSchema.parse(
        (await ask(a, b, '  Loved your  line about trains. ').expect(201)).body,
      );
      expect(sent.outcome).toBe('requested');
      expect((await connections(a)).outgoing[0]).toMatchObject({
        id: sent.requestId,
        note: 'Loved your  line about trains.',
      });
      expect((await connections(b)).incoming[0]).toMatchObject({
        id: sent.requestId,
        person: { userId: a.id },
      });
      expect(await recommendedIds(a)).not.toContain(b.id);
      expect(await recommendedIds(b)).not.toContain(a.id);

      const accepted = await http()
        .post(`/v1/connections/requests/${sent.requestId}/accept`)
        .set(b.auth)
        .expect(200);
      expect((await connections(a)).mutual[0]).toMatchObject({
        id: accepted.body.matchId,
        person: { userId: b.id },
      });
      expect((await connections(b)).mutual[0]?.person.userId).toBe(a.id);
      expect((await relationship(a, b)).matchId).toBe(accepted.body.matchId);
      await ask(a, b).expect(409); // already connected
    });

    it('asking someone who already asked you connects you at once', async () => {
      const [a, b] = [await person(), await person()];
      await ask(a, b).expect(201);
      const result = connectResultSchema.parse((await ask(b, a).expect(201)).body);
      expect(result.outcome).toBe('matched');
      expect((await connections(a)).mutual).toHaveLength(1);
      expect((await connections(a)).outgoing).toHaveLength(0);
    });

    it('only the right person can accept, decline or withdraw', async () => {
      const [a, b, c] = [await person(), await person(), await person()];
      const { requestId } = (await ask(a, b).expect(201)).body;
      await http().post(`/v1/connections/requests/${requestId}/accept`).set(a.auth).expect(404); // sender
      await http().post(`/v1/connections/requests/${requestId}/accept`).set(c.auth).expect(404); // stranger
      await http().post(`/v1/connections/requests/${requestId}/decline`).set(c.auth).expect(404);
      await http().post(`/v1/connections/requests/${requestId}/withdraw`).set(b.auth).expect(404); // recipient
      await http().post(`/v1/connections/requests/${requestId}/withdraw`).set(a.auth).expect(204);
      await http().post(`/v1/connections/requests/${requestId}/accept`).set(b.auth).expect(404); // gone
      await ask(a, b).expect(201); // withdrawing allows asking again
    });

    it('a decline stops the same request for 30 days', async () => {
      const [a, b] = [await person(), await person()];
      const { requestId } = (await ask(a, b).expect(201)).body;
      await http().post(`/v1/connections/requests/${requestId}/decline`).set(b.auth).expect(204);
      expect((await connections(a)).outgoing).toHaveLength(0);
      expect((await relationship(a, b)).requestBlockedReason).toBe('declined_recently');
      await ask(a, b).expect(409);
      await prisma.connectionRequest.update({
        where: { id: requestId },
        data: { respondedAt: new Date(Date.now() - 31 * 86_400_000) },
      });
      await ask(a, b).expect(201);
    });

    it('limits unanswered requests and rejects self, unknown and over-long requests', async () => {
      const a = await person();
      await ask(a, a).expect(400);
      await http()
        .post('/v1/connections/requests')
        .set(a.auth)
        .send({ recipientId: '00000000-0000-4000-8000-000000000000' })
        .expect(404);
      const b = await person();
      await ask(a, b, 'x'.repeat(301)).expect(422);
      await prisma.connectionRequest.createMany({
        data: await Promise.all(
          Array.from({ length: 20 }, async () => ({
            senderId: a.id,
            recipientId: (await person()).id,
          })),
        ),
      });
      expect((await relationship(a, b)).requestBlockedReason).toBe('too_many_pending');
      await ask(a, b).expect(409);
    });

    it('notes are only seen by sender and recipient, and kept as plain text', async () => {
      const [a, b, c] = [await person(), await person(), await person()];
      const note = '<img src=x onerror=alert(1)> hi';
      await ask(a, b, note).expect(201);
      expect((await connections(b)).incoming[0]?.note).toBe(note);
      const stranger = JSON.stringify([
        (await http().get(`/v1/people/${a.id}`).set(c.auth)).body,
        (await http().get('/v1/discovery/recommendations?limit=50').set(c.auth)).body,
      ]);
      expect(stranger).not.toContain('onerror');
    });

    it('people you are connected with stay visible after either changes their preferences', async () => {
      const [a, b] = [await person({ gender: 'WOMAN' }), await person({ gender: 'MAN' })];
      const { requestId } = (await ask(a, b).expect(201)).body;
      await http().post(`/v1/connections/requests/${requestId}/accept`).set(b.auth).expect(200);
      // a now only wants women; b is a man, but they're already connected.
      await http()
        .put('/v1/me/discovery-preferences')
        .set(a.auth)
        .send({
          minAge: 18,
          maxAge: 99,
          maxDistanceKm: null,
          showGenders: ['WOMAN'],
          includeUnlistedGenders: false,
          showAstrology: false,
        })
        .expect(200);
      await http().get(`/v1/people/${b.id}`).set(a.auth).expect(200);
      expect((await connections(a)).mutual[0]?.person.userId).toBe(b.id);
    });

    it('ending a connection removes it for both and lets them find each other again', async () => {
      const [a, b] = [await person(), await person()];
      const { requestId } = (await ask(a, b).expect(201)).body;
      const { matchId } = (
        await http().post(`/v1/connections/requests/${requestId}/accept`).set(b.auth).expect(200)
      ).body;
      const stranger = await person();
      await http().delete(`/v1/connections/matches/${matchId}`).set(stranger.auth).expect(404);
      await http().delete(`/v1/connections/matches/${matchId}`).set(b.auth).expect(204);
      expect((await connections(a)).mutual).toHaveLength(0);
      expect(await recommendedIds(a)).toContain(b.id);
      // Reconnecting revives the same pair record.
      const again = (await ask(a, b).expect(201)).body;
      await http()
        .post(`/v1/connections/requests/${again.requestId}/accept`)
        .set(b.auth)
        .expect(200);
      expect((await connections(a)).mutual).toHaveLength(1);
    });

    it('records events for the learning system', async () => {
      const [a, b] = [await person(), await person()];
      const { requestId } = (await ask(a, b).expect(201)).body;
      await http().post(`/v1/connections/requests/${requestId}/accept`).set(b.auth).expect(200);
      const types = (
        await prisma.discoveryEvent.findMany({
          where: { OR: [{ userId: a.id }, { userId: b.id }], targetUserId: { in: [a.id, b.id] } },
        })
      ).map((e) => e.type);
      expect(types).toEqual(expect.arrayContaining(['CONNECT_REQUESTED', 'CONNECTION_ACCEPTED']));
    });
  });

  describe('blocking', () => {
    it('ends everything between two people and hides them from each other; unblocking restores discovery only', async () => {
      const [a, b] = [await person(), await person()];
      const { requestId } = (await ask(a, b).expect(201)).body;
      await http().post(`/v1/connections/requests/${requestId}/accept`).set(b.auth).expect(200);
      await http().put(`/v1/saved/${a.id}`).set(b.auth).expect(204);

      await http().post(`/v1/blocks/${b.id}`).set(a.auth).expect(204);
      for (const [viewer, other] of [
        [a, b],
        [b, a],
      ] as const) {
        const list = await connections(viewer);
        expect(
          [...list.mutual, ...list.saved, ...list.incoming, ...list.outgoing].map(
            (i) => i.person.userId,
          ),
        ).not.toContain(other.id);
        expect(await recommendedIds(viewer)).not.toContain(other.id);
        await http().get(`/v1/people/${other.id}`).set(viewer.auth).expect(404);
        await ask(viewer, other).expect(404);
      }
      expect(
        blockedListSchema
          .parse((await http().get('/v1/blocks').set(a.auth).expect(200)).body)
          .blocked.map((x) => x.userId),
      ).toEqual([b.id]);
      expect(JSON.stringify((await http().get('/v1/blocks').set(a.auth)).body)).not.toMatch(
        /url|photo/i,
      );

      await http().delete(`/v1/blocks/${b.id}`).set(a.auth).expect(204);
      expect(await recommendedIds(a)).toContain(b.id);
      expect((await connections(a)).mutual).toHaveLength(0); // the connection itself stays ended
      await http().delete(`/v1/blocks/${b.id}`).set(a.auth).expect(404);
      await http().post(`/v1/blocks/${a.id}`).set(a.auth).expect(400);
    });
  });

  describe('photos in Connections', () => {
    it('only approved photos, and none once someone hides from discovery', async () => {
      const [a, b] = [await person(), await person()];
      await http().put(`/v1/saved/${b.id}`).set(a.auth).expect(204);
      await prisma.userPhoto.update({
        where: { id: b.photoId },
        data: { moderationStatus: 'REVIEW_REQUIRED' },
      });
      expect((await connections(a)).saved[0]?.person.photoUrl).toBeNull();
      await prisma.userPhoto.update({
        where: { id: b.photoId },
        data: { moderationStatus: 'APPROVED' },
      });
      expect((await connections(a)).saved[0]?.person.photoUrl).toMatch(/[?&]s=p&/);
      const { requestId } = (await ask(a, b).expect(201)).body;
      await http().post(`/v1/connections/requests/${requestId}/accept`).set(b.auth).expect(200);
      await http().patch('/v1/me/profile').set(b.auth).send({ isDiscoverable: false }).expect(200);
      const mutual = (await connections(a)).mutual[0];
      expect(mutual?.person.userId).toBe(b.id);
      expect(mutual?.person.photoUrl).toBeNull();
    });
  });
});
