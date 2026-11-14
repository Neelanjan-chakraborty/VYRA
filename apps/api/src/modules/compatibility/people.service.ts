import { Injectable } from '@nestjs/common';
import type { Person } from '@vyra/compatibility-engine';
import {
  ageInYears,
  dealBreakerListSchema,
  type GenderCategory,
  type GenderIdentity,
  GENDER_LABELS,
  PERSONA_ATTRIBUTE_KEYS,
  personaRecordsSchema,
  type RelationshipIntent,
} from '@vyra/validation';
import { PrismaService } from '../../database/prisma.service.js';
import type { RelationshipIntentKind } from '../../generated/prisma/client.js';

const INTENT_FROM_DB: Readonly<Record<RelationshipIntentKind, RelationshipIntent>> = {
  SERIOUS: 'serious',
  CASUAL: 'casual',
  EXPLORING: 'exploring',
  COMPANIONSHIP: 'companionship',
  OTHER: 'other',
};

function isCategory(identity: string): identity is GenderCategory {
  return identity === 'WOMAN' || identity === 'MAN' || identity === 'NON_BINARY';
}

/** What others may see of someone's gender: only when shown, never "prefer not to say". */
function visibleGender(
  profile: {
    genderVisible: boolean;
    genderIdentity: GenderIdentity | null;
    genderSelfDescription: string | null;
  } | null,
): string | null {
  if (
    !profile?.genderVisible ||
    !profile.genderIdentity ||
    profile.genderIdentity === 'PREFER_NOT_TO_SAY'
  )
    return null;
  if (profile.genderIdentity === 'SELF_DESCRIBE') return profile.genderSelfDescription;
  return GENDER_LABELS[profile.genderIdentity];
}

/** What the ranking needs besides the engine's view of a person. */
export interface LoadedPerson {
  readonly person: Person;
  readonly eligible: boolean;
  readonly displayName: string;
  readonly city: string | null;
  readonly bio: string | null;
  /** The gender label to show others, only if the person chose to show it. */
  readonly visibleGender: string | null;
  readonly occupation: string | null;
  readonly personaVersionId: string | null;
  /** Storage key of the first approved photo, if any. */
  readonly photoKey: string | null;
}

/**
 * Builds the engine's input from the database. Only approved persona versions
 * are read; drafts never influence matching.
 */
@Injectable()
export class PeopleService {
  constructor(private readonly prisma: PrismaService) {}

  async load(ids: readonly string[]): Promise<Map<string, LoadedPerson>> {
    if (ids.length === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...ids] } },
      include: {
        profile: true,
        discoveryPreferences: true,
        relationshipIntents: true,
        interests: { include: { interest: true }, orderBy: { createdAt: 'asc' } },
        persona: { include: { currentVersion: true } },
        photos: {
          where: { deletedAt: null, moderationStatus: 'APPROVED' },
          orderBy: { position: 'asc' },
          take: 1,
        },
      },
    });

    const result = new Map<string, LoadedPerson>();
    for (const user of users) {
      if (!user.dateOfBirth) continue; // deleted accounts have no date of birth
      const prefs = user.discoveryPreferences;
      const version = user.persona?.currentVersion ?? null;
      const records = version ? personaRecordsSchema.safeParse(version.attributes) : null;
      const traits: Person['traits'] = {};
      if (records?.success) {
        for (const key of PERSONA_ATTRIBUTE_KEYS) {
          const record = records.data[key];
          if (record) traits[key] = { value: record.value, confidence: record.confidence };
        }
      }
      const person: Person = {
        id: user.id,
        age: ageInYears(user.dateOfBirth.toISOString().slice(0, 10)),
        gender: user.profile?.genderIdentity ?? null,
        discoverableAs: (user.profile?.discoverableAs ?? []).filter(isCategory),
        intents: user.relationshipIntents.map((i) => INTENT_FROM_DB[i.kind]),
        preferences: {
          minAge: prefs?.minAge ?? 18,
          maxAge: prefs?.maxAge ?? 99,
          maxDistanceKm: prefs?.maxDistanceKm ?? null,
          showGenders: (prefs?.showGenders ?? []).filter(isCategory),
          includeUnlistedGenders: prefs?.includeUnlistedGenders ?? true,
          dealBreakers: dealBreakerListSchema.catch([]).parse(prefs?.dealBreakers ?? []),
        },
        location:
          user.profile?.latitude != null && user.profile.longitude != null
            ? { latitude: user.profile.latitude, longitude: user.profile.longitude }
            : null,
        traits,
        interests: user.interests.map(({ interest }) => ({
          slug: interest.slug,
          label: interest.label,
        })),
      };
      result.set(user.id, {
        person,
        eligible:
          user.status === 'ACTIVE' &&
          user.deletedAt === null &&
          user.profile?.isDiscoverable === true,
        displayName: user.profile?.displayName ?? '',
        city: user.profile?.city ?? null,
        bio: user.profile?.bio ?? null,
        visibleGender: visibleGender(user.profile),
        occupation: user.profile?.occupation ?? null,
        personaVersionId: version?.status === 'APPROVED' ? version.id : null,
        photoKey: user.photos[0]?.storageKey ?? null,
      });
    }
    return result;
  }

  /**
   * The only way any non-owner response gets photos: approved, not deleted,
   * in the owner's order. Everything else stays invisible.
   */
  async approvedPhotos(
    userId: string,
  ): Promise<{ id: string; storageKey: string; width: number; height: number }[]> {
    return this.prisma.userPhoto.findMany({
      where: { userId, deletedAt: null, moderationStatus: 'APPROVED' },
      orderBy: { position: 'asc' },
      select: { id: true, storageKey: true, width: true, height: true },
    });
  }

  /** True when either person has blocked the other. */
  async isBlocked(a: string, b: string): Promise<boolean> {
    const count = await this.prisma.blockedUser.count({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
    });
    return count > 0;
  }
}
