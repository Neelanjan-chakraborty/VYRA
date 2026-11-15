import type { Metadata } from 'next';
import Link from 'next/link';
import { Chapter } from '@/components/chapter';
import { Answer } from '@/components/answer';
import { ClosingCta } from '@/components/closing-cta';
import { OrbitField } from '@/components/orbit-field';
import { PageHero } from '@/components/page-hero';
import { Reveal } from '@/components/reveal';
import { entity } from '@/lib/entity';
import { iconCredits, photos, type PhotoKey } from '@/content/photos';
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
        photo="pizzaFriends"
        icon="chat"
        index="07"
        title={
          <>
            Dating apps got good at attention.{' '}
            <em className="text-accent">We’re after understanding.</em>
          </>
        }
        lede={
          <p>
            {entity.description} It tries to work out who a person might genuinely connect with, and
            to say why, before it shows them anyone. VYRA is in development, and this site is
            written to be straight about what exists and what does not.
          </p>
        }
      />

      <section id="what-is-vyra" data-section="what-is-vyra" className="theme-ivory">
        <div className="shell py-16 sm:py-24">
          <Answer question="What is VYRA?">
            <p>{entity.answer}</p>
          </Answer>
          <dl className="mt-14 border-t border-line">
            {[
              ['Category', entity.category],
              ['Positioning', `${entity.positioning}. “${entity.tagline}”`],
              ['Who it is for', entity.audience],
              ['Where', entity.market],
              ['Status', entity.status],
            ].map(([term, detail]) => (
              <div key={term} className="grid-12 gap-y-1 border-b border-line py-4">
                <dt className="t-eyebrow col-span-12 pt-1 text-muted md:col-span-3">{term}</dt>
                <dd className="col-span-12 md:col-span-9">{detail}</dd>
              </div>
            ))}
          </dl>

          <div className="grid-12 mt-16 gap-y-12">
            <div className="col-span-12 lg:col-span-7">
              <h2 className="t-headline">What VYRA does</h2>
              <ul className="mt-6 border-t border-line">
                {entity.capabilities.map((capability) => (
                  <li key={capability.name} className="border-b border-line py-5">
                    <h3 className="t-title">
                      <Link href={capability.path} className="hover:text-accent">
                        {capability.name}
                      </Link>
                    </h3>
                    <p className="t-eyebrow mt-2 text-accent">{capability.status}</p>
                    <p className="mt-2 text-muted">{capability.summary}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-span-12 lg:col-span-4 lg:col-start-9">
              <h2 className="t-headline">What VYRA is not</h2>
              <ul className="mt-6 border-t border-line">
                {entity.isNot.map((item) => (
                  <li key={item} className="border-b border-line py-4">
                    Not {item}.
                  </li>
                ))}
              </ul>
              <h3 className="t-title mt-10">Is VYRA an AI dating app?</h3>
              <p className="mt-3 text-muted">
                People would use VYRA to meet potential partners, so it belongs to the same broad
                space as dating apps. The accurate description is narrower: an {entity.category}. AI
                helps a person describe themselves. It does not chat as a companion, write messages,
                or decide who is compatible with whom.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Chapter
        id="why"
        icon="chat"
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

      <section id="image-credits" data-section="image-credits" className="theme-ink">
        <div className="shell py-16 sm:py-24">
          <div className="grid-12 gap-y-8">
            <div className="col-span-12 lg:col-span-4">
              <p className="t-eyebrow text-accent">Image credits</p>
              <h2 className="t-headline mt-4">Who made the pictures.</h2>
            </div>
            <div className="col-span-12 text-muted lg:col-span-7 lg:col-start-6">
              <p>
                The photographs on this site are licensed stock images of models. They are not
                pictures of VYRA members, testimonials or results, and none shows the app’s features
                at work. The screens of the app, where they appear, are real captures of the current
                build. Credit is given to each photographer, with a link to the source.
              </p>
              <ul className="mt-8 border-t border-line">
                {(Object.keys(photos) as PhotoKey[]).map((key) => (
                  <li
                    key={key}
                    className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line py-3"
                  >
                    <a
                      href={photos[key].credit.source}
                      rel="noopener external"
                      className="prose-link text-fg"
                    >
                      {photos[key].title}
                    </a>
                    <span className="t-small">
                      {photos[key].credit.author} on {photos[key].credit.via}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="t-small mt-6">
                Icons, drawn in the surrounding text colour:{' '}
                {iconCredits.map((icon) => `${icon.name} by ${icon.author}`).join(', ')}, via
                Magnific. The orbit motif, halftone patterns, stickers and rings are drawn for VYRA
                in CSS and SVG.
              </p>
            </div>
          </div>
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
              Sign-in, onboarding, the AI persona, the compatibility engine and a first version of
              Discover are built. Orbit, connection requests and messaging are not.
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
        photo="walkingCouple"
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
