import { EnvValidationError, parseEnv } from './env.js';

const valid = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
};

describe('parseEnv', () => {
  it('applies defaults', () => {
    const env = parseEnv(valid);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4000,
      AI_PROVIDER: 'mock',
      CORS_ORIGINS: [],
      LOG_LEVEL: 'log',
    });
  });

  it('coerces the port and splits CORS origins', () => {
    const env = parseEnv({
      ...valid,
      PORT: '8080',
      CORS_ORIGINS: 'https://a.test, https://b.test,',
    });
    expect(env.PORT).toBe(8080);
    expect(env.CORS_ORIGINS).toEqual(['https://a.test', 'https://b.test']);
  });

  it('rejects a missing database URL', () => {
    expect(() => parseEnv({ REDIS_URL: valid.REDIS_URL })).toThrow(EnvValidationError);
  });

  it('rejects a non-PostgreSQL database URL', () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL: must be a postgresql/,
    );
  });

  it('rejects an unknown AI provider', () => {
    expect(() => parseEnv({ ...valid, AI_PROVIDER: 'skynet' })).toThrow(/AI_PROVIDER/);
  });

  it('never echoes secret values in the error', () => {
    const secret = 'sup3r-s3cret';
    try {
      parseEnv({ DATABASE_URL: `mysql://user:${secret}@host/db`, REDIS_URL: valid.REDIS_URL });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
