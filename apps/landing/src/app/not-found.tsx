import type { Metadata } from 'next';
import Link from 'next/link';
import { OrbitField } from '@/components/orbit-field';
import { primaryNav } from '@/lib/routes';

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'There is nothing at this address.',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <section className="theme-ink relative overflow-hidden">
      <OrbitField
        animated={false}
        className="pointer-events-none absolute -right-[30%] top-1/2 w-[110%] -translate-y-1/2 opacity-70 sm:-right-[10%] sm:w-[70%]"
      />
      <div className="shell relative py-24 sm:py-36">
        <p className="t-eyebrow text-muted">Error 404</p>
        <h1 className="t-display mt-6 max-w-[12ch]">
          Nothing in <em className="text-accent">this orbit.</em>
        </h1>
        <p className="t-lede mt-8 max-w-md text-muted">
          The page you were looking for has moved or never existed. These do:
        </p>
        <ul className="mt-8 max-w-md border-t border-line">
          {primaryNav.map((page) => (
            <li key={page.path} className="border-b border-line">
              <Link
                href={page.path}
                className="flex min-h-12 items-center justify-between hover:text-accent"
              >
                {page.label}
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/" className="btn btn-primary mt-10">
          Back to the start
        </Link>
      </div>
    </section>
  );
}
