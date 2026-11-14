import type { Metadata } from 'next';
import type { StaticImageData } from 'next/image';
import Link from 'next/link';
import { Chapter } from '@/components/chapter';
import { ClosingCta } from '@/components/closing-cta';
import { Faq } from '@/components/faq';
import { FurtherReading } from '@/components/further-reading';
import { PageHero } from '@/components/page-hero';
import { PhoneShot } from '@/components/phone-shot';
import { Reveal } from '@/components/reveal';
import { StatusTag } from '@/components/status-tag';
import { pageMetadata, pages } from '@/lib/routes';
import { screens } from '@/lib/screens';
import { site } from '@/lib/site';

export const metadata: Metadata = pageMetadata('howItWorks');

interface Step {
  readonly title: string;
  readonly body: readonly string[];
  readonly optional?: boolean;
  readonly screen: { readonly src: StaticImageData; readonly alt: string };
}

const steps: readonly Step[] = [
  {
    title: 'Sign in with a one-time code',
    body: [
      'There are no passwords. You enter a phone number or an e-mail address and type in the code VYRA sends.',
      'Then two things before anything else: your date of birth, because VYRA is for adults only, and a short plain-language page on how VYRA treats you, which you agree to or walk away from.',
    ],
    screen: screens.consent,
  },
  {
    title: 'Start with you',
    body: [
      'Your name, how you describe your gender and whether to show it, what you do, and a few lines in your own words. Your age appears on your profile; your date of birth never does.',
    ],
    screen: screens.identity,
  },
  {
    title: 'Add photos',
    body: [
      'Up to six. Every photo is checked before anyone else can see it, and any location data inside the file is removed when it is uploaded.',
    ],
    screen: screens.photos,
  },
  {
    title: 'Say what pulls you in, and what you are here for',
    body: [
      'Pick interests that are true rather than ones that sound good. Then choose what you are looking for: something serious, something casual, still working it out, companionship, or your own words. You can choose more than one.',
      'You are only shown people whose intentions overlap with yours.',
    ],
    optional: true,
    screen: screens.intention,
  },
  {
    title: 'Help VYRA understand you',
    body: [
      'Two optional routes. Let VYRA draft a persona from your bio, interests and intentions. Or copy a short questionnaire into the AI assistant you already talk to and paste its answer back.',
      'VYRA never connects to your assistant and never keeps the reply. It reads only the answers.',
    ],
    optional: true,
    screen: screens.understand,
  },
  {
    title: 'Check the persona: “Is this you?”',
    body: [
      'You see what you told VYRA, what it inferred and how confident it is, and what it does not know. Confirm, change or remove anything, then approve it or discard the lot.',
      'An unapproved draft is never used for matching.',
    ],
    screen: screens.personaReview,
  },
  {
    title: 'Set where you are and who to look for',
    body: [
      'Location is optional and deliberately vague: an area of about two kilometres, or simply a city you pick. Other people only ever see a band such as “About 10 km away”.',
      'Then an age range, who you want to see, and a distance. These are limits, not rankings.',
    ],
    optional: true,
    screen: screens.preferences,
  },
  {
    title: 'Say what matters most',
    body: [
      'For pace of life, weekends, communication style and values, choose must-have, preference or open. A must-have removes people known not to match. A preference only changes the order. Open has no effect.',
      'A must-have never removes someone simply because VYRA does not know the answer for them, and your choices are private.',
    ],
    optional: true,
    screen: screens.matters,
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        page={pages.howItWorks}
        index="02"
        title={
          <>
            From first code to <em className="text-accent">first suggestion.</em>
          </>
        }
        lede={
          <p>
            Getting started with VYRA takes eight short steps. Five of them can be skipped, and
            nothing you give is used for matching until you have seen what VYRA made of it. Every
            screen on this page is from the real app.
          </p>
        }
      />

      <section data-section="steps" className="theme-ivory">
        <div className="shell py-16 sm:py-24">
          <h2 className="sr-only">The steps</h2>
          <ol>
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="grid-12 items-center gap-y-8 border-t border-line py-12 sm:py-20"
              >
                <div
                  className={`col-span-12 md:col-span-6 lg:col-span-5 ${index % 2 === 1 ? 'md:order-last md:col-start-7 lg:col-start-8' : ''}`}
                >
                  <Reveal>
                    <p className="flex items-baseline gap-5">
                      <span
                        aria-hidden="true"
                        className="font-display text-[clamp(4.5rem,9vw,8.5rem)] leading-[0.8] text-accent"
                      >
                        {index + 1}
                      </span>
                      {step.optional ? (
                        <span className="t-eyebrow text-muted">Optional · skippable</span>
                      ) : null}
                    </p>
                    <h3 className="t-headline mt-6">
                      <span className="sr-only">Step {index + 1}: </span>
                      {step.title}
                    </h3>
                    {step.body.map((paragraph) => (
                      <p key={paragraph} className="t-lede mt-5 text-muted">
                        {paragraph}
                      </p>
                    ))}
                  </Reveal>
                </div>
                <Reveal
                  delay={0.08}
                  className={`col-span-8 col-start-3 md:col-span-4 lg:col-span-3 ${index % 2 === 1 ? 'md:col-start-2 lg:col-start-3' : 'md:col-start-8 lg:col-start-8'}`}
                >
                  <PhoneShot
                    {...step.screen}
                    className={index % 2 === 1 ? '-rotate-2' : 'rotate-2'}
                    sizes="(min-width: 1024px) 23vw, (min-width: 768px) 31vw, 64vw"
                  />
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Chapter
        id="after"
        index="08"
        label="What happens next"
        title={
          <>
            Then VYRA goes <em className="text-accent">looking.</em>
          </>
        }
        intro={
          <>
            <p>
              With an approved persona, VYRA can compare you with other people who have one. It
              removes anyone outside either person’s limits, estimates alignment for the rest, and
              ranks them by how aligned you appear and how sure it is.
            </p>
            <p>
              Each suggestion comes with two or three reasons in plain words, and with what you have
              in common.
            </p>
          </>
        }
      >
        <div className="grid-12 gap-y-8">
          <Reveal className="col-span-12 md:col-span-6 lg:col-span-5">
            <StatusTag status="partial" />
            <p className="mt-4 text-muted">
              The Discover tab already lists suggestions in this order and opens a profile preview
              with the reasons. The Orbit view and the actions to connect, save or pass are in
              development.
            </p>
          </Reveal>
          <div className="col-span-12 flex flex-wrap gap-x-10 gap-y-4 md:col-span-6 lg:col-start-8">
            <Link href="/compatibility" className="arrow-link">
              How compatibility is estimated{' '}
              <span className="arrow" aria-hidden="true">
                →
              </span>
            </Link>
            <Link href="/features#discovery" className="arrow-link">
              Discovery in VYRA{' '}
              <span className="arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </div>
      </Chapter>

      <Chapter
        id="availability"
        index="09"
        label="Availability"
        theme="theme-ivory"
        title={
          <>
            Where VYRA <em className="text-accent">stands today.</em>
          </>
        }
        intro={
          site.appUrl ? (
            <p>
              VYRA is open.{' '}
              <a className="prose-link" href={site.appUrl}>
                Enter VYRA
              </a>{' '}
              to create your account.
            </p>
          ) : (
            <p>
              VYRA is in development. It is not in an app store and there is no public sign-up or
              waiting list yet. When that changes, the “Enter VYRA” button on this site will take
              you straight in.
            </p>
          )
        }
      >
        <Faq
          items={[
            {
              question: 'What works right now?',
              answer: (
                <p>
                  Sign-in, the age check and consent, the full onboarding, photo upload with
                  moderation, the AI persona and its review, approximate location, must-haves and
                  preferences, account deletion, and a first version of Discover: a ranked list of
                  suggestions with reasons, and a profile preview.
                </p>
              ),
            },
            {
              question: 'What is still being built?',
              answer: (
                <p>
                  The Orbit view, connection requests (Connect, Save and Pass), and messaging. The{' '}
                  <Link className="prose-link" href="/features#next">
                    features page
                  </Link>{' '}
                  lists everything that is planned.
                </p>
              ),
            },
            {
              question: 'Where will it launch?',
              answer: (
                <p>India first. The product is being built so that other countries can follow.</p>
              ),
            },
            {
              question: 'Who can use it?',
              answer: <p>Adults aged 18 and over. Anyone younger is turned away at sign-up.</p>,
            },
          ]}
        />
      </Chapter>

      <FurtherReading
        slugs={['dating-beyond-swiping', 'ai-in-relationship-discovery']}
        theme="theme-ink"
      />

      <ClosingCta
        location="how_it_works_closing"
        title={
          <>
            Eight steps.
            <br />
            <em>No guesswork.</em>
          </>
        }
      />
    </>
  );
}
