import type { Route } from 'next';
import Link from 'next/link';
import { site } from '@/lib/site';

interface Props {
  /** Where on the page this button sits; sent with the click event. */
  readonly location: string;
  readonly className?: string;
  readonly label?: string;
}

/**
 * The primary call to action. Until the app is publicly available it leads to
 * the availability note rather than to a sign-up that does not exist.
 */
export function EnterCta({ location, className = 'btn btn-primary', label = 'Enter VYRA' }: Props) {
  const tracking = { 'data-cta': 'enter_vyra', 'data-cta-location': location };
  const content = (
    <>
      {label}
      <span aria-hidden="true">→</span>
    </>
  );
  if (site.appUrl) {
    return (
      <a href={site.appUrl} className={className} {...tracking}>
        {content}
      </a>
    );
  }
  return (
    <Link href={'/how-it-works#availability' as Route} className={className} {...tracking}>
      {content}
    </Link>
  );
}
