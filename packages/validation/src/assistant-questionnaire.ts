import { z } from 'zod';
import { PERSONA_ATTRIBUTES, type PersonaAttributeKey, personaViewSchema } from './persona.js';

export const QUESTIONNAIRE_VERSION = '1';

export const ASSISTANT_IDS = [
  'chatgpt',
  'gemini',
  'claude',
  'deepseek',
  'copilot',
  'other',
] as const;
export const assistantIdSchema = z.enum(ASSISTANT_IDS);
export type AssistantId = z.infer<typeof assistantIdSchema>;

export interface AssistantInfo {
  readonly id: AssistantId;
  readonly name: string;
  /** The assistant's own site. Opened only when the person taps it. */
  readonly url: string | null;
  /** Whether it usually remembers past conversations, so its answers can be about you. */
  readonly remembers: boolean;
}

export const ASSISTANTS: readonly AssistantInfo[] = [
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com', remembers: true },
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com', remembers: true },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai', remembers: true },
  { id: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com', remembers: false },
  { id: 'copilot', name: 'Copilot', url: 'https://copilot.microsoft.com', remembers: false },
  { id: 'other', name: 'Another assistant', url: null, remembers: false },
];

/**
 * A link that opens the assistant with the questions already in the message
 * box, for the assistants that accept one. Neither OpenAI nor Google documents
 * the parameter, so callers also put the questions on the clipboard and say so.
 * Null for assistants with no such link.
 */
export function assistantPromptUrl(id: AssistantId, prompt: string): string | null {
  const text = encodeURIComponent(prompt);
  if (id === 'chatgpt') return `https://chatgpt.com/?q=${text}`;
  if (id === 'gemini') return `https://gemini.google.com/app?q=${text}`;
  return null;
}

export function assistantInfo(id: AssistantId): AssistantInfo {
  return ASSISTANTS.find((a) => a.id === id) ?? (ASSISTANTS.at(-1) as AssistantInfo);
}

/** Attributes the questionnaire asks about. Boundaries are only ever set by the person. */
export const QUESTIONNAIRE_ATTRIBUTES = (
  Object.keys(PERSONA_ATTRIBUTES) as PersonaAttributeKey[]
).filter((key) => {
  const definition = PERSONA_ATTRIBUTES[key];
  return !(definition.kind === 'list' && definition.userStatedOnly);
});

function questionFor(key: PersonaAttributeKey): string {
  const definition = PERSONA_ATTRIBUTES[key];
  switch (definition.kind) {
    case 'scale':
      return `${key} — ${definition.label}: a number 1–5, where 1 = "${definition.low}" and 5 = "${definition.high}".`;
    case 'enum':
      return `${key} — ${definition.label}: one of ${definition.options.map((o) => `"${o.value}" (${o.label.toLowerCase()})`).join(', ')}.`;
    case 'list':
      return `${key} — ${definition.label}: up to ${definition.max} of ${(definition.vocabulary ?? []).map((o) => `"${o.value}"`).join(', ')}.`;
  }
}

/**
 * The text the person copies into their own assistant. The reply must be a
 * single JSON block in a fixed shape, which VYRA parses as data — it is never
 * passed to a model on VYRA's side.
 */
export function buildQuestionnairePrompt(id: AssistantId): string {
  const assistant = assistantInfo(id);
  const basis = assistant.remembers
    ? 'Base your answers on what you remember about me from our past conversations and any saved memories.'
    : 'Base your answers only on what you actually know about me from this conversation history. If you know nothing about me, answer "unknown" for everything.';
  const example = Object.fromEntries(
    QUESTIONNAIRE_ATTRIBUTES.slice(0, 2).map((key) => [
      key,
      { value: '…', confidence: 'low | medium | high', why: 'one short sentence' },
    ]),
  );
  return [
    'I’m setting up a profile on VYRA, a dating app that suggests people based on compatibility. Please describe how I tend to think, communicate and live, so I can review it before anything is saved.',
    '',
    basis,
    '',
    'Rules:',
    '- Answer "unknown" for anything you are not reasonably sure about. A guess is worse than "unknown".',
    '- Describe tendencies in general terms. Do not quote our conversations.',
    '- Leave out names, places, employers, contact details, and anything about health, religion, caste, ethnicity, sexuality, politics or money.',
    '- "why" is one short sentence (under 25 words) explaining what your answer is based on.',
    '',
    'Questions:',
    ...QUESTIONNAIRE_ATTRIBUTES.map((key) => `- ${questionFor(key)}`),
    '',
    'Reply with exactly one JSON code block and nothing else, in this shape:',
    '```json',
    JSON.stringify(
      {
        vyra_questionnaire: QUESTIONNAIRE_VERSION,
        answers: { ...example, '…': 'one entry per question above' },
      },
      null,
      2,
    ),
    '```',
    'Use "unknown" as the value when you don’t know; include every question key.',
  ].join('\n');
}

export const QUESTIONNAIRE_REPLY_MAX_CHARS = 20_000;

export const assistantReflectionRequestSchema = z.object({
  assistant: assistantIdSchema,
  reply: z.string().min(1).max(QUESTIONNAIRE_REPLY_MAX_CHARS),
});
export type AssistantReflectionRequest = z.infer<typeof assistantReflectionRequestSchema>;

/** Outcome of reading a pasted reply: how many answers were usable. */
export const assistantReflectionResultSchema = z.object({
  accepted: z.array(z.string()),
  unknown: z.array(z.string()),
  rejected: z.array(z.string()),
});
export type AssistantReflectionResult = z.infer<typeof assistantReflectionResultSchema>;

export const assistantReflectionResponseSchema = z.object({
  result: assistantReflectionResultSchema,
  persona: personaViewSchema,
});
export type AssistantReflectionResponse = z.infer<typeof assistantReflectionResponseSchema>;
