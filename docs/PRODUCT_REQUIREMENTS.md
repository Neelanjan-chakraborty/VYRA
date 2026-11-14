# Product requirements

## Vision

VYRA evaluates compatibility across personality, emotional connection, communication,
lifestyle, attraction and relationship expectations, and explains its reasoning. It is not a
swipe app.

Principles:

1. Understand people before recommending people.
2. Discover compatibility instead of browsing endless profiles.
3. Explain why two people might connect.
4. Let people explore relationship scenarios.
5. AI improves discovery; it never replaces human agency.
6. Premium design and privacy-first AI.

## Assumptions (revisable through configuration)

- India-first launch; architecture must not block global expansion.
- Adults only (18+).
- Relationship intentions are plural and user-defined: serious, casual, exploring,
  companionship, or a custom label. Nobody is forced into one category.

## Primary destinations

| Tab         | Purpose                                                                      |
| ----------- | ---------------------------------------------------------------------------- |
| Orbit       | Signature spatial view: people positioned by estimated compatibility         |
| Discover    | Editorial, full-profile reading. Actions: Connect, Save, Pass. No swiping    |
| Connections | Incoming and outgoing requests, mutual connections, saved profiles           |
| Messages    | Real-time conversations between mutual connections, with opt-in Wingman help |
| You         | Profile, persona, privacy, discovery settings, subscription, account         |

## Feature areas

- **Authentication and onboarding** — phone or e-mail OTP, age verification, consent, then a
  low-friction onboarding (identity, photos, optional AI import, optional interests, persona
  review, preferences, intention). Optional data sources are always skippable.
- **AI Persona** — structured, versioned, evidence-aware. Every attribute shows whether it was
  observed, inferred or stated, with confidence, and is editable. Nothing is saved without
  approval.
- **Compatibility Intelligence** — deterministic six-dimension score plus ten scenario
  alignments, each explained. Labelled as estimated alignment, never as a prediction of
  relationship success. Insufficient data is shown as such.
- **BestPic** — photo quality, variety and ordering advice. Advisory only; never alters or
  publishes photos.
- **TrendSync** — interest and culture overlap from legitimate sources, independent of the
  compatibility score.
- **Astrology** — optional, deterministic calculations, labelled entertainment, fully hideable.
- **Wingman** — conversation starters and date ideas from context the user explicitly shares.
  Never sends messages itself and never invents facts about the other person.
- **Safety** — blocking, reporting, moderation workflow, account and import deletion.
- **Administration** — role-restricted console for moderation, safety, jobs and health.

## Non-goals

- Swipe-deck discovery, engagement-time optimisation, or streak mechanics.
- Claims of scientific or predictive accuracy without validated outcome data.
- Inferring sensitive traits (health, religion, caste, sexuality, politics) from imported data.
- Direct access to a user's ChatGPT or Gemini account. Imports are user-uploaded official exports.

## Milestones

See [IMPLEMENTATION_BACKLOG.md](IMPLEMENTATION_BACKLOG.md).
