import {
  PERSONA_ATTRIBUTES,
  QUESTIONNAIRE_ATTRIBUTES,
  QUESTIONNAIRE_VERSION,
} from '@vyra/validation';
import { describe, expect, it } from 'vitest';
import { extractJsonBlock, parseAssistantReply, repairJson } from './questionnaire.parser.js';

const scaleKey = QUESTIONNAIRE_ATTRIBUTES.find((key) => PERSONA_ATTRIBUTES[key].kind === 'scale');
if (!scaleKey) throw new Error('the catalogue has no scale attribute to test with');

const reply = (
  answers: Record<string, unknown> = { [scaleKey]: { value: 4, confidence: 'high' } },
) => JSON.stringify({ vyra_questionnaire: QUESTIONNAIRE_VERSION, answers }, null, 2);

describe('reading a pasted assistant reply', () => {
  it('reads a plain JSON reply', () => {
    const parsed = parseAssistantReply(reply());
    expect(parsed).not.toHaveProperty('error');
    if ('error' in parsed) return;
    expect(parsed.answers.get(scaleKey)?.value).toBe(0.75);
  });

  it('finds the code block among chatty text, with or without a language tag', () => {
    for (const fence of ['```json', '```']) {
      const text = `Sure! Here are my answers:\n\n${fence}\n${reply()}\n\`\`\`\n\nHope that helps.`;
      expect(parseAssistantReply(text)).not.toHaveProperty('error');
    }
    expect(parseAssistantReply(`\`\`\`json${reply()}\`\`\``)).not.toHaveProperty('error');
  });

  it('reads JSON the way chat apps mangle it', () => {
    const curly = reply()
      .replace(/"/g, '“')
      .replace(/“(?=[^“”]*[:,\n}\]])/g, '"');
    const trailing = reply().replace(/\n\s*}\s*}\s*$/, '\n},\n}');
    const commented = `// the answers\n${reply().replace('"answers"', '/* here */ "answers"')}`;
    const invisible = reply().replace('"value"', '​"value" ');
    for (const text of [curly, trailing, commented, invisible]) {
      expect(parseAssistantReply(text), text).not.toHaveProperty('error');
    }
  });

  it('keeps quotes and slashes that are inside strings', () => {
    const text = reply({
      [scaleKey]: {
        value: 3,
        confidence: 'low',
        why: 'They said “always”, see http://x.test // ok',
      },
    });
    const parsed = parseAssistantReply(text);
    if ('error' in parsed) throw new Error(parsed.error);
    expect(parsed.answers.get(scaleKey)?.why).toContain('http://x.test // ok');
  });

  it('says when the reply stops before the answers are finished', () => {
    const half = reply().slice(0, Math.floor(reply().length / 2));
    expect(parseAssistantReply(half)).toEqual({ error: 'cut_off' });
    expect(parseAssistantReply(`\`\`\`json\n${half}`)).toEqual({ error: 'cut_off' });
  });

  it('points at the problem when the JSON is genuinely broken', () => {
    const broken = reply().replace('"confidence"', 'confidence:');
    const parsed = parseAssistantReply(broken);
    expect(parsed).toMatchObject({ error: 'invalid_json' });
    expect('near' in parsed && parsed.near).toContain('confidence');
  });

  it('tells apart no answers, the wrong format and an old questionnaire', () => {
    expect(parseAssistantReply('I could not do that.')).toEqual({ error: 'no_json' });
    expect(parseAssistantReply('{"hello": 1}')).toEqual({ error: 'wrong_shape' });
    expect(parseAssistantReply(JSON.stringify({ vyra_questionnaire: '0', answers: {} }))).toEqual({
      error: 'wrong_version',
    });
  });

  it('still treats "unknown" and bad values as not usable, never as answers', () => {
    const parsed = parseAssistantReply(reply({ [scaleKey]: { value: 'unknown' }, nonsense: 1 }));
    if ('error' in parsed) throw new Error(parsed.error);
    expect(parsed.answers.size).toBe(0);
    expect(parsed.unknown).toEqual([scaleKey]);
    expect(parsed.rejected).toEqual(['nonsense']);
  });
});

describe('extractJsonBlock and repairJson', () => {
  it('reports an object that never closes', () => {
    expect(extractJsonBlock('{"a": {"b": 1}')).toBe('unclosed');
    expect(extractJsonBlock('no braces')).toBeNull();
  });

  it('repairs only what is outside strings', () => {
    expect(repairJson('{"a": "x, ]",}')).toBe('{"a": "x, ]"}');
    expect(JSON.parse(repairJson('{“a”: 1,}'))).toEqual({ a: 1 });
  });
});
