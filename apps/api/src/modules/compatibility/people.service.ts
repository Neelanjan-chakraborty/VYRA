import { Injectable } from '@nestjs/common';
import type { Person } from '@vyra/compatibility-engine';
import {
  ageInYears,
  dealBreakerListSchema,
  genderCategory,
  type GenderCategory,
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

/** What the ranking needs besides the engine's view of a person. */
export interface LoadedPerson {
  readonly person: Person;
  readonly eligible: boolean;
  readonly displayName: string;
  readonly city: string | null;
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
        gender: genderCategory(user.profile?.gender),
        intents: user.relationshipIntents.map((i) => INTENT_FROM_DB[i.kind]),
        preferences: {
          minAge: prefs?.minAge ?? 18,
          maxAge: prefs?.maxAge ?? 99,
          maxDistanceKm: prefs?.maxDistanceKm ?? null,
          interestedIn: (prefs?.interestedIn ?? []).flatMap((g) => {
            const category = genderCategory(g);
            return category ? [category] : ([] as GenderCategory[]);
          }),
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
        personaVersionId: version?.status === 'APPROVED' ? version.id : null,
        photoKey: user.photos[0]?.storageKey ?? null,
      });
    }
    return result;
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
