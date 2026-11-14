import { Global, Module } from '@nestjs/common';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { AI_PROVIDER } from './ai-provider.js';
import { GeminiAiProvider } from './gemini-ai-provider.js';
import { MockAiProvider } from './mock-ai-provider.js';

@Global()
@Module({
  providers: [
    {
      provide: AI_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.AI_PROVIDER === 'gemini' && env.GEMINI_API_KEY
          ? new GeminiAiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL, env.GEMINI_EMBEDDING_MODEL)
          : new MockAiProvider(),
    },
  ],
  exports: [AI_PROVIDER],
})
export class AiModule {}
