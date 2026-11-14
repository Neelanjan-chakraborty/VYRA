import type { Metadata } from 'next';
import Link from 'next/link';
import { Chapter } from '@/components/chapter';
import { ClosingCta } from '@/components/closing-cta';
import { EngineReadout } from '@/components/engine-readout';
import { Faq } from '@/components/faq';
import { PageHero } from '@/components/page-hero';
import { Reveal } from '@/components/reveal';
import { StatusTag } from '@/components/status-tag';
import { pageMetadata, pages } from '@/lib/routes';

export const metadata: Metadata = pageMetadata('compatibility');

const dimensions: readonly (readonly [string, string, string])[] = [
  [
    'Emotional',
    '25%',
    'How openly each of you shares feelings, how you show affection, and how you approach conflict.',
  ],
  [
    'Communication',
    '20%',
    'Whether your styles tend to fit (concise, expansive, playful, reflective) and how you each handle a disagreement.',
  ],
  [
    'Relationship alignment',
    '20%',
    'What you are each looking for, and the values you both named.',
  ],
  [
    'Lifestyle',
    '15%',
    'Social energy, pace of life, weekend rhythm and how far ahead you like to plan.',
  ],
  ['Intellectual', '10%', 'Curiosity, appetite for the unfamiliar, and the interests you share.'],
  [
    'Mutual preferences',
    '10%',
    'How comfortably each of you sits inside the other’s stated age and distance range.',
  ],
];

const gates: readonly (readonly [string, string])[] = [
  ['Age', 'Each person’s age must fall inside the other’s range.'],
  [
    'Who you want to see',
    'Each person’s gender must be one the other asked to see. VYRA never guesses a gender to make a match fit.',
  ],
  ['Distance', 'Applied only when both people have set a location and a limit.'],
  [
    'Intention',
    'Someone looking only for something serious is not shown to someone looking only for something casual.',
  ],
  [
    'Your deal-breakers',
    'Rules you set yourself, applied only when the other person’s trait is known with reasonable confidence.',
  ],
  ['Blocks', 'If either person has blocked the other, the pair does not exist.'],
];

export default function CompatibilityPage() {
  return (
    <>
      <PageHero
        page={pages.compatibility}
        index="04"
        theme="theme-oxblood"
        title={
          <>
            Compatibility, <em>with the working shown.</em>
          </>
        }
        lede={
          <p>
            VYRA never asks an AI model whether two people would get on. It compares what each of
            you has approved about yourselves, with ordinary arithmetic that gives the same answer
            every time, and tells you which parts lined up and which did not.
          </p>
        }
      />

      <Chapter
        id="what-makes-people-compatible"
        index="01"
        label="The idea"
        theme="theme-ivory"
        title={
          <>
            What makes two people <em className="text-accent">compatible?</em>
          </>
        }
        intro={
          <>
            <p>
              Nobody can answer that for certain, and VYRA does not claim to. What can be compared
              honestly is narrower and more useful: whether you want the same kind of relationship,
              whether you talk and argue in ways that fit, whether your weeks have a similar shape,
              and whether you care about the same things.
            </p>
            <p>
              Similar is not always better, either. Two styles of communication can differ and still
              suit each other, and the engine scores them that way.
            </p>
          </>
        }
      >
        <Reveal>
          <ul className="grid border-t border-line md:grid-cols-3">
            {[
              [
                'An estimate',
                'The result is called estimated alignment. It describes overlap between two descriptions, nothing more.',
              ],
              [
                'Not a prediction',
                'It does not forecast attraction, happiness or how long anything lasts. No app has the evidence to promise that.',
              ],
              [
                'Open to revision',
                'The weights are product hypotheses. They will be judged against real outcomes, and no accuracy is claimed before that.',
              ],
            ].map(([title, text]) => (
              <li
                key={title}
                className="border-b border-line py-6 md:border-b-0 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0"
              >
                <h3 className="t-title">{title}</h3>
                <p className="mt-2 text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </Reveal>
      </Chapter>

      <Chapter
        id="limits"
        index="02"
        label="Step one: limits"
        title={
          <>
            First, the <em className="text-accent">hard limits.</em>
          </>
        }
        intro={
          <p>
            Before anything is scored, a pair has to pass every limit in both directions. If it
            fails one, the two people are never scored and never shown to each other. A high score
            cannot buy its way past a limit.
          </p>
        }
      >
        <ol className="grid border-t border-line md:grid-cols-2 md:gap-x-[clamp(1.5rem,4vw,5rem)]">
          {gates.map(([name, rule], index) => (
            <li key={name} className="flex gap-5 border-b border-line py-5">
              <span className="t-eyebrow w-6 shrink-0 pt-2 text-accent" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span>
                <span className="t-title block">{name}</span>
                <span className="mt-1 block text-muted">{rule}</span>
              </span>
            </li>
          ))}
        </ol>
      </Chapter>

      <Chapter
        id="dimensions"
        index="03"
        label="Step two: six dimensions"
        theme="theme-ivory"
        title={
          <>
            Then, six dimensions, <em className="text-accent">each with a weight.</em>
          </>
        }
        intro={
          <p>
            Each dimension compares a few specific things about two people. A comparison counts for
            more when both sides are confident, and it is left out entirely when either side is
            unknown. An unknown is never treated as agreement.
          </p>
        }
      >
        <table className="w-full border-t border-line text-left">
          <caption className="sr-only">
            The six compatibility dimensions, their weights and what each compares
          </caption>
          <thead className="t-eyebrow text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="py-3 pr-4 font-semibold">
                Dimension
              </th>
              <th scope="col" className="py-3 pr-4 font-semibold">
                Weight
              </th>
              <th scope="col" className="hidden py-3 font-semibold sm:table-cell">
                What it compares
              </th>
            </tr>
          </thead>
          <tbody>
            {dimensions.map(([name, weight, text]) => (
              <tr key={name} className="border-b border-line align-baseline">
                <th scope="row" className="t-title py-5 pr-4 font-normal">
                  {name}
                  <span className="mt-2 block font-sans text-base tracking-normal text-muted sm:hidden">
                    {text}
                  </span>
                </th>
                <td className="py-5 pr-4 font-display text-[1.75rem] leading-none text-accent">
                  {weight}
                </td>
                <td className="hidden max-w-xl py-5 text-muted sm:table-cell">{text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Chapter>

      <Chapter
        id="example"
        index="04"
        label="A worked example"
        theme="theme-oxblood"
        title={
          <>
            Two invented people, <em>one real result.</em>
          </>
        }
        intro={
          <>
            <p>
              This is what the engine returned for two test profiles made up for this page. One is
              well described; the other has gaps: no weekend rhythm and no planning style.
            </p>
            <p>
              Notice the Lifestyle row. Half of it is unknown, so it is scored on what is known and
              then counts for less.
            </p>
          </>
        }
      >
        <EngineReadout showScenarios />
        <div className="mt-8">
          <StatusTag status="engine" />
        </div>
      </Chapter>

      <Chapter
        id="honesty"
        index="05"
        label="When VYRA doesn’t know"
        title={
          <>
            “Not enough to say” is <em className="text-accent">an answer.</em>
          </>
        }
        intro={
          <p>
            The easiest way to produce impressive matches is to let thin profiles agree on the
            little they contain. VYRA is built to do the opposite.
          </p>
        }
      >
        <Reveal>
          <ul className="grid border-t border-line md:grid-cols-3">
            {[
              [
                'Sparse data is pulled to neutral',
                'The less that is known about a pair, the closer the estimate is drawn to the middle. Agreeing on three things can never look like agreeing on everything.',
              ],
              [
                'Below a threshold, no number',
                'When less than two-fifths of the picture is known, VYRA shows “not enough to say” rather than a figure. Two people without personas always get that answer.',
              ],
              [
                'Confidence affects ranking',
                'Suggestions are ordered by alignment and by confidence together, so a well-founded estimate comes ahead of a higher but uncertain one.',
              ],
            ].map(([title, text]) => (
              <li
                key={title}
                className="border-b border-line py-6 md:border-b-0 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0"
              >
                <h3 className="t-title">{title}</h3>
                <p className="mt-2 text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </Reveal>
      </Chapter>

      <Chapter
        id="questions"
        index="06"
        label="Questions"
        theme="theme-ivory"
        title={
          <>
            What people ask about <em className="text-accent">compatibility scores.</em>
          </>
        }
      >
        <Faq
          items={[
            {
              question: 'How can AI help with relationship compatibility?',
              answer: (
                <>
                  <p>
                    In VYRA, AI has one job: helping you put into words how you communicate and
                    live, in an{' '}
                    <Link className="prose-link" href="/ai-persona">
                      AI persona
                    </Link>{' '}
                    that you check and approve.
                  </p>
                  <p>
                    The comparison between two people is not done by AI at all. It is fixed,
                    testable code, so it cannot be flattered, cannot make things up, and can always
                    show its reasons.
                  </p>
                </>
              ),
            },
            {
              question: 'Is a higher number a better relationship?',
              answer: (
                <p>
                  No. A higher number means your two descriptions overlap more, under VYRA’s current
                  weights. It is a reason to read someone’s profile carefully, not a verdict.
                </p>
              ),
            },
            {
              question: 'Does personality decide everything?',
              answer: (
                <p>
                  No. Intentions and your own limits come first and cannot be outvoted. Personality
                  traits only shape the estimate among people who already fit those.
                </p>
              ),
            },
            {
              question: 'Does VYRA use my finances, religion or politics?',
              answer: (
                <p>
                  No. VYRA holds none of that. The scenario called “Priorities and planning” uses
                  only how you like to plan and the values you named.
                </p>
              ),
            },
            {
              question: 'Is the score the same for both of us?',
              answer: (
                <p>Yes. The engine is symmetric: you and the other person get the same result.</p>
              ),
            },
          ]}
        />
      </Chapter>

      <ClosingCta
        location="compatibility_closing"
        title={
          <>
            Less mystery.
            <br />
            <em>More reasons.</em>
          </>
        }
      />
    </>
  );
}
