import { type NextRequest, NextResponse } from 'next/server';

/**
 * Logs visits from known search and AI crawlers as one JSON line each, so they
 * can be counted in the host's logs (Vercel → Logs, or a log drain). Nothing
 * is logged for ordinary visitors, and nothing about the response is changed.
 *
 * A logged visit means a crawler fetched a page. It does not mean the page was
 * indexed, cited or recommended anywhere.
 *
 * User-agent strings can be forged. For anything that matters, confirm the
 * address against the operator's published IP ranges
 * (docs/seo/geo-implementation.md, "Monitoring").
 */
const CRAWLERS =
  /Googlebot|Bingbot|OAI-SearchBot|ChatGPT-User|GPTBot|PerplexityBot|Perplexity-User|Claude-SearchBot|Claude-User|ClaudeBot|CCBot|DuckDuckBot|Applebot|YandexBot/i;

export function proxy(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') ?? '';
  const match = CRAWLERS.exec(userAgent);
  if (match) {
    console.warn(
      JSON.stringify({
        event: 'crawler_visit',
        crawler: match[0],
        path: request.nextUrl.pathname,
        at: new Date().toISOString(),
      }),
    );
  }
  return NextResponse.next();
}

export const config = {
  // Pages and the crawl files only; never static assets or optimised images.
  matcher: ['/((?!_next/|.*\\.(?:png|jpg|jpeg|svg|ico|webp|avif|woff2|css|js|map)$).*)'],
};
