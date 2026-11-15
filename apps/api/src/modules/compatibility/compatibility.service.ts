import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  failsMustHaves,
  type Person,
  sharedInterestLabels,
  type Weights,
} from '@vyra/compatibility-engine';
import {
  type CompatibilityResult,
  type CompatibilityView,
  countBucket,
  type CriteriaImpact,
  distanceKm,
  distanceLabel,
  type DistanceFilterStatus,
  PASS_HIDE_DAYS,
  type PersonSummary,
  type PublicProfile,
  compatibilityWeightsSchema,
  type Recommendation,
  type RecommendationList,
} from '@vyra/validation';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { ENGINE, type Engine } from './engine.js';
import { MediaUrlService } from '../storage/media-url.service.js';
import { type LoadedPerson, PeopleService } from './people.service.js';

/** Largest candidate pool scored per recommendations request. */
export const CANDIDATE_POOL = 200;
/** Pool used to estimate how much must-haves narrow things. */
const IMPACT_POOL = 500;
const WEIGHTS_CACHE_MS = 60_000;
const NOT_FOUND = 'Not found.';

@Injectable()
export class CompatibilityService {
  private readonly logger = new Logger(CompatibilityService.name);
  private weightsCache: { version: string; weights: Weights; loadedAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly people: PeopleService,
    private readonly media: MediaUrlService,
    @Inject(ENGINE) private readonly engine: Engine,
  ) {}

  /** Forget the cached weight set, e.g. right after a new one is approved. */
  invalidateWeights(): void {
    this.weightsCache = null;
  }

  /** The active, validated weight set. Cached briefly; a bad row fails loudly. */
  async activeWeights(): Promise<{ version: string; weights: Weights }> {
    if (this.weightsCache && Date.now() - this.weightsCache.loadedAt < WEIGHTS_CACHE_MS)
      return this.weightsCache;
    const row = await this.prisma.compatibilityWeightSet.findFirst({ where: { isActive: true } });
    if (!row) throw new Error('No active compatibility weight set');
    const weights = compatibilityWeightsSchema.parse(row.weights);
    this.weightsCache = { version: row.version, weights, loadedAt: Date.now() };
    return this.weightsCache;
  }

  /**
   * Estimated alignment with one other person. Anyone the viewer may not be
   * shown — hidden, blocked, outside either person's limits — is a plain 404,
   * so the endpoint cannot be used to learn why.
   */
  async forPair(viewerId: string, targetId: string): Promise<CompatibilityView> {
    const { version, weights } = await this.activeWeights();
    const pair = await this.people.visiblePair(viewerId, targetId);
    if (!pair) throw new NotFoundException(NOT_FOUND);
    const { viewer, target } = pair;

    const result = this.engine.score(viewer.person, target.person, weights, version);
    await this.persist(viewer, target, result);
    await this.prisma.discoveryEvent.create({
      data: {
        userId: viewerId,
        targetUserId: targetId,
        type: 'COMPATIBILITY_VIEWED',
        context: { engineVersion: this.engine.version, weightsVersion: version },
      },
    });
    return { userId: targetId, result };
  }

  /**
   * Reasons and shared interests for a pair, without recording a view. Used by
   * Wingman for people who are already connected.
   */
  async reasonsFor(
    viewerId: string,
    targetId: string,
  ): Promise<{ highlights: string[]; sharedInterests: string[] }> {
    const { version, weights } = await this.activeWeights();
    const loaded = await this.people.load([viewerId, targetId]);
    const viewer = loaded.get(viewerId);
    const target = loaded.get(targetId);
    if (!viewer || !target) return { highlights: [], sharedInterests: [] };
    const result = this.engine.score(viewer.person, target.person, weights, version);
    return {
      highlights: this.engine.highlights(result, weights),
      sharedInterests: result.sharedInterests,
    };
  }

  /** Another person's profile as the viewer may see it. Same visibility rules as `forPair`. */
  async profile(viewerId: string, targetId: string): Promise<PublicProfile> {
    const pair = await this.people.visiblePair(viewerId, targetId);
    if (!pair) throw new NotFoundException(NOT_FOUND);
    const { viewer, target } = pair;
    const photos = await this.people.approvedPhotos(targetId);
    const handle = await this.prisma.userProfile.findUnique({
      where: { userId: targetId },
      select: { username: true },
    });
    await this.prisma.discoveryEvent.create({
      data: { userId: viewerId, targetUserId: targetId, type: 'PROFILE_OPENED', context: {} },
    });
    return {
      userId: targetId,
      username: handle?.username ?? null,
      displayName: target.displayName,
      age: target.person.age,
      city: target.city,
      bio: target.bio,
      occupation: target.occupation,
      gender: target.visibleGender,
      distance: distanceBetween(viewer, target),
      photos: photos.map((p) => ({
        id: p.id,
        url: this.media.sign(p.storageKey, 'public'),
        thumbUrl: p.thumbKey ? this.media.sign(p.thumbKey, 'public') : null,
        width: p.width,
        height: p.height,
      })),
      interests: target.person.interests.map((i) => i.label),
      sharedInterests: sharedInterestLabels(viewer.person, target.person),
    };
  }

  /**
   * Short cards for people the viewer already has a tie with (Connections).
   * Photos only when approved and the person is still discoverable — the same
   * condition the media endpoint applies to public URLs.
   */
  async summaries(viewerId: string, ids: readonly string[]): Promise<Map<string, PersonSummary>> {
    const { version, weights } = await this.activeWeights();
    const loaded = await this.people.load([viewerId, ...ids]);
    const viewer = loaded.get(viewerId);
    const out = new Map<string, PersonSummary>();
    if (!viewer) return out;
    for (const id of ids) {
      const target = loaded.get(id);
      if (!target?.reachable) continue;
      const result = this.engine.score(viewer.person, target.person, weights, version);
      out.set(id, {
        userId: id,
        displayName: target.displayName,
        age: target.person.age,
        city: target.city,
        photoUrl:
          target.eligible && target.photoKey
            ? this.media.sign(target.thumbKey ?? target.photoKey, 'public')
            : null,
        distance: distanceBetween(viewer, target),
        overall: result.overall,
        sufficiency: result.sufficiency,
      });
    }
    return out;
  }

  /**
   * How much the viewer's must-haves narrow who they can be shown. Uses the
   * same candidate pool and gates as recommendations, with and without the
   * viewer's must-haves, and reports bucketed counts only.
   */
  async criteriaImpact(viewerId: string): Promise<CriteriaImpact> {
    const viewer = (await this.people.load([viewerId])).get(viewerId);
    if (!viewer) throw new ConflictException('Finish setting up your profile first.');
    const withoutMust: Person = {
      ...viewer.person,
      preferences: {
        ...viewer.person.preferences,
        criteria: viewer.person.preferences.criteria.filter((c) => c.mode !== 'must'),
      },
    };
    const loaded = await this.people.load(await this.candidatePool(viewerId, viewer, IMPACT_POOL));
    const pool = [...loaded.values()].filter((c) => c.eligible);
    const gates = this.engine.ineligibilityMany(
      withoutMust,
      pool.map((c) => c.person),
    );
    const base = pool.filter((_, i) => gates[i] === null);
    const kept = base.filter((c) => failsMustHaves(viewer.person, c.person) === null);
    const musts = viewer.person.preferences.criteria.filter((c) => c.mode === 'must');
    return {
      withoutMustHaves: countBucket(base.length),
      withMustHaves: countBucket(kept.length),
      significant: base.length >= 10 && kept.length <= base.length / 2,
      perCriterion: musts.map((criterion) => ({
        criterion: criterion.criterion,
        excludes: countBucket(
          base.filter((c) => failsMustHaves(viewer.person, c.person, [criterion]) !== null).length,
        ),
      })),
    };
  }

  async recommendations(viewerId: string, limit: number): Promise<RecommendationList> {
    const { version, weights } = await this.activeWeights();
    const viewer = (await this.people.load([viewerId])).get(viewerId);
    if (!viewer || viewer.person.intents.length === 0)
      throw new ConflictException('Finish setting up your profile first.');

    const ids = await this.candidatePool(viewerId, viewer);
    const loaded = await this.people.load(ids);
    const candidates = ids.flatMap((id) => {
      const candidate = loaded.get(id);
      return candidate?.eligible ? [candidate] : [];
    });
    // One call into the engine: gates both ways, scores, ranks, explains the top `limit`.
    const ranked = this.engine
      .recommend(
        viewer.person,
        candidates.map((c) => c.person),
        weights,
        version,
        limit,
      )
      .flatMap(({ index, result, highlights }) => {
        const item = candidates[index];
        return item ? [{ item, result, highlights }] : [];
      });

    await Promise.all(ranked.map(({ item, result }) => this.persist(viewer, item, result)));
    if (ranked.length > 0) {
      await this.prisma.discoveryEvent.createMany({
        data: ranked.map(({ item }, rank) => ({
          userId: viewerId,
          targetUserId: item.person.id,
          type: 'IMPRESSION' as const,
          context: {
            surface: 'recommendations',
            rank,
            engineVersion: this.engine.version,
            weightsVersion: version,
          },
        })),
      });
    }

    return {
      engineVersion: this.engine.version,
      weightsVersion: version,
      distanceFilter: distanceFilterStatus(viewer),
      recommendations: ranked.map(({ item, result, highlights }): Recommendation => ({
        userId: item.person.id,
        displayName: item.displayName,
        age: item.person.age,
        city: item.city,
        // Cards are small: the thumbnail is enough.
        photoUrl: item.photoKey ? this.media.sign(item.thumbKey ?? item.photoKey, 'public') : null,
        distance: distanceBetween(viewer, item),
        overall: result.overall,
        confidence: result.confidence,
        sufficiency: result.sufficiency,
        highlights,
        sharedInterests: result.sharedInterests,
      })),
    };
  }

  /**
   * Coarse SQL filtering, then nearest neighbours by persona embedding where
   * both have one. The embedding only chooses who gets scored; it never sets
   * the score. Exact rules are re-checked by the engine.
   */
  private async candidatePool(
    viewerId: string,
    viewer: LoadedPerson,
    limit = CANDIDATE_POOL,
  ): Promise<string[]> {
    const { minAge, maxAge, maxDistanceKm } = viewer.person.preferences;
    // Bounding box around the viewer when distance applies. People without a
    // location stay in the pool: missing location is never treated as far away.
    const box =
      maxDistanceKm !== null && viewer.person.location
        ? {
            latMin: viewer.person.location.latitude - maxDistanceKm / 111,
            latMax: viewer.person.location.latitude + maxDistanceKm / 111,
            lonMin:
              viewer.person.location.longitude -
              maxDistanceKm /
                (111 * Math.max(0.1, Math.cos((viewer.person.location.latitude * Math.PI) / 180))),
            lonMax:
              viewer.person.location.longitude +
              maxDistanceKm /
                (111 * Math.max(0.1, Math.cos((viewer.person.location.latitude * Math.PI) / 180))),
          }
        : null;
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      WITH viewer_vector AS (
        SELECT e.embedding
        FROM personas p
        JOIN vyra_vector.persona_embeddings e ON e.persona_version_id = p.current_version_id
        WHERE p.user_id = ${viewerId}::uuid
      )
      SELECT u.id
      FROM users u
      JOIN user_profiles pr ON pr.user_id = u.id
      LEFT JOIN discovery_preferences dp ON dp.user_id = u.id
      LEFT JOIN personas pe ON pe.user_id = u.id
      LEFT JOIN vyra_vector.persona_embeddings e ON e.persona_version_id = pe.current_version_id
      WHERE u.id <> ${viewerId}::uuid
        AND u.status = 'ACTIVE'
        AND u.deleted_at IS NULL
        AND pr.is_discoverable
        AND u.date_of_birth <= current_date - make_interval(years => ${minAge}::int)
        AND u.date_of_birth > current_date - make_interval(years => ${maxAge + 1}::int)
        AND (dp.user_id IS NULL OR ${viewer.person.age}::int BETWEEN dp.min_age AND dp.max_age)
        AND (
          ${box === null}::boolean
          OR pr.latitude IS NULL
          OR (pr.latitude BETWEEN ${box?.latMin ?? 0}::float8 AND ${box?.latMax ?? 0}::float8
              AND pr.longitude BETWEEN ${box?.lonMin ?? 0}::float8 AND ${box?.lonMax ?? 0}::float8)
        )
        -- People already handled live in Connections, and passes rest for a while.
        AND NOT EXISTS (
          SELECT 1 FROM discovery_events de
          WHERE de.user_id = ${viewerId}::uuid AND de.target_user_id = u.id AND de.type = 'PASSED'
            AND de.created_at > now() - make_interval(days => ${PASS_HIDE_DAYS}::int)
        )
        AND NOT EXISTS (
          SELECT 1 FROM saved_profiles sp WHERE sp.user_id = ${viewerId}::uuid AND sp.target_user_id = u.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM connection_requests cr
          WHERE cr.status = 'PENDING'
            AND ((cr.sender_id = ${viewerId}::uuid AND cr.recipient_id = u.id)
              OR (cr.sender_id = u.id AND cr.recipient_id = ${viewerId}::uuid))
        )
        AND NOT EXISTS (
          SELECT 1 FROM matches m
          WHERE m.ended_at IS NULL
            AND ((m.user_a_id = ${viewerId}::uuid AND m.user_b_id = u.id)
              OR (m.user_a_id = u.id AND m.user_b_id = ${viewerId}::uuid))
        )
        AND NOT EXISTS (
          SELECT 1 FROM blocked_users b
          WHERE (b.blocker_id = ${viewerId}::uuid AND b.blocked_id = u.id)
             OR (b.blocker_id = u.id AND b.blocked_id = ${viewerId}::uuid)
        )
      ORDER BY (e.embedding <=> (SELECT embedding FROM viewer_vector)) ASC NULLS LAST,
               u.last_active_at DESC NULLS LAST,
               u.id
      LIMIT ${limit}`;
    return rows.map((row) => row.id);
  }

  /**
   * Caches a result for analytics and the learning system. Only pairs where
   * both have an approved persona are stored: the row is keyed by both version
   * ids, so a new approval makes old rows unreachable.
   */
  private async persist(
    a: LoadedPerson,
    b: LoadedPerson,
    result: CompatibilityResult,
  ): Promise<void> {
    if (!a.personaVersionId || !b.personaVersionId) return;
    const [first, second] = a.person.id < b.person.id ? [a, b] : [b, a];
    const key = {
      personaVersionAId: first.personaVersionId as string,
      personaVersionBId: second.personaVersionId as string,
      weightsVersion: result.weightsVersion,
      engineVersion: result.engineVersion,
    };
    const data = {
      overall: result.overall,
      confidence: result.confidence,
      sufficiency: result.sufficiency,
      dimensions: result.dimensions as unknown as Prisma.InputJsonObject,
      computedAt: new Date(),
    };
    try {
      await this.prisma.$transaction(async (tx) => {
        const row = await tx.compatibilityScore.upsert({
          where: { personaVersionAId_personaVersionBId_weightsVersion_engineVersion: key },
          create: { ...key, ...data, userAId: first.person.id, userBId: second.person.id },
          update: data,
        });
        await tx.compatibilityScenario.deleteMany({ where: { scoreId: row.id } });
        await tx.compatibilityScenario.createMany({
          data: result.scenarios.map((s) => ({
            scoreId: row.id,
            scenarioKey: s.key,
            alignment: s.alignment,
            confidence: s.confidence,
            explanation: { features: s.features } as unknown as Prisma.InputJsonObject,
          })),
        });
      });
    } catch (error) {
      // Caching must never break the response.
      this.logger.warn(
        `Could not cache compatibility: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}

/** A distance band only when both people have a location. Never a guess. */
function distanceBetween(a: LoadedPerson, b: LoadedPerson): string | null {
  if (!a.person.location || !b.person.location) return null;
  return distanceLabel(distanceKm(a.person.location, b.person.location));
}

function distanceFilterStatus(viewer: LoadedPerson): DistanceFilterStatus {
  if (viewer.person.preferences.maxDistanceKm === null) return 'off';
  return viewer.person.location ? 'active' : 'no_location';
}
