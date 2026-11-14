import type { Metadata } from 'next';
import Link from 'next/link';
import { Chapter } from '@/components/chapter';
import { ClosingCta } from '@/components/closing-cta';
import { PageHero } from '@/components/page-hero';
import { Reveal } from '@/components/reveal';
import { ShotFigure } from '@/components/shot-figure';
import { type Status, StatusTag } from '@/components/status-tag';
import { pageMetadata, pages } from '@/lib/routes';
import { screens } from '@/lib/screens';

export const metadata: Metadata = pageMetadata('safety');

const protections: readonly (readonly [string, string])[] = [
  [
    'Adults only',
    'You give your date of birth before an account exists. Anyone under 18 is refused. Your age shows on your profile; your date of birth never does.',
  ],
  [
    'No passwords to steal',
    'Sign-in is by one-time code. Codes are stored only as hashes, expire quickly and are limited per address. Sessions are short-lived and rotate, and a reused session token is treated as theft.',
  ],
  [
    'Photos are checked first',
    'Every photo is moderated before anyone else can see it. Photos are re-encoded on upload with location data removed, and served only through short-lived signed links.',
  ],
  [
    'Location stays vague',
    'VYRA keeps a rough area of about two kilometres, or just the city you choose. Other people see a distance band, never a place. Background location is switched off in the app itself.',
  ],
  [
    'No sensitive traits',
    'There is no field for health, religion, caste, ethnicity, sexuality, politics or finances, and inferences about them are filtered out.',
  ],
  [
    'AI output is not trusted',
    'Whatever a model returns is treated as unverified data and checked against what you actually provided. Text you paste in is never executed as instructions.',
  ],
];

const controls: readonly (readonly [string, string])[] = [
  [
    'Consent, one purpose at a time',
    'Reading your profile to draft a persona and reading an answer you paste from your assistant are separate permissions. Each can be withdrawn in Settings.',
  ],
  [
    'See and edit everything inferred',
    'Every persona attribute is visible, with its source. Confirm it, change it or remove it.',
  ],
  ['Hide yourself', 'One switch makes you invisible to anyone new, without deleting anything.'],
  [
    'Remove your location',
    'Take it away whenever you like. Distance then simply stops being used to find people.',
  ],
  [
    'Delete your account',
    'In the app, under You. Your profile, photos and preferences are removed straight away, not queued for later.',
  ],
];

const upcoming: readonly { name: string; status: Status; text: string }[] = [
  {
    name: 'Blocking and reporting',
    status: 'building',
    text: 'Arriving with the screens that show people to each other. Blocks already exclude a pair from matching in the engine.',
  },
  {
    name: 'Messaging between mutual connections only',
    status: 'planned',
    text: 'No one you have not accepted will be able to message you.',
  },
  {
    name: 'A Wingman that cannot speak for you',
    status: 'planned',
    text: 'Suggestions only. Every message will be sent by an explicit action of yours.',
  },
  {
    name: 'Stronger age and identity checks',
    status: 'planned',
    text: 'Today the age check is a self-declared date of birth. We say so because you should know.',
  },
];

export default function SafetyPage() {
  return (
    <>
      <PageHero
        page={pages.safety}
        index="05"
        title={
          <>
            Private by design. <em className="text-accent">Yours to control.</em>
          </>
        }
        lede={
          <p>
            A dating app holds some of the most personal information there is. VYRA treats privacy
            and safety as conditions for building a feature at all. This page sets out what is in
            place, what you control, and what is not finished.
          </p>
        }
      />

      <Chapter
        id="protections"
        index="01"
        label="What is in place"
        theme="theme-ivory"
        title={
          <>
            Protections that are <em className="text-accent">already built.</em>
          </>
        }
        intro={
          <div>
            <StatusTag status="built" />
            <p className="mt-4">
              Each of these is implemented and covered by automated tests in the current build.
            </p>
          </div>
        }
      >
        <div className="grid-12 items-start gap-y-12">
          <Reveal className="col-span-12 lg:col-span-8">
            <ul className="grid border-t border-line sm:grid-cols-2 sm:gap-x-[clamp(1.5rem,3vw,3.5rem)]">
              {protections.map(([title, text]) => (
                <li key={title} className="border-b border-line py-6">
                  <h3 className="t-title">{title}</h3>
                  <p className="mt-2 text-muted">{text}</p>
                </li>
              ))}
            </ul>
          </Reveal>
          <ShotFigure
            className="col-span-8 col-start-3 sm:col-span-6 sm:col-start-4 lg:col-span-3 lg:col-start-10"
            screen={screens.locationSet}
            caption="The location step: a rough area only, and a city you can choose yourself."
          />
        </div>
      </Chapter>

      <Chapter
        id="controls"
        index="02"
        label="Your controls"
        title={
          <>
            Five things you can do <em className="text-accent">without asking anyone.</em>
          </>
        }
        intro={
          <p>
            None of these needs an e-mail to support or a waiting period. They are switches and
            buttons in the app.
          </p>
        }
      >
        <div className="grid-12 items-start gap-y-12">
          <ShotFigure
            className="col-span-8 col-start-3 sm:col-span-6 sm:col-start-4 lg:col-span-3 lg:col-start-1"
            screen={screens.deleteConfirm}
            caption="Deleting an account from the You tab."
          />
          <Reveal className="col-span-12 lg:col-span-8 lg:col-start-5">
            <ol className="border-t border-line">
              {controls.map(([title, text], index) => (
                <li
                  key={title}
                  className="grid-12 items-baseline gap-y-1 border-b border-line py-6"
                >
                  <span
                    className="t-eyebrow col-span-2 text-accent sm:col-span-1"
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="t-title col-span-10 sm:col-span-5">{title}</h3>
                  <p className="col-span-12 text-muted sm:col-span-6">{text}</p>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </Chapter>

      <Chapter
        id="ai"
        index="03"
        label="AI, kept in its place"
        theme="theme-oxblood"
        title={
          <>
            AI helps you describe yourself. <em>It decides nothing.</em>
          </>
        }
        intro={
          <>
            <p>
              AI in VYRA drafts; you approve. It does not decide who is compatible with whom, it
              does not send anything on your behalf, and private data is never used to train shared
              models.
            </p>
            <p>
              <Link href="/ai-persona" className="prose-link">
                How the AI persona works
              </Link>{' '}
              ·{' '}
              <Link href="/compatibility" className="prose-link">
                How compatibility is calculated
              </Link>
            </p>
          </>
        }
      />

      <Chapter
        id="not-yet"
        index="04"
        label="Not finished"
        theme="theme-ivory"
        title={
          <>
            What isn’t there yet, <em className="text-accent">and what we still owe you.</em>
          </>
        }
        intro={
          <>
            <p>
              VYRA is in development. Some safety features belong to parts of the app that do not
              exist yet, and a few obligations must be met before anyone real signs up.
            </p>
            <p>
              The{' '}
              <Link href="/privacy" className="prose-link">
                privacy policy
              </Link>{' '}
              and{' '}
              <Link href="/terms" className="prose-link">
                terms of service
              </Link>{' '}
              are working drafts awaiting legal review. VYRA is being designed with India’s Digital
              Personal Data Protection Act, 2023 in mind; that review has not yet happened.
            </p>
          </>
        }
      >
        <ul className="border-t border-line">
          {upcoming.map((item) => (
            <li
              key={item.name}
              className="grid-12 items-baseline gap-y-2 border-b border-line py-6"
            >
              <h3 className="t-title col-span-12 sm:col-span-5">{item.name}</h3>
              <p className="col-span-12 text-muted sm:col-span-5">{item.text}</p>
              <div className="col-span-12 sm:col-span-2 sm:text-right">
                <StatusTag status={item.status} />
              </div>
            </li>
          ))}
        </ul>
      </Chapter>

      <ClosingCta
        location="safety_closing"
        title={
          <>
            Your data.
            <br />
            <em>Your call.</em>
          </>
        }
      />
    </>
  );
}
