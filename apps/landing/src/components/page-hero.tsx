import Link from 'next/link';
import type { ReactNode } from 'react';
import type { PhotoKey } from '@/content/photos';
import type { IconName } from '@/lib/icon-data';
import { breadcrumbJsonLd, imageObjectJsonLd, webPageJsonLd } from '@/lib/json-ld';
import type { PageDef } from '@/lib/routes';
import { Halftone, RegisterMark, RotatingBadge } from './art';
import { Medallion } from './icon';
import { JsonLd } from './json-ld';
import { StockPhoto } from './stock-photo';

interface Props {
  readonly page: PageDef;
  /** Issue-style number shown beside the breadcrumb, e.g. "02". */
  readonly index: string;
  readonly title: ReactNode;
  readonly lede: ReactNode;
  readonly children?: ReactNode;
  readonly theme?: 'theme-ink' | 'theme-ivory' | 'theme-oxblood';
  /** The photograph that leads the page. Stock, labelled as such, credited on /about. */
  readonly photo?: PhotoKey;
  readonly icon?: IconName;
}

/** The opening of every inner page: visible breadcrumb, the page's one H1, its lead picture and structured data. */
export function PageHero({
  page,
  index,
  title,
  lede,
  children,
  theme = 'theme-ink',
  photo,
  icon,
}: Props) {
  return (
    <section className={`${theme} relative overflow-hidden`}>
      <JsonLd data={webPageJsonLd(page, photo)} />
      <JsonLd data={breadcrumbJsonLd(page)} />
      {photo ? <JsonLd data={imageObjectJsonLd(photo, page.path)} /> : null}
      <Halftone
        className="-right-10 top-24 hidden h-72 w-96 text-accent opacity-40 lg:block"
        fade="right"
      />
      <div className="shell relative pb-16 pt-10 sm:pb-24 sm:pt-14">
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
          <div className="t-lede col-span-12 text-muted md:col-span-8 lg:col-span-6 lg:col-start-5">
            {lede}
          </div>
        </div>
        {children}
        {photo ? (
          <div className="relative mt-14 sm:mt-20">
            <StockPhoto
              photo={photo}
              eager
              sizes="(min-width: 1600px) 1500px, 94vw"
              frame="aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9] rounded-[var(--vyra-radius-s)]"
              tone="warm"
            />
            <RegisterMark className="absolute -left-2.5 -top-2.5 hidden sm:block" />
            <RegisterMark className="absolute -right-2.5 -top-2.5 hidden sm:block" />
            {icon ? (
              <Medallion
                name={icon}
                className="absolute bottom-[4.5rem] left-4 size-16 border-0 bg-cherry! text-ivory! shadow-xl sm:left-8 sm:size-20"
              />
            ) : null}
            <RotatingBadge className="absolute -top-10 right-3 size-24 sm:-top-14 sm:right-8 sm:size-32 lg:size-40" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
