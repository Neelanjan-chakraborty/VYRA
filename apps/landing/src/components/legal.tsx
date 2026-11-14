import type { ReactNode } from 'react';
import { site } from '@/lib/site';

/** A notice shown on legal pages until reviewed documents replace the drafts. */
export function DraftNotice() {
  if (site.legalPublished) return null;
  return (
    <aside
      aria-label="Draft notice"
      className="mb-14 border-l-2 border-accent bg-paper/60 p-6 sm:p-8"
    >
      <p className="t-eyebrow text-accent">Working draft · not in force</p>
      <p className="mt-3 max-w-3xl">
        This page is a plain-language draft describing how VYRA is being built. It has not been
        reviewed by a lawyer, it is not a contract or a legal notice, and it should not be relied on
        as one. VYRA has no public users yet. A reviewed document will replace this draft before
        anyone can sign up. Passages in [square brackets] are details still to be supplied.
      </p>
    </aside>
  );
}

export function LegalSection({
  id,
  number,
  title,
  children,
}: {
  readonly id: string;
  readonly number: string;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section id={id} className="grid-12 gap-y-4 border-t border-line py-10">
      <h2 className="t-title col-span-12 md:col-span-4">
        <span className="t-eyebrow mr-3 text-accent" aria-hidden="true">
          {number}
        </span>
        {title}
      </h2>
      <div className="col-span-12 md:col-span-7 md:col-start-6 [&>p+p]:mt-4 [&>p+ul]:mt-4 [&>ul+p]:mt-4 [&_li]:relative [&_li]:pl-5 [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:content-['—'] [&_li+li]:mt-2">
        {children}
      </div>
    </section>
  );
}
