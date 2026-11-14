/**
 * The crawlers this site has a deliberate policy for. Tokens and purposes are
 * taken from each operator's own documentation (links in
 * docs/seo/geo-implementation.md), checked on 14 November 2026.
 *
 * Three kinds, which are not interchangeable:
 * - search:   builds a search index or answers with links back to the source.
 * - user:     fetches one page because a person asked an assistant to read it.
 * - training: collects text that may be used to train AI models.
 */
export type CrawlerKind = 'search' | 'user' | 'training';

export const crawlers = [
  { token: 'Googlebot', operator: 'Google', kind: 'search' },
  { token: 'Bingbot', operator: 'Microsoft', kind: 'search' },
  { token: 'OAI-SearchBot', operator: 'OpenAI', kind: 'search' },
  { token: 'PerplexityBot', operator: 'Perplexity', kind: 'search' },
  { token: 'Claude-SearchBot', operator: 'Anthropic', kind: 'search' },
  { token: 'ChatGPT-User', operator: 'OpenAI', kind: 'user' },
  { token: 'Perplexity-User', operator: 'Perplexity', kind: 'user' },
  { token: 'Claude-User', operator: 'Anthropic', kind: 'user' },
  { token: 'GPTBot', operator: 'OpenAI', kind: 'training' },
  { token: 'ClaudeBot', operator: 'Anthropic', kind: 'training' },
  // A control token, not a crawler: governs Gemini training and grounding in the Gemini app.
  // It has no effect on Google Search, AI Overviews or AI Mode.
  { token: 'Google-Extended', operator: 'Google', kind: 'training' },
  { token: 'CCBot', operator: 'Common Crawl', kind: 'training' },
] as const satisfies readonly { token: string; operator: string; kind: CrawlerKind }[];

/** Paths no crawler should fetch. Nothing private is served here; this keeps it that way. */
export const disallowedPaths = ['/api/'] as const;
