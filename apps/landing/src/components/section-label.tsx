import { Icon } from './icon';
import type { IconName } from '@/lib/icon-data';

/** The running label at the top of a section: a number and a name on a hairline. */
export function SectionLabel({
  index,
  children,
  icon,
}: {
  readonly index: string;
  readonly children: string;
  readonly icon?: IconName;
}) {
  return (
    <p className="t-eyebrow flex items-center gap-4 border-t border-line pt-4 text-muted">
      <span className="text-accent">{index}</span>
      <span>{children}</span>
      {icon ? <Icon name={icon} className="ml-auto size-7 text-accent" /> : null}
    </p>
  );
}
