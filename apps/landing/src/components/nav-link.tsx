'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** A primary-navigation link that marks the current page for sighted and screen-reader users. */
export function NavLink({
  href,
  children,
}: {
  readonly href: Route;
  readonly children: ReactNode;
}) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`relative flex h-11 items-center text-[0.875rem] font-medium tracking-[0.01em] transition-colors duration-200 hover:text-fg ${
        active ? 'text-fg' : 'text-muted'
      }`}
    >
      {children}
      {active ? (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-1.5 h-px bg-cherry" />
      ) : null}
    </Link>
  );
}
