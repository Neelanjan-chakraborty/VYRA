/**
 * What VYRA is, stated once. Page metadata, structured data, the footer, the
 * About page, the "What is VYRA?" answers and /llms.txt all read from here, so
 * the brand is described the same way wherever a person or a crawler meets it.
 *
 * Only verified facts belong in this file. There is deliberately no founder,
 * legal entity, address, launch date, user count, rating or award: none has
 * been supplied. Add one only when it is true and can be shown on a page.
 */
export const entity = {
  name: 'VYRA',
  tagline: 'Chemistry, decoded.',
  positioning: 'Dynamic Relationship Intelligence Platform',
  /** The category, used the same way everywhere. */
  category: 'AI-assisted relationship discovery platform',
  /** The canonical one-sentence description. */
  description:
    'VYRA is an AI-assisted relationship discovery platform designed to help people understand ' +
    'personality, communication, interests and relationship compatibility.',
  /** The canonical direct answer to "What is VYRA?". */
  answer:
    'VYRA is an AI-assisted relationship discovery platform. It helps people explore ' +
    'personality, communication styles, shared interests and compatibility before they ' +
    'connect, and it explains the reasons behind every suggestion it makes.',
  audience:
    'Adults aged 18 and over who want to meet people through compatibility rather than a swipe deck',
  market: 'India first, in English',
  status: 'In development. Not yet available to download; there is no public sign-up.',
  /** What exists and what does not. Mirrors docs/IMPLEMENTATION_STATUS.md. */
  capabilities: [
    {
      name: 'AI persona',
      status: 'Built',
      summary:
        'A short description of how a person communicates, socialises and wants to relate, drafted with AI help and used only after the person has reviewed and approved it.',
      path: '/ai-persona',
    },
    {
      name: 'Compatibility estimate',
      status: 'Built; shown in the app in words with reasons',
      summary:
        'Estimated alignment between two people across six weighted dimensions and ten everyday scenarios, calculated by fixed rules with the reasons shown. It is not a prediction of relationship success.',
      path: '/compatibility',
    },
    {
      name: 'Discovery',
      status:
        'First version built: a ranked Discover list and profile preview. Orbit, and the Connect, Save and Pass actions, are in development',
      summary:
        'Suggestions ranked by estimated alignment and confidence, read as full profiles. There is no swipe deck.',
      path: '/features',
    },
    {
      name: 'Safety and privacy controls',
      status: 'Built',
      summary:
        'Adults only, consent asked per purpose, approximate location, photo moderation before anyone else sees a photo, and account deletion in the app.',
      path: '/safety',
    },
    {
      name: 'Connections and messaging',
      status: 'Planned',
      summary: 'Conversations only between two people who have both accepted a connection.',
      path: '/features',
    },
  ],
  /** Things VYRA is often assumed to be, and is not. */
  isNot: [
    'an AI companion or chatbot to date',
    'a tool that writes or sends messages for you',
    'a swipe-based dating app',
    'a predictor of whether a relationship will succeed',
  ],
  logoPath: '/logo.png',
} as const;
