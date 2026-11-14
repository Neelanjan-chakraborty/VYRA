import type { Metadata } from 'next';
import Link from 'next/link';
import { DraftNotice, LegalSection } from '@/components/legal';
import { PageHero } from '@/components/page-hero';
import { pageMetadata, pages } from '@/lib/routes';
import { site } from '@/lib/site';

export const metadata: Metadata = pageMetadata('terms');

export default function TermsPage() {
  return (
    <>
      <PageHero
        page={pages.terms}
        index="10"
        title={
          <>
            Terms of <em className="text-accent">service.</em>
          </>
        }
        lede={
          <p>
            The rules for using VYRA, written to be read.
            {site.legalPublished ? null : ' This is a working draft; see the notice below.'}
          </p>
        }
      />
      <div className="theme-ivory">
        <div className="shell py-16 sm:py-24">
          <DraftNotice />

          <LegalSection id="agreement" number="01" title="The agreement">
            <p>
              These terms are between you and [legal name of the operating entity, to be supplied].
              By creating an account you agree to them and to the{' '}
              <Link href="/privacy" className="prose-link">
                privacy policy
              </Link>
              .
            </p>
          </LegalSection>

          <LegalSection id="eligibility" number="02" title="Who can use VYRA">
            <p>
              You must be at least 18 years old and able to enter into an agreement. You confirm
              your date of birth when you sign up, and it must be true.
            </p>
          </LegalSection>

          <LegalSection id="account" number="03" title="Your account">
            <p>
              One account per person, in your own name, with photos of you. Keep access to the phone
              number or e-mail address you sign in with, and do not let anyone else use your
              account.
            </p>
          </LegalSection>

          <LegalSection id="conduct" number="04" title="How to behave">
            <ul>
              <li>Be honest about who you are and what you are looking for.</li>
              <li>Do not harass, threaten, deceive or exploit anyone.</li>
              <li>
                Do not post anything unlawful, sexually explicit, or that shows another person
                without their agreement.
              </li>
              <li>Do not use VYRA for advertising, soliciting money or any commercial purpose.</li>
              <li>
                Do not copy other people’s profiles, scrape the service or try to get round its
                protections.
              </li>
            </ul>
          </LegalSection>

          <LegalSection id="content" number="05" title="What you share">
            <p>
              Your profile and photos remain yours. You give VYRA permission to store and show them
              to other members as the app describes, for as long as your account exists. Photos are
              reviewed before others can see them and may be refused.
            </p>
          </LegalSection>

          <LegalSection id="ai" number="06" title="AI features and compatibility">
            <p>
              AI features are optional. A persona is a working description that you review and
              approve; it is not a psychological assessment.
            </p>
            <p>
              Compatibility figures are estimated alignment between two descriptions. They are not a
              prediction or a promise about any person or relationship, and VYRA does not guarantee
              that you will meet anyone or that anyone is who they say they are. Meet new people
              with ordinary care.
            </p>
          </LegalSection>

          <LegalSection id="ending" number="07" title="Leaving, and being asked to leave">
            <p>
              You can delete your account at any time in the app, and your data is removed as the
              privacy policy describes. VYRA may suspend or close an account that breaks these terms
              or puts others at risk.
            </p>
          </LegalSection>

          <LegalSection id="paid" number="08" title="Paid features">
            <p>
              VYRA has no paid features at present. If any are introduced, their price and terms
              will be shown before you are asked to pay. [Billing and refund terms to be supplied at
              that time.]
            </p>
          </LegalSection>

          <LegalSection id="liability" number="09" title="Responsibility and the law">
            <p>
              [Warranty disclaimers, limits of liability, governing law, the courts that have
              jurisdiction and the process for resolving disputes are to be drafted by counsel.
              Nothing is stated here in the meantime.]
            </p>
          </LegalSection>

          <LegalSection id="changes" number="10" title="Changes">
            <p>
              If these terms change in a way that matters, you will be told in the app before the
              change takes effect.
            </p>
          </LegalSection>
        </div>
      </div>
    </>
  );
}
