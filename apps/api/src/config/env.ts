import { z } from 'zod';

const csv = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

const secret = z.string().min(32, 'must be at least 32 characters');

/**
 * Every environment variable the API reads. The process refuses to start when
 * any value is missing or malformed, so misconfiguration fails fast and loudly.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z
      .url()
      .refine((value) => /^postgres(ql)?:\/\//.test(value), 'must be a postgresql:// URL'),
    REDIS_URL: z.url().refine((value) => /^rediss?:\/\//.test(value), 'must be a redis:// URL'),
    AI_PROVIDER: z.enum(['mock', 'openai', 'gemini']).default('mock'),
    CORS_ORIGINS: csv,
    LOG_LEVEL: z.enum(['error', 'warn', 'log', 'debug', 'verbose']).default('log'),

    /** Signs access and registration tokens (HS256). */
    JWT_ACCESS_SECRET: secret,
    /** Keys the HMACs of OTP codes and destinations. */
    OTP_PEPPER: secret,
    /** Signs short-lived media URLs. */
    MEDIA_URL_SECRET: secret,
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    /** "dev" returns the code in the API response and sends nothing. */
    OTP_DELIVERY: z.enum(['dev']).default('dev'),
    /** "local" writes to STORAGE_LOCAL_DIR on this machine's disk. */
    STORAGE_DRIVER: z.enum(['local']).default('local'),
    STORAGE_LOCAL_DIR: z.string().min(1).default('./.storage'),
    /** Public origin of this API, used to build media URLs. */
    PUBLIC_API_URL: z.url().default('http://localhost:4000'),

    /** Required only when AI_PROVIDER=gemini. */
    GEMINI_API_KEY: z.string().min(1).optional(),
    GEMINI_MODEL: z.string().min(1).default('gemini-3.8-flash'),
    GEMINI_EMBEDDING_MODEL: z.string().min(1).default('gemini-embedding-001'),
    /** "false" stops this process running queue workers (see src/worker.ts). */
    RUN_QUEUE_WORKERS: z.enum(['true', 'false']).default('true'),
    /** nsfwjs = open-source classifier (default); manual = every photo to a person; mock = tests only. */
    PHOTO_MODERATION_PROVIDER: z.enum(['nsfwjs', 'manual', 'mock']).default('nsfwjs'),
  })
  .superRefine((env, ctx) => {
    if (env.AI_PROVIDER === 'gemini' && !env.GEMINI_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['GEMINI_API_KEY'],
        message: 'required when AI_PROVIDER=gemini',
      });
    }
    if (env.AI_PROVIDER === 'openai') {
      ctx.addIssue({
        code: 'custom',
        path: ['AI_PROVIDER'],
        message: 'the openai provider is not implemented yet',
      });
    }
    if (env.NODE_ENV !== 'production') return;
    // Development stand-ins must never run in production. Until real SMS/e-mail
    // and object-storage adapters exist, a production boot fails here on purpose.
    if (env.OTP_DELIVERY === 'dev') {
      ctx.addIssue({
        code: 'custom',
        path: ['OTP_DELIVERY'],
        message: 'the dev sender is not allowed in production',
      });
    }
    if (env.PHOTO_MODERATION_PROVIDER === 'mock') {
      ctx.addIssue({
        code: 'custom',
        path: ['PHOTO_MODERATION_PROVIDER'],
        message: 'the mock moderation provider is not allowed in production',
      });
    }
    if (env.STORAGE_DRIVER === 'local') {
      ctx.addIssue({
        code: 'custom',
        path: ['STORAGE_DRIVER'],
        message: 'local disk storage is not allowed in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    // Only variable names and reasons are reported — never the values.
    super(`Invalid environment configuration:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    );
  }
  return result.data;
}
