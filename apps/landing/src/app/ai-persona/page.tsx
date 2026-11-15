import type { Metadata } from 'next';
import Link from 'next/link';
import { Chapter } from '@/components/chapter';
import { ClosingCta } from '@/components/closing-cta';
import { Faq } from '@/components/faq';
import { FurtherReading } from '@/components/further-reading';
import { PageHero } from '@/components/page-hero';
import { Reveal } from '@/components/reveal';
import { ShotFigure } from '@/components/shot-figure';
import { StatusTag } from '@/components/status-tag';
import { pageMetadata, pages } from '@/lib/routes';
import { screens } from '@/lib/screens';

export const metadata: Metadata = pageMetadata('aiPersona');

const attributes: readonly (readonly [string, string])[] = [
  ['Social energy', 'Recharges alone … recharges around people'],
  ['Emotional expression', 'Keeps feelings private … shares openly'],
  ['Curiosity', 'Prefers the familiar … chases new ideas'],
  ['Adventure', 'Routine and comfort … seeks the unfamiliar'],
  ['Planning', 'Spontaneous … plans ahead'],
  ['In disagreements', 'Needs space first … talks it through at once'],
  ['Showing affection', 'Shows care quietly … shows care openly'],
  ['Communication style', 'Concise, expansive, playful or reflective'],
  ['Pace of life', 'Homebody, balanced or outgoing'],
  ['Weekend rhythm', 'Restful, social, adventurous or productive'],
  ['Values', 'Up to five, from a fixed list of fifteen words'],
  ['Boundaries', 'Up to five, in your own words. Only you can write them'],
];

export default function AiPersonaPage() {
  return (
    <>
      <PageHero
        page={pages.aiPersona}
        photo="restaurantPhone"
        icon="persona"
        index="03"
        title={
          <>
            An AI persona that <em className="text-accent">answers to you.</em>
          </>
        }
        lede={
          <p>
            A VYRA persona is a short, structured description of how you communicate, socialise and
            want to relate. AI helps to draft it. You decide what stays. It is a working description
            used for suggestions, not a personality test and not a psychological assessment.
          </p>
        }
      />

      <Chapter
        id="what"
        icon="persona"
        index="01"
        label="What is in it"
        theme="theme-ivory"
        title={
          <>
            Twelve things. <em className="text-accent">Nothing hidden.</em>
          </>
        }
        intro={
          <>
            <p>
              Seven tendencies on a five-step scale, three choices from fixed options, the values
              you name and the boundaries you set. That is the whole persona.
            </p>
            <p>
              There is no field for health, religion, caste, ethnicity, sexuality, politics or
              finances. What has no field cannot be inferred, stored or shown.
            </p>
          </>
        }
      >
        <Reveal>
          <ol className="grid border-t border-line md:grid-cols-2 md:gap-x-[clamp(1.5rem,4vw,5rem)]">
            {attributes.map(([name, range], index) => (
              <li key={name} className="flex items-baseline gap-5 border-b border-line py-4">
                <span className="t-eyebrow w-6 shrink-0 text-accent" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>
                  <span className="t-title block">{name}</span>
                  <span className="mt-1 block text-muted">{range}</span>
                </span>
              </li>
            ))}
          </ol>
        </Reveal>
      </Chapter>

      <Chapter
        id="sources"
        icon="chat"
        index="02"
        label="Where it comes from"
        title={
          <>
            Three sources, <em className="text-accent">each one opt-in.</em>
          </>
        }
        intro={
          <p>
            A persona is built only from material you hand over, and each kind of AI processing
            needs its own consent, which you can withdraw in Settings.
          </p>
        }
      >
        <ol className="grid-12 gap-y-10">
          {[
            {
              title: 'Your own profile',
              text: 'With your consent, VYRA reads your bio, what you do, your interests and your intentions, and suggests how you tend to communicate and live. Your name, age, gender, city and photos are deliberately left out, and e-mail addresses, numbers, links and handles are stripped from the text first.',
            },
            {
              title: 'The assistant you already use',
              text: 'If you talk to an AI assistant often, it may already know how you think. VYRA gives you a questionnaire to put to it, and reads the answers you bring back. This is a copy-and-paste round trip, never a connection to your account.',
            },
            {
              title: 'Your edits',
              text: 'Anything you set, confirm or correct outranks every other source for good. A later draft can add suggestions beside it but cannot change it.',
            },
          ].map((source, index) => (
            <Reveal
              as="li"
              key={source.title}
              delay={0.06 * index}
              className="col-span-12 border-t border-line pt-6 md:col-span-4"
            >
              <span className="t-eyebrow text-accent" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="t-title mt-3">{source.title}</h3>
              <p className="mt-3 text-muted">{source.text}</p>
            </Reveal>
          ))}
        </ol>
      </Chapter>

      <Chapter
        id="ask-your-ai"
        icon="ai"
        index="03"
        label="Ask your AI"
        theme="theme-ivory"
        title={
          <>
            Bring what your assistant knows,{' '}
            <em className="text-accent">without handing it over.</em>
          </>
        }
        intro={
          <>
            <p>
              VYRA cannot read your ChatGPT, Gemini or Claude account, and does not try to. Instead
              you carry a set of questions across and carry the answers back, reading them on the
              way.
            </p>
            <p>
              The reply is treated strictly as data. It is never passed to another model, so
              instructions hidden inside it have no effect, and it is not stored or logged: only the
              answers and a short reason for each are kept.
            </p>
          </>
        }
      >
        <ol className="grid-12 items-start gap-y-12">
          <li className="col-span-6 lg:col-span-3">
            <ShotFigure
              screen={screens.askAiPick}
              sizes="(min-width: 1024px) 22vw, 46vw"
              caption="1. Pick your assistant. Ones that rarely remember past chats come with a warning."
            />
          </li>
          <li className="col-span-6 mt-10 lg:col-span-3 lg:mt-16">
            <ShotFigure
              screen={screens.askAiCopy}
              sizes="(min-width: 1024px) 22vw, 46vw"
              caption="2. Copy eleven questions. The assistant is told to answer “unknown” rather than guess."
            />
          </li>
          <li className="col-span-6 lg:col-span-3">
            <ShotFigure
              screen={screens.personaReview}
              sizes="(min-width: 1024px) 22vw, 46vw"
              caption="3. Paste the answer back and see what VYRA made of it, with the source named."
            />
          </li>
          <li className="col-span-6 mt-10 lg:col-span-3 lg:mt-16">
            <ShotFigure
              screen={screens.personaEdit}
              sizes="(min-width: 1024px) 22vw, 46vw"
              caption="4. Correct anything that is off. Your version replaces the inference."
            />
          </li>
        </ol>
        <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3">
          <StatusTag status="built" />
          <p className="max-w-xl text-muted">
            Importing a full official export of your assistant history is a separate, planned
            feature. It is not in the app.
          </p>
        </div>
      </Chapter>

      <Chapter
        id="confidence"
        icon="compatibility"
        index="04"
        label="Evidence and confidence"
        theme="theme-oxblood"
        title={
          <>
            It knows the difference between <em>told and guessed.</em>
          </>
        }
        intro={
          <p>
            Confidence in VYRA is set by fixed rules about the kind of evidence, not by how sure a
            model sounds. Those rules are deliberately conservative.
          </p>
        }
      >
        <Reveal>
          <ul className="grid border-t border-line md:grid-cols-2 md:gap-x-[clamp(1.5rem,4vw,5rem)]">
            {[
              [
                'Stated beats inferred',
                'Something you said yourself can reach high confidence. An inference is capped well below it, however many clues point the same way.',
              ],
              [
                'Every inference cites its reason',
                'A suggestion survives only if it points to something you actually gave. Anything else is dropped, not repaired.',
              ],
              [
                'Disagreement is shown, not settled',
                'If two sources disagree, confidence is halved and the attribute is flagged for you to decide. VYRA does not quietly pick a side.',
              ],
              [
                'Unknown stays unknown',
                'A missing attribute sits under “Not known yet”. It is never filled with an average, and it never counts as agreement with someone else.',
              ],
            ].map(([title, text]) => (
              <li key={title} className="border-b border-line py-6">
                <h3 className="t-title">{title}</h3>
                <p className="mt-2 text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </Reveal>
      </Chapter>

      <Chapter
        id="questions"
        index="05"
        label="Questions"
        title={
          <>
            Fair questions about <em className="text-accent">AI and your data.</em>
          </>
        }
      >
        <Faq
          items={[
            {
              question: 'Does VYRA connect to my ChatGPT, Gemini or Claude account?',
              answer: (
                <p>
                  No. There is no integration and no login. You copy VYRA’s questions into your
                  assistant yourself and paste its answer back yourself.
                </p>
              ),
            },
            {
              question: 'Do I have to use AI at all?',
              answer: (
                <p>
                  No. Both AI routes are optional and can be skipped during onboarding. You can also
                  fill in a persona entirely by hand.
                </p>
              ),
            },
            {
              question: 'Who sees my persona?',
              answer: (
                <p>
                  Nothing in it is shown to anyone, or used to suggest people, until you approve it.
                  After that it is used to estimate{' '}
                  <Link className="prose-link" href="/compatibility">
                    compatibility
                  </Link>
                  , and suggestions explain themselves in plain phrases such as “you both lean
                  towards talking things through”.
                </p>
              ),
            },
            {
              question: 'Is my data used to train AI models?',
              answer: <p>No. Private data is never used to train shared models.</p>,
            },
            {
              question: 'Which AI model writes the draft?',
              answer: (
                <>
                  <p>
                    In today’s build, profile drafts come from a transparent, rule-based provider
                    inside VYRA that gives the same output for the same input.
                  </p>
                  <p>
                    A hosted model, Google Gemini, has been integrated but is not switched on. If it
                    is enabled, only the redacted profile text described above would be sent to it,
                    and the privacy notice will say so first.
                  </p>
                </>
              ),
            },
            {
              question: 'Can I get rid of it?',
              answer: (
                <p>
                  Yes. Remove any single attribute, discard a draft, withdraw either AI consent
                  (which deletes drafts immediately), delete the persona, or delete your account.
                  All of it is in the app, under You.
                </p>
              ),
            },
          ]}
        />
      </Chapter>

      <FurtherReading
        slugs={['ai-in-relationship-discovery', 'personality-and-relationships']}
        theme="theme-ivory"
      />

      <ClosingCta
        location="ai_persona_closing"
        photo="neonStreet"
        title={
          <>
            Described by AI.
            <br />
            <em>Decided by you.</em>
          </>
        }
      />
    </>
  );
}
