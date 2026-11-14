import type { Metadata } from 'next';
import Link from 'next/link';
import { Chapter } from '@/components/chapter';
import { ClosingCta } from '@/components/closing-cta';
import { EngineReadout } from '@/components/engine-readout';
import { PageHero } from '@/components/page-hero';
import { Reveal } from '@/components/reveal';
import { ShotFigure } from '@/components/shot-figure';
import { type Status, StatusTag } from '@/components/status-tag';
import { pageMetadata, pages } from '@/lib/routes';
import { screens } from '@/lib/screens';

export const metadata: Metadata = pageMetadata('features');

const planned: readonly { name: string; status: Status; text: string }[] = [
  {
    name: 'Connections',
    status: 'building',
    text: 'Incoming and outgoing requests, mutual connections and saved profiles, in one place.',
  },
  {
    name: 'Messages',
    status: 'planned',
    text: 'Real-time conversation, open only between two people who have both said yes.',
  },
  {
    name: 'Wingman',
    status: 'planned',
    text: 'Optional help with an opening line or a date idea, using only context you chose to share. It never sends a message itself and never invents facts about the other person.',
  },
  {
    name: 'TrendSync',
    status: 'planned',
    text: 'Overlap in interests and culture, kept separate from the compatibility estimate.',
  },
  {
    name: 'BestPic',
    status: 'planned',
    text: 'Advice on photo quality, variety and order. Advisory only: it does not alter or publish photos.',
  },
  {
    name: 'Astrology',
    status: 'planned',
    text: 'Entirely optional, clearly labelled as entertainment, and possible to hide altogether.',
  },
  {
    name: 'Assistant history import',
    status: 'planned',
    text: 'Bringing in an official export from your AI assistant. Only attributes you approve would be kept; the raw file would be deleted within 24 hours.',
  },
];

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        page={pages.features}
        index="01"
        title={
          <>
            What VYRA does, <em className="text-accent">and what it doesn’t yet.</em>
          </>
        }
        lede={
          <>
            <p>
              VYRA is being built in stages, and this page keeps score. Each capability below is
              marked as in the app today, built but still waiting for its screen, or planned.
            </p>
            <ul className="mt-6 flex flex-col gap-2">
              <li>
                <StatusTag status="built" />
              </li>
              <li>
                <StatusTag status="engine" />
              </li>
              <li>
                <StatusTag status="planned" />
              </li>
            </ul>
          </>
        }
      />

      <Chapter
        id="persona"
        index="01"
        label="AI persona"
        theme="theme-ivory"
        title={
          <>
            A description of you that <em className="text-accent">you approve.</em>
          </>
        }
        intro={
          <>
            <p>
              Twelve attributes describe how you communicate, socialise and want to relate: social
              energy, how you handle conflict, your weekend rhythm, the values you name. VYRA drafts
              them; you correct them.
            </p>
            <p>
              Each one is filed under “You told us”, “We inferred” or “Not known yet”. Inferences
              carry their confidence and their reason.
            </p>
          </>
        }
      >
        <div className="grid-12 items-start gap-y-12">
          <ShotFigure
            className="col-span-8 col-start-3 sm:col-span-5 sm:col-start-1 lg:col-span-3"
            screen={screens.personaReview}
            caption="Persona review. Every inference shows its reason and can be confirmed, changed or removed."
          />
          <ShotFigure
            className="col-span-8 col-start-3 sm:col-span-5 sm:col-start-7 sm:mt-16 lg:col-span-3 lg:col-start-5"
            screen={screens.personaEdit}
            caption="Tendencies are edited on a five-step scale. A finer slider would imply precision that isn’t there."
          />
          <Reveal className="col-span-12 lg:col-span-4 lg:col-start-9">
            <ul className="border-t border-line">
              {[
                'Draft from your own bio, interests and intentions, with your consent.',
                'Or ask the assistant you already use: ChatGPT, Gemini, Claude, DeepSeek, Copilot or another.',
                'Boundaries can only be written by you. No AI source may set them.',
                'Withdraw consent and unapproved drafts are deleted at once.',
              ].map((line) => (
                <li key={line} className="border-b border-line py-4">
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
              <Link href="/ai-persona" className="arrow-link">
                The AI persona in detail{' '}
                <span className="arrow" aria-hidden="true">
                  →
                </span>
              </Link>
              <StatusTag status="built" />
            </div>
          </Reveal>
        </div>
      </Chapter>

      <Chapter
        id="compatibility"
        index="02"
        label="Compatibility"
        theme="theme-oxblood"
        title={
          <>
            Compatibility you can <em>read the workings of.</em>
          </>
        }
        intro={
          <>
            <p>
              A pair is first checked against hard limits in both directions. Only then is it
              scored, across six weighted dimensions and ten everyday scenarios, by ordinary code
              that gives the same answer every time.
            </p>
            <p>
              The result is called estimated alignment, because that is what it is. It is not a
              forecast of a relationship.
            </p>
          </>
        }
      >
        <div className="grid-12 gap-y-10">
          <div className="col-span-12 lg:col-span-8">
            <EngineReadout />
          </div>
          <Reveal className="col-span-12 lg:col-span-3 lg:col-start-10">
            <StatusTag status="engine" />
            <p className="mt-4 text-muted">
              The engine and the ranking that uses it are built and tested. The screen that shows a
              breakdown like this inside the app is being made.
            </p>
            <Link href="/compatibility" className="arrow-link mt-8">
              How it is calculated{' '}
              <span className="arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </Reveal>
        </div>
      </Chapter>

      <Chapter
        id="discovery"
        index="03"
        label="Discovery"
        title={
          <>
            Discovery without <em className="text-accent">a swipe deck.</em>
          </>
        }
        intro={
          <>
            <p>
              Orbit is a spatial view: people are placed around you by estimated alignment, closest
              to the centre when you have most in common. Discover is for reading, one full profile
              at a time, with three deliberate actions: Connect, Save, Pass.
            </p>
            <p>
              Suggestions are ranked by alignment and by how sure VYRA is of it, so a confident
              estimate outranks a higher but shakier one. Consecutive suggestions are varied so you
              don’t see the same kind of match five times in a row.
            </p>
          </>
        }
      >
        <div className="grid-12 items-start gap-y-12">
          <ShotFigure
            className="col-span-8 col-start-3 sm:col-span-5 sm:col-start-2 lg:col-span-3 lg:col-start-2"
            screen={screens.orbitEmpty}
            caption="Orbit, as it is in today’s build: an empty state."
          />
          <ShotFigure
            className="col-span-8 col-start-3 sm:col-span-5 sm:col-start-7 sm:mt-16 lg:col-span-3 lg:col-start-6"
            screen={screens.discoverEmpty}
            caption="Discover, as it is in today’s build: an empty state."
          />
          <Reveal className="col-span-12 lg:col-span-3 lg:col-start-10">
            <StatusTag status="engine" />
            <p className="mt-4 text-muted">
              The recommendation service is built and tested end to end. These two screens do not
              show people yet, so we show them empty rather than draw what they might become.
            </p>
            <p className="mt-4 text-muted">
              Photos reach other people’s screens only after moderation has approved them.
            </p>
          </Reveal>
        </div>
      </Chapter>

      <Chapter
        id="profile"
        index="04"
        label="Profile and onboarding"
        theme="theme-ivory"
        title={
          <>
            Onboarding that asks, <em className="text-accent">then listens.</em>
          </>
        }
        intro={
          <p>
            Seven steps, most of them optional. You can be looking for more than one thing, describe
            your gender in your own terms, and skip any data source you would rather not use.
          </p>
        }
      >
        <div className="grid-12 items-start gap-y-12">
          <ShotFigure
            className="col-span-6 lg:col-span-3"
            screen={screens.intention}
            caption="Intentions are plural. Choose as many as are true, or write your own."
            sizes="(min-width: 1024px) 22vw, 46vw"
          />
          <ShotFigure
            className="col-span-6 mt-10 lg:col-span-3 lg:mt-20"
            screen={screens.interests}
            caption="Interests are optional. Shared ones are shown to people you match with."
            sizes="(min-width: 1024px) 22vw, 46vw"
          />
          <ShotFigure
            className="col-span-6 lg:col-span-3"
            screen={screens.locationSet}
            caption="Location is a rough area, or just a city you pick."
            sizes="(min-width: 1024px) 22vw, 46vw"
          />
          <ShotFigure
            className="col-span-6 mt-10 lg:col-span-3 lg:mt-20"
            screen={screens.preferences}
            caption="Preferences are limits, not rankings, and can be changed whenever you like."
            sizes="(min-width: 1024px) 22vw, 46vw"
          />
        </div>
        <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3">
          <Link href="/how-it-works" className="arrow-link">
            The journey, step by step{' '}
            <span className="arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <StatusTag status="built" />
        </div>
      </Chapter>

      <Chapter
        id="next"
        index="05"
        label="Still to come"
        title={
          <>
            Not built yet. <em className="text-accent">Said plainly.</em>
          </>
        }
        intro={
          <p>
            Everything in this list is a plan, not a feature. It is here so you can see where VYRA
            is heading and hold us to the rules written beside each one.
          </p>
        }
      >
        <ol className="border-t border-line">
          {planned.map((item, index) => (
            <li
              key={item.name}
              className="grid-12 items-baseline gap-y-2 border-b border-line py-6"
            >
              <span className="t-eyebrow col-span-2 text-muted sm:col-span-1" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="t-title col-span-10 sm:col-span-4">{item.name}</h3>
              <p className="col-span-12 text-muted sm:col-span-5">{item.text}</p>
              <div className="col-span-12 sm:col-span-2 sm:text-right">
                <StatusTag status={item.status} />
              </div>
            </li>
          ))}
        </ol>
      </Chapter>

      <ClosingCta
        location="features_closing"
        title={
          <>
            Fewer profiles.
            <br />
            <em>Better reasons.</em>
          </>
        }
      />
    </>
  );
}
