'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

interface Props {
  readonly links: readonly { readonly href: Route; readonly label: string }[];
  readonly cta: ReactNode;
}

/** Full-screen navigation for small screens. Closes on Escape and on navigation. */
export function MobileMenu({ links, cta }: Props) {
  const pathname = usePathname();
  // The menu remembers which page it was opened on, so arriving anywhere else closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);
  const reduceMotion = useReducedMotion();
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenOn(null);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="relative z-[70] -mr-2 flex size-11 items-center justify-center"
      >
        <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
        <span aria-hidden="true" className="relative block h-3 w-6">
          <span
            className={`absolute left-0 top-0 h-px w-6 bg-fg transition-transform duration-300 ${open ? 'translate-y-[6px] rotate-45' : ''}`}
          />
          <span
            className={`absolute bottom-0 left-0 h-px w-6 bg-fg transition-transform duration-300 ${open ? '-translate-y-[5px] -rotate-45' : ''}`}
          />
        </span>
      </button>
      <AnimatePresence>
        {open ? (
          <m.div
            id={panelId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.24 }}
            className="theme-ink fixed inset-0 z-[65] flex flex-col overflow-y-auto pt-16"
          >
            <nav aria-label="Menu" className="shell flex flex-1 flex-col justify-between pb-8 pt-6">
              <ul>
                <li className="border-b border-line">
                  <Link href="/" onClick={() => setOpen(false)} className="t-headline block py-3">
                    Home
                  </Link>
                </li>
                {links.map((link, index) => (
                  <m.li
                    key={link.href}
                    initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * index, duration: 0.42, ease: [0.2, 0, 0, 1] }}
                    className="border-b border-line"
                  >
                    <Link
                      href={link.href}
                      aria-current={pathname === link.href ? 'page' : undefined}
                      onClick={() => setOpen(false)}
                      className="t-headline flex items-baseline justify-between py-3"
                    >
                      {link.label}
                      {pathname === link.href ? (
                        <span className="t-eyebrow text-accent">Here</span>
                      ) : null}
                    </Link>
                  </m.li>
                ))}
              </ul>
              <div className="mt-10">{cta}</div>
            </nav>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
