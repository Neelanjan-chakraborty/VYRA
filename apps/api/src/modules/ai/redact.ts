const PATTERNS: readonly [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]'],
  [/https?:\/\/\S+|www\.\S+/gi, '[link]'],
  [/(?:sk|pk|ghp|xox[abp]|AIza)[-_A-Za-z0-9]{12,}/g, '[secret]'],
  [/\+?\d[\d\s().-]{7,}\d/g, '[number]'],
  [/(^|\s)@[A-Za-z0-9_.]{2,}/g, '$1[handle]'],
];

/**
 * Removes contact details, links, handles, long numbers and key-like strings
 * from text before it reaches a model or is stored as an evidence summary.
 */
export function redact(text: string): string {
  return PATTERNS.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    text,
  );
}

/** Words that mark a sentence as touching a sensitive trait VYRA must not infer or store. */
const SENSITIVE =
  /\b(relig\w*|hindu\w*|muslim\w*|islam\w*|christian\w*|sikh\w*|jain\w*|buddhis\w*|jewish|atheis\w*|caste\w*|brahmin\w*|dalit\w*|ethnic\w*|race|racial|skin colou?r|health\w*|illness|disease|diagnos\w*|disorder|depress\w*|anxiety|adhd|autis\w*|therap\w*|medicat\w*|pregnan\w*|disab\w*|sexual\w*|gay|lesbian|bisexual|queer|trans(gender)?|politic\w*|bjp|congress|left-wing|right-wing|salary|income|debt|loan|wealth\w*|rich|poor)\b/i;

export function containsSensitiveContent(text: string): boolean {
  return SENSITIVE.test(text);
}

/** A storable one-line summary: redacted, trimmed to `max`, or a fallback if sensitive. */
export function safeSummary(text: string, fallback: string, max = 200): string {
  const cleaned = redact(text).replaceAll(/\s+/g, ' ').trim();
  if (!cleaned || containsSensitiveContent(cleaned)) return fallback;
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}
