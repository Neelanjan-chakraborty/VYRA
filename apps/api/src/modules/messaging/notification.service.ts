import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { PUSH_PROVIDER, type PushProvider } from './push-provider.js';
import { RealtimeService } from './realtime.service.js';

export type NotificationKind = 'message' | 'request' | 'connected';

export interface Notification {
  readonly kind: NotificationKind;
  readonly fromUserId: string;
  readonly conversationId?: string;
}

const TEXT: Readonly<Record<NotificationKind, (name: string) => string>> = {
  message: (name) => `New message from ${name}`,
  request: (name) => `${name} asked to connect`,
  connected: (name) => `You and ${name} are connected`,
};

/**
 * Push notifications. Says who, never what: message text, notes and photos
 * never leave in a notification. Nothing is sent while the person has the
 * app open, when they turned that kind off, or across a block.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    @Inject(PUSH_PROVIDER) private readonly provider: PushProvider,
  ) {}

  async notify(userId: string, notification: Notification): Promise<void> {
    try {
      const [recipient, sender, blocks] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            status: true,
            profile: { select: { notifyMessages: true, notifyRequests: true } },
            pushDevices: { select: { token: true } },
          },
        }),
        this.prisma.userProfile.findUnique({
          where: { userId: notification.fromUserId },
          select: { displayName: true },
        }),
        this.prisma.blockedUser.count({
          where: {
            OR: [
              { blockerId: userId, blockedId: notification.fromUserId },
              { blockerId: notification.fromUserId, blockedId: userId },
            ],
          },
        }),
      ]);
      if (!recipient || recipient.status !== 'ACTIVE' || blocks > 0) return;
      const wanted =
        notification.kind === 'message'
          ? recipient.profile?.notifyMessages
          : recipient.profile?.notifyRequests;
      if (!wanted || recipient.pushDevices.length === 0) return;
      if (await this.realtime.isOnline(userId)) return;

      const body = TEXT[notification.kind](sender?.displayName || 'Someone');
      const result = await this.provider.send(
        recipient.pushDevices.map(({ token }) => ({
          token,
          title: 'VYRA',
          body,
          data: {
            kind: notification.kind,
            ...(notification.conversationId ? { conversationId: notification.conversationId } : {}),
          },
        })),
      );
      if (result.invalidTokens.length > 0)
        await this.prisma.pushDevice.deleteMany({
          where: { token: { in: [...result.invalidTokens] } },
        });
    } catch (error) {
      // A notification failure never fails the action that caused it.
      this.logger.warn(`Notification not sent: ${(error as Error).name}`);
    }
  }

  async registerDevice(userId: string, token: string, platform: 'ios' | 'android' | 'web') {
    const value = { IOS: 'IOS', ANDROID: 'ANDROID', WEB: 'WEB' } as const;
    const plat = value[platform.toUpperCase() as keyof typeof value];
    // A token belongs to whoever is signed in on that device now.
    await this.prisma.pushDevice.upsert({
      where: { token },
      create: { userId, token, platform: plat },
      update: { userId, platform: plat, lastSeenAt: new Date() },
    });
  }

  async forgetDevice(userId: string, token: string): Promise<void> {
    await this.prisma.pushDevice.deleteMany({ where: { userId, token } });
  }
}
