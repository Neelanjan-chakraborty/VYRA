import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  connectionsSchema,
  type MessageView,
  messagePageSchema,
  messageSchema,
  vaultListSchema,
} from '@vyra/validation';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { EphemeralService } from '../src/modules/messaging/ephemeral.service.js';
import { ModerationService } from '../src/modules/moderation/moderation.service.js';
import {
  PHOTO_MODERATION_PROVIDER,
  type PhotoModerationProvider,
} from '../src/modules/moderation/provider.js';
import { MediaUrlService } from '../src/modules/storage/media-url.service.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../src/modules/storage/storage.js';
import { createTestApp, type TestApp, type TestUser } from './support/app.js';
import { makeImage } from './support/images.js';
import { createPerson } from './support/people.js';

type Person = TestUser & { id: string };

/** A real clip made with ffmpeg: test pattern plus a tone. */
function mp4(seconds: number, size = '640x360'): Buffer {
  const dir = mkdtempSync(join(tmpdir(), 'vyra-test-video-'));
  const file = join(dir, 'v.mp4');
  try {
    execFileSync('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      `testsrc=size=${size}:rate=15:duration=${seconds}`,
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=330:duration=${seconds}`,
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
      file,
    ]);
    return readFileSync(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Mean absolute difference between two images of the same size (0–255). */
async function difference(a: Buffer, b: Buffer): Promise<number> {
  const [x, y] = await Promise.all(
    [a, b].map((img) => sharp(img).removeAlpha().raw().toBuffer({ resolveWithObject: true })),
  );
  if (!x || !y || x.data.length !== y.data.length) return 255;
  let total = 0;
  for (let i = 0; i < x.data.length; i += 1) total += Math.abs((x.data[i] ?? 0) - (y.data[i] ?? 0));
  return total / x.data.length;
}

describe('Ephemeral media, consent, disappearing messages and the vault (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  let storage: ObjectStorage;
  let provider: PhotoModerationProvider;
  let seed = 9100;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    storage = app.get(OBJECT_STORAGE);
    provider = app.get(PHOTO_MODERATION_PROVIDER);
  });
  beforeEach(() => {
    // The classifier is exercised elsewhere; here every frame and photo passes unless a test says so.
    vi.spyOn(provider, 'assess').mockResolvedValue({ verdict: 'approve', reason: 'test' });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    await app.close();
  });

  const settings = (user: TestUser, conversationId: string, body: object) =>
    http().patch(`/v1/conversations/${conversationId}/settings`).set(user.auth).send(body);

  async function connected(allowMedia = true) {
    const [a, b] = [(await createPerson(app)) as Person, (await createPerson(app)) as Person];
    const asked = await http()
      .post('/v1/connections/requests')
      .set(a.auth)
      .send({ recipientId: b.id });
    await http().post(`/v1/connections/requests/${asked.body.requestId}/accept`).set(b.auth);
    const conversationId = connectionsSchema.parse(
      (await http().get('/v1/connections').set(a.auth)).body,
    ).mutual[0]?.conversationId;
    if (!conversationId) throw new Error('no conversation');
    if (allowMedia)
      for (const user of [a, b])
        await settings(user, conversationId, { mediaConsent: 'allowed' }).expect(200);
    return { a, b, conversationId };
  }
  const page = async (user: TestUser, conversationId: string) =>
    messagePageSchema.parse(
      (await http().get(`/v1/conversations/${conversationId}/messages`).set(user.auth).expect(200))
        .body,
    ).messages;
  const find = async (user: TestUser, conversationId: string, id: string) => {
    const found = (await page(user, conversationId)).find((m) => m.id === id);
    if (!found) throw new Error('message not in page');
    return found;
  };
  /** Sends a photo and lets the (mocked) classifier approve it. */
  async function photo(
    user: TestUser,
    conversationId: string,
    fields: Record<string, string> = {},
    image?: Buffer,
  ): Promise<MessageView> {
    vi.spyOn(app.get(ModerationService), 'submitMessage').mockResolvedValueOnce();
    let req = http()
      .post(`/v1/conversations/${conversationId}/media`)
      .set(user.auth)
      .field('kind', 'image')
      .field('clientId', randomUUID());
    for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
    const sent = await req.attach('file', image ?? (await makeImage((seed += 1))), 'p.jpg');
    expect(sent.status).toBe(201);
    await app.get(ModerationService).assessMessage(sent.body.id);
    return messageSchema.parse(sent.body);
  }
  const get = (url: string | null | undefined) => {
    const parsed = new URL(url ?? 'http://x/none');
    return http().get(parsed.pathname + parsed.search);
  };
  const keysOf = (id: string) =>
    prisma.message.findUniqueOrThrow({
      where: { id },
      select: { mediaKey: true, mediaThumbKey: true, mediaPreviewKey: true },
    });

  const bytes = async (m: MessageView) => (await get(m.media?.url).expect(200)).body as Buffer;
  async function sendVideo(user: TestUser, conversationId: string, clip: Buffer, viewOnce = false) {
    const sent = await http()
      .post(`/v1/conversations/${conversationId}/media`)
      .set(user.auth)
      .field('kind', 'video')
      .field('clientId', randomUUID())
      .field('viewOnce', String(viewOnce))
      .attach('file', clip, { filename: 'v.mp4', contentType: 'video/mp4' })
      .expect(201);
    for (let i = 0; i < 300; i += 1) {
      const row = await prisma.message.findUniqueOrThrow({ where: { id: sent.body.id } });
      if (row.mediaStatus !== 'PENDING')
        return { id: sent.body.id as string, status: row.mediaStatus };
      await new Promise((r) => setTimeout(r, 100));
    }
    return { id: sent.body.id as string, status: 'PENDING' };
  }

  describe('media consent', () => {
    it('holds the other person’s media until they allow it', async () => {
      const { a, b, conversationId } = await connected(false);
      expect(
        (await http().get(`/v1/conversations/${conversationId}`).set(b.auth)).body.settings,
      ).toMatchObject({ mediaConsent: 'ask' });
      const sent = await photo(a, conversationId);
      const held = await find(b, conversationId, sent.id);
      expect(held).toMatchObject({ held: true, kind: 'image' });
      expect(held.media).toMatchObject({ url: null, thumbUrl: null, previewUrl: null });
      // A conversation-scope URL for it would be refused anyway.
      const keys = await keysOf(sent.id);
      await get(app.get(MediaUrlService).sign(keys.mediaKey ?? '', 'conversation')).expect(404);
      expect((await find(a, conversationId, sent.id)).held).toBe(true);

      await settings(b, conversationId, { mediaConsent: 'allowed' }).expect(200);
      const allowed = await find(b, conversationId, sent.id);
      expect(allowed.held).toBe(false);
      await get(allowed.media?.url).expect(200);
      expect((await find(a, conversationId, sent.id)).held).toBe(false);
    });

    it('starts new conversations from each person’s defaults; the shorter disappearing timer wins', async () => {
      const [a, b] = [(await createPerson(app)) as Person, (await createPerson(app)) as Person];
      await http()
        .patch('/v1/me/profile')
        .set(b.auth)
        .send({ defaultMediaConsent: 'allow', defaultDisappearSeconds: 604_800 })
        .expect(200);
      await http()
        .patch('/v1/me/profile')
        .set(a.auth)
        .send({ defaultDisappearSeconds: 86_400 })
        .expect(200);
      await http()
        .patch('/v1/me/profile')
        .set(a.auth)
        .send({ defaultDisappearSeconds: 3600 })
        .expect(422);
      const asked = await http()
        .post('/v1/connections/requests')
        .set(a.auth)
        .send({ recipientId: b.id });
      await http().post(`/v1/connections/requests/${asked.body.requestId}/accept`).set(b.auth);
      const conversationId = connectionsSchema.parse(
        (await http().get('/v1/connections').set(a.auth)).body,
      ).mutual[0]?.conversationId;
      const summary = async (u: TestUser) =>
        (await http().get(`/v1/conversations/${conversationId}`).set(u.auth)).body.settings;
      expect(await summary(a)).toMatchObject({ mediaConsent: 'ask', disappearSeconds: 86_400 });
      expect(await summary(b)).toMatchObject({ mediaConsent: 'allowed', disappearSeconds: 86_400 });
    });
  });

  describe('view once', () => {
    it('shows only a blurred preview, opens once with a one-minute URL, then is erased', async () => {
      const { a, b, conversationId } = await connected();
      const sent = await photo(a, conversationId, { viewOnce: 'true' });
      // The sender keeps their own copy and may save it.
      expect(await find(a, conversationId, sent.id)).toMatchObject({
        viewOnce: true,
        savable: true,
      });
      const before = await find(b, conversationId, sent.id);
      expect(before).toMatchObject({ openable: true, blurred: true, savable: false });
      expect(before.media).toMatchObject({ url: null, thumbUrl: null });
      await get(before.media?.previewUrl).expect(200);
      const keys = await keysOf(sent.id);
      await get(app.get(MediaUrlService).sign(keys.mediaKey ?? '', 'conversation')).expect(404);
      await http().post(`/v1/messages/${sent.id}/open`).set(a.auth).expect(404); // not the sender

      const opened = await http().post(`/v1/messages/${sent.id}/open`).set(b.auth).expect(200);
      const url = new URL(opened.body.media.url);
      expect(url.searchParams.get('s')).toBe('x');
      expect(Number(url.searchParams.get('exp')) * 1000 - Date.now()).toBeLessThanOrEqual(60_000);
      const file = await get(opened.body.media.url).expect(200);
      expect(file.headers['cache-control']).toBe('private, no-store');
      await http().post(`/v1/messages/${sent.id}/open`).set(b.auth).expect(409);
      expect((await find(a, conversationId, sent.id)).openedAt).not.toBeNull();

      await http().post(`/v1/messages/${sent.id}/close`).set(b.auth).expect(204);
      for (const user of [a, b])
        expect(await find(user, conversationId, sent.id)).toMatchObject({
          removed: true,
          removedReason: 'opened',
          media: null,
        });
      await get(opened.body.media.url).expect(404);
      for (const key of Object.values(keys)) if (key) expect(await storage.get(key)).toBeNull();
    });

    it('carries the recipient’s watermark; ordinary photos stay clean', async () => {
      const { a, b, conversationId } = await connected();
      const image = await makeImage((seed += 1));
      const plain1 = await photo(a, conversationId, {}, image);
      const plain2 = await photo(a, conversationId, {}, image);
      const marked = await photo(a, conversationId, { sensitive: 'true' }, image);
      const [p1, p2, w] = await Promise.all([bytes(plain1), bytes(plain2), bytes(marked)]);
      expect(await difference(p1, p2)).toBeLessThan(0.5);
      expect(await difference(p1, w)).toBeGreaterThan(0.5);
      // Sensitive (not view-once) media: full URLs, shown blurred until tapped.
      const theirs = await find(b, conversationId, marked.id);
      expect(theirs).toMatchObject({ blurred: true, sensitive: true, openable: false });
      expect(theirs.media?.url).toEqual(expect.any(String));
    });
  });

  describe('timers and disappearing messages', () => {
    it('timed media starts its timer when opened; past it, nothing is served and the sweeper erases it', async () => {
      const { a, b, conversationId } = await connected();
      const sent = await photo(a, conversationId, { timerSeconds: '10' });
      await http()
        .post(`/v1/conversations/${conversationId}/media`)
        .set(a.auth)
        .field('kind', 'image')
        .field('clientId', randomUUID())
        .field('viewOnce', 'true')
        .field('timerSeconds', '10')
        .attach('file', await makeImage((seed += 1)), 'p.jpg')
        .expect(422);
      const opened = await http().post(`/v1/messages/${sent.id}/open`).set(b.auth).expect(200);
      const expires = Date.parse(opened.body.expiresAt);
      expect(expires - Date.now()).toBeGreaterThan(8000);
      expect(expires - Date.now()).toBeLessThanOrEqual(10_000);
      // It can be opened again until then.
      await http().post(`/v1/messages/${sent.id}/open`).set(b.auth).expect(200);

      const keys = await keysOf(sent.id);
      await prisma.message.update({
        where: { id: sent.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      expect(await find(b, conversationId, sent.id)).toMatchObject({
        removed: true,
        removedReason: 'expired',
      });
      await get(opened.body.media.url).expect(404);
      await http().post(`/v1/messages/${sent.id}/open`).set(b.auth).expect(409);
      expect(await app.get(EphemeralService).sweep()).toBeGreaterThanOrEqual(1);
      await http().post(`/v1/messages/${sent.id}/open`).set(b.auth).expect(404);
      for (const key of Object.values(keys)) if (key) expect(await storage.get(key)).toBeNull();
      expect(await find(a, conversationId, sent.id)).toMatchObject({ removedReason: 'expired' });
    });

    it('self-destructing text starts once read', async () => {
      const { a, b, conversationId } = await connected();
      const sent = await http()
        .post(`/v1/conversations/${conversationId}/messages`)
        .set(a.auth)
        .send({ kind: 'text', clientId: randomUUID(), body: 'gone soon', timerSeconds: 30 })
        .expect(201);
      expect(sent.body).toMatchObject({ timerSeconds: 30, expiresAt: null });
      await http()
        .post(`/v1/conversations/${conversationId}/read`)
        .set(b.auth)
        .send({ upTo: sent.body.id })
        .expect(204);
      const read = await find(a, conversationId, sent.body.id);
      expect(Date.parse(read.expiresAt ?? '') - Date.now()).toBeGreaterThan(25_000);
      await prisma.message.update({
        where: { id: sent.body.id },
        data: { expiresAt: new Date(Date.now() - 1) },
      });
      await app.get(EphemeralService).sweep();
      const stored = await prisma.message.findUniqueOrThrow({ where: { id: sent.body.id } });
      expect(stored.body).toBeNull();
      expect(await find(b, conversationId, sent.body.id)).toMatchObject({
        removedReason: 'expired',
        body: null,
      });
    });

    it('either person turns disappearing messages on or off, with a note for both', async () => {
      const { a, b, conversationId } = await connected();
      await settings(a, conversationId, { disappearSeconds: 3600 }).expect(422);
      await settings(a, conversationId, { disappearSeconds: 86_400 }).expect(200);
      const [note] = await page(b, conversationId);
      expect(note).toMatchObject({ event: 'disappear', disappearSeconds: 86_400, mine: false });
      const later = await http()
        .post(`/v1/conversations/${conversationId}/messages`)
        .set(b.auth)
        .send({ kind: 'text', clientId: randomUUID(), body: 'vanishing' })
        .expect(201);
      const ttl = Date.parse(later.body.expiresAt) - Date.now();
      expect(ttl).toBeGreaterThan(86_000_000);
      expect(ttl).toBeLessThanOrEqual(86_400_000);

      await settings(b, conversationId, { disappearSeconds: null }).expect(200);
      expect((await page(a, conversationId))[0]).toMatchObject({
        event: 'disappear',
        disappearSeconds: null,
      });
      const kept = await http()
        .post(`/v1/conversations/${conversationId}/messages`)
        .set(a.auth)
        .send({ kind: 'text', clientId: randomUUID(), body: 'staying' })
        .expect(201);
      expect(kept.body.expiresAt).toBeNull();
    });
  });

  describe('video', () => {
    it('is transcoded to 720p H.264 with a poster, checked frame by frame, and streams with ranges', async () => {
      const { a, b, conversationId } = await connected();
      const frames = vi.spyOn(app.get(ModerationService), 'assessVideoFrames');
      const { id, status } = await sendVideo(a, conversationId, mp4(2, '1920x1080'));
      expect(status).toBe('APPROVED');
      expect(frames).toHaveBeenCalledTimes(1);
      expect(frames.mock.calls[0]?.[1]).toHaveLength(5);
      const theirs = await find(b, conversationId, id);
      expect(theirs).toMatchObject({
        kind: 'video',
        media: { status: 'ready', width: 1280, height: 720 },
      });
      expect(theirs.media?.durationMs).toBeGreaterThan(1500);
      expect(theirs.media?.durationMs).toBeLessThanOrEqual(2100);
      const poster = await get(theirs.media?.posterUrl).expect(200);
      expect(poster.headers['content-type']).toBe('image/avif');
      const full = await get(theirs.media?.url).expect(200);
      expect(full.headers['content-type']).toBe('video/mp4');
      const parsed = new URL(theirs.media?.url ?? '');
      const part = await http()
        .get(parsed.pathname + parsed.search)
        .set('range', 'bytes=0-99')
        .expect(206);
      expect(part.headers['content-range']).toBe(`bytes 0-99/${(full.body as Buffer).length}`);
      expect((part.body as Buffer).length).toBe(100);
      expect(await storage.get(`uploads/video/${id}`)).toBeNull();
    }, 60_000);

    it('is declined when any frame fails, or when it is too long', async () => {
      const { a, b, conversationId } = await connected();
      vi.mocked(provider.assess)
        .mockResolvedValueOnce({ verdict: 'approve', reason: 'ok' })
        .mockResolvedValueOnce({ verdict: 'reject', reason: 'explicit' });
      const refused = await sendVideo(a, conversationId, mp4(2));
      expect(refused.status).toBe('REJECTED');
      expect((await page(b, conversationId)).map((m) => m.id)).not.toContain(refused.id);
      const long = await sendVideo(a, conversationId, mp4(32, '320x240'));
      expect(long.status).toBe('REJECTED');
      await http()
        .post(`/v1/conversations/${conversationId}/media`)
        .set(a.auth)
        .field('kind', 'video')
        .field('clientId', randomUUID())
        .attach('file', Buffer.from('not a video at all, really'), 'v.mp4')
        .expect(415);
    }, 90_000);
  });

  describe('blur and the vault', () => {
    it('blurs incoming media for people who ask for it', async () => {
      const { a, b, conversationId } = await connected();
      await http()
        .patch('/v1/me/profile')
        .set(b.auth)
        .send({ blurIncomingMedia: true })
        .expect(200);
      const sent = await photo(a, conversationId);
      expect((await find(b, conversationId, sent.id)).blurred).toBe(true);
      expect((await find(a, conversationId, sent.id)).blurred).toBe(false);
    });

    it('keeps private copies only where allowed, for the owner only', async () => {
      const { a, b, conversationId } = await connected();
      const open = await photo(a, conversationId);
      const noSave = await photo(a, conversationId, { allowSave: 'false' });
      const once = await photo(a, conversationId, { viewOnce: 'true' });
      expect((await find(b, conversationId, noSave.id)).savable).toBe(false);

      const kept = await http().post(`/v1/messages/${open.id}/save`).set(b.auth).expect(201);
      await http().post(`/v1/messages/${open.id}/save`).set(b.auth).expect(201); // idempotent
      await http().post(`/v1/messages/${noSave.id}/save`).set(b.auth).expect(409);
      await http().post(`/v1/messages/${once.id}/save`).set(b.auth).expect(409);
      await http().post(`/v1/messages/${noSave.id}/save`).set(a.auth).expect(201); // the sender may

      const vault = vaultListSchema.parse((await http().get('/v1/me/vault').set(b.auth)).body);
      expect(vault.items.map((i) => i.id)).toEqual([kept.body.id]);
      await get(vault.items[0]?.url).expect(200);
      // The copy outlives the message.
      await http().delete(`/v1/messages/${open.id}`).set(a.auth).expect(204);
      await get(vault.items[0]?.url).expect(200);
      await http().delete(`/v1/me/vault/${kept.body.id}`).set(a.auth).expect(404);
      await http().delete(`/v1/me/vault/${kept.body.id}`).set(b.auth).expect(204);
      await get(vault.items[0]?.url).expect(404);
      expect((await http().get('/v1/me/vault').set(b.auth)).body.items).toEqual([]);
    });
  });
});
