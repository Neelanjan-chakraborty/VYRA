import { criteriaImpactSchema, meSchema, recommendationListSchema } from '@vyra/validation';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTestApp, type TestApp, type TestUser } from './support/app.js';
import { createPerson, SOCIAL_PLANNER } from './support/people.js';

type Spec = Parameters<typeof createPerson>[1];

const withTraits = (overrides: Record<string, unknown>): Spec => ({
  traits: { ...SOCIAL_PLANNER, ...overrides } as Spec extends { traits?: infer T } ? T : never,
});

describe('Must-haves, preferences and open (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  let homebody: { id: string };
  let outgoing: { id: string };
  let unknownPace: { id: string };
  let casualOnly: { id: string };
  let valuesHonesty: { id: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await prisma.userProfile.updateMany({ data: { isDiscoverable: false } });
    homebody = await createPerson(
      app,
      withTraits({ lifestylePace: 'homebody', values: ['honesty', 'calm'] }),
    );
    outgoing = await createPerson(
      app,
      withTraits({ lifestylePace: 'outgoing', values: ['adventure'] }),
    );
    unknownPace = await createPerson(app, { traits: { socialEnergy: 0.5 } });
    casualOnly = await createPerson(app, {
      ...withTraits({ lifestylePace: 'homebody' }),
      intents: ['casual', 'exploring'],
    });
    valuesHonesty = await createPerson(
      app,
      withTraits({ lifestylePace: 'balanced', values: ['honesty'] }),
    );
  });
  afterAll(async () => {
    await app.close();
  });

  async function ids(viewer: TestUser): Promise<string[]> {
    const body = recommendationListSchema.parse(
      (await http().get('/v1/discovery/recommendations?limit=50').set(viewer.auth).expect(200))
        .body,
    );
    return body.recommendations.map((r) => r.userId);
  }
  const ours = (list: string[]) =>
    list.filter((id) =>
      [homebody, outgoing, unknownPace, casualOnly, valuesHonesty].some((p) => p.id === id),
    );

  const setPreference = (viewer: TestUser, accepted: string[]) =>
    http()
      .put('/v1/me/discovery-preferences')
      .set(viewer.auth)
      .send({
        minAge: 18,
        maxAge: 99,
        maxDistanceKm: null,
        showGenders: [],
        showAstrology: false,
        criteria: [{ criterion: 'lifestylePace', mode: 'prefer', accepted }],
      })
      .expect(200);
  const overall = async (viewer: TestUser, target: { id: string }) => {
    const body = (await http().get(`/v1/compatibility/${target.id}`).set(viewer.auth).expect(200))
      .body;
    return body.result.dimensions.mutualPreferences as {
      score: number;
      features: { feature: string }[];
    };
  };

  it('no criteria: everyone eligible is shown', async () => {
    const viewer = await createPerson(app, { intents: ['serious', 'exploring'] });
    expect(ours(await ids(viewer)).toSorted()).toEqual(
      [homebody.id, outgoing.id, unknownPace.id, casualOnly.id, valuesHonesty.id].toSorted(),
    );
  });

  it('a must-have excludes known mismatches but keeps people whose value is unknown', async () => {
    const viewer = await createPerson(app, {
      intents: ['serious', 'exploring'],
      criteria: [{ criterion: 'lifestylePace', mode: 'must', accepted: ['homebody', 'balanced'] }],
    });
    const shown = ours(await ids(viewer));
    expect(shown).not.toContain(outgoing.id);
    expect(shown).toEqual(
      expect.arrayContaining([homebody.id, unknownPace.id, valuesHonesty.id, casualOnly.id]),
    );
    await http().get(`/v1/people/${outgoing.id}`).set(viewer.auth).expect(404);
  });

  it('several must-haves all apply', async () => {
    const viewer = await createPerson(app, {
      intents: ['serious', 'exploring'],
      criteria: [
        { criterion: 'lifestylePace', mode: 'must', accepted: ['homebody', 'balanced'] },
        { criterion: 'values', mode: 'must', accepted: ['honesty'] },
        { criterion: 'relationshipIntent', mode: 'must', accepted: ['serious'] },
      ],
    });
    expect(ours(await ids(viewer)).toSorted()).toEqual(
      [homebody.id, unknownPace.id, valuesHonesty.id].toSorted(),
    );
  });

  it('a preference never excludes anyone; it only changes the score', async () => {
    const viewer = await createPerson(app, {
      ...withTraits({}),
      intents: ['serious', 'exploring'],
      criteria: [{ criterion: 'lifestylePace', mode: 'prefer', accepted: ['outgoing'] }],
    });
    expect(ours(await ids(viewer)).toSorted()).toEqual(
      [homebody.id, outgoing.id, unknownPace.id, casualOnly.id, valuesHonesty.id].toSorted(),
    );
    const preferOutgoing = await overall(viewer, outgoing);
    expect(preferOutgoing.features.map((f) => f.feature)).toContain('statedPreferences');

    await setPreference(viewer, ['homebody']);
    expect(ours(await ids(viewer))).toHaveLength(5);
    const preferHomebody = await overall(viewer, outgoing);
    expect(preferHomebody.score).toBeLessThan(preferOutgoing.score);
    // Someone whose pace is unknown is unaffected by the preference.
    expect((await overall(viewer, unknownPace)).features.map((f) => f.feature)).not.toContain(
      'statedPreferences',
    );
  });

  it('"open" changes nothing', async () => {
    const viewer = await createPerson(app, {
      intents: ['serious', 'exploring'],
      criteria: [{ criterion: 'lifestylePace', mode: 'open', accepted: [] }],
    });
    expect(ours(await ids(viewer))).toHaveLength(5);
  });

  it('must-haves apply in both directions', async () => {
    const strict = await createPerson(app, {
      ...withTraits({ lifestylePace: 'homebody' }),
      criteria: [{ criterion: 'lifestylePace', mode: 'must', accepted: ['homebody'] }],
    });
    const viewer = await createPerson(app, withTraits({ lifestylePace: 'outgoing' }));
    expect(await ids(viewer)).not.toContain(strict.id);
  });

  it('reports when must-haves narrow things a lot, in buckets only', async () => {
    // Twelve people who are all "outgoing".
    for (let i = 0; i < 12; i += 1)
      await createPerson(app, withTraits({ lifestylePace: 'outgoing' }));
    const viewer = await createPerson(app, {
      intents: ['serious', 'exploring'],
      criteria: [{ criterion: 'lifestylePace', mode: 'must', accepted: ['homebody'] }],
    });
    const impact = criteriaImpactSchema.parse(
      (await http().get('/v1/discovery/criteria-impact').set(viewer.auth).expect(200)).body,
    );
    // Exact pool size depends on who earlier tests created; the shape does not.
    expect(impact.significant).toBe(true);
    const order = ['0', '1–5', '6–20', '20+'];
    expect(order.indexOf(impact.withMustHaves)).toBeLessThan(
      order.indexOf(impact.withoutMustHaves),
    );
    expect(impact.perCriterion).toHaveLength(1);
    expect(impact.perCriterion[0]?.criterion).toBe('lifestylePace');
    expect(impact.perCriterion[0]?.excludes).not.toBe('0');
    const relaxed = await createPerson(app, { intents: ['serious', 'exploring'] });
    expect(
      criteriaImpactSchema.parse(
        (await http().get('/v1/discovery/criteria-impact').set(relaxed.auth).expect(200)).body,
      ),
    ).toMatchObject({
      significant: false,
      perCriterion: [],
    });
  });

  it('criteria are private: never in anything another person receives', async () => {
    const secretive = await createPerson(app, {
      ...withTraits({ lifestylePace: 'homebody' }),
      criteria: [
        {
          criterion: 'weekendRhythm',
          mode: 'must',
          accepted: ['restful', 'social', 'adventurous'],
        },
      ],
    });
    const viewer = await createPerson(app, withTraits({}));
    const responses = [
      (await http().get('/v1/discovery/recommendations?limit=50').set(viewer.auth).expect(200))
        .body,
      (await http().get(`/v1/people/${secretive.id}`).set(viewer.auth).expect(200)).body,
      (await http().get(`/v1/compatibility/${secretive.id}`).set(viewer.auth).expect(200)).body,
    ];
    for (const body of responses)
      expect(JSON.stringify(body)).not.toMatch(/criteria|must|"accepted"|restful/);
  });

  it('can be changed and cleared after onboarding', async () => {
    const viewer = await createPerson(app, {
      intents: ['serious', 'exploring'],
      criteria: [{ criterion: 'lifestylePace', mode: 'must', accepted: ['outgoing'] }],
    });
    expect(ours(await ids(viewer))).not.toContain(homebody.id);
    const cleared = await http()
      .put('/v1/me/discovery-preferences')
      .set(viewer.auth)
      .send({
        minAge: 18,
        maxAge: 99,
        maxDistanceKm: null,
        showGenders: [],
        showAstrology: false,
        criteria: [],
      })
      .expect(200);
    expect(meSchema.parse(cleared.body).discoveryPreferences?.criteria).toEqual([]);
    expect(ours(await ids(viewer))).toContain(homebody.id);
  });

  it('rejects invalid criteria', async () => {
    const viewer = await createPerson(app, {});
    const send = (criteria: unknown) =>
      http().put('/v1/me/discovery-preferences').set(viewer.auth).send({
        minAge: 18,
        maxAge: 99,
        maxDistanceKm: null,
        showGenders: [],
        showAstrology: false,
        criteria,
      });
    await send([{ criterion: 'lifestylePace', mode: 'must', accepted: [] }]).expect(422);
    await send([{ criterion: 'lifestylePace', mode: 'must', accepted: ['party'] }]).expect(422);
    await send([{ criterion: 'lifestylePace', mode: 'sometimes', accepted: ['homebody'] }]).expect(
      422,
    );
    await send([{ criterion: 'income', mode: 'must', accepted: ['high'] }]).expect(422);
  });
});
