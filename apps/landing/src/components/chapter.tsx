import type { ReactNode } from 'react';
import type { IconName } from '@/lib/icon-data';
import { Reveal } from './reveal';
import { SectionLabel } from './section-label';

interface Props {
  readonly id?: string;
  readonly index: string;
  readonly label: string;
  readonly icon?: IconName;
  readonly title: ReactNode;
  readonly theme?: 'theme-ink' | 'theme-ivory' | 'theme-oxblood';
  /** The lead paragraph(s), set beside the heading. */
  readonly intro?: ReactNode;
  readonly children?: ReactNode;
}

/** A numbered chapter of an inner page: label, H2, lead text, then free content. */
export function Chapter({
  id,
  index,
  label,
  icon,
  title,
  theme = 'theme-ink',
  intro,
  children,
}: Props) {
  return (
    <section id={id} data-section={id ?? label} className={`${theme} overflow-hidden`}>
      <div className="shell py-20 sm:py-28">
        <SectionLabel index={index} icon={icon}>
          {label}
        </SectionLabel>
        <div className="grid-12 mt-10 gap-y-8 sm:mt-14">
          <Reveal className="col-span-12 lg:col-span-6">
            <h2 className="t-headline max-w-[18ch] lg:text-[clamp(2.5rem,5vw,4.75rem)]">{title}</h2>
          </Reveal>
          {intro ? (
            <Reveal
              delay={0.08}
              className="t-lede col-span-12 text-muted md:col-span-9 lg:col-span-5 lg:col-start-8 [&>p+p]:mt-5"
            >
              {intro}
            </Reveal>
          ) : null}
        </div>
        {children ? <div className="mt-14 sm:mt-20">{children}</div> : null}
      </div>
    </section>
  );
}
