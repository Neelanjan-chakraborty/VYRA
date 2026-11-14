import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/page-hero';
import { pageMetadata, pages } from '@/lib/routes';
import { site } from '@/lib/site';

export const metadata: Metadata = pageMetadata('contact');

const topics = [
  ['Product and availability', 'Questions about what VYRA does and when it opens.'],
  [
    'Privacy and your data',
    'Requests to see, correct or delete personal data, and questions about how it is handled.',
  ],
  ['Safety', 'Concerns about someone’s behaviour, or about your own safety on the platform.'],
  ['Press and partnerships', 'Enquiries from journalists, researchers and organisations.'],
] as const;

export default function ContactPage() {
  return (
    <>
      <PageHero
        page={pages.contact}
        index="07"
        title={
          <>
            Get in <em className="text-accent">touch.</em>
          </>
        }
        lede={
          site.contactEmail ? (
            <p>
              Write to us at{' '}
              <a
                className="prose-link text-fg"
                href={`mailto:${site.contactEmail}`}
                data-cta="contact_email"
                data-cta-location="contact_hero"
              >
                {site.contactEmail}
              </a>
              . Tell us which of the topics below it concerns and we will route it to the right
              person.
            </p>
          ) : (
            <p>
              VYRA is in development and does not have a public contact address yet. One will be
              published on this page before the app opens. We have chosen not to list an address
              that nobody is answering.
            </p>
          )
        }
      />
      <section data-section="topics" className="theme-ivory">
        <div className="shell py-20 sm:py-28">
          <h2 className="t-headline max-w-[18ch]">
            What you will be able to <em className="text-accent">write to us about.</em>
          </h2>
          <ul className="mt-12 border-t border-line">
            {topics.map(([title, text]) => (
              <li key={title} className="grid-12 items-baseline gap-y-1 border-b border-line py-6">
                <h3 className="t-title col-span-12 md:col-span-5">{title}</h3>
                <p className="col-span-12 text-muted md:col-span-6 md:col-start-7">{text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-10 max-w-2xl text-muted">
            In the meantime, most questions about how VYRA handles data are answered on the{' '}
            <Link href="/safety" className="prose-link">
              safety and privacy page
            </Link>
            , and the{' '}
            <Link href="/features" className="prose-link">
              features page
            </Link>{' '}
            says what is built and what is planned. If you are in immediate danger, contact your
            local emergency services; an app is not the right place to turn first.
          </p>
        </div>
      </section>
    </>
  );
}
