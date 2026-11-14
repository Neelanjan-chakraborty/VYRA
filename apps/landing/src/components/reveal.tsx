'use client';

import * as m from 'motion/react-m';
import type { ReactNode } from 'react';

interface Props {
  readonly children: ReactNode;
  readonly className?: string;
  /** Seconds. Use to stagger siblings. */
  readonly delay?: number;
  /** Pixels of upward travel. */
  readonly distance?: number;
  readonly as?: 'div' | 'li' | 'figure';
}

const TAGS = { div: m.div, li: m.li, figure: m.figure } as const;

/**
 * Content rises into place the first time it scrolls into view. The children
 * are server-rendered; a <noscript> rule in the layout shows them without JS.
 */
export function Reveal({ children, className, delay = 0, distance = 28, as = 'div' }: Props) {
  const Tag = TAGS[as];
  return (
    <Tag
      data-reveal=""
      className={className}
      initial={{ opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.9, delay, ease: [0.2, 0, 0, 1] }}
    >
      {children}
    </Tag>
  );
}
