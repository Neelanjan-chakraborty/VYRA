import { GoogleGenAI } from '@google/genai';
import {
  type AiProvider,
  EMBEDDING_DIMENSIONS,
  normalise,
  type PersonaSourceBundle,
} from './ai-provider.js';
import {
  buildPersonaUserPrompt,
  PERSONA_SYSTEM_INSTRUCTION,
  personaResponseJsonSchema,
} from './prompt.js';

export class AiProviderError extends Error {
  constructor(readonly code: 'provider_unavailable' | 'provider_bad_response') {
    super(code);
    this.name = 'AiProviderError';
  }
}

/**
 * Google Gemini adapter. Not verified against the live API in this repository
 * until a key is configured; see docs/IMPLEMENTATION_STATUS.md.
 */
export class GeminiAiProvider implements AiProvider {
  readonly id: string;
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
    private readonly embeddingModel: string,
  ) {
    this.client = new GoogleGenAI({ apiKey });
    this.id = `gemini:${model}`;
  }

  async draftPersona(bundle: PersonaSourceBundle): Promise<unknown> {
    let text: string | undefined;
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: buildPersonaUserPrompt(bundle),
        config: {
          systemInstruction: PERSONA_SYSTEM_INSTRUCTION,
          temperature: 0,
          responseMimeType: 'application/json',
          responseJsonSchema: personaResponseJsonSchema(),
        },
      });
      text = response.text;
    } catch {
      throw new AiProviderError('provider_unavailable');
    }
    if (!text) throw new AiProviderError('provider_bad_response');
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new AiProviderError('provider_bad_response');
    }
  }

  async embed(text: string): Promise<number[]> {
    let values: number[] | undefined;
    try {
      const response = await this.client.models.embedContent({
        model: this.embeddingModel,
        contents: text,
        config: { outputDimensionality: EMBEDDING_DIMENSIONS },
      });
      values = response.embeddings?.[0]?.values;
    } catch {
      throw new AiProviderError('provider_unavailable');
    }
    if (!values || values.length !== EMBEDDING_DIMENSIONS) {
      throw new AiProviderError('provider_bad_response');
    }
    // Truncated (Matryoshka) embeddings must be re-normalised.
    return normalise(values);
  }
}
