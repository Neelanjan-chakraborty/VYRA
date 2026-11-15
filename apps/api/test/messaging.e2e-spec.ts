import { randomUUID } from 'node:crypto';
import {
  connectionsSchema,
  conversationListSchema,
  messagePageSchema,
  messageSchema,
  SOCKET_EVENTS,
} from '@vyra/validation';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { LogPushProvider, PUSH_PROVIDER } from '../src/modules/messaging/push-provider.js';
import { SOCKET_PATH } from '../src/modules/messaging/redis-io.adapter.js';
import { createTestApp, type TestApp, type TestUser } from './support/app.js';
import { createPerson } from './support/people.js';

type Person = TestUser & { id: string; photoId: string };

function connectSocket(url: string, sockets: Socket[], user?: TestUser): Promise<Socket> {
  return new Promise<Socket>((resolve, reject) => {
    const socket = io(url, {
      path: SOCKET_PATH,
      transports: ['websocket'],
      auth: user ? { token: user.tokens.accessToken } : {},
      reconnection: false,
    });
    sockets.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

/** The next payload of an event, or null if none arrives in time. */
function next(socket: Socket, event: string, ms = 2000): Promise<unknown> {
  return new Promise<unknown>((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    socket.once(event, (payload: unknown) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe('Messaging (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  let push: LogPushProvider;
  let url: string;
  const sockets: Socket[] = [];
  const http = () => request(app.getHttpServer());
  const person = () => createPerson(app) as Promise<Person>;

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen(0);
    url = (await app.getUrl()).replace('[::1]', 'localhost');
    prisma = app.get(PrismaService);
    push = app.get(PUSH_PROVIDER);
  });
  afterEach(() => {
    for (const socket of sockets.splice(0)) socket.disconnect();
  });
  afterAll(async () => {
    await app.close();
  });

  /** Two people who asked and accepted; returns their conversation id. */
  async function connected(): Promise<{ a: Person; b: Person; conversationId: string }> {
    const [a, b] = [await person(), await person()];
    const asked = await http()
      .post('/v1/connections/requests')
      .set(a.auth)
      .send({ recipientId: b.id })
      .expect(201);
    await http()
      .post(`/v1/connections/requests/${asked.body.requestId}/accept`)
      .set(b.auth)
      .expect(200);
    const list = connectionsSchema.parse(
      (await http().get('/v1/connections').set(a.auth).expect(200)).body,
    );
    const conversationId = list.mutual[0]?.conversationId;
    if (!conversationId) throw new Error('no conversation');
    return { a, b, conversationId };
  }

  const send = (user: TestUser, conversationId: string, body: string, clientId = randomUUID()) =>
    http()
      .post(`/v1/conversations/${conversationId}/messages`)
      .set(user.auth)
      .send({ kind: 'text', clientId, body });
  const page = async (user: TestUser, conversationId: string, query = '') =>
    messagePageSchema.parse(
      (
        await http()
          .get(`/v1/conversations/${conversationId}/messages${query}`)
          .set(user.auth)
          .expect(200)
      ).body,
    );
  const list = async (user: TestUser) =>
    conversationListSchema.parse(
      (await http().get('/v1/conversations').set(user.auth).expect(200)).body,
    ).conversations;

  describe('conversations', () => {
    it('opens with the connection, for both people only', async () => {
      const { a, b, conversationId } = await connected();
      const outsider = await person();
      for (const user of [a, b]) {
        const [conversation] = await list(user);
        expect(conversation?.id).toBe(conversationId);
        expect(conversation?.readOnly).toBe(false);
        const { messages } = await page(user, conversationId);
        expect(messages.map((m) => m.event)).toEqual(['connected']);
      }
      expect(await list(outsider)).toEqual([]);
      await http()
        .get(`/v1/conversations/${conversationId}/messages`)
        .set(outsider.auth)
        .expect(404);
      await send(outsider, conversationId, 'hi').expect(404);
      await http().get(`/v1/conversations/${conversationId}`).set(outsider.auth).expect(404);
    });

    it('opens at once when both asked each other', async () => {
      const [a, b] = [await person(), await person()];
      await http().post('/v1/connections/requests').set(a.auth).send({ recipientId: b.id });
      const second = await http()
        .post('/v1/connections/requests')
        .set(b.auth)
        .send({ recipientId: a.id })
        .expect(201);
      expect(second.body.outcome).toBe('matched');
      const relationship = await http().get(`/v1/people/${a.id}/relationship`).set(b.auth);
      expect(relationship.body.conversationId).toEqual(expect.any(String));
      expect((await list(a))[0]?.id).toBe(relationship.body.conversationId);
    });
  });

  describe('sending', () => {
    it('stores plain text, is idempotent per clientId, and pages newest first', async () => {
      const { a, b, conversationId } = await connected();
      const clientId = randomUUID();
      const first = await send(a, conversationId, '  hello\u0007 there  ', clientId).expect(201);
      expect(messageSchema.parse(first.body)).toMatchObject({ body: 'hello there', mine: true });
      const again = await send(a, conversationId, 'hello there', clientId).expect(201);
      expect(again.body.id).toBe(first.body.id);
      await send(a, conversationId, 'x'.repeat(2001)).expect(422);
      await send(a, conversationId, '   ').expect(422);

      for (let i = 0; i < 44; i += 1) await send(b, conversationId, `m${i}`).expect(201);
      const newest = await page(a, conversationId, '?limit=40');
      expect(newest.messages).toHaveLength(40);
      expect(newest.messages[0]?.body).toBe('m43');
      expect(newest.messages[0]?.mine).toBe(false);
      const older = await page(a, conversationId, `?before=${newest.nextBefore}`);
      expect(older.messages.map((m) => m.body ?? m.event)).toEqual([
        'm3',
        'm2',
        'm1',
        'm0',
        'hello there',
        'connected',
      ]);
      expect(older.nextBefore).toBeNull();
    });

    it('shows an unread dot and read ticks, and read receipts are reciprocal', async () => {
      const { a, b, conversationId } = await connected();
      const sent = await send(b, conversationId, 'are you free?').expect(201);
      expect((await list(a))[0]?.unread).toBe(true);
      expect((await list(b))[0]?.unread).toBe(false);
      expect((await page(b, conversationId)).messages[0]?.read).toBe(false);

      await http()
        .post(`/v1/conversations/${conversationId}/read`)
        .set(a.auth)
        .send({ upTo: sent.body.id })
        .expect(204);
      expect((await list(a))[0]?.unread).toBe(false);
      expect((await page(b, conversationId)).messages[0]?.read).toBe(true);

      // a stops sharing receipts: b no longer sees ticks, and a no longer sees b's.
      await http()
        .patch(`/v1/conversations/${conversationId}/settings`)
        .set(a.auth)
        .send({ sendsReadReceipts: false })
        .expect(200);
      expect((await page(b, conversationId)).messages[0]?.read).toBe(false);
      const reply = await send(a, conversationId, 'yes').expect(201);
      await http()
        .post(`/v1/conversations/${conversationId}/read`)
        .set(b.auth)
        .send({ upTo: reply.body.id })
        .expect(204);
      expect((await page(a, conversationId)).messages[0]?.read).toBe(false);
    });

    it('lets only the sender remove a message, and erases its text', async () => {
      const { a, b, conversationId } = await connected();
      const sent = await send(a, conversationId, 'oops, wrong chat').expect(201);
      await http().delete(`/v1/messages/${sent.body.id}`).set(b.auth).expect(404);
      await http().delete(`/v1/messages/${sent.body.id}`).set(a.auth).expect(204);
      const [latest] = (await page(b, conversationId)).messages;
      expect(latest).toMatchObject({ removed: true, body: null });
      expect((await list(b))[0]?.lastMessage?.preview).toBe('Message removed');
      const stored = await prisma.message.findUniqueOrThrow({ where: { id: sent.body.id } });
      expect(stored.body).toBeNull();
    });

    it('never writes message text to the audit log', async () => {
      const { a, conversationId } = await connected();
      const secret = `secret-${randomUUID()}`;
      await send(a, conversationId, secret).expect(201);
      const rows = await prisma.$queryRaw<{ n: bigint }[]>`
        select count(*) as n from audit_logs where metadata::text like ${`%${secret}%`}`;
      expect(Number(rows[0]?.n)).toBe(0);
    });
  });

  describe('when a connection ends or someone blocks', () => {
    it('keeps history read-only after the connection ends', async () => {
      const { a, b, conversationId } = await connected();
      await send(a, conversationId, 'see you').expect(201);
      const matchId = connectionsSchema.parse(
        (await http().get('/v1/connections').set(a.auth)).body,
      ).mutual[0]?.id;
      await http().delete(`/v1/connections/matches/${matchId}`).set(b.auth).expect(204);
      expect((await list(a))[0]?.readOnly).toBe(true);
      expect((await page(a, conversationId)).messages[0]?.body).toBe('see you');
      await send(a, conversationId, 'wait').expect(409);
    });

    it('hides the conversation from both people across a block', async () => {
      const { a, b, conversationId } = await connected();
      await send(a, conversationId, 'hello').expect(201);
      await http().post(`/v1/blocks/${a.id}`).set(b.auth).expect(204);
      for (const user of [a, b]) {
        expect(await list(user)).toEqual([]);
        await http().get(`/v1/conversations/${conversationId}/messages`).set(user.auth).expect(404);
        await send(user, conversationId, 'still there?').expect(404);
      }
      await http().delete(`/v1/blocks/${a.id}`).set(b.auth).expect(204);
      expect((await list(a))[0]?.readOnly).toBe(true);
    });
  });

  describe('date ideas', () => {
    it('is answered only by the other person, once; only the proposer withdraws', async () => {
      const { a, b, conversationId } = await connected();
      const plan = await http()
        .post(`/v1/conversations/${conversationId}/messages`)
        .set(a.auth)
        .send({
          kind: 'date_plan',
          clientId: randomUUID(),
          plan: { idea: 'Filter coffee and a walk', when: 'Saturday morning', area: 'Indiranagar' },
        })
        .expect(201);
      expect(plan.body.plan).toMatchObject({ status: 'proposed', area: 'Indiranagar' });
      await http().post(`/v1/messages/${plan.body.id}/plan/accept`).set(a.auth).expect(404);
      await http().post(`/v1/messages/${plan.body.id}/plan/withdraw`).set(b.auth).expect(404);
      const accepted = await http()
        .post(`/v1/messages/${plan.body.id}/plan/accept`)
        .set(b.auth)
        .expect(201);
      expect(accepted.body.plan.status).toBe('accepted');
      await http().post(`/v1/messages/${plan.body.id}/plan/decline`).set(b.auth).expect(409);
      expect((await list(b))[0]?.lastMessage?.preview).toBe('Date idea');

      const second = await http()
        .post(`/v1/conversations/${conversationId}/messages`)
        .set(a.auth)
        .send({ kind: 'date_plan', clientId: randomUUID(), plan: { idea: 'Board games' } })
        .expect(201);
      const withdrawn = await http()
        .post(`/v1/messages/${second.body.id}/plan/withdraw`)
        .set(a.auth)
        .expect(201);
      expect(withdrawn.body.plan.status).toBe('withdrawn');
    });
  });

  describe('push notifications', () => {
    it('say who, never what, and respect mute and preferences', async () => {
      const { a, b, conversationId } = await connected();
      const token = `ExponentPushToken[${randomUUID()}]`;
      await http()
        .put('/v1/me/push-devices')
        .set(b.auth)
        .send({ token, platform: 'android' })
        .expect(204);
      const sentTo = () => push.sent.filter((m) => m.token === token);

      await send(a, conversationId, 'the secret plan').expect(201);
      expect(sentTo()).toHaveLength(1);
      expect(sentTo()[0]?.body).toBe('New message from Synthetic');
      expect(JSON.stringify(sentTo()[0])).not.toContain('secret plan');

      await http()
        .patch(`/v1/conversations/${conversationId}/settings`)
        .set(b.auth)
        .send({ muted: true })
        .expect(200);
      await send(a, conversationId, 'muted?').expect(201);
      expect(sentTo()).toHaveLength(1);

      await http()
        .patch(`/v1/conversations/${conversationId}/settings`)
        .set(b.auth)
        .send({ muted: false });
      await http().patch('/v1/me/profile').set(b.auth).send({ notifyMessages: false }).expect(200);
      await send(a, conversationId, 'off?').expect(201);
      expect(sentTo()).toHaveLength(1);

      await http().delete('/v1/me/push-devices').set(b.auth).send({ token }).expect(204);
      expect(await prisma.pushDevice.count({ where: { token } })).toBe(0);
    });

    it('tells someone they were asked to connect', async () => {
      const [a, b] = [await person(), await person()];
      const token = `ExponentPushToken[${randomUUID()}]`;
      await http().put('/v1/me/push-devices').set(b.auth).send({ token, platform: 'ios' });
      await http()
        .post('/v1/connections/requests')
        .set(a.auth)
        .send({ recipientId: b.id, note: 'hi' });
      const sent = push.sent.filter((m) => m.token === token);
      expect(sent.map((m) => m.body)).toEqual(['Synthetic asked to connect']);
      expect(JSON.stringify(sent)).not.toContain('"hi"');
    });
  });

  describe('realtime', () => {
    it('refuses connections without a valid token', async () => {
      await expect(connectSocket(url, sockets)).rejects.toThrow('unauthorized');
    });

    it('tells only the other participant, with ids and never text', async () => {
      const { a, b, conversationId } = await connected();
      const outsider = await person();
      const [socketB, socketOutsider] = [
        await connectSocket(url, sockets, b),
        await connectSocket(url, sockets, outsider),
      ];
      const forB = next(socketB, SOCKET_EVENTS.conversationChanged);
      const forOutsider = next(socketOutsider, SOCKET_EVENTS.conversationChanged, 800);
      await send(a, conversationId, 'live hello').expect(201);
      expect(await forB).toEqual({ conversationId, reason: 'message' });
      expect(await forOutsider).toBeNull();
    });

    it('does not push to someone who has the app open', async () => {
      const { a, b, conversationId } = await connected();
      const token = `ExponentPushToken[${randomUUID()}]`;
      await http().put('/v1/me/push-devices').set(b.auth).send({ token, platform: 'android' });
      await connectSocket(url, sockets, b);
      await send(a, conversationId, 'are you there').expect(201);
      expect(push.sent.filter((m) => m.token === token)).toHaveLength(0);
    });

    it('relays typing only when shared, and never across a block', async () => {
      const { a, b, conversationId } = await connected();
      const [socketA, socketB] = [
        await connectSocket(url, sockets, a),
        await connectSocket(url, sockets, b),
      ];
      let typing = next(socketB, SOCKET_EVENTS.typing);
      socketA.emit(SOCKET_EVENTS.typing, { conversationId });
      expect(await typing).toEqual({ conversationId });

      await http()
        .patch(`/v1/conversations/${conversationId}/settings`)
        .set(a.auth)
        .send({ sharesTyping: false })
        .expect(200);
      await new Promise((r) => setTimeout(r, 2100)); // past the typing rate limit
      typing = next(socketB, SOCKET_EVENTS.typing, 800);
      socketA.emit(SOCKET_EVENTS.typing, { conversationId });
      expect(await typing).toBeNull();

      await http()
        .patch(`/v1/conversations/${conversationId}/settings`)
        .set(a.auth)
        .send({ sharesTyping: true });
      await http().post(`/v1/blocks/${a.id}`).set(b.auth).expect(204);
      await new Promise((r) => setTimeout(r, 2100));
      typing = next(socketB, SOCKET_EVENTS.typing, 800);
      socketA.emit(SOCKET_EVENTS.typing, { conversationId });
      expect(await typing).toBeNull();
    });
  });
});
