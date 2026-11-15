import type { ReactNode } from 'react';
import type { PhotoKey } from '@/content/photos';
import { site } from '@/lib/site';
import { Halftone, OrbitRing, RotatingBadge } from './art';
import { EnterCta } from './enter-cta';
import { OrbitField } from './orbit-field';
import { StockPhoto } from './stock-photo';

/** The full-bleed cherry close used at the end of every page. */
export function ClosingCta({
  location,
  title,
  photo,
}: {
  readonly location: string;
  readonly title: ReactNode;
  /** A stock photograph shown in an oval frame beside the call to action. */
  readonly photo?: PhotoKey;
}) {
  return (
    <section data-section="closing" className="theme-cherry relative overflow-hidden">
      <OrbitField
        animated={false}
        className="pointer-events-none absolute -right-[60%] top-1/2 w-[140%] max-w-none -translate-y-1/2 lg:-right-[18%] lg:w-[72%]"
      />
      <Halftone
        className="-bottom-6 -left-6 h-56 w-80 text-ivory opacity-30"
        fade="right"
        size={10}
      />
      <div className="shell relative grid-12 items-center gap-y-12 py-24 sm:py-36">
        <div className="col-span-12 lg:col-span-8">
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
        {photo ? (
          <div className="relative col-span-8 col-start-3 sm:col-span-6 sm:col-start-4 lg:col-span-3 lg:col-start-10">
            <StockPhoto
              photo={photo}
              sizes="(min-width: 1024px) 24vw, 60vw"
              frame="aspect-[4/5] rounded-[50%]"
              caption="label"
              tone="warm"
            />
            <OrbitRing className="-inset-[22%] size-[144%]" rotate={-20} dot="62%" />
            <RotatingBadge className="absolute -left-4 -top-6 size-24 sm:-left-8 sm:size-28" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
