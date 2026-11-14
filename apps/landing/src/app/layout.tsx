import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Analytics } from '@/components/analytics';
import { JsonLd } from '@/components/json-ld';
import { MotionProvider } from '@/components/motion-provider';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { instrumentSerif, manrope } from '@/lib/fonts';
import { organizationJsonLd, websiteJsonLd } from '@/lib/json-ld';
import { pages } from '@/lib/routes';
import { defaultLocale, site } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: pages.home.title, template: `%s — ${site.name}` },
  description: site.description,
  applicationName: site.name,
  // Previews, staging and local builds are never indexable; pages can only tighten this.
  robots: site.indexable
    ? {
        index: true,
        follow: true,
        googleBot: { 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
      }
    : { index: false, follow: false },
  ...(site.googleSiteVerification ? { verification: { google: site.googleSiteVerification } } : {}),
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: '#100F13',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang={defaultLocale.code} className={`${instrumentSerif.variable} ${manrope.variable}`}>
      <body className="theme-ink grain">
        <a
          href="#main"
          className="btn btn-primary sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-3 focus-visible:top-3 focus-visible:z-[90]"
        >
          Skip to content
        </a>
        <noscript>
          {/* Without JavaScript nothing waits to be revealed. */}
          <style>{'[data-reveal]{opacity:1!important;transform:none!important}'}</style>
        </noscript>
        <MotionProvider>
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
        </MotionProvider>
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
        {site.gaMeasurementId ? <Analytics measurementId={site.gaMeasurementId} /> : null}
      </body>
    </html>
  );
}
