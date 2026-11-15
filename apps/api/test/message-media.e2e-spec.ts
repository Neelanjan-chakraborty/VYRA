import { randomUUID } from 'node:crypto';
import { connectionsSchema, messagePageSchema } from '@vyra/validation';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { AI_PROVIDER } from '../src/modules/ai/ai-provider.js';
import type { MockAiProvider } from '../src/modules/ai/mock-ai-provider.js';
import { ModerationService } from '../src/modules/moderation/moderation.service.js';
import {
  PHOTO_MODERATION_PROVIDER,
  type PhotoModerationProvider,
} from '../src/modules/moderation/provider.js';
import { createTestApp, type TestApp, type TestUser } from './support/app.js';
import { makeImageWithGps, makeImage } from './support/images.js';
import { createPerson } from './support/people.js';

type Person = TestUser & { id: string; photoId: string };

/** A minimal M4A: an ftyp box and a moov box whose mvhd records the duration. */
function m4a(durationMs: number): Buffer {
  const ftyp = Buffer.alloc(16);
  ftyp.writeUInt32BE(16, 0);
  ftyp.write('ftypM4A ', 4, 'latin1');
  const mvhd = Buffer.alloc(8 + 100);
  mvhd.writeUInt32BE(mvhd.length, 0);
  mvhd.write('mvhd', 4, 'latin1');
  mvhd.writeUInt32BE(1000, 8 + 12); // timescale: milliseconds
  mvhd.writeUInt32BE(durationMs, 8 + 16);
  const moov = Buffer.alloc(8);
  moov.writeUInt32BE(8 + mvhd.length, 0);
  moov.write('moov', 4, 'latin1');
  return Buffer.concat([ftyp, moov, mvhd, Buffer.alloc(2000, 7)]);
}

describe('Photos, voice notes, reports and Wingman in conversations (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  let provider: PhotoModerationProvider;
  let ai: MockAiProvider;
  let seed = 7000;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    provider = app.get(PHOTO_MODERATION_PROVIDER);
    ai = app.get(AI_PROVIDER);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    await app.close();
  });

  async function connected(): Promise<{ a: Person; b: Person; conversationId: string }> {
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
    return { a, b, conversationId };
  }
  const page = async (user: TestUser, conversationId: string) =>
    messagePageSchema.parse(
      (await http().get(`/v1/conversations/${conversationId}/messages`).set(user.auth).expect(200))
        .body,
    ).messages;
  const sendPhoto = async (user: TestUser, conversationId: string, image?: Buffer, status = 201) =>
    http()
      .post(`/v1/conversations/${conversationId}/media`)
      .set(user.auth)
      .field('kind', 'image')
      .field('clientId', randomUUID())
      .attach('file', image ?? (await makeImage((seed += 1))), 'p.jpg')
      .expect(status);
  const sendVoice = (user: TestUser, conversationId: string, file: Buffer, durationMs = 5000) =>
    http()
      .post(`/v1/conversations/${conversationId}/media`)
      .set(user.auth)
      .field('kind', 'voice')
      .field('clientId', randomUUID())
      .field('durationMs', String(durationMs))
      .attach('file', file, { filename: 'v.m4a', contentType: 'audio/mp4' });
  async function settled(messageId: string): Promise<string | null> {
    for (let i = 0; i < 100; i += 1) {
      const message = await prisma.message.findUniqueOrThrow({ where: { id: messageId } });
      if (message.mediaStatus !== 'PENDING') return message.mediaStatus;
      await new Promise((r) => setTimeout(r, 100));
    }
    return 'PENDING';
  }

  describe('photos', () => {
    it('reach the other person only after approval, without EXIF, via a scoped URL', async () => {
      const { a, b, conversationId } = await connected();
      vi.spyOn(app.get(ModerationService), 'submitMessage').mockResolvedValue();
      const sent = await sendPhoto(a, conversationId, await makeImageWithGps());
      expect(sent.body.media.status).toBe('checking');
      expect(sent.body.media.url).toEqual(expect.any(String)); // the sender sees their own

      const [pending] = await page(b, conversationId);
      expect(pending?.media).toMatchObject({ status: 'checking', url: null });

      vi.restoreAllMocks();
      await app.get(ModerationService).assessMessage(sent.body.id);
      const [ready] = await page(b, conversationId);
      expect(ready?.media?.status).toBe('ready');
      const url = new URL(ready?.media?.url ?? '');
      expect(url.searchParams.get('s')).toBe('c');
      const image = await http()
        .get(url.pathname + url.search)
        .expect(200);
      expect(image.headers['content-type']).toBe('image/jpeg');
      expect((image.body as Buffer).includes(Buffer.from('secret-device-id'))).toBe(false);

      // The same URL stops working across a block.
      await http().post(`/v1/blocks/${a.id}`).set(b.auth).expect(204);
      await http()
        .get(url.pathname + url.search)
        .expect(404);
    });

    it('are never shown to the other person when the classifier is unsure or says no', async () => {
      const { a, b, conversationId } = await connected();
      for (const verdict of ['review', 'reject'] as const) {
        vi.spyOn(provider, 'assess').mockResolvedValue({ verdict, reason: 'possibly_explicit' });
        const sent = await sendPhoto(a, conversationId);
        expect(await settled(sent.body.id)).toBe('REJECTED');
        expect((await page(b, conversationId)).map((m) => m.id)).not.toContain(sent.body.id);
        const mine = (await page(a, conversationId)).find((m) => m.id === sent.body.id);
        expect(mine?.media?.status).toBe('declined');
        vi.restoreAllMocks();
      }
    });

    it('refuse files that are not the image they claim to be, and outsiders', async () => {
      const { a, conversationId } = await connected();
      const outsider = (await createPerson(app)) as Person;
      await http()
        .post(`/v1/conversations/${conversationId}/media`)
        .set(a.auth)
        .field('kind', 'image')
        .field('clientId', randomUUID())
        .attach('file', Buffer.from('not an image at all'), {
          filename: 'x.jpg',
          contentType: 'image/jpeg',
        })
        .expect(400);
      await sendPhoto(outsider, conversationId, undefined, 404);
    });
  });

  describe('voice notes', () => {
    it('accept a real M4A up to a minute, using the duration recorded in the file', async () => {
      const { a, b, conversationId } = await connected();
      const sent = await sendVoice(a, conversationId, m4a(12_345), 999).expect(201);
      expect(sent.body.media).toMatchObject({ status: 'ready', durationMs: 12_345 });
      const [received] = await page(b, conversationId);
      const url = new URL(received?.media?.url ?? '');
      const audio = await http()
        .get(url.pathname + url.search)
        .expect(200);
      expect(audio.headers['content-type']).toBe('audio/mp4');
    });

    it('refuse long, oversized or disguised files', async () => {
      const { a, conversationId } = await connected();
      await sendVoice(a, conversationId, m4a(61_000)).expect(400);
      await sendVoice(
        a,
        conversationId,
        Buffer.concat([m4a(5000), Buffer.alloc(2_200_000)]),
      ).expect(400);
      await sendVoice(a, conversationId, await makeImage((seed += 1))).expect(415);
    });

    it('disappear for the person who reports them, and the report is filed', async () => {
      const { a, b, conversationId } = await connected();
      const sent = await sendVoice(a, conversationId, m4a(3000)).expect(201);
      const url = new URL(
        (await page(b, conversationId)).find((m) => m.id === sent.body.id)?.media?.url ?? '',
      );
      // Only the recipient can report a message, and only one from the reported person.
      await http()
        .post('/v1/reports')
        .set(a.auth)
        .send({ reportedUserId: b.id, reason: 'HARASSMENT', messageId: sent.body.id })
        .expect(404);
      await http()
        .post('/v1/reports')
        .set(b.auth)
        .send({ reportedUserId: a.id, reason: 'HARASSMENT', messageId: sent.body.id })
        .expect(202);
      const reported = (await page(b, conversationId)).find((m) => m.id === sent.body.id);
      expect(reported).toMatchObject({ removed: true, media: null });
      await http()
        .get(url.pathname + url.search)
        .expect(404);
      expect(
        await prisma.safetyReport.count({ where: { messageId: sent.body.id, reporterId: b.id } }),
      ).toBe(1);
    });
  });

  describe('Wingman', () => {
    it('needs consent, suggests without sending, and reads messages only when allowed', async () => {
      const { a, conversationId } = await connected();
      const ask = () =>
        http()
          .post(`/v1/conversations/${conversationId}/wingman`)
          .set(a.auth)
          .send({ purpose: 'opener' });
      await ask().expect(409);
      await http().put('/v1/me/consents/WINGMAN').set(a.auth).send({ granted: true }).expect(200);
      await http()
        .post(`/v1/conversations/${conversationId}/messages`)
        .set(a.auth)
        .send({ kind: 'text', clientId: randomUUID(), body: 'private words' })
        .expect(201);

      const before = (await page(a, conversationId)).length;
      const first = await ask().expect(201);
      expect(first.body.suggestions.length).toBeGreaterThan(0);
      expect(first.body.usedMessages).toBe(false);
      expect(ai.lastWingmanContext?.messages).toBeNull();
      expect((await page(a, conversationId)).length).toBe(before); // nothing was sent

      // Switching it on for the conversation is not enough without the consent, and vice versa.
      await http()
        .patch(`/v1/conversations/${conversationId}/settings`)
        .set(a.auth)
        .send({ wingmanContextEnabled: true });
      expect((await ask().expect(201)).body.usedMessages).toBe(false);
      await http()
        .put('/v1/me/consents/WINGMAN_MESSAGE_CONTEXT')
        .set(a.auth)
        .send({ granted: true });
      expect((await ask().expect(201)).body.usedMessages).toBe(true);
      expect(ai.lastWingmanContext?.messages?.map((m) => m.text)).toContain('private words');

      const audit = await prisma.$queryRaw<{ n: bigint }[]>`
        select count(*) as n from audit_logs where metadata::text like '%private words%'`;
      expect(Number(audit[0]?.n)).toBe(0);
    });

    it('drops unsafe or malformed suggestions from the model', async () => {
      const { a, conversationId } = await connected();
      await http().put('/v1/me/consents/WINGMAN').set(a.auth).send({ granted: true });
      vi.spyOn(ai, 'suggestMessages').mockResolvedValue({
        suggestions: [
          'Message me on whatsapp +91 98765 43210',
          'Check out https://example.com',
          42,
          'x'.repeat(400),
          'Want to grab a filter coffee this weekend?',
          'want to grab a filter coffee this weekend?',
        ],
      });
      const response = await http()
        .post(`/v1/conversations/${conversationId}/wingman`)
        .set(a.auth)
        .send({ purpose: 'date_idea' })
        .expect(201);
      expect(response.body.suggestions).toEqual(['Want to grab a filter coffee this weekend?']);
    });
  });
});
