import type { ReactNode } from 'react';

export interface FaqItem {
  readonly question: string;
  readonly answer: ReactNode;
}

/** Questions and answers set as an open list: everything is readable without a click. */
export function Faq({ items }: { readonly items: readonly FaqItem[] }) {
  return (
    <dl className="border-t border-line">
      {items.map((item) => (
        <div key={item.question} className="grid-12 gap-y-3 border-b border-line py-7">
          <dt className="t-title col-span-12 md:col-span-5">{item.question}</dt>
          <dd className="col-span-12 text-muted md:col-span-6 md:col-start-7 [&>p+p]:mt-4">
            {item.answer}
          </dd>
        </div>
      ))}
    </dl>
  );
}
