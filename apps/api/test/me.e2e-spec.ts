import { existsSync } from 'node:fs';
import path from 'node:path';
import { meSchema, type Me, type Photo } from '@vyra/validation';
import request from 'supertest';
import sharp from 'sharp';
import { ENV } from '../src/config/config.module.js';
import type { Env } from '../src/config/env.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { createTestApp, registerUser, type TestApp, type TestUser } from './support/app.js';
import { makeImage, makeImageWithGps } from './support/images.js';

describe('Profile, photos and account (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  let storageDir: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    storageDir = path.resolve(app.get<Env>(ENV).STORAGE_LOCAL_DIR);
  });
  afterAll(async () => {
    await app.close();
  });

  async function upload(user: TestUser, image: Buffer, filename = 'photo.jpg') {
    return http().post('/v1/me/photos').set(user.auth).attach('file', image, filename);
  }
  async function getMe(user: TestUser): Promise<Me> {
    const response = await http().get('/v1/me').set(user.auth).expect(200);
    return meSchema.parse(response.body);
  }
  /** Fetches a signed media URL through the test server. */
  function fetchMedia(url: string) {
    const { pathname, search } = new URL(url);
    return http().get(pathname + search);
  }

  describe('GET /v1/me', () => {
    it('returns a new account with masked contact details and what is missing', async () => {
      const user = await registerUser(app);
      const me = await getMe(user);
      expect(me.status).toBe('ONBOARDING');
      expect(me.emailMasked).toMatch(/^t\*\*\*@example\.test$/);
      expect(JSON.stringify(me)).not.toContain(user.email);
      expect(me.age).toBeGreaterThanOrEqual(18);
      expect(me.onboardingMissing).toEqual(['profile', 'photo', 'relationshipIntent']);
    });
  });

  describe('profile', () => {
    it('requires a display name to create the profile', async () => {
      const user = await registerUser(app);
      const response = await http().patch('/v1/me/profile').set(user.auth).send({ bio: 'Hello' });
      expect(response.status).toBe(422);
      expect(response.body.error.details[0].path).toBe('displayName');
    });

    it('creates, updates and clears fields', async () => {
      const user = await registerUser(app);
      await http()
        .patch('/v1/me/profile')
        .set(user.auth)
        .send({
          displayName: '  Asha ',
          bio: 'Reads too much.',
          occupation: 'Writer',
        })
        .expect(200);
      const updated = await http()
        .patch('/v1/me/profile')
        .set(user.auth)
        .send({ bio: '', occupation: 'Designer' })
        .expect(200);
      expect(meSchema.parse(updated.body).profile).toMatchObject({
        displayName: 'Asha',
        bio: null,
        occupation: 'Designer',
        isDiscoverable: false,
      });
    });

    it.each([
      [{ displayName: 'x'.repeat(61) }, 'displayName'],
      [{ displayName: 'Ok', bio: 'x'.repeat(601) }, 'bio'],
      [{ displayName: 'Ok', genderIdentity: 'female' }, 'genderIdentity'],
    ])('rejects %j', async (body, field) => {
      const user = await registerUser(app);
      const response = await http().patch('/v1/me/profile').set(user.auth).send(body);
      expect(response.status).toBe(422);
      expect(response.body.error.details.map((d: { path: string }) => d.path)).toContain(field);
    });

    it('ignores fields a client must not set', async () => {
      const user = await registerUser(app);
      await http()
        .patch('/v1/me/profile')
        .set(user.auth)
        .send({
          displayName: 'Mallory',
          userId: '00000000-0000-0000-0000-000000000000',
          role: 'ADMIN',
          status: 'ACTIVE',
        })
        .expect(200);
      const row = await prisma.user.findUniqueOrThrow({ where: { email: user.email } });
      expect(row.role).toBe('USER');
      expect(row.status).toBe('ONBOARDING');
    });

    it('cannot become discoverable before onboarding is complete', async () => {
      const user = await registerUser(app);
      await http()
        .patch('/v1/me/profile')
        .set(user.auth)
        .send({ displayName: 'Asha', isDiscoverable: true })
        .expect(409);
    });
  });

  describe('relationship intentions, preferences and interests', () => {
    it('replaces intentions, including a custom one', async () => {
      const user = await registerUser(app);
      await http()
        .put('/v1/me/relationship-intents')
        .set(user.auth)
        .send({ intents: [{ kind: 'casual' }] })
        .expect(200);
      const response = await http()
        .put('/v1/me/relationship-intents')
        .set(user.auth)
        .send({
          intents: [
            { kind: 'serious', isPrimary: true },
            { kind: 'other', customLabel: 'Travel partner' },
          ],
        })
        .expect(200);
      expect(meSchema.parse(response.body).relationshipIntents).toEqual([
        { kind: 'serious', customLabel: null, isPrimary: true },
        { kind: 'other', customLabel: 'Travel partner', isPrimary: false },
      ]);
    });

    it('rejects an empty list of intentions', async () => {
      const user = await registerUser(app);
      await http()
        .put('/v1/me/relationship-intents')
        .set(user.auth)
        .send({ intents: [] })
        .expect(422);
    });

    it('saves discovery preferences and rejects under-age ranges', async () => {
      const user = await registerUser(app);
      const prefs = {
        minAge: 24,
        maxAge: 32,
        maxDistanceKm: 50,
        showGenders: ['WOMAN'],
        showAstrology: false,
      };
      const response = await http()
        .put('/v1/me/discovery-preferences')
        .set(user.auth)
        .send(prefs)
        .expect(200);
      expect(meSchema.parse(response.body).discoveryPreferences).toEqual({
        ...prefs,
        includeUnlistedGenders: true,
        dealBreakers: [],
      });
      await http()
        .put('/v1/me/discovery-preferences')
        .set(user.auth)
        .send({ ...prefs, minAge: 16 })
        .expect(422);
    });

    it('lists the catalogue and saves selected interests', async () => {
      const user = await registerUser(app);
      const catalogue = await http().get('/v1/interests').set(user.auth).expect(200);
      expect(catalogue.body.interests.length).toBeGreaterThan(30);
      const picked = catalogue.body.interests.slice(0, 3).map((i: { id: string }) => i.id);
      const response = await http()
        .put('/v1/me/interests')
        .set(user.auth)
        .send({ interestIds: picked })
        .expect(200);
      expect(
        meSchema
          .parse(response.body)
          .interests.map((i) => i.id)
          .toSorted(),
      ).toEqual(picked.toSorted());
      await http()
        .put('/v1/me/interests')
        .set(user.auth)
        .send({ interestIds: ['00000000-0000-4000-8000-000000000000'] })
        .expect(422);
    });

    it('the catalogue needs authentication', async () => {
      await http().get('/v1/interests').expect(401);
    });
  });

  describe('photos', () => {
    it('re-encodes to JPEG, strips EXIF and GPS, and serves through a signed URL', async () => {
      const user = await registerUser(app);
      const response = await upload(user, await makeImageWithGps());
      expect(response.status).toBe(201);
      const photo = response.body as Photo;
      const served = await fetchMedia(photo.url).expect(200);
      expect(served.headers['content-type']).toBe('image/jpeg');
      const metadata = await sharp(served.body as Buffer).metadata();
      expect(metadata.format).toBe('jpeg');
      expect(metadata.exif).toBeUndefined();
      expect((served.body as Buffer).includes('secret-device-id')).toBe(false);
    });

    it('accepts PNG and WebP and downsizes large images', async () => {
      const user = await registerUser(app);
      const png = await upload(
        user,
        await makeImage(1, { format: 'png', width: 3000, height: 4000 }),
        'a.png',
      );
      expect(png.status).toBe(201);
      expect(Math.max(png.body.width, png.body.height)).toBe(2048);
      const webp = await upload(user, await makeImage(2, { format: 'webp' }), 'b.webp');
      expect(webp.status).toBe(201);
    });

    it('judges files by content, not by name or declared type', async () => {
      const user = await registerUser(app);
      const fake = await http()
        .post('/v1/me/photos')
        .set(user.auth)
        .attach(
          'file',
          Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
          {
            filename: 'innocent.jpg',
            contentType: 'image/jpeg',
          },
        );
      expect(fake.status).toBe(400);
      const gif = await sharp({
        create: { width: 500, height: 500, channels: 3, background: '#fff' },
      })
        .gif()
        .toBuffer();
      expect((await upload(user, gif, 'photo.jpg')).status).toBe(400);
      expect((await upload(user, Buffer.from('not an image at all'))).status).toBe(400);
    });

    it('rejects tiny images, oversized uploads and a missing file', async () => {
      const user = await registerUser(app);
      expect((await upload(user, await makeImage(3, { width: 200, height: 200 }))).status).toBe(
        400,
      );
      const tooBig = await upload(user, Buffer.alloc(10 * 1024 * 1024 + 1));
      expect(tooBig.status).toBe(413);
      expect(tooBig.body.error.code).toBe('PAYLOAD_TOO_LARGE');
      expect((await http().post('/v1/me/photos').set(user.auth)).status).toBe(400);
    });

    it('rejects duplicates and more than six photos', async () => {
      const user = await registerUser(app);
      const image = await makeImage(10);
      expect((await upload(user, image)).status).toBe(201);
      expect((await upload(user, image)).status).toBe(409);
      for (let seed = 11; seed <= 15; seed += 1) {
        expect((await upload(user, await makeImage(seed))).status).toBe(201);
      }
      expect((await upload(user, await makeImage(16))).status).toBe(409);
      expect((await getMe(user)).photos.map((p) => p.position)).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('reorders photos and rejects incomplete or foreign orderings', async () => {
      const user = await registerUser(app);
      const other = await registerUser(app);
      const ids: string[] = [];
      for (let seed = 20; seed < 23; seed += 1)
        ids.push((await upload(user, await makeImage(seed))).body.id);
      const foreign = (await upload(other, await makeImage(29))).body.id as string;

      const reversed = ids.toReversed();
      const response = await http()
        .put('/v1/me/photos/order')
        .set(user.auth)
        .send({ photoIds: reversed })
        .expect(200);
      expect(response.body.photos.map((p: Photo) => p.id)).toEqual(reversed);
      expect(response.body.photos.map((p: Photo) => p.position)).toEqual([0, 1, 2]);

      await http()
        .put('/v1/me/photos/order')
        .set(user.auth)
        .send({ photoIds: ids.slice(0, 2) })
        .expect(400);
      await http()
        .put('/v1/me/photos/order')
        .set(user.auth)
        .send({ photoIds: [ids[0], ids[1], foreign] })
        .expect(400);
    });

    it("cannot delete or reorder another person's photo", async () => {
      const owner = await registerUser(app);
      const attacker = await registerUser(app);
      const photo = (await upload(owner, await makeImage(30))).body as Photo;
      await http().delete(`/v1/me/photos/${photo.id}`).set(attacker.auth).expect(404);
      await http()
        .put('/v1/me/photos/order')
        .set(attacker.auth)
        .send({ photoIds: [photo.id] })
        .expect(400);
      expect((await getMe(owner)).photos).toHaveLength(1);
    });

    it('deleting a photo removes the row and the stored file', async () => {
      const user = await registerUser(app);
      const photo = (await upload(user, await makeImage(31))).body as Photo;
      const row = await prisma.userPhoto.findUniqueOrThrow({ where: { id: photo.id } });
      expect(existsSync(path.join(storageDir, row.storageKey))).toBe(true);
      await http().delete(`/v1/me/photos/${photo.id}`).set(user.auth).expect(204);
      expect(existsSync(path.join(storageDir, row.storageKey))).toBe(false);
      await fetchMedia(photo.url).expect(404);
      await http().delete(`/v1/me/photos/${photo.id}`).set(user.auth).expect(404);
      await http().delete('/v1/me/photos/not-a-uuid').set(user.auth).expect(422);
    });

    it('media URLs cannot be forged, extended or pointed elsewhere', async () => {
      const user = await registerUser(app);
      const other = await registerUser(app);
      const mine = (await upload(user, await makeImage(40))).body as Photo;
      const theirs = (await upload(other, await makeImage(41))).body as Photo;
      const url = new URL(mine.url);
      const sig = url.searchParams.get('sig') as string;
      const exp = url.searchParams.get('exp') as string;

      await http().get(url.pathname).expect(404); // no signature
      await http()
        .get(`${url.pathname}?exp=${exp}&sig=${'0'.repeat(64)}`)
        .expect(404);
      await http()
        .get(`${url.pathname}?exp=${Number(exp) + 3600}&sig=${sig}`)
        .expect(404);
      await http().get(`${url.pathname}?exp=1&sig=${sig}`).expect(404);
      // A valid signature for my photo does not open someone else's.
      await http()
        .get(`${new URL(theirs.url).pathname}?exp=${exp}&sig=${sig}`)
        .expect(404);
      await http()
        .get(`/v1/media/photos/..%2F..%2Fetc/passwd.jpg?exp=${exp}&sig=${sig}`)
        .expect(404);
    });
  });

  describe('onboarding', () => {
    it('cannot be completed until profile, photo and intention exist', async () => {
      const user = await registerUser(app);
      const early = await http().post('/v1/me/onboarding/complete').set(user.auth);
      expect(early.status).toBe(409);

      await http().patch('/v1/me/profile').set(user.auth).send({ displayName: 'Asha' }).expect(200);
      await upload(user, await makeImage(50));
      await http()
        .put('/v1/me/relationship-intents')
        .set(user.auth)
        .send({ intents: [{ kind: 'exploring' }] })
        .expect(200);

      const done = await http().post('/v1/me/onboarding/complete').set(user.auth).expect(200);
      const me = meSchema.parse(done.body);
      expect(me.status).toBe('ACTIVE');
      expect(me.profile?.isDiscoverable).toBe(true);
      expect(me.onboardingMissing).toEqual([]);

      // Active people may hide themselves again.
      const hidden = await http()
        .patch('/v1/me/profile')
        .set(user.auth)
        .send({ isDiscoverable: false })
        .expect(200);
      expect(hidden.body.profile.isDiscoverable).toBe(false);
    });
  });

  describe('account deletion', () => {
    it('needs explicit confirmation', async () => {
      const user = await registerUser(app);
      await http().delete('/v1/me').set(user.auth).send({}).expect(422);
      await http().get('/v1/me').set(user.auth).expect(200);
    });

    it('removes personal data and files, ends sessions, and frees the address', async () => {
      const user = await registerUser(app);
      await http()
        .patch('/v1/me/profile')
        .set(user.auth)
        .send({ displayName: 'Asha', bio: 'Private words' })
        .expect(200);
      const photo = (await upload(user, await makeImage(60))).body as Photo;
      const before = await prisma.user.findUniqueOrThrow({ where: { email: user.email } });
      const file = path.join(storageDir, `photos/${before.id}/${photo.id}.jpg`);
      expect(existsSync(file)).toBe(true);

      await http().delete('/v1/me').set(user.auth).send({ confirm: 'DELETE' }).expect(204);

      const after = await prisma.user.findUniqueOrThrow({
        where: { id: before.id },
        include: {
          profile: true,
          photos: true,
          sessions: true,
          consents: true,
          relationshipIntents: true,
        },
      });
      expect(after).toMatchObject({
        status: 'DELETED',
        email: null,
        phone: null,
        dateOfBirth: null,
      });
      expect(after.deletedAt).not.toBeNull();
      expect([
        after.profile,
        after.photos,
        after.sessions,
        after.consents,
        after.relationshipIntents,
      ]).toEqual([null, [], [], [], []]);
      expect(existsSync(file)).toBe(false);

      await http().get('/v1/me').set(user.auth).expect(401);
      await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: user.tokens.refreshToken })
        .expect(401);
      await fetchMedia(photo.url).expect(404);
      expect(
        await prisma.auditLog.count({ where: { action: 'account.deleted', actorId: before.id } }),
      ).toBe(1);

      // The same address can register again as a brand-new account.
      const again = await registerUser(app, user.email);
      expect((await getMe(again)).id).not.toBe(before.id);
    });
  });
});
