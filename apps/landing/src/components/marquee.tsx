/** A slow band of words. The text is repeated for the loop, so the copy is hidden from assistive technology and read once from `label`. */
export function Marquee({
  items,
  label,
}: {
  readonly items: readonly string[];
  readonly label: string;
}) {
  const run = (
    <ul className="flex shrink-0 items-center">
      {items.map((item) => (
        <li key={item} className="flex items-center">
          <span className="t-headline px-6 italic sm:px-10">{item}</span>
          <span className="size-2 rotate-45 bg-cherry" />
        </li>
      ))}
    </ul>
  );
  return (
    <div className="overflow-hidden border-y border-line py-5 sm:py-7">
      <p className="sr-only">{label}</p>
      <div className="marquee-track" aria-hidden="true">
        {run}
        {run}
      </div>
    </div>
  );
}
