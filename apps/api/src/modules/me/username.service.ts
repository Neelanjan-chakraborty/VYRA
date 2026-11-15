import { ConflictException, Injectable } from '@nestjs/common';
import { type Me, normalizeUsername, type UsernameCheck, usernameProblem } from '@vyra/validation';
import { PrismaService } from '../../database/prisma.service.js';
import { MeService } from './me.service.js';
import { usernameChangeableAt } from './username-cooldown.js';

/** Prisma reports a violated unique index as P2002; the driver message names the index. */
function isUsernameTaken(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return code === 'P2002' || (typeof message === 'string' && message.includes('username_key'));
}

@Injectable()
export class UsernameService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly me: MeService,
  ) {}

  async check(userId: string, raw: string): Promise<UsernameCheck> {
    const username = normalizeUsername(raw);
    const problem = usernameProblem(username);
    if (problem) return { username, available: false, reason: problem };
    const owner = await this.prisma.userProfile.findFirst({
      where: { username },
      select: { userId: true },
    });
    if (owner && owner.userId !== userId)
      return { username, available: false, reason: 'Already taken' };
    return { username, available: true, reason: null };
  }

  async set(userId: string, username: string): Promise<Me> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { username: true, usernameChangedAt: true },
    });
    if (!profile) throw new ConflictException('Finish setting up your profile first.');
    if (profile.username === username) return this.me.get(userId);

    const wait = usernameChangeableAt(profile.usernameChangedAt, profile.username !== null);
    if (wait) {
      throw new ConflictException(
        `You can change your username again on ${wait.toISOString().slice(0, 10)}.`,
      );
    }
    try {
      await this.prisma.userProfile.update({
        where: { userId },
        data: { username, usernameChangedAt: new Date() },
      });
    } catch (error) {
      if (isUsernameTaken(error)) throw new ConflictException('That username is already taken.');
      throw error;
    }
    return this.me.get(userId);
  }
}
