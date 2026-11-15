import Image from 'next/image';
import type { ReactNode } from 'react';
import { type PhotoKey, photos } from '@/content/photos';

interface Props {
  readonly photo: PhotoKey;
  /** CSS `sizes` for the rendered width. */
  readonly sizes: string;
  /** Tailwind aspect and shape classes for the frame, e.g. "aspect-[4/5] rounded-t-[999px]". */
  readonly frame?: string;
  readonly className?: string;
  /** Above the fold: load at once and at high priority. */
  readonly eager?: boolean;
  /** `true`: caption and stock label. `'label'`: only the stock label. `false`: none (decorative use; keep the label nearby). */
  readonly caption?: boolean | 'label';
  /** Overlays drawn inside the frame: gradients, tags, stickers. */
  readonly children?: ReactNode;
  /** Tone applied by CSS: keeps a set of photographs feeling like one shoot. */
  readonly tone?: 'natural' | 'warm' | 'duotone';
}

/**
 * A stock photograph with everything a crawler and a screen reader can use: a
 * descriptive file name (in the served URL), real alt text, intrinsic width
 * and height, responsive sizes, lazy loading below the fold, a caption, and a
 * plain label saying it is a stock photograph of models. The frame is sized by
 * CSS, so the layout never shifts while it loads.
 */
export function StockPhoto({
  photo,
  sizes,
  frame = 'aspect-[4/3]',
  className,
  eager = false,
  caption = true,
  tone = 'natural',
  children,
}: Props) {
  const item = photos[photo];
  return (
    <figure className={className}>
      <div className={`photo-frame relative overflow-hidden bg-ink-raised ${frame} tone-${tone}`}>
        <Image
          src={item.image}
          alt={item.alt}
          sizes={sizes}
          quality={75}
          placeholder="blur"
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'auto'}
          className="size-full object-cover"
          style={{ objectPosition: item.focus }}
        />
        {children}
      </div>
      {caption === 'label' ? (
        <figcaption className="t-eyebrow mt-3 text-muted">
          Stock photo · models, not members
        </figcaption>
      ) : caption ? (
        <figcaption className="t-small mt-3 flex flex-wrap items-baseline justify-between gap-x-4 text-muted">
          <span>{item.caption}</span>
          <span className="t-eyebrow">Stock photo · models, not members</span>
        </figcaption>
      ) : null}
    </figure>
  );
}
