import {
  moderationQueueSchema,
  PHOTO_REPORT_HIDE_THRESHOLD,
  publicProfileSchema,
  recommendationListSchema,
} from '@vyra/validation';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { ModerationService } from '../src/modules/moderation/moderation.service.js';
import {
  PHOTO_MODERATION_PROVIDER,
  type PhotoModerationProvider,
} from '../src/modules/moderation/provider.js';
import {
  createTestApp,
  registerUser,
  waitForPhoto,
  type TestApp,
  type TestUser,
} from './support/app.js';
import { makeImage } from './support/images.js';
import { createPerson } from './support/people.js';

type Person = TestUser & { id: string; photoId: string };

/**
 * The guarantee: no photo that is not APPROVED reaches anyone but its owner
 * (and moderators), through any response or any URL.
 */
describe('Photo moderation and leak-proofing (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  let provider: PhotoModerationProvider;
  const http = () => request(app.getHttpServer());
  let seed = 5000;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    provider = app.get<PhotoModerationProvider>(PHOTO_MODERATION_PROVIDER);
    await prisma.userProfile.updateMany({ data: { isDiscoverable: false } });
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const nextImage = () => makeImage((seed += 1));
  const viewerSpec = { gender: 'woman', interestedIn: ['Men'] } as const;
  const subjectSpec = { gender: 'man', interestedIn: ['Women'] } as const;

  /** Everything a viewer can receive about `subject`, plus every URL in it. */
  async function publicSurface(viewer: TestUser, subject: Person) {
    const recs = recommendationListSchema.parse(
      (await http().get('/v1/discovery/recommendations?limit=50').set(viewer.auth).expect(200))
        .body,
    );
    const card = recs.recommendations.find((r) => r.userId === subject.id);
    const profileResponse = await http().get(`/v1/people/${subject.id}`).set(viewer.auth);
    const profile =
      profileResponse.status === 200 ? publicProfileSchema.parse(profileResponse.body) : null;
    const compat = await http().get(`/v1/compatibility/${subject.id}`).set(viewer.auth);
    const urls = [card?.photoUrl, ...(profile?.photos.map((p) => p.url) ?? [])].filter(
      (u): u is string => typeof u === 'string',
    );
    return { card, profile, compatBody: JSON.stringify(compat.body), urls };
  }

  function fetchUrl(url: string) {
    const { pathname, search } = new URL(url);
    return http().get(pathname + search);
  }

  async function ownerUrl(user: TestUser, photoId: string): Promise<string> {
    const me = await http().get('/v1/me').set(user.auth).expect(200);
    return (me.body.photos as { id: string; url: string }[]).find((p) => p.id === photoId)
      ?.url as string;
  }

  async function makeModerator(): Promise<TestUser> {
    const user = await registerUser(app);
    await prisma.user.update({ where: { email: user.email }, data: { role: 'MODERATOR' } });
    return user;
  }

  describe('upload validation', () => {
    it('rejects a declared type that is not accepted, or that does not match the bytes', async () => {
      const user = await registerUser(app);
      const png = await makeImage(1, { format: 'png' });
      const wrongDeclared = await http()
        .post('/v1/me/photos')
        .set(user.auth)
        .attach('file', png, { filename: 'a.png', contentType: 'image/jpeg' });
      expect(wrongDeclared.status).toBe(400);
      const gif = await http()
        .post('/v1/me/photos')
        .set(user.auth)
        .attach('file', png, { filename: 'a.gif', contentType: 'image/gif' });
      expect(gif.status).toBe(415);
      const huge = await makeImage(2, { width: 8100, height: 900 });
      expect(
        (await http().post('/v1/me/photos').set(user.auth).attach('file', huge, 'big.jpg')).status,
      ).toBe(400);
    });
  });

  describe('every non-approved state stays private', () => {
    let viewer: Person;

    beforeAll(async () => {
      viewer = await createPerson(app, { ...viewerSpec });
    });

    it.each([
      ['PENDING', 'pending'],
      ['REVIEW_REQUIRED', 'review'],
      ['REJECTED', 'reject'],
    ] as const)('a %s photo never reaches another person', async (status, verdict) => {
      if (verdict !== 'pending') {
        vi.spyOn(provider, 'assess').mockResolvedValue({
          verdict,
          reason: verdict === 'reject' ? 'explicit_content' : 'possibly_explicit',
        });
      } else {
        // Don't queue the job: the photo stays PENDING for the duration of the test.
        vi.spyOn(app.get(ModerationService), 'submit').mockResolvedValue();
      }
      let subject: Person;
      if (verdict === 'reject') {
        // Someone with only rejected photos can't finish onboarding, so reject a replacement.
        vi.restoreAllMocks();
        subject = await createPerson(app, { ...subjectSpec });
        vi.spyOn(provider, 'assess').mockResolvedValue({ verdict, reason: 'explicit_content' });
        await http()
          .put(`/v1/me/photos/${subject.photoId}`)
          .set(subject.auth)
          .attach('file', await nextImage(), 'r.jpg')
          .expect(200);
      } else {
        subject = await createPerson(app, { ...subjectSpec, photo: 'pending' });
      }
      if (verdict !== 'pending') await waitForPhoto(app, subject, subject.photoId, status);

      const surface = await publicSurface(viewer, subject);
      expect(surface.card).toBeDefined(); // the person is still recommended…
      expect(surface.card?.photoUrl).toBeNull(); // …with a placeholder
      expect(surface.profile?.photos).toEqual([]);
      expect(surface.compatBody).not.toContain(subject.photoId);

      // The owner still sees it, with its status.
      const me = await http().get('/v1/me').set(subject.auth).expect(200);
      expect(me.body.photos[0]).toMatchObject({ id: subject.photoId, status });

      // The owner's own URL cannot be replayed as a public one.
      const url = new URL(await ownerUrl(subject, subject.photoId));
      url.searchParams.set('s', 'p');
      await http()
        .get(url.pathname + url.search)
        .expect(404);
    });

    it('an approved photo appears, and its public URL dies the moment it is rejected', async () => {
      const subject = await createPerson(app, { ...subjectSpec });
      const before = await publicSurface(viewer, subject);
      expect(before.card?.photoUrl).toMatch(/[?&]s=p&/);
      expect(before.profile?.photos).toHaveLength(1);
      for (const url of before.urls) await fetchUrl(url).expect(200);

      const moderator = await makeModerator();
      await http()
        .post(`/v1/moderation/photos/${subject.photoId}/decision`)
        .set(moderator.auth)
        .send({ decision: 'reject', reason: 'policy_violation' })
        .expect(204);

      for (const url of before.urls) await fetchUrl(url).expect(404); // URLs issued earlier
      const after = await publicSurface(viewer, subject);
      expect(after.card?.photoUrl).toBeNull();
      expect(after.profile?.photos).toEqual([]);
      // The owner can still see their own rejected photo.
      await fetchUrl(await ownerUrl(subject, subject.photoId)).expect(200);
    });

    it('public URLs stop working when the owner hides their profile or deletes the photo', async () => {
      const subject = await createPerson(app, { ...subjectSpec });
      const [url] = (await publicSurface(viewer, subject)).urls;
      await fetchUrl(url as string).expect(200);
      await http()
        .patch('/v1/me/profile')
        .set(subject.auth)
        .send({ isDiscoverable: false })
        .expect(200);
      await fetchUrl(url as string).expect(404);
      await http()
        .patch('/v1/me/profile')
        .set(subject.auth)
        .send({ isDiscoverable: true })
        .expect(200);
      await fetchUrl(url as string).expect(200);
      await http().delete(`/v1/me/photos/${subject.photoId}`).set(subject.auth).expect(204);
      await fetchUrl(url as string).expect(404);
    });

    it('replacing a photo hides it until the new image is approved, and kills old URLs', async () => {
      const subject = await createPerson(app, { ...subjectSpec });
      const [oldUrl] = (await publicSurface(viewer, subject)).urls;
      vi.spyOn(app.get(ModerationService), 'submit').mockResolvedValue();
      const replaced = await http()
        .put(`/v1/me/photos/${subject.photoId}`)
        .set(subject.auth)
        .attach('file', await nextImage(), 'new.jpg')
        .expect(200);
      expect(replaced.body).toMatchObject({ id: subject.photoId, status: 'PENDING' });
      await fetchUrl(oldUrl as string).expect(404);
      const surface = await publicSurface(viewer, subject);
      expect(surface.card?.photoUrl).toBeNull();
      expect(surface.profile?.photos).toEqual([]);
    });

    it('a person with no photos at all is shown with a placeholder', async () => {
      const subject = await createPerson(app, { ...subjectSpec });
      await http().delete(`/v1/me/photos/${subject.photoId}`).set(subject.auth).expect(204);
      const surface = await publicSurface(viewer, subject);
      expect(surface.card?.photoUrl).toBeNull();
      expect(surface.profile?.photos).toEqual([]);
    });
  });

  describe('replace, appeal and human review', () => {
    it('re-moderates a replaced photo and records the history', async () => {
      const subject = await createPerson(app, { ...subjectSpec });
      vi.spyOn(provider, 'assess').mockResolvedValue({
        verdict: 'reject',
        reason: 'explicit_content',
      });
      await http()
        .put(`/v1/me/photos/${subject.photoId}`)
        .set(subject.auth)
        .attach('file', await nextImage(), 'x.jpg')
        .expect(200);
      await waitForPhoto(app, subject, subject.photoId, 'REJECTED');
      const me = await http().get('/v1/me').set(subject.auth).expect(200);
      expect(me.body.photos[0]).toMatchObject({
        status: 'REJECTED',
        reason: 'explicit_content',
        canAppeal: true,
      });

      const history = await prisma.moderationEvent.findMany({
        where: { targetId: subject.photoId },
        orderBy: { createdAt: 'asc' },
      });
      expect(history.map((e) => e.action)).toEqual([
        'PHOTO_SUBMITTED',
        'PHOTO_APPROVED',
        'PHOTO_SUBMITTED',
        'PHOTO_REJECTED',
      ]);
      expect(
        await prisma.auditLog.count({ where: { entityType: 'photo', entityId: subject.photoId } }),
      ).toBe(4);
    });

    it('an appeal goes to a moderator once; the decision is final', async () => {
      const subject = await createPerson(app, { ...subjectSpec });
      const moderator = await makeModerator();
      await http()
        .post(`/v1/moderation/photos/${subject.photoId}/decision`)
        .set(moderator.auth)
        .send({ decision: 'reject', reason: 'blurry' })
        .expect(204);
      await http().post(`/v1/me/photos/${subject.photoId}/appeal`).set(subject.auth).expect(204);
      await http().post(`/v1/me/photos/${subject.photoId}/appeal`).set(subject.auth).expect(409);

      const queue = moderationQueueSchema.parse(
        (await http().get('/v1/moderation/photos').set(moderator.auth).expect(200)).body,
      );
      const item = queue.items.find((i) => i.photoId === subject.photoId);
      expect(item).toMatchObject({ status: 'REVIEW_REQUIRED', appealed: true });
      await fetchUrl(item?.url as string).expect(200); // moderators can see it

      await http()
        .post(`/v1/moderation/photos/${subject.photoId}/decision`)
        .set(moderator.auth)
        .send({ decision: 'approve', reason: 'appeal_upheld' })
        .expect(204);
      const me = await http().get('/v1/me').set(subject.auth).expect(200);
      expect(me.body.photos[0]).toMatchObject({ status: 'APPROVED', canAppeal: false });
      await http().post(`/v1/me/photos/${subject.photoId}/appeal`).set(subject.auth).expect(409);
    });

    it('only moderators and admins can use the queue', async () => {
      const user = await registerUser(app);
      await http().get('/v1/moderation/photos').set(user.auth).expect(403);
      await http()
        .post('/v1/moderation/photos/00000000-0000-4000-8000-000000000000/decision')
        .set(user.auth)
        .send({ decision: 'approve', reason: 'x' })
        .expect(403);
      await http().get('/v1/moderation/photos').expect(401);
    });

    it('a rejected photo does not count towards finishing onboarding', async () => {
      const user = await registerUser(app);
      vi.spyOn(provider, 'assess').mockResolvedValue({
        verdict: 'reject',
        reason: 'explicit_content',
      });
      await http().patch('/v1/me/profile').set(user.auth).send({ displayName: 'R' }).expect(200);
      const photo = await http()
        .post('/v1/me/photos')
        .set(user.auth)
        .attach('file', await nextImage(), 'r.jpg')
        .expect(201);
      await waitForPhoto(app, user, photo.body.id, 'REJECTED');
      await http()
        .put('/v1/me/relationship-intents')
        .set(user.auth)
        .send({ intents: [{ kind: 'serious' }] })
        .expect(200);
      const me = await http().get('/v1/me').set(user.auth).expect(200);
      expect(me.body.onboardingMissing).toEqual(['photo']);
      await http().post('/v1/me/onboarding/complete').set(user.auth).expect(409);
    });
  });

  describe('reports', () => {
    it(`hides a photo after ${PHOTO_REPORT_HIDE_THRESHOLD} different people report it, not before`, async () => {
      const subject = await createPerson(app, { ...subjectSpec });
      const viewer = await createPerson(app, { ...viewerSpec });
      const report = {
        reportedUserId: subject.id,
        reason: 'INAPPROPRIATE_CONTENT',
        photoId: subject.photoId,
      };

      const first = await registerUser(app);
      await http().post('/v1/reports').set(first.auth).send(report).expect(202);
      await http().post('/v1/reports').set(first.auth).send(report).expect(202); // same person again: no effect
      expect((await publicSurface(viewer, subject)).profile?.photos).toHaveLength(1);

      const second = await registerUser(app);
      await http().post('/v1/reports').set(second.auth).send(report).expect(202);
      const surface = await publicSurface(viewer, subject);
      expect(surface.profile?.photos).toEqual([]);
      expect(surface.card?.photoUrl).toBeNull();

      const moderator = await makeModerator();
      const queue = moderationQueueSchema.parse(
        (await http().get('/v1/moderation/photos').set(moderator.auth).expect(200)).body,
      );
      expect(queue.items.find((i) => i.photoId === subject.photoId)).toMatchObject({
        openReports: 2,
        reason: 'reported',
      });
      await http()
        .post(`/v1/moderation/photos/${subject.photoId}/decision`)
        .set(moderator.auth)
        .send({ decision: 'reject', reason: 'policy_violation' })
        .expect(204);
      const reports = await prisma.safetyReport.findMany({ where: { photoId: subject.photoId } });
      expect(reports.every((r) => r.status === 'ACTIONED')).toBe(true);
    });

    it('cannot report yourself, a stranger’s photo under someone else, or nobody', async () => {
      const a = await createPerson(app, { ...subjectSpec });
      const b = await createPerson(app, { ...subjectSpec });
      await http()
        .post('/v1/reports')
        .set(a.auth)
        .send({ reportedUserId: a.id, reason: 'OTHER' })
        .expect(400);
      await http()
        .post('/v1/reports')
        .set(a.auth)
        .send({ reportedUserId: b.id, reason: 'OTHER', photoId: a.photoId })
        .expect(404);
      await http()
        .post('/v1/reports')
        .set(a.auth)
        .send({ reportedUserId: '00000000-0000-4000-8000-000000000000', reason: 'OTHER' })
        .expect(404);
      await http()
        .post('/v1/reports')
        .set(a.auth)
        .send({ reportedUserId: b.id, reason: 'NOPE' })
        .expect(422);
    });
  });
});
