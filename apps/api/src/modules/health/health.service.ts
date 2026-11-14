import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@vyra/validation';
import { PrismaService } from '../../database/prisma.service.js';
import { RedisService } from '../../redis/redis.service.js';

export const API_VERSION = process.env.npm_package_version ?? '0.1.0';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthResponse> {
    const [database, redis] = await Promise.all([this.prisma.isHealthy(), this.redis.isHealthy()]);
    return {
      status: database && redis ? 'ok' : 'degraded',
      version: API_VERSION,
      uptimeSeconds: Math.round(process.uptime()),
      checks: { database: database ? 'up' : 'down', redis: redis ? 'up' : 'down' },
    };
  }
}
