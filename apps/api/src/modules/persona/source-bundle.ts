import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { PersonaSourceBundle, SourceItem } from '../ai/ai-provider.js';
import { redact } from '../ai/redact.js';

const INTENT_LABELS: Readonly<Record<string, string>> = {
  SERIOUS: 'Looking for something serious',
  CASUAL: 'Looking for something casual',
  EXPLORING: 'Still working out what they want',
  COMPANIONSHIP: 'Looking for companionship',
};

/**
 * Collects only what the person wrote or chose themselves. Name, city, age,
 * gender and photos are deliberately left out: they are not needed to
 * describe tendencies and would invite stereotyping.
 */
@Injectable()
export class SourceBundleService {
  constructor(private readonly prisma: PrismaService) {}

  async build(userId: string): Promise<PersonaSourceBundle> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: { select: { bio: true, occupation: true } },
        interests: { include: { interest: true }, orderBy: { createdAt: 'asc' } },
        relationshipIntents: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!user) return { items: [] };

    const items: SourceItem[] = [];
    if (user.profile?.bio)
      items.push({
        ref: 'profile.bio',
        kind: 'profile',
        label: 'Bio',
        text: redact(user.profile.bio),
      });
    if (user.profile?.occupation) {
      items.push({
        ref: 'profile.occupation',
        kind: 'profile',
        label: 'Occupation',
        text: redact(user.profile.occupation),
      });
    }
    for (const { interest } of user.interests) {
      items.push({
        ref: `interest.${interest.slug}`,
        kind: 'interest',
        label: interest.label,
        text: interest.label,
      });
    }
    for (const intent of user.relationshipIntents) {
      const text =
        intent.kind === 'OTHER'
          ? redact(intent.customLabel ?? '')
          : (INTENT_LABELS[intent.kind] ?? '');
      if (text)
        items.push({
          ref: `intent.${intent.kind.toLowerCase()}`,
          kind: 'intent',
          label: 'Intention',
          text,
        });
    }
    return { items };
  }
}
