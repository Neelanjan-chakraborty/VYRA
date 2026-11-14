import type { Metadata } from 'next';
import Link from 'next/link';
import { ConsentControls } from '@/components/analytics';
import { DraftNotice, LegalSection } from '@/components/legal';
import { PageHero } from '@/components/page-hero';
import { pageMetadata, pages } from '@/lib/routes';
import { site } from '@/lib/site';

export const metadata: Metadata = pageMetadata('privacy');

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        page={pages.privacy}
        index="09"
        title={
          <>
            Privacy <em className="text-accent">policy.</em>
          </>
        }
        lede={
          <p>
            What VYRA handles about you, why, and what you can do about it.
            {site.legalPublished ? null : ' This is a working draft; see the notice below.'}
          </p>
        }
      />
      <div className="theme-ivory">
        <div className="shell py-16 sm:py-24">
          <DraftNotice />

          <LegalSection id="who" number="01" title="Who is responsible">
            <p>
              VYRA is operated by [legal name of the operating entity, to be supplied], which
              decides how and why your personal data is handled. Its registered address and the
              contact details of the person responsible for privacy are [to be supplied before
              launch].
            </p>
          </LegalSection>

          <LegalSection id="what" number="02" title="What VYRA handles">
            <ul>
              <li>
                Your phone number or e-mail address, used to sign you in with a one-time code.
              </li>
              <li>
                Your date of birth, used to confirm you are an adult. Your profile shows your age
                only.
              </li>
              <li>
                Your profile: name, gender as you describe it, occupation, bio, interests, what you
                are looking for, and the preferences you set for who to see.
              </li>
              <li>
                Your photos. They are re-encoded when uploaded and any location data in the file is
                removed.
              </li>
              <li>
                An approximate location, if you choose to give one: a rough area of about two
                kilometres, or a city you pick.
              </li>
              <li>
                Your persona: attributes you stated or approved, and a short reason for each
                inference. The source text is not kept.
              </li>
              <li>Your consents, with the date and the version of the policy you agreed to.</li>
              <li>
                Records of activity needed to run the service, such as which suggestions you were
                shown.
              </li>
            </ul>
            <p>
              VYRA does not ask for, infer or store information about health, religion, caste,
              ethnicity, sexuality, politics or finances.
            </p>
          </LegalSection>

          <LegalSection id="why" number="03" title="Why, and on what basis">
            <p>
              To create and secure your account; to show your profile to people within your and
              their limits; to estimate compatibility; to moderate photos; and to keep the service
              safe.
            </p>
            <p>
              Each optional kind of AI processing has its own consent, which you can withdraw in
              Settings: drafting a persona from your profile, and reading an answer you paste from
              an AI assistant. Withdrawing consent deletes unapproved drafts immediately. [The legal
              basis for each purpose under applicable law is to be confirmed by counsel.]
            </p>
          </LegalSection>

          <LegalSection id="ai" number="04" title="AI and your data">
            <p>
              When you ask VYRA to draft a persona from your profile, it uses your bio, occupation,
              interests and intentions. Your name, age, gender, city and photos are not included,
              and contact details, numbers and links are removed from the text first.
            </p>
            <p>
              [If an external AI provider is used, it will be named here together with what is sent
              to it. In the current build, drafting runs inside VYRA and nothing is sent to an
              external provider.]
            </p>
            <p>
              An answer you paste from your own assistant is read for its answers only. The reply
              itself is not stored. Your private data is not used to train shared AI models.
            </p>
            <p>
              Compatibility is calculated by fixed rules, not by an AI model. See{' '}
              <Link href="/compatibility" className="prose-link">
                how compatibility is calculated
              </Link>
              .
            </p>
          </LegalSection>

          <LegalSection id="sharing" number="05" title="Who else sees it">
            <p>
              Other members see your profile, and your photos once approved, only when you are
              visible and within each other’s limits. They see a distance band, never your location.
              They never see your date of birth, your contact details or the reasons behind your
              persona.
            </p>
            <p>
              [Service providers who process data on VYRA’s behalf, such as hosting, message
              delivery and storage, are to be listed here once chosen. None has been appointed yet.]
              VYRA does not sell personal data.
            </p>
          </LegalSection>

          <LegalSection id="keeping" number="06" title="How long it is kept">
            <p>
              For as long as you have an account. When you delete your account in the app, your
              profile, photos, preferences and persona are removed immediately. [Retention periods
              for security logs and any records that must be kept by law are to be confirmed.]
            </p>
          </LegalSection>

          <LegalSection id="rights" number="07" title="Your choices and rights">
            <ul>
              <li>See and edit your profile and every persona attribute, in the app.</li>
              <li>
                Withdraw either AI consent, remove your location, or hide yourself from new people.
              </li>
              <li>Delete your persona, or your whole account, yourself.</li>
            </ul>
            <p>
              [Your statutory rights, how to exercise them, and how to complain to a regulator are
              to be set out here for each country VYRA operates in, beginning with India.]
            </p>
          </LegalSection>

          <LegalSection id="analytics" number="08" title="This website">
            <p>
              This website is separate from the app. It has no accounts and no forms.{' '}
              {site.gaMeasurementId
                ? 'With your permission it uses Google Analytics 4 to count visits and see which pages are read. Nothing is loaded or stored until you agree, IP addresses are anonymised, and no advertising features are switched on.'
                : 'No analytics or tracking scripts are running on it.'}
            </p>
            {site.gaMeasurementId ? <ConsentControls /> : null}
          </LegalSection>

          <LegalSection id="children" number="09" title="Adults only">
            <p>VYRA is for people aged 18 and over. Anyone younger is refused at sign-up.</p>
          </LegalSection>

          <LegalSection id="changes" number="10" title="Changes and contact">
            <p>
              Material changes will be announced in the app and will need fresh agreement where the
              law requires it. Questions about privacy can be sent to{' '}
              {site.contactEmail ? (
                <a className="prose-link" href={`mailto:${site.contactEmail}`}>
                  {site.contactEmail}
                </a>
              ) : (
                '[privacy contact address, to be supplied]'
              )}
              .
            </p>
          </LegalSection>
        </div>
      </div>
    </>
  );
}
