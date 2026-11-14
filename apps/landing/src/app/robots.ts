import type { MetadataRoute } from 'next';
import { crawlers, disallowedPaths } from '@/lib/crawlers';
import { site } from '@/lib/site';

const named = (kind: string) =>
  crawlers.filter((crawler) => crawler.kind === kind).map((crawler) => crawler.token);

/**
 * Crawler policy, stated per crawler so that nothing is decided by accident.
 *
 * - Search crawlers (Google, Bing, OpenAI's OAI-SearchBot, PerplexityBot,
 *   Claude-SearchBot) and user-requested fetchers may read every public page.
 * - Training crawlers (GPTBot, ClaudeBot, Google-Extended, CCBot) follow
 *   VYRA_AI_TRAINING_CRAWLERS. It is a product-owner decision with a real
 *   trade-off (docs/seo/geo-implementation.md, "Training crawlers"). Until one
 *   is recorded they are not named, and the general rule applies to them.
 * - `/_next/` is never disallowed: it holds the CSS, JavaScript and images the
 *   pages need in order to render.
 */
export default function robots(): MetadataRoute.Robots {
  // Previews and staging: keep every crawler out, and advertise no sitemap.
  if (!site.indexable) return { rules: [{ userAgent: '*', disallow: '/' }] };

  const open = { allow: '/', disallow: [...disallowedPaths] };

  const rules: MetadataRoute.Robots['rules'] = [
    { userAgent: '*', ...open },
    // A crawler with its own group ignores the `*` group, so each group repeats the rule.
    { userAgent: named('search'), ...open },
    { userAgent: named('user'), ...open },
  ];
  if (site.aiTrainingCrawlers === 'allow') rules.push({ userAgent: named('training'), ...open });
  if (site.aiTrainingCrawlers === 'disallow')
    rules.push({ userAgent: named('training'), disallow: '/' });

  return { rules, sitemap: `${site.url}/sitemap.xml` };
}
