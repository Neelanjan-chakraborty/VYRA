/** The running label at the top of a section: a number and a name on a hairline. */
export function SectionLabel({
  index,
  children,
}: {
  readonly index: string;
  readonly children: string;
}) {
  return (
    <p className="t-eyebrow flex items-center gap-4 border-t border-line pt-4 text-muted">
      <span className="text-accent">{index}</span>
      <span>{children}</span>
    </p>
  );
}
