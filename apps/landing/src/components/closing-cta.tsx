import type { ReactNode } from 'react';
import { site } from '@/lib/site';
import { EnterCta } from './enter-cta';
import { OrbitField } from './orbit-field';

/** The full-bleed cherry close used at the end of every page. */
export function ClosingCta({
  location,
  title,
}: {
  readonly location: string;
  readonly title: ReactNode;
}) {
  return (
    <section data-section="closing" className="theme-cherry relative overflow-hidden">
      <OrbitField
        animated={false}
        className="pointer-events-none absolute -right-[60%] top-1/2 w-[140%] max-w-none -translate-y-1/2 lg:-right-[18%] lg:w-[72%]"
      />
      <div className="shell relative py-24 sm:py-36">
        <p className="t-eyebrow">Chemistry, decoded.</p>
        <h2 className="t-mega mt-6 max-sm:text-[15vw]">{title}</h2>
        <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-5">
          <EnterCta location={location} />
          {site.appUrl ? null : (
            <p className="max-w-sm">
              VYRA is in development and not yet open to the public. See where it stands and what
              comes next.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
