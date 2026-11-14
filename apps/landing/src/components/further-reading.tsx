import type { Route } from 'next';
import Link from 'next/link';
import { getArticle } from '@/content/learn';

/** Links from a product page to the Learn articles that explain the ideas behind it. */
export function FurtherReading({
  slugs,
  theme = 'theme-ink',
}: {
  readonly slugs: readonly string[];
  readonly theme?: 'theme-ink' | 'theme-ivory';
}) {
  return (
    <aside aria-label="Further reading" data-section="further-reading" className={theme}>
      <div className="shell py-16 sm:py-24">
        <h2 className="t-eyebrow flex items-center justify-between border-t border-line pt-4 text-muted">
          <span>From the Learn library</span>
          <Link href="/learn" className="-my-3 py-3 hover:text-fg">
            All articles <span aria-hidden="true">→</span>
          </Link>
        </h2>
        <ul className="mt-8 grid gap-x-[clamp(1.5rem,3vw,3.5rem)] md:grid-cols-2">
          {slugs.map((slug) => {
            const article = getArticle(slug);
            if (!article) return null;
            return (
              <li key={slug} className="border-t border-line py-6">
                <p className="t-eyebrow text-accent">{article.kicker}</p>
                <Link
                  href={`/learn/${slug}` as Route}
                  className="t-headline mt-3 block hover:text-accent"
                >
                  {article.question}
                </Link>
                <p className="mt-3 max-w-xl text-muted">{article.description}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
