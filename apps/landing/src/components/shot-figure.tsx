import type { StaticImageData } from 'next/image';
import { PhoneShot } from './phone-shot';

interface Props {
  readonly screen: { readonly src: StaticImageData; readonly alt: string };
  readonly caption: string;
  readonly className?: string;
  readonly sizes?: string;
}

/** A real app screen with a caption saying what it is. */
export function ShotFigure({
  screen,
  caption,
  className,
  sizes = '(min-width: 1024px) 22vw, (min-width: 640px) 40vw, 72vw',
}: Props) {
  return (
    <figure className={className}>
      <PhoneShot {...screen} sizes={sizes} />
      <figcaption className="t-small mt-4 text-muted">{caption}</figcaption>
    </figure>
  );
}
