import {
  compatibilityViewSchema,
  recommendationListSchema,
  type RecommendationList,
} from '@vyra/validation';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTestApp, registerUser, type TestApp, type TestUser } from './support/app.js';
import { createPerson, QUIET_HOMEBODY, SOCIAL_PLANNER } from './support/people.js';

const INTERESTS = ['trekking', 'poetry', 'specialty-coffee', 'quizzing'];

describe('Compatibility and recommendations (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    // Earlier suites leave many active people behind; hide them so this
    // suite's rankings are about the people it creates.
    await prisma.userProfile.updateMany({ data: { isDiscoverable: false } });
  });
  afterAll(async () => {
    await app.close();
  });

  async function recommend(user: TestUser, limit = 50): Promise<RecommendationList> {
    const response = await http()
      .get(`/v1/discovery/recommendations?limit=${limit}`)
      .set(user.auth)
      .expect(200);
    return recommendationListSchema.parse(response.body);
  }

  describe('a small synthetic population', () => {
    let viewer: TestUser & { id: string };
    let twin: TestUser & { id: string };
    let opposite: TestUser & { id: string };
    let noPersona: TestUser & { id: string };
    let casual: TestUser & { id: string };
    let tooOld: TestUser & { id: string };
    let excludesViewer: TestUser & { id: string };
    let hidden: TestUser & { id: string };
    let blocked: TestUser & { id: string };
    let dealBreaker: TestUser & { id: string };

    beforeAll(async () => {
      viewer = await createPerson(app, {
        age: 28,
        gender: 'WOMAN',
        showGenders: ['MAN'],
        minAge: 24,
        maxAge: 34,
        traits: SOCIAL_PLANNER,
        interests: INTERESTS,
        criteria: [
          {
            criterion: 'weekendRhythm',
            mode: 'must',
            accepted: ['restful', 'social', 'adventurous'],
          },
        ],
      });
      const man = { gender: 'MAN', showGenders: ['WOMAN'] } as const;
      twin = await createPerson(app, {
        ...man,
        age: 29,
        traits: SOCIAL_PLANNER,
        interests: INTERESTS,
      });
      opposite = await createPerson(app, {
        ...man,
        age: 29,
        traits: QUIET_HOMEBODY,
        interests: ['baking', 'yoga', 'anime'],
      });
      noPersona = await createPerson(app, { ...man, age: 29 });
      casual = await createPerson(app, {
        ...man,
        age: 29,
        intents: ['casual'],
        traits: SOCIAL_PLANNER,
      });
      tooOld = await createPerson(app, { ...man, age: 40, traits: SOCIAL_PLANNER });
      excludesViewer = await createPerson(app, {
        ...man,
        age: 29,
        maxAge: 26,
        traits: SOCIAL_PLANNER,
      });
      hidden = await createPerson(app, {
        ...man,
        age: 29,
        traits: SOCIAL_PLANNER,
        discoverable: false,
      });
      blocked = await createPerson(app, { ...man, age: 29, traits: SOCIAL_PLANNER });
      dealBreaker = await createPerson(app, {
        ...man,
        age: 29,
        traits: { ...SOCIAL_PLANNER, weekendRhythm: 'productive' },
      });
      await prisma.blockedUser.create({ data: { blockerId: blocked.id, blockedId: viewer.id } });
      // Someone the viewer is not interested in.
      await createPerson(app, {
        gender: 'WOMAN',
        showGenders: ['WOMAN'],
        age: 29,
        traits: SOCIAL_PLANNER,
      });
    });

    it('ranks by estimated alignment and leaves out everyone who fails a gate', async () => {
      const list = await recommend(viewer);
      const ids = list.recommendations.map((r) => r.userId);
      expect(ids).toEqual([twin.id, opposite.id, noPersona.id]);
      for (const excluded of [casual, tooOld, excludesViewer, hidden, blocked, dealBreaker]) {
        expect(ids).not.toContain(excluded.id);
      }
      expect(list.engineVersion).toBe('compat-2');
      expect(list.weightsVersion).toBe('2026-11-v1');
    });

    it('explains each recommendation and is honest about missing data', async () => {
      const [first, second, third] = (await recommend(viewer)).recommendations;
      expect(first).toMatchObject({ sufficiency: 'SUFFICIENT', displayName: 'Synthetic', age: 29 });
      expect(first?.overall).toBeGreaterThan(0.9);
      expect(first?.highlights.length).toBeGreaterThan(0);
      expect(first?.sharedInterests).toEqual(expect.arrayContaining(['Trekking', 'Poetry']));
      expect(second?.overall).toBeLessThan(0.55);
      expect(third).toMatchObject({ sufficiency: 'INSUFFICIENT', overall: null });
      // Approved photos are shown, through a public-scope URL.
      expect(first?.photoUrl).toMatch(/[?&]s=p&/);
    });

    it('limits the number of results', async () => {
      expect((await recommend(viewer, 1)).recommendations).toHaveLength(1);
      await http().get('/v1/discovery/recommendations?limit=0').set(viewer.auth).expect(422);
      await http().get('/v1/discovery/recommendations?limit=500').set(viewer.auth).expect(422);
    });

    it('works in both directions', async () => {
      const ids = (await recommend(twin)).recommendations.map((r) => r.userId);
      expect(ids).toContain(viewer.id);
    });

    it('returns the full breakdown for an eligible pair', async () => {
      const response = await http()
        .get(`/v1/compatibility/${twin.id}`)
        .set(viewer.auth)
        .expect(200);
      const view = compatibilityViewSchema.parse(response.body);
      expect(view.userId).toBe(twin.id);
      expect(view.result.overall).toBeGreaterThan(0.9);
      expect(view.result.scenarios).toHaveLength(10);
      expect(view.result.dimensions.relationshipAlignment.aligned).toContain(
        'You’re looking for the same kind of relationship',
      );
    });

    it('is the same number seen from either side', async () => {
      const ab = compatibilityViewSchema.parse(
        (await http().get(`/v1/compatibility/${opposite.id}`).set(viewer.auth).expect(200)).body,
      );
      const ba = compatibilityViewSchema.parse(
        (await http().get(`/v1/compatibility/${viewer.id}`).set(opposite.auth).expect(200)).body,
      );
      expect(ab.result.overall).toBe(ba.result.overall);
    });

    it('answers 404 for anyone the viewer may not see, without saying why', async () => {
      for (const target of [casual, tooOld, excludesViewer, hidden, blocked, dealBreaker]) {
        const response = await http().get(`/v1/compatibility/${target.id}`).set(viewer.auth);
        expect(response.status).toBe(404);
        expect(response.body.error.message).toBe('Not found.');
      }
      await http().get(`/v1/compatibility/${viewer.id}`).set(viewer.auth).expect(404);
      await http()
        .get('/v1/compatibility/00000000-0000-4000-8000-000000000000')
        .set(viewer.auth)
        .expect(404);
      await http().get('/v1/compatibility/not-a-uuid').set(viewer.auth).expect(422);
    });

    it('caches pairs with approved personas, keyed by both versions, in a fixed order', async () => {
      await http().get(`/v1/compatibility/${twin.id}`).set(viewer.auth).expect(200);
      const [low, high] = [viewer.id, twin.id].toSorted();
      const rows = await prisma.compatibilityScore.findMany({
        where: { userAId: low, userBId: high },
        include: { scenarios: true },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        sufficiency: 'SUFFICIENT',
        weightsVersion: '2026-11-v1',
        engineVersion: 'compat-2',
      });
      expect(rows[0]?.scenarios).toHaveLength(10);
      // Pairs where one side has no persona are not cached.
      expect(
        await prisma.compatibilityScore.count({
          where: { OR: [{ userAId: noPersona.id }, { userBId: noPersona.id }] },
        }),
      ).toBe(0);
    });

    it('a new persona version gets a new cache row; the old one is never served', async () => {
      await http()
        .patch('/v1/me/persona/draft')
        .set(twin.auth)
        .send({ set: { socialEnergy: 0 } })
        .expect(200);
      await http().post('/v1/me/persona/draft/approve').set(twin.auth).expect(200);
      const view = compatibilityViewSchema.parse(
        (await http().get(`/v1/compatibility/${twin.id}`).set(viewer.auth).expect(200)).body,
      );
      expect(
        view.result.dimensions.lifestyle.different.some((l) => l.startsWith('Social energy')),
      ).toBe(true);
      const [low, high] = [viewer.id, twin.id].toSorted();
      expect(
        await prisma.compatibilityScore.count({ where: { userAId: low, userBId: high } }),
      ).toBe(2);
    });

    it('records impressions and views for the learning system', async () => {
      await recommend(viewer, 2);
      const impressions = await prisma.discoveryEvent.findMany({
        where: { userId: viewer.id, type: 'IMPRESSION' },
        orderBy: { createdAt: 'desc' },
        take: 2,
      });
      expect(impressions.map((e) => (e.context as { rank: number }).rank).toSorted()).toEqual([
        0, 1,
      ]);
      expect(
        await prisma.discoveryEvent.count({
          where: { userId: viewer.id, type: 'COMPATIBILITY_VIEWED' },
        }),
      ).toBeGreaterThan(0);
    });
  });

  it('someone still onboarding gets no recommendations', async () => {
    const user = await registerUser(app);
    await http().get('/v1/discovery/recommendations').set(user.auth).expect(409);
  });

  it('needs authentication', async () => {
    await http().get('/v1/discovery/recommendations').expect(401);
    await http().get('/v1/compatibility/00000000-0000-4000-8000-000000000000').expect(401);
  });

  it('rejects invalid criteria', async () => {
    const user = await registerUser(app);
    await http()
      .put('/v1/me/discovery-preferences')
      .set(user.auth)
      .send({
        minAge: 20,
        maxAge: 30,
        maxDistanceKm: null,
        showGenders: [],
        showAstrology: false,
        criteria: [{ criterion: 'religion', mode: 'must', accepted: ['x'] }],
      })
      .expect(422);
  });
});
