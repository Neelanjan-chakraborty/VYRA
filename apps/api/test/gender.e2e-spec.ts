import {
  GENDER_IDENTITIES,
  meSchema,
  publicProfileSchema,
  recommendationListSchema,
} from '@vyra/validation';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { SourceBundleService } from '../src/modules/persona/source-bundle.js';
import { createTestApp, registerUser, type TestApp, type TestUser } from './support/app.js';
import { createPerson } from './support/people.js';

describe('Structured gender identity (e2e)', () => {
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

  async function visibleIds(viewer: TestUser): Promise<string[]> {
    const body = recommendationListSchema.parse(
      (await http().get('/v1/discovery/recommendations?limit=50').set(viewer.auth).expect(200))
        .body,
    );
    return body.recommendations.map((r) => r.userId);
  }

  describe('profile', () => {
    it.each(GENDER_IDENTITIES)('saves %s, private by default', async (identity) => {
      const user = await registerUser(app);
      const body =
        identity === 'SELF_DESCRIBE'
          ? {
              displayName: 'G',
              genderIdentity: identity,
              genderSelfDescription: 'Genderfluid',
              discoverableAs: ['WOMAN'],
            }
          : { displayName: 'G', genderIdentity: identity };
      const me = meSchema.parse(
        (await http().patch('/v1/me/profile').set(user.auth).send(body).expect(200)).body,
      );
      expect(me.profile).toMatchObject({ genderIdentity: identity, genderVisible: false });
    });

    it('a self-description is only accepted with "Self-describe", and is cleared when the identity changes', async () => {
      const user = await registerUser(app);
      await http()
        .patch('/v1/me/profile')
        .set(user.auth)
        .send({ displayName: 'G', genderIdentity: 'WOMAN', genderSelfDescription: 'x' })
        .expect(422);
      await http()
        .patch('/v1/me/profile')
        .set(user.auth)
        .send({ displayName: 'G', genderIdentity: 'MAN', discoverableAs: ['MAN'] })
        .expect(422);
      await http()
        .patch('/v1/me/profile')
        .set(user.auth)
        .send({
          displayName: 'G',
          genderIdentity: 'SELF_DESCRIBE',
          genderSelfDescription: 'Two-spirit',
          discoverableAs: ['NON_BINARY'],
        })
        .expect(200);
      const me = meSchema.parse(
        (
          await http()
            .patch('/v1/me/profile')
            .set(user.auth)
            .send({ genderIdentity: 'NON_BINARY' })
            .expect(200)
        ).body,
      );
      expect(me.profile).toMatchObject({
        genderIdentity: 'NON_BINARY',
        genderSelfDescription: null,
        discoverableAs: [],
      });
    });

    it('rejects free text and impossible search choices', async () => {
      const user = await registerUser(app);
      await http()
        .patch('/v1/me/profile')
        .set(user.auth)
        .send({ displayName: 'G', genderIdentity: 'female' })
        .expect(422);
      await http()
        .patch('/v1/me/profile')
        .set(user.auth)
        .send({
          displayName: 'G',
          genderIdentity: 'SELF_DESCRIBE',
          discoverableAs: ['PREFER_NOT_TO_SAY'],
        })
        .expect(422);
      await http()
        .put('/v1/me/discovery-preferences')
        .set(user.auth)
        .send({
          minAge: 20,
          maxAge: 30,
          maxDistanceKm: null,
          showGenders: ['SELF_DESCRIBE'],
          showAstrology: false,
        })
        .expect(422);
    });

    it('can be cleared', async () => {
      const user = await registerUser(app);
      await http()
        .patch('/v1/me/profile')
        .set(user.auth)
        .send({ displayName: 'G', genderIdentity: 'MAN' })
        .expect(200);
      const me = meSchema.parse(
        (
          await http()
            .patch('/v1/me/profile')
            .set(user.auth)
            .send({ genderIdentity: null })
            .expect(200)
        ).body,
      );
      expect(me.profile?.genderIdentity).toBeNull();
    });

    it('is never sent to the AI persona provider', async () => {
      const user = await createPerson(app, {
        gender: 'SELF_DESCRIBE',
        genderSelfDescription: 'Genderqueer',
      });
      const bundle = await app.get(SourceBundleService).build(user.id);
      expect(JSON.stringify(bundle).toLowerCase()).not.toMatch(/gender|self_describe|genderqueer/);
    });
  });

  describe('visibility', () => {
    it('others see a gender only when it is shown, and never "prefer not to say"', async () => {
      const viewer = await createPerson(app, {});
      const hidden = await createPerson(app, { gender: 'WOMAN' });
      const shown = await createPerson(app, { gender: 'WOMAN', genderVisible: true });
      const described = await createPerson(app, {
        gender: 'SELF_DESCRIBE',
        genderSelfDescription: 'Genderfluid',
        genderVisible: true,
      });
      const undisclosed = await createPerson(app, {
        gender: 'PREFER_NOT_TO_SAY',
        genderVisible: true,
      });
      const genderOf = async (subject: { id: string }) =>
        publicProfileSchema.parse(
          (await http().get(`/v1/people/${subject.id}`).set(viewer.auth).expect(200)).body,
        ).gender;
      expect(await genderOf(hidden)).toBeNull();
      expect(await genderOf(shown)).toBe('Woman');
      expect(await genderOf(described)).toBe('Genderfluid');
      expect(await genderOf(undisclosed)).toBeNull();
      // Recommendation cards never carry gender or preferences.
      const recs = JSON.stringify(
        (await http().get('/v1/discovery/recommendations?limit=50').set(viewer.auth).expect(200))
          .body,
      );
      expect(recs).not.toMatch(/WOMAN|showGenders|includeUnlisted/);
    });
  });

  describe('discovery', () => {
    let everyone: Record<string, { id: string }>;

    beforeAll(async () => {
      await prisma.userProfile.updateMany({ data: { isDiscoverable: false } });
      everyone = {
        woman: await createPerson(app, { gender: 'WOMAN' }),
        man: await createPerson(app, { gender: 'MAN' }),
        nonBinary: await createPerson(app, { gender: 'NON_BINARY' }),
        selfDescribedAsMan: await createPerson(app, {
          gender: 'SELF_DESCRIBE',
          genderSelfDescription: 'Trans man',
          discoverableAs: ['MAN'],
        }),
        selfDescribed: await createPerson(app, {
          gender: 'SELF_DESCRIBE',
          genderSelfDescription: 'Agender',
        }),
        undisclosed: await createPerson(app, { gender: 'PREFER_NOT_TO_SAY' }),
        unanswered: await createPerson(app, { gender: null }),
      };
    });

    const expectExactly = (ids: string[], keys: string[]) => {
      const expected = keys.map((k) => everyone[k]?.id);
      expect(
        ids.filter((id) => Object.values(everyone).some((p) => p.id === id)).toSorted(),
      ).toEqual(expected.toSorted());
    };

    it('showing everyone includes every identity', async () => {
      const viewer = await createPerson(app, { gender: 'WOMAN' });
      expectExactly(await visibleIds(viewer), Object.keys(everyone));
    });

    it('showing men includes men, people who chose to appear for men, and — by default — unlisted identities', async () => {
      const viewer = await createPerson(app, { gender: 'WOMAN', showGenders: ['MAN'] });
      expectExactly(await visibleIds(viewer), [
        'man',
        'selfDescribedAsMan',
        'selfDescribed',
        'undisclosed',
        'unanswered',
      ]);
    });

    it('turning off unlisted identities narrows to exact matches', async () => {
      const viewer = await createPerson(app, {
        gender: 'WOMAN',
        showGenders: ['MAN'],
        includeUnlistedGenders: false,
      });
      expectExactly(await visibleIds(viewer), ['man', 'selfDescribedAsMan']);
    });

    it('several identities can be chosen', async () => {
      const viewer = await createPerson(app, {
        gender: 'MAN',
        showGenders: ['WOMAN', 'NON_BINARY'],
        includeUnlistedGenders: false,
      });
      expectExactly(await visibleIds(viewer), ['woman', 'nonBinary']);
    });

    it('people who prefer not to say still see others and can be seen', async () => {
      const viewer = await createPerson(app, {
        gender: 'PREFER_NOT_TO_SAY',
        showGenders: ['WOMAN'],
      });
      const ids = await visibleIds(viewer);
      expect(ids).toContain(everyone.woman?.id);
    });

    it('changing preferences after onboarding takes effect at once', async () => {
      const viewer = await createPerson(app, {
        gender: 'WOMAN',
        showGenders: ['MAN'],
        includeUnlistedGenders: false,
      });
      expect(await visibleIds(viewer)).not.toContain(everyone.woman?.id);
      await http()
        .put('/v1/me/discovery-preferences')
        .set(viewer.auth)
        .send({
          minAge: 18,
          maxAge: 99,
          maxDistanceKm: null,
          showGenders: ['WOMAN'],
          includeUnlistedGenders: false,
          showAstrology: false,
        })
        .expect(200);
      expectExactly(await visibleIds(viewer), ['woman']);
    });

    it('a filter applies in both directions', async () => {
      // This viewer wants women, but the woman candidates here only want men.
      const viewer = await createPerson(app, {
        gender: 'NON_BINARY',
        showGenders: ['WOMAN'],
        includeUnlistedGenders: false,
      });
      const pickyWoman = await createPerson(app, {
        gender: 'WOMAN',
        showGenders: ['MAN'],
        includeUnlistedGenders: false,
      });
      expect(await visibleIds(viewer)).not.toContain(pickyWoman.id);
      await http().get(`/v1/people/${pickyWoman.id}`).set(viewer.auth).expect(404);
    });
  });
});
