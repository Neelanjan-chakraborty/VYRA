import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { apiErrorSchema, healthResponseSchema } from '@vyra/validation';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { ENV } from '../src/config/config.module.js';
import type { Env } from '../src/config/env.js';
import { configureApp } from '../src/configure-app.js';
import { RedisService } from '../src/redis/redis.service.js';

describe('API foundation (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, app.get<Env>(ENV));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/health/live responds without touching dependencies', async () => {
    const response = await request(app.getHttpServer()).get('/v1/health/live').expect(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('GET /v1/health reports PostgreSQL and Redis as up', async () => {
    const response = await request(app.getHttpServer()).get('/v1/health').expect(200);
    expect(healthResponseSchema.parse(response.body)).toMatchObject({
      status: 'ok',
      checks: { database: 'up', redis: 'up' },
    });
  });

  it('GET /v1/health returns 503 when a dependency is down', async () => {
    const redis = app.get(RedisService);
    const spy = vi.spyOn(redis, 'isHealthy').mockResolvedValue(false);
    const response = await request(app.getHttpServer()).get('/v1/health').expect(503);
    expect(response.body.checks.redis).toBe('down');
    spy.mockRestore();
  });

  it('unversioned and unknown routes return the error envelope', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(404);
    const body = apiErrorSchema.parse(response.body);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(response.headers['x-request-id']).toBe(body.error.requestId);
  });

  it('echoes a well-formed request id and replaces a malformed one', async () => {
    const good = await request(app.getHttpServer())
      .get('/v1/health/live')
      .set('x-request-id', 'client-req-12345');
    expect(good.headers['x-request-id']).toBe('client-req-12345');

    const bad = await request(app.getHttpServer())
      .get('/v1/health/live')
      .set('x-request-id', 'bad id\twith spaces');
    expect(bad.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sets security headers and does not advertise the framework', async () => {
    const response = await request(app.getHttpServer()).get('/v1/health/live');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('the schema is migrated: weight set seeded, embeddings table indexed', async () => {
    const { PrismaService } = await import('../src/database/prisma.service.js');
    const prisma = app.get(PrismaService);
    const active = await prisma.compatibilityWeightSet.findMany({ where: { isActive: true } });
    expect(active).toHaveLength(1);
    const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'vyra_vector'`;
    expect(indexes.map((i) => i.indexname)).toContain('persona_embeddings_embedding_hnsw_idx');
  });
});
