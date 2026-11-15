import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Halftone, RegisterMark, RotatingBadge } from '@/components/art';
import { ClosingCta } from '@/components/closing-cta';
import { JsonLd } from '@/components/json-ld';
import { StockPhoto } from '@/components/stock-photo';
import { articlePhoto, type PhotoKey } from '@/content/photos';
import { type Block, articles, getArticle } from '@/content/learn';
import { articleJsonLd, breadcrumbTrailJsonLd, imageObjectJsonLd } from '@/lib/json-ld';
import { articlePages, metadataFor, pages } from '@/lib/routes';

// Only the articles that exist are pages; any other slug is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

interface Props {
  readonly params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = articlePages.find((candidate) => candidate.path === `/learn/${slug}`);
  if (!page) return {};
  return metadataFor(page, getArticle(slug));
}

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));

function renderBlock(block: Block, key: number) {
  if ('p' in block) return <p key={key}>{block.p}</p>;
  if ('list' in block)
    return (
      <ul key={key} className="border-t border-line">
        {block.list.map((item) => (
          <li key={item} className="border-b border-line py-3">
            {item}
          </li>
        ))}
      </ul>
    );
  if ('example' in block)
    return (
      <figure key={key} className="border-l-2 border-accent bg-paper/60 p-6 sm:p-8">
        <figcaption className="t-eyebrow text-accent">Example · {block.example.title}</figcaption>
        <p className="mt-3">{block.example.text}</p>
      </figure>
    );
  return (
    <div key={key} className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[30rem] border-t border-line text-left">
        <thead className="t-eyebrow text-muted">
          <tr className="border-b border-line">
            {block.table.head.map((cell) => (
              <th key={cell} scope="col" className="py-3 pr-5 font-semibold">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.table.rows.map((row) => (
            <tr key={row[0]} className="border-b border-line align-top">
              {row.map((cell, index) =>
                index === 0 ? (
                  <th key={cell} scope="row" className="py-3 pr-5 font-semibold">
                    {cell}
                  </th>
                ) : (
                  <td key={cell} className="py-3 pr-5 text-muted">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The photograph that closes each article: never the one that opens it. */
const closingPhoto = {
  'relationship-compatibility': 'walkingCouple',
  'personality-and-relationships': 'restaurantPhone',
  'communication-styles': 'dessert',
  'ai-in-relationship-discovery': 'neonStreet',
  'dating-beyond-swiping': 'pizzaFriends',
  'online-dating-safety': 'selfieNight',
} as const satisfies Record<keyof typeof articlePhoto, PhotoKey>;

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();
  const path = `/learn/${article.slug}`;
  const photo = articlePhoto[article.slug as keyof typeof articlePhoto];
  const closing = closingPhoto[article.slug as keyof typeof closingPhoto];

  return (
    <>
      <JsonLd
        data={articleJsonLd({
          path,
          photo,
          headline: article.question,
          description: article.description,
          datePublished: article.published,
          dateModified: article.updated,
          citations: article.references.map((reference) => reference.url),
        })}
      />
      <JsonLd data={imageObjectJsonLd(photo, path)} />
      <JsonLd
        data={breadcrumbTrailJsonLd([
          { name: pages.home.label, path: '/' },
          { name: pages.learn.label, path: pages.learn.path },
          { name: article.question, path },
        ])}
      />

      <article>
        <header className="theme-ink relative overflow-hidden">
          <Halftone
            className="-right-10 top-24 hidden h-72 w-96 text-accent opacity-40 lg:block"
            fade="right"
          />
          <div className="shell relative pb-14 pt-10 sm:pb-20 sm:pt-14">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <nav aria-label="Breadcrumb">
                <ol className="t-eyebrow flex flex-wrap items-center gap-3 text-muted">
                  <li>
                    <Link href="/" className="-my-3 inline-block py-3 hover:text-fg">
                      Home
                    </Link>
                  </li>
                  <li aria-hidden="true">/</li>
                  <li>
                    <Link href="/learn" className="-my-3 inline-block py-3 hover:text-fg">
                      Learn
                    </Link>
                  </li>
                  <li aria-hidden="true">/</li>
                  <li aria-current="page" className="text-fg">
                    {article.kicker}
                  </li>
                </ol>
              </nav>
            </div>
            <h1 className="t-display mt-12 max-w-[16ch] sm:mt-16">{article.question}</h1>
            <div className="grid-12 mt-10 gap-y-8 sm:mt-14">
              <div className="col-span-12 lg:col-span-8">
                <p className="t-eyebrow text-accent">The short answer</p>
                <p className="t-title mt-4">{article.answer}</p>
              </div>
              <dl className="t-small col-span-12 grid grid-cols-[auto_1fr] content-start gap-x-6 gap-y-1 text-muted lg:col-span-3 lg:col-start-10">
                <dt>Written by</dt>
                <dd className="text-fg">The VYRA team</dd>
                <dt>Published</dt>
                <dd className="text-fg">
                  <time dateTime={article.published}>{formatDate(article.published)}</time>
                </dd>
                <dt>Updated</dt>
                <dd className="text-fg">
                  <time dateTime={article.updated}>{formatDate(article.updated)}</time>
                </dd>
                <dt>Review</dt>
                <dd className="text-fg">Not reviewed by a clinician or lawyer</dd>
              </dl>
            </div>
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
              <RotatingBadge className="absolute -top-10 right-3 size-24 sm:-top-14 sm:right-8 sm:size-32" />
            </div>
          </div>
        </header>

        <div className="theme-ivory">
          <div className="shell py-16 sm:py-24">
            <div className="grid-12 gap-y-12">
              <nav aria-label="On this page" className="col-span-12 lg:col-span-3">
                <div className="lg:sticky lg:top-24">
                  <h2 className="t-eyebrow text-muted">On this page</h2>
                  <ol className="mt-4 border-t border-line">
                    {[
                      ...article.sections.map((s) => s.heading),
                      article.vyra.heading,
                      'Questions people also ask',
                      'References',
                    ].map((heading, index) => (
                      <li key={heading} className="border-b border-line">
                        <a
                          href={`#s${index + 1}`}
                          className="t-small flex min-h-11 items-center hover:text-accent"
                        >
                          {heading}
                        </a>
                      </li>
                    ))}
                  </ol>
                </div>
              </nav>

              <div className="col-span-12 lg:col-span-8 lg:col-start-5">
                {article.sections.map((section, index) => (
                  <section
                    key={section.heading}
                    id={`s${index + 1}`}
                    className="mb-14 scroll-mt-24"
                  >
                    <h2 className="t-headline">{section.heading}</h2>
                    <div className="t-lede mt-6 flex flex-col gap-5">
                      {section.blocks.map((block, blockIndex) => renderBlock(block, blockIndex))}
                    </div>
                  </section>
                ))}

                <section
                  id={`s${article.sections.length + 1}`}
                  className="theme-oxblood mb-14 scroll-mt-24 p-7 sm:p-10"
                >
                  <p className="t-eyebrow text-muted">About VYRA</p>
                  <h2 className="t-headline mt-3">{article.vyra.heading}</h2>
                  <div className="t-lede mt-6 flex flex-col gap-5 text-muted">
                    {article.vyra.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                  <ul className="mt-8 flex flex-col gap-1">
                    {article.productLinks.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href as Route} className="arrow-link">
                          {link.label}{' '}
                          <span className="arrow" aria-hidden="true">
                            →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>

                <section id={`s${article.sections.length + 2}`} className="mb-14 scroll-mt-24">
                  <h2 className="t-headline">Questions people also ask</h2>
                  <dl className="mt-6 border-t border-line">
                    {article.faq.map((item) => (
                      <div key={item.q} className="border-b border-line py-6">
                        <dt className="t-title">{item.q}</dt>
                        <dd className="t-lede mt-3 text-muted">{item.a}</dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <section id={`s${article.sections.length + 3}`} className="scroll-mt-24">
                  <h2 className="t-headline">References</h2>
                  <ol data-references="" className="mt-6 border-t border-line">
                    {article.references.map((reference) => (
                      <li key={reference.id} className="border-b border-line py-4">
                        <p>{reference.citation}</p>
                        <a
                          href={reference.url}
                          rel="noopener external"
                          className="prose-link t-small mt-1 inline-block break-all"
                        >
                          {reference.url}
                        </a>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
            </div>
          </div>
        </div>
      </article>

      <aside aria-label="Related articles" className="theme-ink">
        <div className="shell py-16 sm:py-24">
          <h2 className="t-eyebrow border-t border-line pt-4 text-muted">Keep reading</h2>
          <ul className="mt-8 grid gap-x-[clamp(1.5rem,3vw,3.5rem)] md:grid-cols-3">
            {article.related.map((relatedSlug) => {
              const related = getArticle(relatedSlug);
              if (!related) return null;
              return (
                <li key={related.slug} className="border-t border-line py-6">
                  <p className="t-eyebrow text-accent">{related.kicker}</p>
                  <Link
                    href={`/learn/${related.slug}` as Route}
                    className="t-title mt-3 block hover:text-accent"
                  >
                    {related.question}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      <ClosingCta
        location={`learn_${article.slug}_closing`}
        photo={closing}
        title={
          <>
            Fewer guesses.
            <br />
            <em>Better questions.</em>
          </>
        }
      />
    </>
  );
}
