import type { MetadataRoute } from 'next';
import { indexablePages } from '@/lib/routes';
import { absoluteUrl, locales, site } from '@/lib/site';

/**
 * Canonical, indexable pages only, read from the same registry as the page
 * metadata. Drafts, redirects and anything marked noindex never appear. A
 * non-production deployment publishes an empty sitemap.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!site.indexable) return [];
  return indexablePages.map((page) => ({
    url: absoluteUrl(page.path),
    lastModified: page.updated,
    alternates: {
      languages: Object.fromEntries(
        locales.map((locale) => [locale.code, absoluteUrl(`${locale.pathPrefix}${page.path}`)]),
      ),
    },
  }));
}
