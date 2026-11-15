import type { Metadata } from 'next';
import Link from 'next/link';
import { EngineReadout } from '@/components/engine-readout';
import { Answer } from '@/components/answer';
import { Halftone, OrbitRing, RegisterMark, RotatingBadge } from '@/components/art';
import { ClosingCta } from '@/components/closing-cta';
import { EnterCta } from '@/components/enter-cta';
import { Icon, Medallion } from '@/components/icon';
import { JsonLd } from '@/components/json-ld';
import { Marquee } from '@/components/marquee';
import { OrbitField } from '@/components/orbit-field';
import { Parallax } from '@/components/parallax';
import { PhoneShot } from '@/components/phone-shot';
import { Reveal } from '@/components/reveal';
import { SectionLabel } from '@/components/section-label';
import { StockPhoto } from '@/components/stock-photo';
import { type Status, StatusTag } from '@/components/status-tag';
import { FurtherReading } from '@/components/further-reading';
import { entity } from '@/lib/entity';
import { imageObjectJsonLd, webPageJsonLd } from '@/lib/json-ld';
import type { IconName } from '@/lib/icon-data';
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

const controls: readonly (readonly [IconName, string])[] = [
  ['ai', 'Every AI feature is optional and asks first.'],
  ['persona', 'You see, edit and approve anything VYRA infers about you.'],
  ['chat', 'Nothing is ever sent in your name without you pressing send.'],
  ['privacy', 'You can delete your account and data at any time.'],
];

const pillars: readonly { icon: IconName; title: string; text: string; href: string }[] = [
  {
    icon: 'persona',
    title: 'AI persona',
    text: 'A description of you that you read, correct and approve.',
    href: '/ai-persona',
  },
  {
    icon: 'compatibility',
    title: 'Compatibility',
    text: 'Estimated alignment, with the working shown.',
    href: '/compatibility',
  },
  {
    icon: 'location',
    title: 'Discovery',
    text: 'People read in full, ranked with reasons.',
    href: '/features#discovery',
  },
  {
    icon: 'privacy',
    title: 'Safety',
    text: 'Consent per purpose, a rough location, deletion in the app.',
    href: '/safety',
  },
];

export default function HomePage() {
  return (
    <>
      <JsonLd data={webPageJsonLd(pages.home, 'neonStreet')} />
      <JsonLd data={imageObjectJsonLd('neonStreet', pages.home.path)} />

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

            {/* A stock photograph and a real screen from the app, set against the headline. */}
            <div className="relative mt-16 h-[124vw] sm:h-[82vw] lg:absolute lg:-right-[1vw] lg:top-0 lg:mt-0 lg:h-[43vw] lg:w-[43vw] lg:max-w-[46rem] 2xl:h-[46rem]">
              <Parallax
                travel={-40}
                className="absolute right-[3%] top-0 w-[56%] lg:right-[2%] lg:w-[52%]"
              >
                <StockPhoto
                  photo="neonStreet"
                  eager
                  sizes="(min-width: 1024px) 24vw, 56vw"
                  frame="aspect-[2/3] rounded-t-[999px]"
                  caption="label"
                  tone="warm"
                  className="[&_figcaption]:text-right"
                />
                <OrbitRing className="-inset-[26%] size-[152%]" rotate={-16} dot="70%" />
              </Parallax>
              <Parallax
                travel={60}
                className="absolute bottom-[4%] left-[0%] w-[48%] -rotate-[6deg] lg:bottom-[2%] lg:left-[4%] lg:w-[42%]"
              >
                <PhoneShot
                  {...screens.personaReview}
                  sizes="(min-width: 1024px) 20vw, 50vw"
                  eager
                />
              </Parallax>
              <RotatingBadge className="absolute bottom-[1%] right-[0%] size-[28%] lg:bottom-[0%] lg:right-[2%] lg:size-[22%]" />
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
          <ul className="mt-14 grid border-t border-line sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((pillar) => (
              <li
                key={pillar.title}
                className="border-b border-line lg:border-b-0 lg:border-r lg:last:border-r-0"
              >
                <Link
                  href={pillar.href as never}
                  className="group flex h-full flex-col gap-5 px-1 py-7 lg:px-7 lg:first:pl-0"
                >
                  <Medallion
                    name={pillar.icon}
                    className="transition-colors group-hover:bg-cherry group-hover:text-ivory"
                  />
                  <span className="t-title">{pillar.title}</span>
                  <span className="text-muted">{pillar.text}</span>
                  <span
                    className="arrow-link mt-auto w-fit border-0 pb-0 text-sm"
                    aria-hidden="true"
                  >
                    Read more <span className="arrow">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────────── The problem, the opening ───────────── */}
      <section data-section="problem" className="theme-ivory relative overflow-hidden">
        <Halftone
          className="-left-10 top-28 h-72 w-[26rem] text-accent opacity-25"
          fade="right"
          size={12}
          dot={1.8}
        />
        <div className="shell relative py-20 sm:py-32">
          <SectionLabel index="01">The problem</SectionLabel>
          <div className="grid-12 mt-10 gap-y-12 sm:mt-16">
            <Reveal className="col-span-12 lg:col-span-7">
              <h2 className="t-display">
                A swipe measures reflexes. <em className="text-accent">Not chemistry.</em>
              </h2>
            </Reveal>
            <Reveal
              delay={0.1}
              className="relative col-span-10 col-start-2 sm:col-span-7 sm:col-start-3 lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:-mt-10"
            >
              <div className="rotate-[2deg]">
                <StockPhoto
                  photo="pizzaFriends"
                  sizes="(min-width: 1024px) 30vw, 80vw"
                  frame="aspect-[4/5]"
                  tone="warm"
                />
              </div>
              <RegisterMark className="absolute -left-3 -top-3" />
              <RegisterMark className="absolute -right-3 top-[-0.75rem]" />
            </Reveal>
            <div className="col-span-12 grid gap-10 md:grid-cols-2 lg:col-span-7">
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
          <SectionLabel index="02" icon="persona">
            AI persona
          </SectionLabel>
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
            <div className="relative col-span-12 h-[132vw] sm:h-[88vw] lg:col-span-5 lg:col-start-8 lg:h-auto lg:min-h-[50rem]">
              <Parallax travel={-40} className="absolute right-0 top-0 w-[64%] lg:w-[68%]">
                <StockPhoto
                  photo="restaurantPhone"
                  sizes="(min-width: 1024px) 26vw, 64vw"
                  frame="aspect-[4/5] rounded-[50%]"
                  caption="label"
                  tone="warm"
                  className="[&_figcaption]:text-right"
                />
                <OrbitRing className="-inset-[24%] size-[148%]" rotate={-22} dot="40%" />
              </Parallax>
              <Parallax
                travel={60}
                className="absolute bottom-[6%] left-0 w-[50%] rotate-[-4deg] lg:bottom-[4%] lg:w-[48%]"
              >
                <PhoneShot {...screens.personaApproved} sizes="(min-width: 1024px) 20vw, 50vw" />
              </Parallax>
              <Parallax
                travel={-30}
                className="absolute bottom-0 right-[2%] w-[34%] rotate-[5deg] max-sm:hidden lg:right-0 lg:w-[38%]"
              >
                <PhoneShot {...screens.askAiPick} sizes="(min-width: 1024px) 16vw, 40vw" />
              </Parallax>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Compatibility ───────────── */}
      <section data-section="compatibility" className="theme-oxblood overflow-hidden">
        <div className="shell py-20 sm:py-32">
          <SectionLabel index="03" icon="compatibility">
            Compatibility
          </SectionLabel>
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
              <div className="relative mt-14">
                <StockPhoto
                  photo="walkingCouple"
                  sizes="(min-width: 1024px) 40vw, 94vw"
                  frame="aspect-[16/10]"
                  tone="duotone"
                />
                <RotatingBadge className="absolute -right-3 -top-8 size-24 sm:-right-5 sm:size-28" />
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
          <SectionLabel index="04" icon="location">
            Discovery
          </SectionLabel>
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
              <div className="absolute bottom-[2%] left-[2%] w-[38%] lg:bottom-[4%] lg:left-0 lg:w-[34%]">
                <StockPhoto
                  photo="barLaugh"
                  sizes="(min-width: 1024px) 14vw, 38vw"
                  frame="aspect-square rounded-full"
                  caption={false}
                  tone="warm"
                />
                <OrbitRing className="-inset-[30%] size-[160%]" rotate={-12} dot="20%" />
              </div>
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
        <div className="relative">
          <StockPhoto
            photo="selfieNight"
            sizes="100vw"
            frame="aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9]"
            caption="label"
            className="[&_figcaption]:shell [&_figcaption]:py-3"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-transparent" />
            <div className="shell absolute inset-x-0 bottom-0 pb-8 sm:pb-14">
              <SectionLabel index="05">Beyond the match</SectionLabel>
              <h2 className="t-display mt-8 max-w-[14ch]">
                The point is to <em className="text-accent">meet.</em>
              </h2>
            </div>
          </StockPhoto>
        </div>
        <div className="shell pb-20 pt-14 sm:pb-32 sm:pt-20">
          <Reveal className="max-w-2xl">
            <p className="t-lede text-muted">
              A good suggestion is only the start. What follows is being built around one rule: the
              app helps, and you decide. None of the features below is in the app yet, and each is
              marked as such.
            </p>
          </Reveal>
          <ol className="mt-14 border-t border-line sm:mt-16">
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
          <SectionLabel index="06" icon="privacy">
            Privacy and control
          </SectionLabel>
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
                  {controls.map(([icon, line]) => (
                    <li key={line} className="flex items-center gap-6 border-b border-line py-5">
                      <Icon name={icon} className="size-9 shrink-0 text-accent" />
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
            <div className="relative col-span-12 h-[124vw] sm:h-[84vw] lg:col-span-4 lg:col-start-9 lg:h-auto lg:min-h-[48rem]">
              <Parallax
                travel={-40}
                className="absolute right-0 top-0 w-[58%] rotate-[3deg] lg:w-[66%]"
              >
                <StockPhoto
                  photo="nightPhone"
                  sizes="(min-width: 1024px) 22vw, 58vw"
                  frame="aspect-[4/5]"
                  caption="label"
                  tone="warm"
                />
                <RegisterMark className="absolute -left-3 -top-3" />
                <RegisterMark className="absolute -right-3 -top-3" />
              </Parallax>
              <Parallax
                travel={50}
                className="absolute bottom-[3%] left-0 w-[50%] rotate-[-4deg] lg:bottom-[2%] lg:w-[58%]"
              >
                <PhoneShot {...screens.consent} sizes="(min-width: 1024px) 20vw, 50vw" />
              </Parallax>
              <Parallax
                travel={-30}
                className="absolute bottom-0 right-[2%] w-[38%] rotate-[5deg] max-sm:hidden lg:right-0 lg:w-[40%]"
              >
                <PhoneShot {...screens.deleteConfirm} sizes="(min-width: 1024px) 14vw, 38vw" />
              </Parallax>
            </div>
          </div>
        </div>
      </section>

      <FurtherReading slugs={['relationship-compatibility', 'ai-in-relationship-discovery']} />

      <ClosingCta
        location="home_closing"
        photo="dessert"
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
