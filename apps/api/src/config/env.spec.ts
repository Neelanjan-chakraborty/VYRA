import { EnvValidationError, parseEnv } from './env.js';

const valid = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  OTP_PEPPER: 'b'.repeat(32),
  MEDIA_URL_SECRET: 'c'.repeat(32),
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
    expect(() => parseEnv({ ...valid, DATABASE_URL: undefined })).toThrow(EnvValidationError);
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
      parseEnv({
        ...valid,
        DATABASE_URL: `mysql://user:${secret}@host/db`,
        JWT_ACCESS_SECRET: secret,
      });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });

  it('rejects short secrets', () => {
    expect(() => parseEnv({ ...valid, OTP_PEPPER: 'short' })).toThrow(/OTP_PEPPER/);
  });

  it('refuses development stand-ins in production', () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: 'production' })).toThrow(
      /OTP_DELIVERY[\s\S]*STORAGE_DRIVER/,
    );
  });

  it('needs a Gemini key only when Gemini is the provider', () => {
    expect(() => parseEnv({ ...valid, AI_PROVIDER: 'gemini' })).toThrow(/GEMINI_API_KEY/);
    expect(parseEnv({ ...valid, AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'k' }).GEMINI_MODEL).toBe(
      'gemini-3.8-flash',
    );
  });

  it('refuses the unimplemented openai provider', () => {
    expect(() => parseEnv({ ...valid, AI_PROVIDER: 'openai' })).toThrow(/not implemented/);
  });
});
