import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ENGINE_VERSION,
  highlights,
  ineligibility,
  rankWithDiversity,
  score,
  type Ranked,
  type Weights,
} from '@vyra/compatibility-engine';
import {
  type CompatibilityResult,
  type CompatibilityView,
  distanceKm,
  distanceLabel,
  type DistanceFilterStatus,
  type PublicProfile,
  compatibilityWeightsSchema,
  type Recommendation,
  type RecommendationList,
} from '@vyra/validation';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { MediaUrlService } from '../storage/media-url.service.js';
import { type LoadedPerson, PeopleService } from './people.service.js';

/** Largest candidate pool scored per recommendations request. */
export const CANDIDATE_POOL = 200;
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
  ) {}

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
    const loaded = await this.people.load([viewerId, targetId]);
    const viewer = loaded.get(viewerId);
    const target = loaded.get(targetId);
    if (
      !viewer ||
      !target ||
      !target.eligible ||
      (await this.people.isBlocked(viewerId, targetId))
    ) {
      throw new NotFoundException(NOT_FOUND);
    }
    if (ineligibility(viewer.person, target.person) !== null)
      throw new NotFoundException(NOT_FOUND);

    const result = score(viewer.person, target.person, weights, version);
    await this.persist(viewer, target, result);
    await this.prisma.discoveryEvent.create({
      data: {
        userId: viewerId,
        targetUserId: targetId,
        type: 'COMPATIBILITY_VIEWED',
        context: { engineVersion: ENGINE_VERSION, weightsVersion: version },
      },
    });
    return { userId: targetId, result };
  }

  /** Another person's profile as the viewer may see it. Same visibility rules as `forPair`. */
  async profile(viewerId: string, targetId: string): Promise<PublicProfile> {
    const loaded = await this.people.load([viewerId, targetId]);
    const viewer = loaded.get(viewerId);
    const target = loaded.get(targetId);
    if (
      !viewer ||
      !target ||
      !target.eligible ||
      (await this.people.isBlocked(viewerId, targetId))
    ) {
      throw new NotFoundException(NOT_FOUND);
    }
    if (ineligibility(viewer.person, target.person) !== null)
      throw new NotFoundException(NOT_FOUND);
    const photos = await this.people.approvedPhotos(targetId);
    await this.prisma.discoveryEvent.create({
      data: { userId: viewerId, targetUserId: targetId, type: 'PROFILE_OPENED', context: {} },
    });
    return {
      userId: targetId,
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
        width: p.width,
        height: p.height,
      })),
      interests: target.person.interests.map((i) => i.label),
    };
  }

  async recommendations(viewerId: string, limit: number): Promise<RecommendationList> {
    const { version, weights } = await this.activeWeights();
    const viewer = (await this.people.load([viewerId])).get(viewerId);
    if (!viewer || viewer.person.intents.length === 0)
      throw new ConflictException('Finish setting up your profile first.');

    const ids = await this.candidatePool(viewerId, viewer);
    const loaded = await this.people.load(ids);
    const scored: Ranked<LoadedPerson>[] = [];
    for (const id of ids) {
      const candidate = loaded.get(id);
      if (!candidate?.eligible || ineligibility(viewer.person, candidate.person) !== null) continue;
      scored.push({
        item: candidate,
        result: score(viewer.person, candidate.person, weights, version),
      });
    }
    const ranked = rankWithDiversity(scored, weights, (c) => c.person.id).slice(0, limit);

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
            engineVersion: ENGINE_VERSION,
            weightsVersion: version,
          },
        })),
      });
    }

    return {
      engineVersion: ENGINE_VERSION,
      weightsVersion: version,
      distanceFilter: distanceFilterStatus(viewer),
      recommendations: ranked.map(({ item, result }): Recommendation => ({
        userId: item.person.id,
        displayName: item.displayName,
        age: item.person.age,
        city: item.city,
        photoUrl: item.photoKey ? this.media.sign(item.photoKey, 'public') : null,
        distance: distanceBetween(viewer, item),
        overall: result.overall,
        confidence: result.confidence,
        sufficiency: result.sufficiency,
        highlights: highlights(result, weights),
        sharedInterests: result.sharedInterests,
      })),
    };
  }

  /**
   * Coarse SQL filtering, then nearest neighbours by persona embedding where
   * both have one. The embedding only chooses who gets scored; it never sets
   * the score. Exact rules are re-checked by the engine.
   */
  private async candidatePool(viewerId: string, viewer: LoadedPerson): Promise<string[]> {
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
        AND NOT EXISTS (
          SELECT 1 FROM blocked_users b
          WHERE (b.blocker_id = ${viewerId}::uuid AND b.blocked_id = u.id)
             OR (b.blocker_id = u.id AND b.blocked_id = ${viewerId}::uuid)
        )
      ORDER BY (e.embedding <=> (SELECT embedding FROM viewer_vector)) ASC NULLS LAST,
               u.last_active_at DESC NULLS LAST,
               u.id
      LIMIT ${CANDIDATE_POOL}`;
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
