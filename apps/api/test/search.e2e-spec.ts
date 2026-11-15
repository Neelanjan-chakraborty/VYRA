import { randomBytes } from 'node:crypto';
import { resolvedPersonSchema, searchResultsSchema, usernameCheckSchema } from '@vyra/validation';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTestApp, type TestApp, type TestUser } from './support/app.js';
import { createPerson } from './support/people.js';

type Person = TestUser & { id: string };

/** A fresh run of random letters per test, so names never share trigrams across tests. */
const newTag = () =>
  Array.from(randomBytes(7), (byte) => 'abcdefghijklmnopqrstuvwxyz'[byte % 26]).join('');

describe('Usernames and people search (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  let tag = '';
  beforeEach(() => {
    tag = newTag();
  });
  const http = () => request(app.getHttpServer());

  const person = async (
    displayName: string,
    username: string | null,
    spec: Parameters<typeof createPerson>[1] = {},
  ): Promise<Person> => {
    const created = (await createPerson(app, spec)) as Person;
    await http().patch('/v1/me/profile').set(created.auth).send({ displayName }).expect(200);
    if (username) {
      await http().put('/v1/me/username').set(created.auth).send({ username }).expect(200);
    }
    return created;
  };
  const check = async (user: TestUser, username: string) =>
    usernameCheckSchema.parse(
      (await http().get('/v1/me/username/check').query({ username }).set(user.auth).expect(200))
        .body,
    );
  const search = async (viewer: TestUser, q: string, limit = 12) =>
    searchResultsSchema.parse(
      (await http().get('/v1/search/people').query({ q, limit }).set(viewer.auth).expect(200)).body,
    ).results;
  const names = async (viewer: TestUser, q: string) =>
    (await search(viewer, q)).map((r) => r.username ?? r.displayName);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => {
    await app.close();
  });

  describe('choosing a username', () => {
    it('stores it normalised and returns it on /me', async () => {
      const a = await person('Ada', null);
      const me = (
        await http()
          .put('/v1/me/username')
          .set(a.auth)
          .send({ username: `@Ada_${tag}` })
          .expect(200)
      ).body;
      expect(me.profile.username).toBe(`ada_${tag}`);
      expect(me.profile.usernameChangeableAt).not.toBeNull();
      const again = await http().get('/v1/me').set(a.auth).expect(200);
      expect(again.body.profile.username).toBe(`ada_${tag}`);
    });

    it('checks shape and availability as you type', async () => {
      const a = await person('Bea', `bea.${tag}`);
      const b = await person('Cy', null);
      expect(await check(b, `bea.${tag}`)).toMatchObject({
        available: false,
        reason: 'Already taken',
      });
      expect(await check(a, `bea.${tag}`)).toMatchObject({ available: true }); // your own
      expect(await check(b, `free.${tag}`)).toMatchObject({ available: true });
      expect(await check(b, 'ab')).toMatchObject({ available: false });
      expect(await check(b, 'admin')).toMatchObject({ available: false });
      expect(await check(b, 'no spaces')).toMatchObject({ available: false });
    });

    it('rejects a taken name and a malformed one', async () => {
      const a = await person('Dee', `dee.${tag}`);
      const b = await person('Eli', null);
      await http()
        .put('/v1/me/username')
        .set(b.auth)
        .send({ username: `DEE.${tag}` })
        .expect(409);
      await http().put('/v1/me/username').set(b.auth).send({ username: 'a..b' }).expect(422);
      await http().put('/v1/me/username').set(b.auth).send({ username: 'support' }).expect(422);
      // setting your own name again is a no-op, not a conflict
      await http()
        .put('/v1/me/username')
        .set(a.auth)
        .send({ username: `dee.${tag}` })
        .expect(200);
    });

    it('allows one change per 14 days, then frees the old name', async () => {
      const a = await person('Fay', `fay.${tag}`);
      await http()
        .put('/v1/me/username')
        .set(a.auth)
        .send({ username: `fay2.${tag}` })
        .expect(409);
      await prisma.userProfile.update({
        where: { userId: a.id },
        data: { usernameChangedAt: new Date(Date.now() - 15 * 86_400_000) },
      });
      await http()
        .put('/v1/me/username')
        .set(a.auth)
        .send({ username: `fay2.${tag}` })
        .expect(200);
      const b = await person('Gus', null);
      await http()
        .put('/v1/me/username')
        .set(b.auth)
        .send({ username: `fay.${tag}` })
        .expect(200);
    });

    it('the table itself refuses a badly shaped name', async () => {
      const a = await person('Hal', null);
      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE user_profiles SET username = 'Bad Name' WHERE user_id = '${a.id}'::uuid`,
        ),
      ).rejects.toThrow();
    });
  });

  describe('searching', () => {
    it('orders exact, then prefix, then contains', async () => {
      const viewer = await person('Viewer One', null);
      await person('Ann A', `${tag}anna`);
      await person('Ann B', `${tag}annabel`);
      await person('Ann C', `x${tag}anna`);
      expect(await names(viewer, `${tag}anna`)).toEqual([
        `${tag}anna`,
        `${tag}annabel`,
        `x${tag}anna`,
      ]);
      expect(await names(viewer, `@${tag}ANNA`)).toEqual([
        `${tag}anna`,
        `${tag}annabel`,
        `x${tag}anna`,
      ]);
    });

    it('finds people by the start of any word in their name, ignoring accents', async () => {
      const viewer = await person('Viewer Two', null);
      await person(`Zoë Wex${tag}`, null);
      expect(await names(viewer, `wex${tag}`)).toEqual([`Zoë Wex${tag}`]);
      expect(await names(viewer, `zoe wex${tag}`)).toEqual([`Zoë Wex${tag}`]);
    });

    it('forgives a missing or swapped letter', async () => {
      const viewer = await person('Viewer Three', null);
      await person('Quill', `${tag}quillan`);
      expect(await names(viewer, `${tag}quilan`)).toContain(`${tag}quillan`);
      expect(await names(viewer, `${tag}quillna`)).toContain(`${tag}quillan`);
    });

    it('matches wildcards literally and ignores a query with no letters or digits', async () => {
      const viewer = await person('Viewer Four', null);
      await person('Percent', `${tag}pct`);
      expect(await search(viewer, '%%')).toEqual([]);
      expect(await search(viewer, '__')).toEqual([]);
    });

    it('never returns the searcher, blocked people, hidden people or people outside either side’s limits', async () => {
      const viewer = await person(`Viewer ${tag}`, `${tag}viewer`, {
        showGenders: ['MAN'],
        includeUnlistedGenders: false,
      });
      const shown = await person('Shown', `${tag}shown`, { gender: 'MAN' });
      const blocked = await person('Blocked', `${tag}blocked`, { gender: 'MAN' });
      await person('Hidden', `${tag}hidden`, { gender: 'MAN', discoverable: false });
      await person('Filtered', `${tag}filtered`, { gender: 'WOMAN' });

      await http().post(`/v1/blocks/${blocked.id}`).set(viewer.auth).expect(204);
      expect(await names(viewer, `${tag}`)).toEqual([`${tag}shown`]);
      // the block hides people from each other in both directions
      expect(await names(blocked, `${tag}shown`)).toEqual([`${tag}shown`]);
      expect(await names(blocked, `${tag}viewer`)).toEqual([]);
      expect(shown.id).toBeDefined();
    });

    it('keeps showing people you are already connected with, even when they hide', async () => {
      const a = await person('Ivy', `${tag}ivy`);
      const b = await person('Jon', `${tag}jon`);
      await http()
        .post('/v1/connections/requests')
        .set(a.auth)
        .send({ recipientId: b.id })
        .expect(201);
      await http().patch('/v1/me/profile').set(b.auth).send({ isDiscoverable: false }).expect(200);
      const found = await search(a, `${tag}jon`);
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({ userId: b.id, relation: 'pending' });
      // someone who isn't tied to Jon can't see him now
      const stranger = await person('Kim', null);
      expect((await search(stranger, `${tag}jon`)).map((r) => r.userId)).not.toContain(b.id);
    });

    it('puts people you know ahead of strangers with an equally good match', async () => {
      const viewer = await person('Viewer Five', null);
      const stranger = await person('Same A', `${tag}twin1`);
      const known = await person('Same B', `${tag}twin2`);
      await http()
        .post('/v1/connections/requests')
        .set(viewer.auth)
        .send({ recipientId: known.id })
        .expect(201);
      const results = await search(viewer, `${tag}twin`);
      expect(results.map((r) => r.userId)).toEqual([known.id, stranger.id]);
    });

    it('rejects a one-character query and honours the limit', async () => {
      const viewer = await person('Viewer Six', null);
      await http().get('/v1/search/people').query({ q: 'a' }).set(viewer.auth).expect(422);
      await http().get('/v1/search/people').set(viewer.auth).expect(422);
      await http()
        .get('/v1/search/people')
        .query({ q: 'ab', limit: 99 })
        .set(viewer.auth)
        .expect(422);
      for (const n of [1, 2, 3]) await person(`Many ${n}`, `${tag}many${n}`);
      expect(await search(viewer, `${tag}many`, 2)).toHaveLength(2);
    });

    it('requires a signed-in session', async () => {
      await http().get('/v1/search/people').query({ q: 'abc' }).expect(401);
      await http().get('/v1/people/by-username/abc').expect(401);
    });
  });

  describe('opening a shared profile', () => {
    it('resolves a username to a person you may see, and says nothing else on a miss', async () => {
      const a = await person('Lia', null);
      const b = await person('Max', `max.${tag}`);
      const body = resolvedPersonSchema.parse(
        (
          await http()
            .get(`/v1/people/by-username/${encodeURIComponent(`@MAX.${tag}`)}`)
            .set(a.auth)
            .expect(200)
        ).body,
      );
      expect(body.userId).toBe(b.id);

      const miss = await http().get('/v1/people/by-username/nobody.here').set(a.auth).expect(404);
      await http()
        .put(`/v1/blocks/${b.id}`)
        .set(a.auth)
        .catch(() => undefined);
      await http().post(`/v1/blocks/${b.id}`).set(a.auth).expect(204);
      const blocked = await http().get(`/v1/people/by-username/max.${tag}`).set(a.auth).expect(404);
      expect(blocked.body.error).toMatchObject({
        code: 'NOT_FOUND',
        message: miss.body.error.message,
      });
      await http().get('/v1/people/by-username/%20%20').set(a.auth).expect(404);
    });

    it('resolving your own username is a miss (the app opens your own profile instead)', async () => {
      const a = await person('Nia', `nia.${tag}`);
      await http().get(`/v1/people/by-username/nia.${tag}`).set(a.auth).expect(404);
    });
  });

  describe('share landing page', () => {
    it('is public, opens the app, and does not reveal whether the name exists', async () => {
      await person('Oli', `oli.${tag}`);
      const real = await http().get(`/u/oli.${tag}`).expect(200);
      const fake = await http().get('/u/not.a.real.one').expect(200);
      expect(real.headers['content-type']).toContain('text/html');
      expect(real.text).toContain(`vyra://u/oli.${tag}`);
      expect(fake.text).toContain('vyra://u/not.a.real.one');
      expect(real.text.replaceAll(`oli.${tag}`, 'X')).toBe(
        fake.text.replaceAll('not.a.real.one', 'X'),
      );
    });

    it('only echoes a well-formed username', async () => {
      const page = await http()
        .get(`/u/${encodeURIComponent('"><script>alert(1)</script>')}`)
        .expect(200);
      expect(page.text).not.toContain('<script>alert');
      expect(page.text).toContain('vyra://');
    });
  });
});
