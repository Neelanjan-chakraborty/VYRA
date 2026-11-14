import { serializeJsonLd } from '@/lib/json-ld';

export function JsonLd({ data }: { readonly data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // Serialised with `<`, `>` and `&` escaped, so page data cannot close the element.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
