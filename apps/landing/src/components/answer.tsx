import type { ReactNode } from 'react';

interface Props {
  /** The question, as a heading. */
  readonly question: string;
  /** The answer in full: it must make sense read on its own. */
  readonly children: ReactNode;
  readonly as?: 'h2' | 'h3';
  readonly label?: string;
}

/**
 * A question and its direct answer, set as an editorial pull-out. The answer
 * comes first and stands alone; the detail follows elsewhere on the page.
 */
export function Answer({ question, children, as: Heading = 'h2', label = 'In short' }: Props) {
  return (
    <div className="grid-12 gap-y-6">
      <div className="col-span-12 lg:col-span-4">
        <p className="t-eyebrow text-accent">{label}</p>
        <Heading className="t-headline mt-4">{question}</Heading>
      </div>
      <div className="t-title col-span-12 lg:col-span-7 lg:col-start-6 [&>p+p]:mt-5">
        {children}
      </div>
    </div>
  );
}
