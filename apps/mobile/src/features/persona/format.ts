import {
  PERSONA_ATTRIBUTES,
  type PersonaAttributeKey,
  type PersonaAttributeValue,
} from '@vyra/validation';

/** Plain-language reading of a stored value. */
export function describeValue(key: PersonaAttributeKey, value: PersonaAttributeValue): string {
  const definition = PERSONA_ATTRIBUTES[key];
  if (definition.kind === 'scale' && typeof value === 'number') {
    if (value <= 0.12) return definition.low;
    if (value < 0.38) return `Leans towards “${definition.low.toLowerCase()}”`;
    if (value < 0.63) return 'Somewhere in between';
    if (value < 0.88) return `Leans towards “${definition.high.toLowerCase()}”`;
    return definition.high;
  }
  if (definition.kind === 'enum' && typeof value === 'string') {
    return definition.options.find((o) => o.value === value)?.label ?? value;
  }
  if (Array.isArray(value)) {
    const labels =
      definition.kind === 'list' && definition.vocabulary ? definition.vocabulary : null;
    return value.map((v) => labels?.find((o) => o.value === v)?.label ?? v).join(', ');
  }
  return String(value);
}

export function confidenceLabel(confidence: number): 'Low' | 'Medium' | 'High' {
  if (confidence >= 0.75) return 'High';
  if (confidence >= 0.4) return 'Medium';
  return 'Low';
}

const SOURCE_LABELS: Record<string, string> = {
  PROFILE: 'your profile',
  INTEREST_SELECTION: 'your interests',
  USER_CORRECTION: 'you',
  ASSISTANT_REFLECTION: 'your assistant',
  CHATGPT_IMPORT: 'your ChatGPT export',
  GEMINI_IMPORT: 'your Gemini export',
  PHOTO: 'your photos',
  INTEGRATION: 'a connected service',
};

const ASSISTANT_NAMES: Record<string, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
  deepseek: 'DeepSeek',
  copilot: 'Copilot',
  other: 'your assistant',
};

export function sourceLabel(sourceType: string, sourceDetail: string | null): string {
  if (sourceType === 'ASSISTANT_REFLECTION' && sourceDetail)
    return ASSISTANT_NAMES[sourceDetail] ?? 'your assistant';
  return SOURCE_LABELS[sourceType] ?? 'VYRA';
}

export const FAILURE_MESSAGES: Record<string, string> = {
  nothing_to_read:
    'There isn’t enough in your profile yet. Add a few lines about you or some interests, then try again.',
  provider_unavailable: 'Our AI service didn’t respond. Try again in a few minutes.',
  provider_bad_response: 'We couldn’t make sense of the result this time. Try again.',
  provider_error: 'Something went wrong while preparing your persona. Try again.',
};
