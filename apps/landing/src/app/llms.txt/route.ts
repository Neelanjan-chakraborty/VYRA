import { articles } from '@/content/learn';
import { entity } from '@/lib/entity';
import { indexableArticlePages, indexablePages, pages } from '@/lib/routes';
import { absoluteUrl, site } from '@/lib/site';

export const dynamic = 'force-static';

const link = (title: string, path: string, note: string) =>
  `- [${title}](${absoluteUrl(path)}): ${note}`;

/**
 * /llms.txt: a short, plain-text guide to this site for tools that read one.
 *
 * It is optional and experimental. Google states that it ignores such files and
 * no search or AI product requires one. It is generated from the same entity
 * definition and page registry as the site, so it cannot drift from it, and it
 * lists only public, indexable pages. Nothing private or unpublished appears.
 */
export function GET() {
  if (!site.indexable) return new Response('Not found', { status: 404 });

  const body = [
    `# ${entity.name}`,
    '',
    `> ${entity.description}`,
    '',
    entity.answer,
    '',
    `- Category: ${entity.category}`,
    `- Audience: ${entity.audience}`,
    `- Market: ${entity.market}`,
    `- Status: ${entity.status}`,
    `- ${entity.name} is not: ${entity.isNot.join('; ')}.`,
    '',
    '## Capabilities and their status',
    '',
    ...entity.capabilities.map((c) => `- ${c.name} (${c.status}): ${c.summary}`),
    '',
    '## Product pages',
    '',
    ...indexablePages
      .filter((page) => page.path !== pages.learn.path)
      .map((page) =>
        link(page.label === 'Home' ? 'VYRA home' : page.label, page.path, page.description),
      ),
    '',
    '## Learn',
    '',
    link(pages.learn.label, pages.learn.path, pages.learn.description),
    ...indexableArticlePages.map((page) => {
      const article = articles.find((a) => page.path.endsWith(a.slug));
      return link(page.label, page.path, article?.description ?? page.description);
    }),
    '',
    '## Policies',
    '',
    site.legalPublished
      ? [
          link('Privacy policy', '/privacy', pages.privacy.description),
          link('Terms of service', '/terms', pages.terms.description),
        ].join('\n')
      : '- The privacy policy and terms of service are working drafts and are not yet in force.',
    site.contactEmail
      ? `- Contact: ${site.contactEmail}`
      : '- No public contact address has been published yet.',
    '',
  ].join('\n');

  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
