import { healthResponseSchema } from '@vyra/validation';
import type { PrismaService } from '../../database/prisma.service.js';
import type { RedisService } from '../../redis/redis.service.js';
import { HealthService } from './health.service.js';

function build(database: boolean, redis: boolean): HealthService {
  return new HealthService(
    { isHealthy: async () => database } as PrismaService,
    { isHealthy: async () => redis } as RedisService,
  );
}

describe('HealthService', () => {
  it('reports ok when every dependency is up', async () => {
    const result = await build(true, true).check();
    expect(healthResponseSchema.parse(result)).toMatchObject({
      status: 'ok',
      checks: { database: 'up', redis: 'up' },
    });
  });

  it.each([
    [false, true, { database: 'down', redis: 'up' }],
    [true, false, { database: 'up', redis: 'down' }],
    [false, false, { database: 'down', redis: 'down' }],
  ])('reports degraded when database=%s redis=%s', async (database, redis, checks) => {
    const result = await build(database, redis).check();
    expect(result.status).toBe('degraded');
    expect(result.checks).toEqual(checks);
  });
});
