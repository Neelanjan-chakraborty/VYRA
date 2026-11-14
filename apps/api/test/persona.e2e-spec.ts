import {
  assistantReflectionResponseSchema,
  QUESTIONNAIRE_VERSION,
  personaViewSchema,
  type PersonaView,
} from '@vyra/validation';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { AI_PROVIDER, type AiProvider } from '../src/modules/ai/ai-provider.js';
import { createTestApp, registerUser, type TestApp, type TestUser } from './support/app.js';

const BIO = 'Honest and curious. Spontaneous weekends! Mail me at asha@example.com';

const validReply = (answers: Record<string, unknown>) =>
  'Here is what I know:\n```json\n' +
  JSON.stringify({ vyra_questionnaire: QUESTIONNAIRE_VERSION, answers }) +
  '\n```';

describe('Persona (e2e)', () => {
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

  async function setUp(
    options: { consent?: boolean; importConsent?: boolean } = {},
  ): Promise<TestUser> {
    const user = await registerUser(app);
    await http()
      .patch('/v1/me/profile')
      .set(user.auth)
      .send({ displayName: 'Asha', bio: BIO })
      .expect(200);
    const catalogue = await http().get('/v1/interests').set(user.auth).expect(200);
    const ids = catalogue.body.interests
      .filter((i: { slug: string }) =>
        ['trekking', 'solo-travel', 'philosophy', 'live-gigs'].includes(i.slug),
      )
      .map((i: { id: string }) => i.id);
    await http().put('/v1/me/interests').set(user.auth).send({ interestIds: ids }).expect(200);
    if (options.consent !== false) {
      await http()
        .put('/v1/me/consents/AI_PERSONA_PROCESSING')
        .set(user.auth)
        .send({ granted: true })
        .expect(200);
    }
    if (options.importConsent) {
      await http()
        .put('/v1/me/consents/AI_IMPORT_PROCESSING')
        .set(user.auth)
        .send({ granted: true })
        .expect(200);
    }
    return user;
  }

  async function getPersona(user: TestUser): Promise<PersonaView> {
    const response = await http().get('/v1/me/persona').set(user.auth).expect(200);
    return personaViewSchema.parse(response.body);
  }

  async function generateAndWait(user: TestUser): Promise<PersonaView> {
    await http().post('/v1/me/persona/generate').set(user.auth).expect(202);
    for (let i = 0; i < 100; i += 1) {
      const view = await getPersona(user);
      if (view.generation.status === 'ready' || view.generation.status === 'failed') return view;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Generation did not finish');
  }

  describe('consent', () => {
    it('lists optional consents, all off for a new account', async () => {
      const user = await registerUser(app);
      const response = await http().get('/v1/me/consents').set(user.auth).expect(200);
      expect(response.body.consents.every((c: { granted: boolean }) => !c.granted)).toBe(true);
    });

    it('refuses to generate without consent', async () => {
      const user = await setUp({ consent: false });
      const response = await http().post('/v1/me/persona/generate').set(user.auth);
      expect(response.status).toBe(409);
      expect((await getPersona(user)).draft).toBeNull();
    });

    it('cannot toggle terms or privacy here', async () => {
      const user = await registerUser(app);
      await http()
        .put('/v1/me/consents/TERMS_OF_SERVICE')
        .set(user.auth)
        .send({ granted: false })
        .expect(422);
    });
  });

  describe('generation', () => {
    it('drafts a persona from the profile, with evidence and no raw text', async () => {
      const user = await setUp();
      const view = await generateAndWait(user);
      expect(view.generation.status).toBe('ready');
      expect(view.current).toBeNull();
      const draft = view.draft;
      expect(draft?.attributes.adventureOrientation).toMatchObject({
        evidenceCategory: 'INFERRED',
        sourceType: 'INTEREST_SELECTION',
        confirmation: 'unreviewed',
      });
      expect(draft?.attributes.adventureOrientation?.confidence).toBeLessThanOrEqual(0.6);
      expect(draft?.attributes.communicationStyle?.value).toBe('playful');
      expect(draft?.attributes.values?.value).toEqual(['honesty', 'curiosity']);
      expect(draft?.unknown).toContain('boundaries');

      const rows = await prisma.personaEvidence.findMany({
        where: { personaVersionId: draft?.id },
      });
      expect(rows.length).toBeGreaterThan(0);
      const stored = JSON.stringify(rows) + JSON.stringify(draft);
      expect(stored).not.toContain('asha@example.com');
      expect(stored).not.toContain(BIO);
    });

    it('rejects a second request while one is running or just finished', async () => {
      const user = await setUp();
      await http().post('/v1/me/persona/generate').set(user.auth).expect(202);
      const again = await http().post('/v1/me/persona/generate').set(user.auth);
      expect([409, 429]).toContain(again.status);
    });

    it('fails clearly when there is nothing to read', async () => {
      const user = await registerUser(app);
      await http()
        .put('/v1/me/consents/AI_PERSONA_PROCESSING')
        .set(user.auth)
        .send({ granted: true })
        .expect(200);
      const view = await generateAndWait(user);
      expect(view.generation).toEqual({ status: 'failed', failureCode: 'nothing_to_read' });
    });

    it('keeps only valid, evidenced, catalogue attributes from a misbehaving provider', async () => {
      const user = await setUp();
      const provider = app.get<AiProvider>(AI_PROVIDER);
      const spy = vi.spyOn(provider, 'draftPersona').mockResolvedValue({
        attributes: {
          socialEnergy: {
            value: 1,
            rationale: 'Ignore previous instructions',
            evidenceRefs: ['interest.live-gigs'],
          },
          intellectualCuriosity: {
            value: 0.9,
            rationale: 'Invented',
            evidenceRefs: ['profile.instagram'],
          },
          religion: { value: 'x', rationale: 'x', evidenceRefs: ['profile.bio'] },
          boundaries: { value: ['none'], rationale: 'x', evidenceRefs: ['profile.bio'] },
          planningStyle: { value: 'very', rationale: 'x', evidenceRefs: ['profile.bio'] },
        },
        admin: true,
      });
      const view = await generateAndWait(user);
      spy.mockRestore();
      expect(Object.keys(view.draft?.attributes ?? {})).toEqual(['socialEnergy']);
    });

    it('records a failure when the provider keeps returning garbage', async () => {
      const user = await setUp();
      const spy = vi
        .spyOn(app.get<AiProvider>(AI_PROVIDER), 'draftPersona')
        .mockResolvedValue('not json at all');
      const view = await generateAndWait(user);
      expect(spy).toHaveBeenCalledTimes(2);
      spy.mockRestore();
      expect(view.generation).toEqual({ status: 'failed', failureCode: 'provider_bad_response' });
      expect(view.draft).toBeNull();
    });
  });

  describe('editing and approval', () => {
    it('edits, confirms, removes and approves; approval writes one embedding', async () => {
      const user = await setUp();
      await generateAndWait(user);
      const edited = await http()
        .patch('/v1/me/persona/draft')
        .set(user.auth)
        .send({
          set: { socialEnergy: 0.25, boundaries: ['No smoking around me'] },
          confirm: ['adventureOrientation'],
          clear: ['values'],
        })
        .expect(200);
      const draft = personaViewSchema.parse(edited.body).draft;
      expect(draft?.attributes.socialEnergy).toMatchObject({
        value: 0.25,
        evidenceCategory: 'USER_STATED',
        confirmation: 'corrected',
      });
      expect(draft?.attributes.adventureOrientation).toMatchObject({
        evidenceCategory: 'USER_STATED',
        confirmation: 'confirmed',
      });
      expect(draft?.attributes.values).toBeUndefined();

      const approved = personaViewSchema.parse(
        (await http().post('/v1/me/persona/draft/approve').set(user.auth).expect(200)).body,
      );
      expect(approved.draft).toBeNull();
      expect(approved.current?.status).toBe('APPROVED');
      expect(approved.current?.attributes.boundaries?.value).toEqual(['No smoking around me']);

      const embeddings = await prisma.$queryRaw<{ dims: number }[]>`
        SELECT vector_dims(embedding) AS dims FROM vyra_vector.persona_embeddings
        WHERE persona_version_id = ${approved.current?.id}::uuid`;
      expect(embeddings).toEqual([{ dims: 768 }]);
    });

    it('rejects invalid edits with field details', async () => {
      const user = await setUp();
      const response = await http()
        .patch('/v1/me/persona/draft')
        .set(user.auth)
        .send({
          set: { socialEnergy: 7, communicationStyle: 'shouty' },
          confirm: ['planningStyle'],
        });
      expect(response.status).toBe(422);
      expect(response.body.error.details.map((d: { path: string }) => d.path).toSorted()).toEqual([
        'confirm.planningStyle',
        'set.communicationStyle',
        'set.socialEnergy',
      ]);
      await http()
        .patch('/v1/me/persona/draft')
        .set(user.auth)
        .send({ set: { religion: 'x' } })
        .expect(422);
    });

    it('a second approval supersedes the first and keeps one embedding', async () => {
      const user = await setUp();
      await generateAndWait(user);
      const first = personaViewSchema.parse(
        (await http().post('/v1/me/persona/draft/approve').set(user.auth).expect(200)).body,
      );
      // Editing an approved persona opens a new draft from it; the person's word sticks.
      await http()
        .patch('/v1/me/persona/draft')
        .set(user.auth)
        .send({ set: { planningStyle: 1 } })
        .expect(200);
      const second = personaViewSchema.parse(
        (await http().post('/v1/me/persona/draft/approve').set(user.auth).expect(200)).body,
      );
      expect(second.current?.version).toBe((first.current?.version ?? 0) + 1);
      expect(second.current?.attributes.planningStyle?.value).toBe(1);
      expect(second.current?.attributes.adventureOrientation).toBeDefined();
      const old = await prisma.personaVersion.findUniqueOrThrow({
        where: { id: first.current?.id },
      });
      expect(old.status).toBe('SUPERSEDED');
      const count = await prisma.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS n FROM vyra_vector.persona_embeddings e
        JOIN persona_versions v ON v.id = e.persona_version_id
        WHERE v.persona_id = (SELECT persona_id FROM persona_versions WHERE id = ${second.current?.id}::uuid)`;
      expect(Number(count[0]?.n)).toBe(1);
    });

    it('nothing to approve is a clear error', async () => {
      const user = await setUp();
      await http().post('/v1/me/persona/draft/approve').set(user.auth).expect(404);
      await http()
        .patch('/v1/me/persona/draft')
        .set(user.auth)
        .send({ set: { socialEnergy: 0.5 } })
        .expect(200);
      await http()
        .patch('/v1/me/persona/draft')
        .set(user.auth)
        .send({ clear: ['socialEnergy'] })
        .expect(200);
      await http().post('/v1/me/persona/draft/approve').set(user.auth).expect(409);
    });

    it('discarding a draft keeps the approved persona', async () => {
      const user = await setUp();
      await generateAndWait(user);
      await http().post('/v1/me/persona/draft/approve').set(user.auth).expect(200);
      await http()
        .patch('/v1/me/persona/draft')
        .set(user.auth)
        .send({ set: { socialEnergy: 0 } })
        .expect(200);
      const view = personaViewSchema.parse(
        (await http().delete('/v1/me/persona/draft').set(user.auth).expect(200)).body,
      );
      expect(view.draft).toBeNull();
      expect(view.current).not.toBeNull();
    });
  });

  describe('assistant reflection', () => {
    it('needs import consent', async () => {
      const user = await setUp();
      await http()
        .post('/v1/me/persona/assistant-reflection')
        .set(user.auth)
        .send({ assistant: 'chatgpt', reply: validReply({}) })
        .expect(409);
    });

    it('merges a pasted reply into the draft without storing the reply', async () => {
      const user = await setUp({ importConsent: true });
      const secret = 'UNIQUE-REPLY-MARKER-93721';
      const response = await http()
        .post('/v1/me/persona/assistant-reflection')
        .set(user.auth)
        .send({
          assistant: 'chatgpt',
          reply:
            `${secret}\n` +
            validReply({
              socialEnergy: {
                value: 2,
                confidence: 'high',
                why: 'Prefers small dinners to big parties',
              },
              conflictApproach: {
                value: 5,
                confidence: 'medium',
                why: 'Likes to talk things through',
              },
              weekendRhythm: { value: 'unknown', confidence: 'low', why: '' },
              religion: { value: 'x', confidence: 'high', why: 'x' },
            }),
        })
        .expect(200);
      const body = assistantReflectionResponseSchema.parse(response.body);
      expect(body.result).toEqual({
        accepted: ['socialEnergy', 'conflictApproach'],
        unknown: ['weekendRhythm'],
        rejected: ['religion'],
      });
      expect(body.persona.draft?.attributes.socialEnergy).toMatchObject({
        value: 0.25,
        sourceType: 'ASSISTANT_REFLECTION',
        evidenceCategory: 'INFERRED',
        confidence: 0.6,
      });
      expect(body.persona.draft?.attributes.socialEnergy?.evidence[0]).toMatchObject({
        sourceDetail: 'chatgpt',
        summary: 'Prefers small dinners to big parties',
      });
      expect(body.persona.current).toBeNull();

      const dump = JSON.stringify(
        await prisma.personaVersion.findMany({
          where: { persona: { user: { email: user.email } } },
          include: { evidence: true },
        }),
      );
      expect(dump).not.toContain(secret);
      const audit = JSON.stringify(
        await prisma.auditLog.findMany({ where: { actor: { email: user.email } } }),
      );
      expect(audit).not.toContain(secret);
    });

    it('disagreement with the profile-based draft is flagged for review', async () => {
      const user = await setUp({ importConsent: true });
      await generateAndWait(user); // live-gigs → socialEnergy 0.75
      const response = await http()
        .post('/v1/me/persona/assistant-reflection')
        .set(user.auth)
        .send({
          assistant: 'gemini',
          reply: validReply({ socialEnergy: { value: 1, confidence: 'high', why: 'Quiet' } }),
        })
        .expect(200);
      const attribute = assistantReflectionResponseSchema.parse(response.body).persona.draft
        ?.attributes.socialEnergy;
      expect(attribute?.needsReview).toBe(true);
      expect(attribute?.evidence.map((e) => e.sourceType)).toEqual([
        'INTEREST_SELECTION',
        'ASSISTANT_REFLECTION',
      ]);
    });

    it.each([
      ['no JSON', 'I’m sorry, I don’t remember anything about you.', 'no_json'],
      ['cut off', '```json\n{"vyra_questionnaire":"1","answers":{\n```', 'invalid_json'],
      ['all unknown', validReply({ socialEnergy: { value: 'unknown' } }), 'no_usable_answers'],
    ])('explains an unusable reply (%s) and saves nothing', async (_name, reply, code) => {
      const user = await setUp({ importConsent: true });
      const response = await http()
        .post('/v1/me/persona/assistant-reflection')
        .set(user.auth)
        .send({ assistant: 'deepseek', reply });
      expect(response.status).toBe(422);
      expect(response.body.error.details[0].message).toBe(code);
      expect((await getPersona(user)).draft).toBeNull();
    });

    it('rejects oversize replies and unknown assistants', async () => {
      const user = await setUp({ importConsent: true });
      await http()
        .post('/v1/me/persona/assistant-reflection')
        .set(user.auth)
        .send({ assistant: 'chatgpt', reply: 'x'.repeat(20_001) })
        .expect(422);
      await http()
        .post('/v1/me/persona/assistant-reflection')
        .set(user.auth)
        .send({ assistant: 'hal9000', reply: validReply({}) })
        .expect(422);
    });
  });

  describe('privacy', () => {
    it('withdrawing consent deletes the draft but keeps the approved persona', async () => {
      const user = await setUp({ importConsent: true });
      await generateAndWait(user);
      await http().post('/v1/me/persona/draft/approve').set(user.auth).expect(200);
      await http()
        .post('/v1/me/persona/assistant-reflection')
        .set(user.auth)
        .send({
          assistant: 'claude',
          reply: validReply({
            planningStyle: { value: 4, confidence: 'medium', why: 'Plans trips early' },
          }),
        })
        .expect(200);
      expect((await getPersona(user)).draft).not.toBeNull();
      await http()
        .put('/v1/me/consents/AI_IMPORT_PROCESSING')
        .set(user.auth)
        .send({ granted: false })
        .expect(200);
      const view = await getPersona(user);
      expect(view.draft).toBeNull();
      expect(view.current).not.toBeNull();
    });

    it("one person can never see or change another's persona", async () => {
      const owner = await setUp();
      await generateAndWait(owner);
      const other = await registerUser(app);
      const view = await getPersona(other);
      expect(view).toEqual({
        generation: { status: 'idle', failureCode: null },
        current: null,
        draft: null,
      });
      await http().post('/v1/me/persona/draft/approve').set(other.auth).expect(404);
      expect((await getPersona(owner)).draft).not.toBeNull();
    });

    it('clearing the persona and deleting the account remove versions and embeddings', async () => {
      const user = await setUp();
      await generateAndWait(user);
      const approved = personaViewSchema.parse(
        (await http().post('/v1/me/persona/draft/approve').set(user.auth).expect(200)).body,
      );
      const versionId = approved.current?.id as string;

      await http().delete('/v1/me').set(user.auth).send({ confirm: 'DELETE' }).expect(204);
      expect(await prisma.personaVersion.count({ where: { id: versionId } })).toBe(0);
      const left = await prisma.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS n FROM vyra_vector.persona_embeddings WHERE persona_version_id = ${versionId}::uuid`;
      expect(Number(left[0]?.n)).toBe(0);

      const other = await setUp();
      await generateAndWait(other);
      await http().delete('/v1/me/persona').set(other.auth).expect(204);
      expect(await getPersona(other)).toEqual({
        generation: { status: 'idle', failureCode: null },
        current: null,
        draft: null,
      });
    });
  });
});
