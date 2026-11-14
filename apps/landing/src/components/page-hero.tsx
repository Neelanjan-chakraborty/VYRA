import Link from 'next/link';
import type { ReactNode } from 'react';
import { breadcrumbJsonLd, webPageJsonLd } from '@/lib/json-ld';
import type { PageDef } from '@/lib/routes';
import { JsonLd } from './json-ld';

interface Props {
  readonly page: PageDef;
  /** Issue-style number shown beside the breadcrumb, e.g. "02". */
  readonly index: string;
  readonly title: ReactNode;
  readonly lede: ReactNode;
  readonly children?: ReactNode;
  readonly theme?: 'theme-ink' | 'theme-ivory' | 'theme-oxblood';
}

/** The opening of every inner page: visible breadcrumb, the page's one H1, and its structured data. */
export function PageHero({ page, index, title, lede, children, theme = 'theme-ink' }: Props) {
  return (
    <section className={`${theme} relative overflow-hidden`}>
      <JsonLd data={webPageJsonLd(page)} />
      <JsonLd data={breadcrumbJsonLd(page)} />
      <div className="shell pb-16 pt-10 sm:pb-24 sm:pt-14">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <nav aria-label="Breadcrumb">
            <ol className="t-eyebrow flex items-center gap-3 text-muted">
              <li>
                <Link href="/" className="-my-3 inline-block py-3 hover:text-fg">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-fg">
                {page.label}
              </li>
            </ol>
          </nav>
          <p className="t-eyebrow text-muted" aria-hidden="true">
            N° {index}
          </p>
        </div>
        <div className="grid-12 mt-12 gap-y-10 sm:mt-20">
          <h1 className="t-display col-span-12 lg:col-span-10">{title}</h1>
          <div className="t-lede col-span-12 text-muted md:col-span-8 lg:col-span-6 lg:col-start-6">
            {lede}
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}
