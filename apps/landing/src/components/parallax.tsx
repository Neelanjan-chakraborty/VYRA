'use client';

import { useReducedMotion, useScroll, useTransform } from 'motion/react';
import * as m from 'motion/react-m';
import { type ReactNode, useRef } from 'react';

interface Props {
  readonly children: ReactNode;
  readonly className?: string;
  /** Total vertical travel in pixels across the element's pass through the viewport. */
  readonly travel?: number;
}

/** Moves its children slightly against the scroll. Transform only, so it never shifts layout. */
export function Parallax({ children, className, travel = 80 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [travel / 2, -travel / 2]);
  return (
    <m.div ref={ref} className={className} style={reduceMotion ? undefined : { y }}>
      {children}
    </m.div>
  );
}
