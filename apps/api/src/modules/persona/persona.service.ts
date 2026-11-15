import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  assistantInfo,
  attributeValueSchema,
  type AssistantId,
  type AssistantReflectionResponse,
  type GenerationStatus,
  PERSONA_ATTRIBUTE_KEYS,
  PERSONA_SCHEMA_VERSION,
  type PersonaAttributeKey,
  type PersonaAttributeValue,
  type PersonaEdit,
  type PersonaEvidenceView,
  personaRecordsSchema,
  type PersonaVersionView,
  type PersonaView,
} from '@vyra/validation';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service.js';
import type { Persona, PersonaEvidence, PersonaVersion } from '../../generated/prisma/client.js';
import { PERSONA_QUEUE } from '../../queue/queue.module.js';
import { AI_PROVIDER, type AiProvider } from '../ai/ai-provider.js';
import { AiProviderError } from '../ai/gemini-ai-provider.js';
import { AuditService } from '../audit/audit.service.js';
import { ConsentsService } from '../consents/consents.service.js';
import { type AttributeState, combine, confirmState, stateFromPerson } from './calibration.js';
import { candidatesFromModel, candidatesFromReflection } from './candidates.js';
import { parseAssistantReply, type ReflectionParseError } from './questionnaire.parser.js';
import { SourceBundleService } from './source-bundle.js';

type State = Map<PersonaAttributeKey, AttributeState>;
type VersionWithEvidence = PersonaVersion & { evidence: PersonaEvidence[] };

/** A generation stuck longer than this (e.g. the worker died) may be requested again. */
const STALE_GENERATION_MS = 10 * 60_000;
/** Minimum gap between generation requests per person. */
const GENERATION_COOLDOWN_MS = 60_000;

const PARSE_MESSAGES: Record<ReflectionParseError, string> = {
  no_json:
    'We couldn’t find the answers in that text. Paste the assistant’s whole reply, including the code block with its answers.',
  cut_off:
    'The reply stops partway: its answers aren’t finished. Ask your assistant to send the answers again, then copy the whole reply.',
  invalid_json:
    'We found the answers but couldn’t read them as written. Ask your assistant to send just the code block again, then copy that.',
  wrong_shape:
    'That reply isn’t in the format the questionnaire asks for. Copy the prompt again and send it to your assistant.',
  wrong_version:
    'That reply is for an older questionnaire. Copy the prompt again and send it to your assistant.',
};

@Injectable()
export class PersonaService {
  private readonly logger = new Logger(PersonaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bundles: SourceBundleService,
    private readonly consents: ConsentsService,
    private readonly audit: AuditService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    @InjectQueue(PERSONA_QUEUE) private readonly queue: Queue,
  ) {}

  // ─────────────────────────── reading ───────────────────────────

  async view(userId: string): Promise<PersonaView> {
    const persona = await this.prisma.persona.findUnique({ where: { userId } });
    if (!persona)
      return { generation: { status: 'idle', failureCode: null }, current: null, draft: null };
    const versions = await this.prisma.personaVersion.findMany({
      where: {
        personaId: persona.id,
        OR: [{ status: 'DRAFT' }, { id: persona.currentVersionId ?? undefined }],
      },
      include: { evidence: { orderBy: { createdAt: 'asc' } } },
    });
    const current = versions.find((v) => v.id === persona.currentVersionId);
    const draft = versions.find((v) => v.status === 'DRAFT');
    return {
      generation: {
        status: persona.generationStatus as GenerationStatus,
        failureCode: persona.generationFailureCode,
      },
      current: current ? toView(current) : null,
      draft: draft ? toView(draft) : null,
    };
  }

  // ─────────────────────────── generation ───────────────────────────

  /** Queues a draft built from the person's own profile. Requires their consent. */
  async requestGeneration(userId: string, requestId: string): Promise<PersonaView> {
    if (!(await this.consents.hasConsent(userId, 'AI_PERSONA_PROCESSING'))) {
      throw new ConflictException('Turn on persona suggestions first.');
    }
    const persona = await this.ensurePersona(userId);
    const since = persona.generationRequestedAt
      ? Date.now() - persona.generationRequestedAt.getTime()
      : Infinity;
    const busy = persona.generationStatus === 'queued' || persona.generationStatus === 'generating';
    if (busy && since < STALE_GENERATION_MS)
      throw new ConflictException('Your persona is already being prepared.');
    if (since < GENERATION_COOLDOWN_MS) {
      throw new HttpException(
        'Please wait a minute before trying again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.prisma.persona.update({
      where: { id: persona.id },
      data: {
        generationStatus: 'queued',
        generationFailureCode: null,
        generationRequestedAt: new Date(),
      },
    });
    await this.queue.add(
      'generate',
      { userId },
      { removeOnComplete: true, removeOnFail: true, attempts: 1 },
    );
    await this.audit.record({ action: 'persona.generation_requested', actorId: userId, requestId });
    return this.view(userId);
  }

  /** Worker entry point. Never throws: every outcome is recorded on the persona row. */
  async generate(userId: string): Promise<void> {
    const persona = await this.prisma.persona.findUnique({
      where: { userId },
      include: { user: { select: { status: true } } },
    });
    if (!persona || persona.user.status === 'DELETED') return;
    // Consent can be withdrawn while the job waits in the queue.
    if (!(await this.consents.hasConsent(userId, 'AI_PERSONA_PROCESSING'))) {
      await this.setGeneration(persona.id, 'idle', null);
      return;
    }
    await this.setGeneration(persona.id, 'generating', null);

    const bundle = await this.bundles.build(userId);
    if (bundle.items.length === 0) {
      await this.setGeneration(persona.id, 'failed', 'nothing_to_read');
      return;
    }

    let parsed: ReturnType<typeof candidatesFromModel> = null;
    let failure = 'provider_bad_response';
    // One retry on an unusable answer; never "repair" model output.
    for (let attempt = 0; attempt < 2 && !parsed; attempt += 1) {
      try {
        parsed = candidatesFromModel(await this.ai.draftPersona(bundle), bundle);
      } catch (error) {
        failure = error instanceof AiProviderError ? error.code : 'provider_error';
        if (!(error instanceof AiProviderError))
          this.logger.error(
            'Persona provider failed',
            error instanceof Error ? error.stack : undefined,
          );
      }
    }
    if (!parsed) {
      await this.setGeneration(persona.id, 'failed', failure);
      return;
    }
    if (parsed.dropped.length > 0) {
      // Keys and reason codes only — never values or rationale text.
      this.logger.warn(
        `Dropped persona attributes: ${parsed.dropped.map((d) => `${d.key}:${d.reason}`).join(', ')}`,
      );
    }

    const base = await this.baseState(persona);
    const merged = combine(base.state, parsed.candidates, new Date());
    await this.writeDraft(persona, base.draft, merged, this.ai.id);
    await this.setGeneration(persona.id, 'ready', null);
    await this.audit.record({
      action: 'persona.draft_generated',
      actorId: userId,
      metadata: {
        provider: this.ai.id,
        attributes: parsed.candidates.length,
        dropped: parsed.dropped.length,
      },
    });
  }

  // ─────────────────────────── assistant reflection ───────────────────────────

  /** Reads a reply pasted back from the person's own assistant into the draft. */
  async importAssistantReflection(
    userId: string,
    assistant: AssistantId,
    reply: string,
    requestId: string,
  ): Promise<AssistantReflectionResponse> {
    if (!(await this.consents.hasConsent(userId, 'AI_IMPORT_PROCESSING'))) {
      throw new ConflictException('Allow VYRA to read your assistant’s answers first.');
    }
    const parsed = parseAssistantReply(reply);
    if ('error' in parsed) {
      throw new UnprocessableEntityException({
        message:
          parsed.near && parsed.error === 'invalid_json'
            ? `${PARSE_MESSAGES.invalid_json} It goes wrong near: ${parsed.near}`
            : PARSE_MESSAGES[parsed.error],
        details: [{ path: 'reply', message: parsed.error }],
      });
    }
    if (parsed.answers.size === 0) {
      throw new UnprocessableEntityException({
        message: 'Your assistant didn’t give any answers we could use. Nothing was saved.',
        details: [{ path: 'reply', message: 'no_usable_answers' }],
      });
    }
    const persona = await this.ensurePersona(userId);
    const base = await this.baseState(persona);
    const info = assistantInfo(assistant);
    const merged = combine(
      base.state,
      candidatesFromReflection(parsed.answers, assistant, info.name),
      new Date(),
    );
    await this.writeDraft(
      persona,
      base.draft,
      merged,
      base.draft?.generatedBy ?? `assistant:${assistant}`,
    );
    await this.audit.record({
      action: 'persona.assistant_reflection_imported',
      actorId: userId,
      requestId,
      metadata: {
        assistant,
        accepted: parsed.answers.size,
        unknown: parsed.unknown.length,
        rejected: parsed.rejected.length,
      },
    });
    return {
      result: {
        accepted: [...parsed.answers.keys()],
        unknown: parsed.unknown,
        rejected: parsed.rejected,
      },
      persona: await this.view(userId),
    };
  }

  // ─────────────────────────── editing and approval ───────────────────────────

  async editDraft(userId: string, edit: PersonaEdit): Promise<PersonaView> {
    const details: { path: string; message: string }[] = [];
    const persona = await this.ensurePersona(userId);
    const base = await this.baseState(persona);
    const state = new Map(base.state);
    const now = new Date();

    for (const [key, raw] of Object.entries(edit.set ?? {}) as [PersonaAttributeKey, unknown][]) {
      const value = attributeValueSchema(key).safeParse(raw);
      if (value.success) state.set(key, stateFromPerson(value.data as PersonaAttributeValue, now));
      else
        details.push({
          path: `set.${key}`,
          message: value.error.issues[0]?.message ?? 'Invalid value',
        });
    }
    for (const key of edit.confirm ?? []) {
      const existing = state.get(key);
      if (existing) state.set(key, confirmState(existing, now));
      else details.push({ path: `confirm.${key}`, message: 'Nothing to confirm' });
    }
    for (const key of edit.clear ?? []) state.delete(key);
    if (details.length > 0) {
      throw new UnprocessableEntityException({
        message: 'Some of the information provided is not valid.',
        details,
      });
    }
    await this.writeDraft(persona, base.draft, state, base.draft?.generatedBy ?? 'user');
    return this.view(userId);
  }

  async approveDraft(userId: string, requestId: string): Promise<PersonaView> {
    const persona = await this.prisma.persona.findUnique({ where: { userId } });
    const draft = persona
      ? await this.prisma.personaVersion.findFirst({
          where: { personaId: persona.id, status: 'DRAFT' },
        })
      : null;
    if (!persona || !draft) throw new NotFoundException('There is no draft to approve.');
    const records = personaRecordsSchema.parse(draft.attributes);
    if (Object.keys(records).length === 0)
      throw new ConflictException('Add at least one thing before approving.');

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.personaVersion.updateMany({
        where: { personaId: persona.id, status: 'APPROVED' },
        data: { status: 'SUPERSEDED' },
      }),
      this.prisma.personaVersion.update({
        where: { id: draft.id },
        data: { status: 'APPROVED', approvedAt: now },
      }),
      this.prisma.persona.update({
        where: { id: persona.id },
        data: { currentVersionId: draft.id, generationStatus: 'idle', generationFailureCode: null },
      }),
    ]);
    await this.writeEmbedding(persona.id, draft.id, records);
    await this.audit.record({
      action: 'persona.approved',
      actorId: userId,
      entityType: 'persona_version',
      entityId: draft.id,
      requestId,
    });
    return this.view(userId);
  }

  async discardDraft(userId: string): Promise<PersonaView> {
    await this.prisma.$transaction([
      this.prisma.personaVersion.deleteMany({ where: { status: 'DRAFT', persona: { userId } } }),
      this.prisma.persona.updateMany({
        where: { userId },
        data: { generationStatus: 'idle', generationFailureCode: null },
      }),
    ]);
    return this.view(userId);
  }

  /** Removes the persona, every version, its evidence and embeddings. */
  async clear(userId: string, requestId: string): Promise<void> {
    await this.prisma.persona.deleteMany({ where: { userId } });
    await this.audit.record({ action: 'persona.cleared', actorId: userId, requestId });
  }

  // ─────────────────────────── internals ───────────────────────────

  private async ensurePersona(userId: string): Promise<Persona> {
    return this.prisma.persona.upsert({ where: { userId }, create: { userId }, update: {} });
  }

  private async setGeneration(
    personaId: string,
    status: GenerationStatus,
    failureCode: string | null,
  ): Promise<void> {
    await this.prisma.persona.update({
      where: { id: personaId },
      data: { generationStatus: status, generationFailureCode: failureCode },
    });
  }

  /** What new input is merged into: the open draft, else a copy of the approved persona. */
  private async baseState(
    persona: Persona,
  ): Promise<{ draft: VersionWithEvidence | null; state: State }> {
    const draft = await this.prisma.personaVersion.findFirst({
      where: { personaId: persona.id, status: 'DRAFT' },
      include: { evidence: { orderBy: { createdAt: 'asc' } } },
    });
    if (draft) return { draft, state: toState(draft) };
    const current = persona.currentVersionId
      ? await this.prisma.personaVersion.findUnique({
          where: { id: persona.currentVersionId },
          include: { evidence: { orderBy: { createdAt: 'asc' } } },
        })
      : null;
    return { draft: null, state: current ? toState(current) : new Map() };
  }

  /** Replaces the open draft's content, or opens a new draft version. */
  private async writeDraft(
    persona: Persona,
    draft: VersionWithEvidence | null,
    state: State,
    generatedBy: string,
  ): Promise<void> {
    const records = Object.fromEntries([...state].map(([key, s]) => [key, s.record]));
    const evidence = [...state].flatMap(([key, s]) =>
      s.evidence.map((e) => ({
        attributeKey: key,
        category: e.category,
        sourceType: e.sourceType,
        sourceDetail: e.sourceDetail,
        confidence: s.record.confidence,
        summary: e.summary,
      })),
    );
    await this.prisma.$transaction(async (tx) => {
      let versionId = draft?.id;
      if (versionId) {
        await tx.personaVersion.update({
          where: { id: versionId },
          data: { attributes: records, generatedBy },
        });
        await tx.personaEvidence.deleteMany({ where: { personaVersionId: versionId } });
      } else {
        const latest = await tx.personaVersion.aggregate({
          where: { personaId: persona.id },
          _max: { version: true },
        });
        const created = await tx.personaVersion.create({
          data: {
            personaId: persona.id,
            version: (latest._max.version ?? 0) + 1,
            schemaVersion: PERSONA_SCHEMA_VERSION,
            status: 'DRAFT',
            attributes: records,
            generatedBy,
          },
        });
        versionId = created.id;
      }
      if (evidence.length > 0) {
        await tx.personaEvidence.createMany({
          data: evidence.map((e) => ({ ...e, personaVersionId: versionId })),
        });
      }
    });
  }

  /**
   * Stores the embedding for the newly approved version and removes those of
   * older versions. A provider failure leaves the persona approved without an
   * embedding; matching treats that as "no vector" rather than blocking.
   */
  private async writeEmbedding(
    personaId: string,
    versionId: string,
    records: Record<string, { value: unknown }>,
  ): Promise<void> {
    const text = PERSONA_ATTRIBUTE_KEYS.filter((key) => records[key])
      .map((key) => `${key}: ${JSON.stringify(records[key]?.value)}`)
      .join('\n');
    try {
      const vector = await this.ai.embed(text);
      const literal = `[${vector.join(',')}]`;
      await this.prisma.$transaction([
        this.prisma.$executeRaw`
          DELETE FROM vyra_vector.persona_embeddings
          WHERE persona_version_id IN (SELECT id FROM persona_versions WHERE persona_id = ${personaId}::uuid)`,
        this.prisma.$executeRaw`
          INSERT INTO vyra_vector.persona_embeddings (persona_version_id, model, embedding)
          VALUES (${versionId}::uuid, ${this.ai.id}, ${literal}::vector)`,
      ]);
    } catch (error) {
      this.logger.error(
        'Could not store persona embedding',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

function toState(version: VersionWithEvidence): State {
  const records = personaRecordsSchema.parse(version.attributes);
  const state: State = new Map();
  for (const key of PERSONA_ATTRIBUTE_KEYS) {
    const record = records[key];
    if (!record) continue;
    const evidence: PersonaEvidenceView[] = version.evidence
      .filter((e) => e.attributeKey === key)
      .map((e) => ({
        summary: e.summary,
        category: e.category,
        sourceType: e.sourceType,
        sourceDetail: e.sourceDetail,
      }));
    state.set(key, { record, evidence });
  }
  return state;
}

function toView(version: VersionWithEvidence): PersonaVersionView {
  const state = toState(version);
  return {
    id: version.id,
    version: version.version,
    status: version.status === 'DRAFT' ? 'DRAFT' : 'APPROVED',
    createdAt: version.createdAt.toISOString(),
    approvedAt: version.approvedAt?.toISOString() ?? null,
    attributes: Object.fromEntries(
      [...state].map(([key, s]) => [key, { ...s.record, evidence: [...s.evidence] }]),
    ),
    unknown: PERSONA_ATTRIBUTE_KEYS.filter((key) => !state.has(key)),
  };
}
