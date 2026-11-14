import Image, { type StaticImageData } from 'next/image';

interface Props {
  readonly src: StaticImageData;
  /** Says what the screen shows; it is content, not decoration. */
  readonly alt: string;
  /** CSS `sizes` for the rendered width. */
  readonly sizes: string;
  readonly className?: string;
  /** Above the fold: load eagerly at high priority. */
  readonly eager?: boolean;
}

/** A real screen from the VYRA app in a plain bezel. */
export function PhoneShot({ src, alt, sizes, className, eager = false }: Props) {
  return (
    <div className={`shot ${className ?? ''}`}>
      <Image
        src={src}
        alt={alt}
        sizes={sizes}
        quality={70}
        placeholder="empty"
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
      />
    </div>
  );
}
