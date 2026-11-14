import Link from 'next/link';
import { primaryNav } from '@/lib/routes';
import { EnterCta } from './enter-cta';
import { Wordmark } from './logo';
import { MobileMenu } from './mobile-menu';
import { NavLink } from './nav-link';

export function SiteHeader() {
  return (
    <header className="theme-ink sticky top-0 z-50 border-b border-line">
      <div className="shell flex h-16 items-center justify-between gap-6">
        <Link href="/" aria-label="VYRA home" className="-ml-1 flex h-11 items-center px-1">
          <Wordmark />
        </Link>
        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-8">
            {primaryNav.map((page) => (
              <li key={page.path}>
                <NavLink href={page.path}>{page.label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <EnterCta
            location="header"
            className="btn btn-primary hidden min-h-11! px-5! py-2! sm:inline-flex"
          />
          <MobileMenu
            links={primaryNav.map((page) => ({ href: page.path, label: page.label }))}
            cta={<EnterCta location="mobile_menu" className="btn btn-primary w-full" />}
          />
        </div>
      </div>
    </header>
  );
}
