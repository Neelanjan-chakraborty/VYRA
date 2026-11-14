'use client';

import Script from 'next/script';
import { useEffect, useSyncExternalStore } from 'react';
import { type Consent, readConsent, subscribeConsent, writeConsent } from '@/lib/consent';

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

function track(event: string, params: Record<string, string>): void {
  window.gtag?.('event', event, params);
}

export function useConsent(): Consent {
  return useSyncExternalStore(subscribeConsent, readConsent, () => 'unset');
}

/**
 * Google Analytics 4, loaded only after the visitor says yes. Before that no
 * script is requested and nothing is stored. Once running it records:
 *
 * - `cta_click`  — any element with `data-cta` (`cta`, `cta_location`, `page_path`);
 *                  `cta: enter_vyra` is the sign-up intent to mark as a key event in GA4.
 * - `section_view` — the first time each `[data-section]` is half on screen.
 *
 * Page views, scroll depth and engagement time come from GA4's enhanced measurement.
 */
export function Analytics({ measurementId }: { readonly measurementId: string }) {
  const consent = useConsent();
  const granted = consent === 'granted';

  useEffect(() => {
    if (!granted) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('[data-cta]') : null;
      if (!(target instanceof HTMLElement)) return;
      track('cta_click', {
        cta: target.dataset.cta ?? 'unknown',
        cta_location: target.dataset.ctaLocation ?? 'unknown',
        page_path: window.location.pathname,
      });
    };
    document.addEventListener('click', onClick);

    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const name = entry.target instanceof HTMLElement ? entry.target.dataset.section : null;
          if (!entry.isIntersecting || !name || seen.has(name)) continue;
          seen.add(name);
          track('section_view', { section: name, page_path: window.location.pathname });
        }
      },
      { threshold: 0.5 },
    );
    for (const section of document.querySelectorAll('[data-section]')) observer.observe(section);

    return () => {
      document.removeEventListener('click', onClick);
      observer.disconnect();
    };
  }, [granted]);

  return (
    <>
      {granted ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
gtag('js',new Date());gtag('config',${JSON.stringify(measurementId)},{anonymize_ip:true});`}
          </Script>
        </>
      ) : null}
      {consent === 'unset' ? <ConsentBanner /> : null}
    </>
  );
}

function ConsentBanner() {
  return (
    <section
      aria-label="Analytics consent"
      className="theme-ivory fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-xl rounded-[var(--vyra-radius-m)] p-5 shadow-2xl sm:inset-x-auto sm:right-5 sm:bottom-5"
    >
      <p className="t-small">
        May we count visits? With your permission this site uses Google Analytics to see which pages
        are read. Nothing is loaded or stored unless you say yes, and no advertising data is
        collected either way.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary min-h-11! px-5! py-2!"
          onClick={() => writeConsent('granted')}
        >
          Allow analytics
        </button>
        <button
          type="button"
          className="btn btn-ghost min-h-11! px-5! py-2!"
          onClick={() => writeConsent('denied')}
        >
          No thanks
        </button>
      </div>
    </section>
  );
}

/** Shown on the privacy page so a choice can be changed at any time. */
export function ConsentControls() {
  const consent = useConsent();
  const label =
    consent === 'granted'
      ? 'You have allowed analytics on this device.'
      : consent === 'denied'
        ? 'You have declined analytics on this device.'
        : 'You have not made a choice on this device, so analytics is off.';
  return (
    <div className="mt-6 border-t border-line pt-6">
      <p aria-live="polite">{label}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-ghost min-h-11! px-5! py-2!"
          onClick={() => writeConsent('granted')}
        >
          Allow analytics
        </button>
        <button
          type="button"
          className="btn btn-ghost min-h-11! px-5! py-2!"
          onClick={() => writeConsent('denied')}
        >
          Turn analytics off
        </button>
      </div>
    </div>
  );
}
