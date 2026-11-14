import askAiCopy from '@/assets/screens/11-ask-ai-copy.png';
import askAiPick from '@/assets/screens/10-ask-ai-pick.png';
import connectionsEmpty from '@/assets/screens/20-connections-empty.png';
import consent from '@/assets/screens/04-consent.png';
import deleteConfirm from '@/assets/screens/25-delete-confirm.png';
import discover from '@/assets/screens/19-discover-list.png';
import matters from '@/assets/screens/26-onboarding-matters.png';
import person from '@/assets/screens/27-person-profile.png';
import identity from '@/assets/screens/05-onboarding-identity.png';
import intention from '@/assets/screens/08-onboarding-intention.png';
import interests from '@/assets/screens/07-onboarding-interests.png';
import locationSet from '@/assets/screens/16-onboarding-location-set.png';
import messagesEmpty from '@/assets/screens/21-messages-empty.png';
import orbitEmpty from '@/assets/screens/18-orbit-empty.png';
import personaApproved from '@/assets/screens/24-persona-approved.png';
import personaEdit from '@/assets/screens/14-persona-edit.png';
import personaReview from '@/assets/screens/13-persona-review.png';
import photos from '@/assets/screens/06-onboarding-photos.png';
import preferences from '@/assets/screens/17-onboarding-preferences.png';
import understand from '@/assets/screens/09-onboarding-understand.png';
import welcome from '@/assets/screens/01-welcome.png';
import you from '@/assets/screens/22-you.png';

/**
 * Real screens of the VYRA app, captured by scripts/capture-app-screens.cjs
 * from a synthetic account. Each alt text says what is actually on the screen.
 */
export const screens = {
  welcome: {
    src: welcome,
    alt: 'VYRA welcome screen: “Chemistry, decoded.” with buttons to continue by phone or e-mail.',
  },
  consent: {
    src: consent,
    alt: 'VYRA consent screen, “How VYRA treats you”: every AI feature is optional, you approve what VYRA infers, nothing is sent in your name, and you can delete your account at any time.',
  },
  identity: {
    src: identity,
    alt: 'VYRA onboarding: choosing a gender, whether to show it on the profile, and writing a few lines about yourself.',
  },
  photos: {
    src: photos,
    alt: 'VYRA onboarding, “Show yourself”: a photo grid with a note that every photo is checked before anyone else can see it and location data is removed.',
  },
  interests: {
    src: interests,
    alt: 'VYRA onboarding, “What pulls you in?”: interests grouped under food, ideas, making and movement, with four selected.',
  },
  intention: {
    src: intention,
    alt: 'VYRA onboarding, “What are you here for?”: something serious, something casual, still working it out, companionship, or something else in your own words.',
  },
  understand: {
    src: understand,
    alt: 'VYRA onboarding, “Help VYRA understand you”: two optional choices, drafting a persona from your profile or asking an AI assistant that already knows you.',
  },
  askAiPick: {
    src: askAiPick,
    alt: 'VYRA screen “Which assistant knows you best?” listing ChatGPT, Gemini, Claude, DeepSeek, Copilot and another assistant, with a note that VYRA never connects to it.',
  },
  askAiCopy: {
    src: askAiCopy,
    alt: 'VYRA screen “Copy the questions”: eleven questions to paste into ChatGPT, with options to open the assistant or read the questions first.',
  },
  personaReview: {
    src: personaReview,
    alt: 'VYRA persona review, “Is this you?”: sections “You told us” and “We inferred”, each inference with its confidence, its reason, and links to confirm, change or remove it.',
  },
  personaEdit: {
    src: personaEdit,
    alt: 'VYRA persona editor: a five-step scale for social energy, from “recharges alone” to “recharges around people”.',
  },
  personaApproved: {
    src: personaApproved,
    alt: 'VYRA “Your persona” screen after approval, listing what the person stated and what VYRA inferred, each with change and remove links.',
  },
  locationSet: {
    src: locationSet,
    alt: 'VYRA onboarding, “Where are you?”: Bengaluru chosen as a city, with a note that only a rough area is kept and others see a distance band, never the location.',
  },
  preferences: {
    src: preferences,
    alt: 'VYRA onboarding, “Who should we look for?”: age range, who to show, and a distance limit, described as limits rather than rankings.',
  },
  orbitEmpty: {
    src: orbitEmpty,
    alt: 'VYRA Orbit tab in its current empty state: “Your orbit is still empty”, with three orbit paths around a centre point.',
  },
  discover: {
    src: discover,
    alt: 'VYRA Discover tab listing one sample person, Ravi, 29, Bengaluru, under 5 km away, marked “Strong estimated alignment” with three reasons, beside a plain colour placeholder photo.',
  },
  person: {
    src: person,
    alt: 'VYRA profile preview for a sample person, Ravi: age, city and distance band, a placeholder photo, a short bio, and “Strong estimated alignment” followed by its reasons.',
  },
  matters: {
    src: matters,
    alt: 'VYRA onboarding, “What matters to you?”: pace of life, weekends, communication style and values, each set to must-have, preference or open.',
  },
  connectionsEmpty: {
    src: connectionsEmpty,
    alt: 'VYRA Connections tab in its current empty state: “No requests yet.”',
  },
  messagesEmpty: {
    src: messagesEmpty,
    alt: 'VYRA Messages tab in its current empty state: “No conversations yet. A conversation opens when a connection is mutual.”',
  },
  you: {
    src: you,
    alt: 'VYRA You tab for a sample profile: photo, city and bio, with rows for about you, photos, interests, looking for and your persona.',
  },
  deleteConfirm: {
    src: deleteConfirm,
    alt: 'VYRA delete-account confirmation: “Your profile, photos and preferences are removed straight away. This can’t be undone.”',
  },
} as const;
