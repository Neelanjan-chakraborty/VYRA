import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ageInYears,
  dealBreakerListSchema,
  type DiscoveryPreferences,
  type GenderCategory,
  type Interest,
  type Me,
  type RelationshipIntent,
} from '@vyra/validation';
import type { z } from 'zod';
import type { profileUpdateSchema, relationshipIntentsUpdateSchema } from '@vyra/validation';
import { PrismaService } from '../../database/prisma.service.js';
import type { RelationshipIntentKind } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { AuthService } from '../auth/auth.service.js';
import { PhotosService } from './photos.service.js';

type ProfileUpdate = z.output<typeof profileUpdateSchema>;
type IntentsUpdate = z.output<typeof relationshipIntentsUpdateSchema>;

const KIND_TO_DB = {
  serious: 'SERIOUS',
  casual: 'CASUAL',
  exploring: 'EXPLORING',
  companionship: 'COMPANIONSHIP',
  other: 'OTHER',
} as const satisfies Record<RelationshipIntent, RelationshipIntentKind>;
const KIND_FROM_DB = Object.fromEntries(
  Object.entries(KIND_TO_DB).map(([api, db]) => [db, api]),
) as Record<RelationshipIntentKind, RelationshipIntent>;

function isCategory(identity: string): identity is GenderCategory {
  return identity === 'WOMAN' || identity === 'MAN' || identity === 'NON_BINARY';
}

export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

export function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)}${'•'.repeat(Math.max(0, phone.length - 5))}${phone.slice(-2)}`;
}

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly photos: PhotosService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  async get(userId: string): Promise<Me> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        relationshipIntents: { orderBy: { createdAt: 'asc' } },
        discoveryPreferences: true,
        interests: { include: { interest: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!user || user.status === 'DELETED' || !user.dateOfBirth) {
      throw new NotFoundException('Account not found.');
    }
    const photos = await this.photos.list(userId);
    const { profile, discoveryPreferences: prefs } = user;

    const onboardingMissing: Me['onboardingMissing'] = [];
    if (!profile) onboardingMissing.push('profile');
    // A rejected photo doesn't count; one waiting for moderation does.
    if (!photos.some((p) => p.status !== 'REJECTED')) onboardingMissing.push('photo');
    if (user.relationshipIntents.length === 0) onboardingMissing.push('relationshipIntent');

    return {
      id: user.id,
      status: user.status,
      emailMasked: user.email ? maskEmail(user.email) : null,
      phoneMasked: user.phone ? maskPhone(user.phone) : null,
      age: ageInYears(user.dateOfBirth.toISOString().slice(0, 10)),
      profile: profile && {
        displayName: profile.displayName,
        bio: profile.bio,
        genderIdentity: profile.genderIdentity,
        genderSelfDescription: profile.genderSelfDescription,
        genderVisible: profile.genderVisible,
        discoverableAs: profile.discoverableAs.filter(isCategory),
        pronouns: profile.pronouns,
        occupation: profile.occupation,
        city: profile.city,
        countryCode: profile.countryCode,
        isDiscoverable: profile.isDiscoverable,
      },
      photos,
      relationshipIntents: user.relationshipIntents.map((intent) => ({
        kind: KIND_FROM_DB[intent.kind],
        customLabel: intent.customLabel,
        isPrimary: intent.isPrimary,
      })),
      discoveryPreferences: prefs && {
        minAge: prefs.minAge,
        maxAge: prefs.maxAge,
        maxDistanceKm: prefs.maxDistanceKm,
        showGenders: prefs.showGenders.filter(isCategory),
        includeUnlistedGenders: prefs.includeUnlistedGenders,
        showAstrology: prefs.showAstrology,
        dealBreakers: dealBreakerListSchema.catch([]).parse(prefs.dealBreakers),
      },
      interests: user.interests.map(({ interest }) => ({
        id: interest.id,
        slug: interest.slug,
        label: interest.label,
        category: interest.category,
      })),
      onboardingMissing,
    };
  }

  async updateProfile(userId: string, status: string, update: ProfileUpdate): Promise<Me> {
    if (update.isDiscoverable !== undefined && status === 'ONBOARDING') {
      throw new ConflictException('Finish setting up your profile first.');
    }
    const existing = await this.prisma.userProfile.findUnique({ where: { userId } });
    // A self-description and chosen searches only exist alongside "Self-describe".
    const identity =
      update.genderIdentity !== undefined
        ? update.genderIdentity
        : (existing?.genderIdentity ?? null);
    if (identity !== 'SELF_DESCRIBE') {
      if (update.genderSelfDescription || (update.discoverableAs?.length ?? 0) > 0) {
        throw new UnprocessableEntityException({
          message: 'Some of the information provided is not valid.',
          details: [
            {
              path: 'genderIdentity',
              message: 'Choose “Self-describe” to describe your gender in your own words',
            },
          ],
        });
      }
      update = { ...update, genderSelfDescription: null, discoverableAs: [] };
    }
    if (existing) {
      await this.prisma.userProfile.update({ where: { userId }, data: update });
    } else {
      if (update.displayName === undefined) {
        throw new UnprocessableEntityException({
          message: 'Some of the information provided is not valid.',
          details: [{ path: 'displayName', message: 'Tell us what to call you' }],
        });
      }
      const { isDiscoverable: _ignored, ...fields } = update;
      await this.prisma.userProfile.create({
        data: { ...fields, displayName: update.displayName, userId },
      });
    }
    return this.get(userId);
  }

  async setRelationshipIntents(userId: string, update: IntentsUpdate): Promise<Me> {
    await this.prisma.$transaction([
      this.prisma.relationshipIntent.deleteMany({ where: { userId } }),
      this.prisma.relationshipIntent.createMany({
        data: update.intents.map((intent) => ({
          userId,
          kind: KIND_TO_DB[intent.kind],
          customLabel: intent.customLabel ?? null,
          isPrimary: intent.isPrimary,
        })),
      }),
    ]);
    return this.get(userId);
  }

  async setDiscoveryPreferences(userId: string, prefs: DiscoveryPreferences): Promise<Me> {
    await this.prisma.discoveryPreferences.upsert({
      where: { userId },
      create: { userId, ...prefs },
      update: prefs,
    });
    return this.get(userId);
  }

  async listInterests(): Promise<Interest[]> {
    return this.prisma.interest.findMany({
      select: { id: true, slug: true, label: true, category: true },
      orderBy: [{ category: 'asc' }, { label: 'asc' }],
    });
  }

  async setInterests(userId: string, interestIds: readonly string[]): Promise<Me> {
    const known = await this.prisma.interest.count({ where: { id: { in: [...interestIds] } } });
    if (known !== interestIds.length) {
      throw new UnprocessableEntityException({
        message: 'Some of the information provided is not valid.',
        details: [{ path: 'interestIds', message: 'Unknown interest' }],
      });
    }
    await this.prisma.$transaction([
      this.prisma.userInterest.deleteMany({ where: { userId } }),
      this.prisma.userInterest.createMany({
        data: interestIds.map((interestId) => ({ userId, interestId })),
      }),
    ]);
    return this.get(userId);
  }

  /** Moves an account from onboarding to active once the essentials exist. */
  async completeOnboarding(userId: string): Promise<Me> {
    const me = await this.get(userId);
    if (me.status !== 'ONBOARDING') return me;
    if (me.onboardingMissing.length > 0) {
      throw new ConflictException(`Still needed: ${me.onboardingMissing.join(', ')}.`);
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } }),
      this.prisma.userProfile.update({ where: { userId }, data: { isDiscoverable: true } }),
    ]);
    return this.get(userId);
  }

  /**
   * Deletes the account. Personal data is removed now; an anonymous tombstone row
   * stays so safety reports and moderation history about the account survive and
   * a banned person cannot erase their record by deleting and re-registering.
   */
  async deleteAccount(userId: string, requestId: string): Promise<void> {
    await this.auth.revokeAllSessions(userId);
    await this.photos.purge(userId);
    await this.prisma.$transaction([
      // Persona versions, evidence and embeddings cascade from the persona row.
      this.prisma.persona.deleteMany({ where: { userId } }),
      this.prisma.userProfile.deleteMany({ where: { userId } }),
      this.prisma.relationshipIntent.deleteMany({ where: { userId } }),
      this.prisma.discoveryPreferences.deleteMany({ where: { userId } }),
      this.prisma.userInterest.deleteMany({ where: { userId } }),
      this.prisma.userConsent.deleteMany({ where: { userId } }),
      this.prisma.authSession.deleteMany({ where: { userId } }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          email: null,
          phone: null,
          dateOfBirth: null,
          status: 'DELETED',
          deletedAt: new Date(),
        },
      }),
    ]);
    await this.audit.record({ action: 'account.deleted', actorId: userId, requestId });
  }
}
