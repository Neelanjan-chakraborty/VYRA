import type { Metadata } from 'next';
import Link from 'next/link';
import { Chapter } from '@/components/chapter';
import { ClosingCta } from '@/components/closing-cta';
import { OrbitField } from '@/components/orbit-field';
import { PageHero } from '@/components/page-hero';
import { Reveal } from '@/components/reveal';
import { pageMetadata, pages } from '@/lib/routes';

export const metadata: Metadata = pageMetadata('about');

const principles = [
  [
    'Understand people before recommending people.',
    'A suggestion is only as good as the picture behind it, so the picture comes first.',
  ],
  [
    'Discover compatibility; don’t browse an endless shelf.',
    'More profiles is not the same as better odds.',
  ],
  [
    'Explain why two people might connect.',
    'If VYRA cannot give a reason, it should not make the suggestion.',
  ],
  [
    'Let people explore real situations.',
    'A first date, a weekend, a disagreement: alignment is looked at scenario by scenario.',
  ],
  [
    'AI improves discovery. It never replaces a person’s choice.',
    'It drafts and suggests. People approve, decide and press send.',
  ],
  ['Design and privacy are part of the product.', 'Neither is a layer added at the end.'],
] as const;

const refusals = [
  'A swipe deck, streaks, or anything tuned for time spent in the app.',
  'Claims of scientific or predictive accuracy without outcome data to support them.',
  'Inferring health, religion, caste, sexuality or politics from anything you provide.',
  'Reaching into your AI assistant’s account. You bring what you choose to bring.',
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        page={pages.about}
        index="06"
        title={
          <>
            Dating apps got good at attention.{' '}
            <em className="text-accent">We’re after understanding.</em>
          </>
        }
        lede={
          <p>
            VYRA is a relationship discovery platform: it tries to work out who you might genuinely
            connect with, and to tell you why, before it shows you anyone. It is in development, and
            this site is written to be straight about what exists and what does not.
          </p>
        }
      />

      <Chapter
        id="why"
        index="01"
        label="Why"
        theme="theme-ivory"
        title={
          <>
            A different <em className="text-accent">starting question.</em>
          </>
        }
        intro={
          <>
            <p>
              The usual question is “do you like the look of this person?”, asked a few hundred
              times an evening. It is quick to answer and it keeps people busy, but it does not have
              much to do with whether two people will enjoy each other’s company.
            </p>
            <p>
              VYRA starts from “what would these two people actually be like together?” That is a
              harder question, and it can only be answered partly. We would rather give a partial,
              explained answer to the right question than a confident answer to the wrong one.
            </p>
          </>
        }
      />

      <section data-section="principles" className="theme-ink relative overflow-hidden">
        <OrbitField
          animated={false}
          className="pointer-events-none absolute -left-[45%] top-[8%] w-[120%] max-w-none opacity-60 lg:-left-[28%] lg:w-[78%]"
        />
        <div className="shell relative py-20 sm:py-28">
          <p className="t-eyebrow flex items-center gap-4 border-t border-line pt-4 text-muted">
            <span className="text-accent">02</span>
            <span>Principles</span>
          </p>
          <h2 className="t-headline mt-10 max-w-[16ch] sm:mt-14 lg:text-[clamp(2.5rem,5vw,4.75rem)]">
            Six rules the product <em className="text-accent">is built to.</em>
          </h2>
          <ol className="mt-14 border-t border-line lg:ml-[33%]">
            {principles.map(([rule, note], index) => (
              <Reveal
                as="li"
                key={rule}
                delay={0.04 * index}
                distance={16}
                className="flex gap-6 border-b border-line py-6"
              >
                <span className="t-eyebrow pt-2 text-accent" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>
                  <span className="t-title block">{rule}</span>
                  <span className="mt-2 block text-muted">{note}</span>
                </span>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <Chapter
        id="refusals"
        index="03"
        label="What we won’t build"
        theme="theme-oxblood"
        title={
          <>
            The list of things <em>VYRA is not.</em>
          </>
        }
        intro={
          <p>
            A product is defined as much by what it declines to do. These are written down as
            non-goals, so that they are decisions and not accidents.
          </p>
        }
      >
        <ul className="border-t border-line">
          {refusals.map((line) => (
            <li key={line} className="t-title border-b border-line py-5">
              {line}
            </li>
          ))}
        </ul>
      </Chapter>

      <Chapter
        id="status"
        index="04"
        label="Where things stand"
        theme="theme-ivory"
        title={
          <>
            Early, and <em className="text-accent">saying so.</em>
          </>
        }
        intro={
          <>
            <p>
              VYRA is being built for India first, for adults, with the rest of the world in mind.
              Sign-in, onboarding, the AI persona and the compatibility engine are complete. The
              screens that introduce people to each other, and messaging, are not.
            </p>
            <p>
              There are no user numbers, ratings or testimonials on this site because there are no
              users yet. When there are results worth reporting, they will be reported with their
              evidence.
            </p>
          </>
        }
      >
        <div className="flex flex-wrap gap-x-10 gap-y-4">
          <Link href="/features" className="arrow-link">
            What is built and what is planned{' '}
            <span className="arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <Link href="/safety" className="arrow-link">
            Safety and privacy{' '}
            <span className="arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <Link href="/contact" className="arrow-link">
            Contact{' '}
            <span className="arrow" aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </Chapter>

      <ClosingCta
        location="about_closing"
        title={
          <>
            Understand first.
            <br />
            <em>Then introduce.</em>
          </>
        }
      />
    </>
  );
}
