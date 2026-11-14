import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  // Previews and staging: keep every crawler out, and advertise no sitemap.
  if (!site.indexable) return { rules: [{ userAgent: '*', disallow: '/' }] };
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // No private routes are served from this site. `/api/` is reserved so that any
        // endpoint added later is not crawled by default. `/_next/` stays crawlable:
        // it holds the CSS, JavaScript and optimised images the pages need to render.
        disallow: ['/api/'],
      },
    ],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
