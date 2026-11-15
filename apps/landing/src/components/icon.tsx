import { createElement, type ReactNode } from 'react';
import { type IconName, type IconNode, iconData } from '@/lib/icon-data';

const render = (node: IconNode, key: number): ReactNode =>
  createElement(
    node.tag,
    // React wants camelCase for these SVG attributes.
    {
      key,
      ...Object.fromEntries(
        Object.entries(node.attrs).map(([name, value]) => [
          name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()),
          value,
        ]),
      ),
    },
    ...(node.children?.map(render) ?? []),
  );

/**
 * A licensed icon, drawn in the surrounding text colour. Decorative by
 * default: put the meaning in adjacent text. Pass `label` only when the icon
 * stands alone.
 */
export function Icon({
  name,
  className,
  label,
}: {
  readonly name: IconName;
  readonly className?: string;
  readonly label?: string;
}) {
  const icon = iconData[name];
  return (
    <svg
      viewBox={icon.viewBox}
      fill={icon.fill}
      className={className}
      focusable="false"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {icon.nodes.map(render)}
    </svg>
  );
}

/** An icon in a ringed disc, the way the site marks a section or a capability. */
export function Medallion({
  name,
  className = '',
}: {
  readonly name: IconName;
  readonly className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-line text-accent ${className}`}
    >
      <Icon name={name} className="size-6" />
    </span>
  );
}
