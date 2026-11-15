import { fitResultSchema, recommendationListSchema, weightSetListSchema } from '@vyra/validation';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { ENGINE, type Engine } from '../src/modules/compatibility/engine.js';
import { LearningService } from '../src/modules/learning/learning.service.js';
import { createTestApp, registerUser, type TestApp, type TestUser } from './support/app.js';
import { createPerson, SOCIAL_PLANNER } from './support/people.js';

describe('Weight learning (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  let admin: TestUser;
  let originalActive: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = await registerUser(app);
    await prisma.user.updateMany({
      where: { email: admin.email },
      data: { role: 'ADMIN' },
    });
    const active = await prisma.compatibilityWeightSet.findFirstOrThrow({
      where: { isActive: true },
    });
    originalActive = active.version;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    // The database is shared: put the original weights back, then remove what this suite made.
    await prisma.$transaction([
      prisma.compatibilityWeightSet.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      }),
      prisma.compatibilityWeightSet.update({
        where: { version: originalActive },
        data: { isActive: true },
      }),
    ]);
    const learned = { startsWith: 'learned-' };
    await prisma.compatibilityScore.deleteMany({ where: { weightsVersion: learned } });
    await prisma.compatibilityWeightSet.deleteMany({ where: { version: learned } });
    await app.close();
  });

  it('is for admins only', async () => {
    const member = await registerUser(app);
    await http().get('/v1/admin/weights').set(member.auth).expect(403);
    await http().post('/v1/admin/weights/fit').set(member.auth).expect(403);
    await http().get('/v1/admin/weights').expect(401);
    const list = weightSetListSchema.parse(
      (await http().get('/v1/admin/weights').set(admin.auth).expect(200)).body,
    );
    expect(list.weightSets.find((w) => w.isActive)?.version).toBe(originalActive);
  });

  it('labels decisions from what people did: save is positive, pass is negative', async () => {
    const learning = app.get(LearningService);
    const viewer = await createPerson(app, { traits: SOCIAL_PLANNER });
    const [liked, passed] = [
      await createPerson(app, { traits: SOCIAL_PLANNER }),
      await createPerson(app, { traits: SOCIAL_PLANNER }),
    ];
    // Viewing recommendations stores the pairs' dimension scores.
    await http().get('/v1/discovery/recommendations?limit=50').set(viewer.auth).expect(200);
    const before = await learning.samples();
    await http().put(`/v1/saved/${liked.id}`).set(viewer.auth).expect(204);
    await http().post(`/v1/discovery/pass/${passed.id}`).set(viewer.auth).expect(204);
    const after = await learning.samples();
    const count = (list: typeof after, positive: boolean) =>
      list.filter((s) => s.positive === positive).length;
    expect(count(after, true)).toBe(count(before, true) + 1);
    expect(count(after, false)).toBe(count(before, false) + 1);
    // Only six dimension scores and an outcome: nothing that identifies anyone.
    expect(Object.keys(after[0] ?? {}).toSorted()).toEqual(['positive', 'scores']);
    expect(after[0]?.scores).toHaveLength(6);
  });

  it('runs the real Rust fit and reports what it found', async () => {
    const result = fitResultSchema.parse(
      (await http().post('/v1/admin/weights/fit').set(admin.auth).expect(201)).body,
    );
    expect(['proposed', 'insufficient_data', 'no_improvement']).toContain(result.status);
    if (result.version) {
      const row = await prisma.compatibilityWeightSet.findUniqueOrThrow({
        where: { version: result.version },
      });
      expect(row.status).toBe('PROPOSED');
      expect(row.isActive).toBe(false);
    }
  });

  it('changes nothing until approved; approval switches recommendations to the new weights', async () => {
    const engine = app.get<Engine>(ENGINE);
    vi.spyOn(engine, 'fitWeights').mockReturnValue({
      status: 'proposed',
      weights: {
        emotional: 0.2,
        communication: 0.25,
        lifestyle: 0.2,
        relationshipAlignment: 0.15,
        intellectual: 0.1,
        mutualPreferences: 0.1,
      },
      metrics: {
        samples: 600,
        positives: 300,
        negatives: 300,
        trainSize: 480,
        validationSize: 120,
        coefficients: [0.1, 0.9, 0.3, 0, 0, 0],
        aucCurrent: 0.6,
        aucProposed: 0.64,
      },
    });
    const fit = fitResultSchema.parse(
      (await http().post('/v1/admin/weights/fit').set(admin.auth).expect(201)).body,
    );
    expect(fit.status).toBe('proposed');
    const version = fit.version as string;

    const viewer = await createPerson(app, { traits: SOCIAL_PLANNER });
    await createPerson(app, { traits: SOCIAL_PLANNER });
    const recommended = async () =>
      recommendationListSchema.parse(
        (await http().get('/v1/discovery/recommendations').set(viewer.auth).expect(200)).body,
      ).weightsVersion;
    expect(await recommended()).toBe(originalActive);

    await http().post(`/v1/admin/weights/${version}/approve`).set(admin.auth).expect(201);
    expect(await recommended()).toBe(version);
    await http().post(`/v1/admin/weights/${version}/approve`).set(admin.auth).expect(409);

    // A second proposal can be rejected, and a rejected one can't be approved.
    vi.spyOn(engine, 'fitWeights').mockReturnValue({
      status: 'proposed',
      weights: {
        emotional: 0.25,
        communication: 0.2,
        lifestyle: 0.2,
        relationshipAlignment: 0.15,
        intellectual: 0.1,
        mutualPreferences: 0.1,
      },
      metrics: null,
    });
    const second = fitResultSchema.parse(
      (await http().post('/v1/admin/weights/fit').set(admin.auth).expect(201)).body,
    );
    const rejected = await http()
      .post(`/v1/admin/weights/${second.version}/reject`)
      .set(admin.auth)
      .expect(201);
    expect(rejected.body.status).toBe('REJECTED');
    await http().post(`/v1/admin/weights/${second.version}/approve`).set(admin.auth).expect(409);
    await http().post(`/v1/admin/weights/${second.version}/reject`).set(admin.auth).expect(404);
  });

  it('records only aggregates in the audit log', async () => {
    const rows = await prisma.auditLog.findMany({ where: { action: 'weights.fit' }, take: 5 });
    for (const row of rows)
      expect(Object.keys(row.metadata as object).toSorted()).toEqual(['samples', 'status']);
  });
});
