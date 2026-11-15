import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { ClosingCta } from '@/components/closing-cta';
import { PageHero } from '@/components/page-hero';
import { Reveal } from '@/components/reveal';
import { articles } from '@/content/learn';
import { pageMetadata, pages } from '@/lib/routes';

export const metadata: Metadata = pageMetadata('learn');

export default function LearnPage() {
  return (
    <>
      <PageHero
        page={pages.learn}
        photo="barLaugh"
        icon="chat"
        index="06"
        title={
          <>
            Straight answers about <em className="text-accent">how people fit.</em>
          </>
        }
        lede={
          <p>
            The VYRA Learn library answers common questions about relationship compatibility,
            personality, communication, AI in relationship discovery and online dating safety. Each
            article gives the answer first, cites the research it relies on, and says what is not
            known.
          </p>
        }
      />

      <section data-section="articles" className="theme-ivory">
        <div className="shell py-16 sm:py-24">
          <h2 className="sr-only">Articles</h2>
          <ol className="border-t border-line">
            {articles.map((article, index) => (
              <Reveal
                as="li"
                key={article.slug}
                distance={16}
                delay={0.03 * index}
                className="border-b border-line"
              >
                <article className="grid-12 items-baseline gap-y-3 py-8 sm:py-10">
                  <p className="t-eyebrow col-span-12 text-muted lg:col-span-2">
                    <span className="mr-3 text-accent" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {article.kicker}
                  </p>
                  <h3 className="t-headline col-span-12 lg:col-span-5">
                    <Link href={`/learn/${article.slug}` as Route} className="hover:text-accent">
                      {article.question}
                    </Link>
                  </h3>
                  <p className="col-span-12 text-muted lg:col-span-5">{article.answer}</p>
                </article>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section data-section="standards" className="theme-ink">
        <div className="shell py-20 sm:py-28">
          <p className="t-eyebrow flex items-center gap-4 border-t border-line pt-4 text-muted">
            <span className="text-accent">02</span>
            <span>How these are written</span>
          </p>
          <div className="grid-12 mt-10 gap-y-8 sm:mt-14">
            <h2 className="t-headline col-span-12 lg:col-span-5">
              No expert costume. <em className="text-accent">Just sources.</em>
            </h2>
            <div className="col-span-12 text-muted lg:col-span-6 lg:col-start-7 [&>p+p]:mt-4">
              <p>
                These articles are written by the VYRA team. They have not been reviewed by a
                psychologist or a lawyer, and they say so. Claims about research name the study and
                link to it, so that you can check the source and not take our word for it.
              </p>
              <p>
                Most relationship research comes from Western countries. Where a finding may not
                carry over to India, the article says that too. Nothing here reports data about
                VYRA’s own members, because VYRA has none yet.
              </p>
              <p>
                To see how these ideas are applied, read{' '}
                <Link href="/compatibility" className="prose-link text-fg">
                  how VYRA estimates compatibility
                </Link>{' '}
                and{' '}
                <Link href="/ai-persona" className="prose-link text-fg">
                  how the AI persona works
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      <ClosingCta
        location="learn_closing"
        photo="neonStreet"
        title={
          <>
            Know more.
            <br />
            <em>Guess less.</em>
          </>
        }
      />
    </>
  );
}
