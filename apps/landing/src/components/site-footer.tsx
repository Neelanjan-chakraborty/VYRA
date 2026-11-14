import Link from 'next/link';
import { pages, primaryNav } from '@/lib/routes';
import { site } from '@/lib/site';
import { LogoMark } from './logo';

// Fixed when the site is built; the page is static.
const YEAR = new Date().getFullYear();

const company = [pages.about, pages.contact, pages.privacy, pages.terms];

export function SiteFooter() {
  return (
    <footer className="theme-ink overflow-hidden border-t border-line">
      <div className="shell pt-16 sm:pt-24">
        <div className="grid-12 gap-y-12">
          <div className="col-span-12 lg:col-span-5">
            <p className="t-headline max-w-[14ch]">
              Chemistry, <em className="text-accent">decoded.</em>
            </p>
            <p className="mt-6 max-w-sm text-muted">
              VYRA is in development and is not yet available to download. This site describes what
              is built today and says where something is still to come.
            </p>
          </div>
          <nav
            aria-label="Product"
            className="col-span-6 sm:col-span-4 lg:col-span-3 lg:col-start-7"
          >
            <h2 className="t-eyebrow text-muted">Product</h2>
            <ul className="mt-4">
              {primaryNav.map((page) => (
                <li key={page.path}>
                  <Link href={page.path} className="flex min-h-11 items-center hover:text-accent">
                    {page.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Company" className="col-span-6 sm:col-span-4 lg:col-span-3">
            <h2 className="t-eyebrow text-muted">Company</h2>
            <ul className="mt-4">
              {company.map((page) => (
                <li key={page.path}>
                  <Link href={page.path} className="flex min-h-11 items-center hover:text-accent">
                    {page.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
      {/* The name, set as large as the page allows and cut by the bottom edge. */}
      <div aria-hidden="true" className="shell mt-14 select-none sm:mt-20">
        <div className="flex items-end justify-between gap-6 border-t border-line pt-6">
          <LogoMark className="mb-[2vw] size-[clamp(3rem,9vw,8.5rem)] shrink-0" />
          <span className="-mb-[0.19em] block font-display text-[clamp(6rem,29vw,30rem)] leading-[0.8] tracking-[0.02em]">
            VYRA
          </span>
        </div>
      </div>
      <div className="relative border-t border-line bg-bg">
        <div className="shell t-small flex flex-col gap-2 py-5 text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {YEAR} {site.name}. For adults aged 18 and over.
          </p>
          <p>Estimated alignment is not a prediction of how a relationship will go.</p>
        </div>
      </div>
    </footer>
  );
}
