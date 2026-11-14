/** Analytics consent, kept in the visitor's own browser. No cookie is set to remember it. */
export type Consent = 'granted' | 'denied' | 'unset';

const KEY = 'vyra-analytics-consent';
const EVENT = 'vyra:consent';

export function readConsent(): Consent {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === 'granted' || value === 'denied' ? value : 'unset';
  } catch {
    // Storage blocked: behave as if no choice was made, and load nothing.
    return 'unset';
  }
}

export function writeConsent(value: Exclude<Consent, 'unset'>): void {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    // Nothing to do; the choice simply lasts for this page only.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeConsent(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}
