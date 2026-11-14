import type { Metadata } from 'next';
import Link from 'next/link';
import { EngineReadout } from '@/components/engine-readout';
import { Answer } from '@/components/answer';
import { ClosingCta } from '@/components/closing-cta';
import { EnterCta } from '@/components/enter-cta';
import { JsonLd } from '@/components/json-ld';
import { Marquee } from '@/components/marquee';
import { OrbitField } from '@/components/orbit-field';
import { Parallax } from '@/components/parallax';
import { PhoneShot } from '@/components/phone-shot';
import { Reveal } from '@/components/reveal';
import { SectionLabel } from '@/components/section-label';
import { type Status, StatusTag } from '@/components/status-tag';
import { FurtherReading } from '@/components/further-reading';
import { entity } from '@/lib/entity';
import { webPageJsonLd } from '@/lib/json-ld';
import { pageMetadata, pages } from '@/lib/routes';
import { screens } from '@/lib/screens';

export const metadata: Metadata = pageMetadata('home');

const ecosystem: readonly { name: string; status: Status; text: string }[] = [
  {
    name: 'Connections',
    status: 'building',
    text: 'A request is sent on purpose and accepted on purpose. Saved profiles and mutual connections are kept in one place.',
  },
  {
    name: 'Messages',
    status: 'planned',
    text: 'A conversation opens only when a connection is mutual. Nobody you have not chosen can write to you.',
  },
  {
    name: 'Wingman',
    status: 'planned',
    text: 'Opening lines and date ideas drawn from what you both chose to share. It suggests; you press send, every time.',
  },
  {
    name: 'TrendSync',
    status: 'planned',
    text: 'The music, films and places you have in common, shown alongside compatibility and never mixed into the score.',
  },
  {
    name: 'BestPic',
    status: 'planned',
    text: 'Advice on which of your photos to lead with. It never edits or publishes a photo for you.',
  },
];

const controls = [
  'Every AI feature is optional and asks first.',
  'You see, edit and approve anything VYRA infers about you.',
  'Nothing is ever sent in your name without you pressing send.',
  'You can delete your account and data at any time.',
];

export default function HomePage() {
  return (
    <>
      <JsonLd data={webPageJsonLd(pages.home)} />

      {/* ───────────── Hero ───────────── */}
      <section data-section="hero" className="theme-ink relative overflow-hidden">
        <OrbitField className="pointer-events-none absolute -right-[55%] -top-[8%] w-[150%] max-w-none sm:-right-[22%] sm:-top-[30%] sm:w-[92%]" />
        <div className="shell relative pt-8 sm:pt-12">
          <div className="t-eyebrow flex items-center justify-between text-muted">
            <p>Relationship intelligence</p>
            <p className="hidden sm:block">Pre-launch · In development</p>
          </div>

          <div className="relative mt-8 sm:mt-10 lg:min-h-[50vw] 2xl:min-h-[50rem]">
            <h1 className="t-mega relative z-10 max-sm:text-[19.5vw]">
              Chemistry
              <br />
              isn’t a
              <br />
              <em className="text-accent">
                guessing <br className="sm:hidden" />
                game.
              </em>
            </h1>

            <div className="relative z-10 mt-8 max-w-md lg:mt-12">
              <p className="t-lede text-muted">
                Discover people through personality, communication, shared interests and the things
                that actually make a connection work.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <EnterCta location="hero" />
                <Link
                  href="/how-it-works"
                  className="btn btn-ghost"
                  data-cta="explore_experience"
                  data-cta-location="hero"
                >
                  Explore the experience
                </Link>
              </div>
            </div>

            {/* Real screens from the app, set against the headline. */}
            <div className="relative mt-14 h-[112vw] sm:h-[78vw] lg:absolute lg:-right-[1vw] lg:top-0 lg:mt-0 lg:h-auto lg:w-[41vw] lg:max-w-[43rem]">
              <Parallax
                travel={70}
                className="absolute left-[2%] top-[9%] w-[47%] -rotate-[7deg] lg:left-[13%] lg:top-[19vw] lg:w-[43%] 2xl:top-[19rem]"
              >
                <PhoneShot {...screens.interests} sizes="(min-width: 1024px) 20vw, 47vw" eager />
              </Parallax>
              <Parallax
                travel={-50}
                className="absolute right-[2%] top-0 w-[53%] rotate-[4deg] lg:right-[3%] lg:w-[51%]"
              >
                <PhoneShot
                  {...screens.personaReview}
                  sizes="(min-width: 1024px) 23vw, 53vw"
                  eager
                />
              </Parallax>
            </div>
          </div>
        </div>
        <div className="relative z-20 mt-6 bg-bg lg:mt-24">
          <Marquee
            label="VYRA looks at personality, communication, shared interests, intentions, pace of life and values."
            items={[
              'Personality',
              'Communication',
              'Shared interests',
              'Intentions',
              'Pace of life',
              'Values',
            ]}
          />
        </div>
      </section>

      {/* ───────────── What is VYRA? ───────────── */}
      <section
        id="what-is-vyra"
        data-section="what-is-vyra"
        className="theme-ink border-b border-line"
      >
        <div className="shell py-16 sm:py-24">
          <Answer question="What is VYRA?">
            <p>{entity.answer}</p>
            <p className="font-sans text-base leading-relaxed tracking-normal text-muted">
              It is built for adults who want to meet people through compatibility instead of a
              swipe deck, and it is launching in India first. AI helps each person describe how they
              communicate and live; the person approves that description; and VYRA compares approved
              descriptions using fixed rules it can explain. VYRA is in development and is not yet
              available to download.{' '}
              <Link href="/about" className="prose-link text-fg">
                What VYRA is and is not
              </Link>
              .
            </p>
          </Answer>
        </div>
      </section>

      {/* ───────────── The problem, the opening ───────────── */}
      <section data-section="problem" className="theme-ivory">
        <div className="shell py-20 sm:py-32">
          <SectionLabel index="01">The problem</SectionLabel>
          <div className="grid-12 mt-10 gap-y-12 sm:mt-16">
            <Reveal className="col-span-12 lg:col-span-8">
              <h2 className="t-display">
                A swipe measures reflexes. <em className="text-accent">Not chemistry.</em>
              </h2>
            </Reveal>
            <div className="col-span-12 grid gap-10 md:col-span-10 md:grid-cols-2 lg:col-span-9 lg:col-start-4">
              <Reveal>
                <h3 className="t-eyebrow text-muted">What a photo can’t tell you</h3>
                <p className="t-lede mt-4">
                  Most dating apps ask you to judge a person from a few photos and a line of text,
                  then do it again, and again. That tells you who photographs well. It says nothing
                  about how someone argues, how they spend a Sunday, or what they are actually
                  looking for.
                </p>
              </Reveal>
              <Reveal delay={0.1}>
                <h3 className="t-eyebrow text-muted">Where VYRA starts instead</h3>
                <p className="t-lede mt-4">
                  VYRA begins with the things you would only learn on a fourth date: how you
                  communicate, how you handle a disagreement, what pace of life suits you. It works
                  out who you might connect with, and why, before it shows you anyone.
                </p>
              </Reveal>
            </div>
          </div>
          <Reveal className="mt-16 sm:mt-24">
            <ul className="grid border-t border-line md:grid-cols-3">
              {[
                [
                  'No swipe deck',
                  'Profiles are read in full, one at a time, each with the reasons it was suggested.',
                ],
                ['No black box', 'Every suggestion arrives with its reasons, in plain language.'],
                ['No streaks', 'Nothing in VYRA is tuned to keep you scrolling.'],
              ].map(([title, text]) => (
                <li
                  key={title}
                  className="border-b border-line py-6 md:border-b-0 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0"
                >
                  <p className="t-title">{title}</p>
                  <p className="mt-2 text-muted">{text}</p>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ───────────── AI persona ───────────── */}
      <section data-section="persona" className="theme-ink relative overflow-hidden">
        <div className="shell py-20 sm:py-32">
          <SectionLabel index="02">AI persona</SectionLabel>
          <div className="grid-12 mt-10 gap-y-14 sm:mt-16">
            <div className="col-span-12 lg:col-span-6">
              <Reveal>
                <h2 className="t-display">
                  A portrait of you. <em className="text-accent">Signed off by you.</em>
                </h2>
                <p className="t-lede mt-8 max-w-xl text-muted">
                  VYRA drafts a short description of how you communicate, socialise and want to
                  relate. It can work from your own profile, or from the AI assistant you already
                  talk to. Nothing in it is used, or shown to anyone, until you have read it and
                  approved it.
                </p>
              </Reveal>
              <Reveal delay={0.1}>
                <dl className="mt-12 border-t border-line">
                  {[
                    [
                      'You told us',
                      'What you stated or confirmed yourself. No later source can overwrite it.',
                    ],
                    [
                      'We inferred',
                      'Each inference comes with its confidence in words and the reason behind it.',
                    ],
                    [
                      'Not known yet',
                      'Gaps stay gaps. An unknown is never filled in with a default.',
                    ],
                  ].map(([term, text]) => (
                    <div key={term} className="grid-12 items-baseline border-b border-line py-5">
                      <dt className="t-title col-span-12 italic sm:col-span-5">{term}</dt>
                      <dd className="col-span-12 mt-1 text-muted sm:col-span-7 sm:mt-0">{text}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3">
                  <Link href="/ai-persona" className="arrow-link">
                    How the AI persona works{' '}
                    <span className="arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                  <StatusTag status="built" />
                </div>
              </Reveal>
            </div>
            <div className="relative col-span-12 h-[118vw] sm:h-[80vw] lg:col-span-5 lg:col-start-8 lg:h-auto lg:min-h-[48rem]">
              <Parallax
                travel={60}
                className="absolute left-0 top-0 w-[56%] rotate-[-3deg] lg:w-[62%]"
              >
                <PhoneShot {...screens.personaApproved} sizes="(min-width: 1024px) 24vw, 56vw" />
              </Parallax>
              <Parallax
                travel={-60}
                className="absolute right-0 top-[22%] w-[50%] rotate-[5deg] lg:w-[54%]"
              >
                <PhoneShot {...screens.askAiPick} sizes="(min-width: 1024px) 21vw, 50vw" />
              </Parallax>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Compatibility ───────────── */}
      <section data-section="compatibility" className="theme-oxblood">
        <div className="shell py-20 sm:py-32">
          <SectionLabel index="03">Compatibility</SectionLabel>
          <div className="grid-12 mt-10 gap-y-14 sm:mt-16">
            <Reveal className="col-span-12 lg:col-span-5">
              <h2 className="t-display">
                Six dimensions. <em>Zero fortune-telling.</em>
              </h2>
              <p className="t-lede mt-8 text-muted">
                Compatibility in VYRA is arithmetic you can inspect, not a verdict from a model.
                Hard limits come first: age, intention and your own must-haves. Then six weighted
                dimensions, each with the reasons it scored the way it did.
              </p>
              <p className="mt-6 text-muted">
                When too little is known about two people, VYRA says “not enough to say” instead of
                producing a number. Missing information never makes a match look stronger.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3">
                <Link href="/compatibility" className="arrow-link">
                  How compatibility is calculated{' '}
                  <span className="arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
                <StatusTag status="partial" />
              </div>
            </Reveal>
            <Reveal delay={0.1} className="col-span-12 lg:col-span-6 lg:col-start-7">
              <EngineReadout />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ───────────── Discovery ───────────── */}
      <section data-section="discovery" className="theme-ivory overflow-hidden">
        <div className="shell py-20 sm:py-32">
          <SectionLabel index="04">Discovery</SectionLabel>
          <div className="grid-12 mt-10 gap-y-14 sm:mt-16">
            <div className="relative order-last col-span-12 h-[112vw] sm:h-[76vw] lg:order-none lg:col-span-5 lg:h-auto lg:min-h-[46rem]">
              <Parallax
                travel={-50}
                className="absolute left-[3%] top-[14%] w-[48%] rotate-[-5deg] lg:w-[54%]"
              >
                <PhoneShot {...screens.orbitEmpty} sizes="(min-width: 1024px) 22vw, 50vw" />
              </Parallax>
              <Parallax
                travel={60}
                className="absolute right-0 top-0 w-[54%] rotate-[3deg] lg:w-[60%]"
              >
                <PhoneShot {...screens.discover} sizes="(min-width: 1024px) 24vw, 54vw" />
              </Parallax>
            </div>
            <div className="col-span-12 lg:col-span-6 lg:col-start-7">
              <Reveal>
                <h2 className="t-display">
                  Read people. <em className="text-accent">Don’t flick past them.</em>
                </h2>
                <p className="t-lede mt-8 text-muted">
                  Two ways in. <strong className="font-semibold text-fg">Orbit</strong> places
                  people around you by estimated alignment: the closer someone sits to your centre,
                  the more you appear to have in common.{' '}
                  <strong className="font-semibold text-fg">Discover</strong> lists people in order
                  of estimated alignment and opens one full profile at a time, with the reasons you
                  were suggested to each other.
                </p>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-8 border-l-2 border-accent pl-5 text-muted">
                  Both screens are shown exactly as they are in today’s build. Discover has its
                  first version: a ranked list and a profile preview, here with an invented sample
                  person. Orbit is still an empty state, and the Connect, Save and Pass actions are
                  not built yet. We would rather show you that than a mock-up.
                </p>
                <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3">
                  <Link href="/features#discovery" className="arrow-link">
                    How discovery works in VYRA{' '}
                    <span className="arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                  <StatusTag status="partial" />
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── From match to meeting ───────────── */}
      <section data-section="ecosystem" className="theme-ink">
        <div className="shell py-20 sm:py-32">
          <SectionLabel index="05">Beyond the match</SectionLabel>
          <div className="grid-12 mt-10 gap-y-12 sm:mt-16">
            <Reveal className="col-span-12 lg:col-span-7">
              <h2 className="t-display">
                The point is to <em className="text-accent">meet.</em>
              </h2>
            </Reveal>
            <Reveal delay={0.1} className="col-span-12 md:col-span-8 lg:col-span-4 lg:col-start-9">
              <p className="t-lede text-muted">
                A good suggestion is only the start. What follows is being built around one rule:
                the app helps, and you decide. None of the features below is in the app yet, and
                each is marked as such.
              </p>
            </Reveal>
          </div>
          <ol className="mt-14 border-t border-line sm:mt-20">
            {ecosystem.map((item, index) => (
              <Reveal
                as="li"
                key={item.name}
                delay={0.04 * index}
                distance={16}
                className="grid-12 items-baseline gap-y-2 border-b border-line py-6 sm:py-8"
              >
                <span className="t-eyebrow col-span-2 text-muted sm:col-span-1" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="t-headline col-span-10 sm:col-span-4">{item.name}</h3>
                <p className="col-span-12 text-muted sm:col-span-5">{item.text}</p>
                <div className="col-span-12 sm:col-span-2 sm:text-right">
                  <StatusTag status={item.status} />
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────────── Privacy and control ───────────── */}
      <section data-section="privacy" className="theme-ivory overflow-hidden">
        <div className="shell py-20 sm:py-32">
          <SectionLabel index="06">Privacy and control</SectionLabel>
          <div className="grid-12 mt-10 gap-y-14 sm:mt-16">
            <div className="col-span-12 lg:col-span-7">
              <Reveal>
                <h2 className="t-display">
                  Your data keeps <em className="text-accent">your name on it.</em>
                </h2>
                <p className="t-lede mt-8 max-w-xl text-muted">
                  These four lines are the first thing the app asks you to read, before you create
                  an account. They are quoted here word for word.
                </p>
              </Reveal>
              <Reveal delay={0.1}>
                <ol className="mt-10 border-t border-line">
                  {controls.map((line, index) => (
                    <li key={line} className="flex gap-6 border-b border-line py-5">
                      <span className="t-eyebrow pt-2 text-accent" aria-hidden="true">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="t-title">{line}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-8 max-w-xl text-muted">
                  VYRA has no field for health, religion, caste, ethnicity, sexuality, politics or
                  finances, so none of them can be inferred, stored or shown. Location is kept as a
                  rough area; other people see a distance band, never where you are.
                </p>
                <div className="mt-10">
                  <Link href="/safety" className="arrow-link">
                    Safety, privacy and your controls{' '}
                    <span className="arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                </div>
              </Reveal>
            </div>
            <div className="relative col-span-12 h-[112vw] sm:h-[76vw] lg:col-span-4 lg:col-start-9 lg:h-auto lg:min-h-[44rem]">
              <Parallax
                travel={50}
                className="absolute left-0 top-0 w-[54%] rotate-[-4deg] lg:w-[72%]"
              >
                <PhoneShot {...screens.consent} sizes="(min-width: 1024px) 23vw, 54vw" />
              </Parallax>
              <Parallax
                travel={-50}
                className="absolute right-0 top-[20%] w-[48%] rotate-[4deg] lg:top-[34%] lg:w-[60%]"
              >
                <PhoneShot {...screens.deleteConfirm} sizes="(min-width: 1024px) 19vw, 48vw" />
              </Parallax>
            </div>
          </div>
        </div>
      </section>

      <FurtherReading slugs={['relationship-compatibility', 'ai-in-relationship-discovery']} />

      <ClosingCta
        location="home_closing"
        title={
          <>
            Stop guessing.
            <br />
            <em>Start reading.</em>
          </>
        }
      />
    </>
  );
}
