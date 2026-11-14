# AI Persona Engine

Status: **implemented** (Milestone 3) with the deterministic mock provider. The Gemini adapter
is written but has **not been run against the live API** (no key configured yet).

## What a persona is

A structured, versioned description of how someone communicates, socialises and wants to
relate — built from what they gave VYRA and approved by them. It is a working model for
suggestions, not a psychological assessment, and the app says so on every persona screen.

## Attribute catalogue (`packages/validation/src/persona.ts`, schema version 1)

| Key                       | Type  | Values                                               |
| ------------------------- | ----- | ---------------------------------------------------- |
| `socialEnergy`            | scale | 0 recharges alone … 1 recharges around people        |
| `emotionalExpressiveness` | scale | 0 keeps feelings private … 1 shares openly           |
| `intellectualCuriosity`   | scale | 0 prefers the familiar … 1 chases new ideas          |
| `adventureOrientation`    | scale | 0 routine and comfort … 1 seeks the unfamiliar       |
| `planningStyle`           | scale | 0 spontaneous … 1 plans ahead                        |
| `conflictApproach`        | scale | 0 needs space first … 1 talks it through at once     |
| `affectionExpression`     | scale | 0 shows care quietly … 1 shows care openly           |
| `communicationStyle`      | enum  | concise · expansive · playful · reflective           |
| `lifestylePace`           | enum  | homebody · balanced · outgoing                       |
| `weekendRhythm`           | enum  | restful · social · adventurous · productive          |
| `values`                  | list  | up to 5 of 15 fixed words (honesty, kindness, …)     |
| `boundaries`              | list  | up to 5 free-text items — **set only by the person** |

There is no field for health, religion, caste, ethnicity, sexuality, politics or finances, so
none can be inferred, stored or shown. A test enforces this.

Each stored attribute carries `value`, `confidence` (0–1), `evidenceCategory`
(`USER_STATED` · `OBSERVED` · `INFERRED`), `sourceType`, `updatedAt`, `confirmation`
(`unreviewed` · `confirmed` · `corrected`) and `needsReview`. A missing attribute is
**unknown** and is shown in its own section, never filled with a default.

## Sources

1. **The person's own profile** (needs consent `AI_PERSONA_PROCESSING`): bio, occupation,
   selected interests, relationship intentions. Name, age, gender, city and photos are
   deliberately not sent. Text is redacted (e-mails, numbers, links, handles, key-like strings).
2. **Their own AI assistant** (needs consent `AI_IMPORT_PROCESSING`) — see below.
3. **The person's edits and confirmations.**

## Pipeline (profile)

1. `POST /v1/me/persona/generate` queues a BullMQ job (one in flight per person, one request a
   minute).
2. The worker builds the source bundle, each item with a ref id (`profile.bio`,
   `interest.trekking`, …), and asks the provider for attributes. The provider's answer is
   typed `unknown`.
3. `candidatesFromModel` keeps only catalogue attributes with a valid value **and at least one
   ref that exists in the bundle**; `boundaries` are refused from any AI source. Everything
   else is dropped (and logged as key + reason code only). Unusable output is retried once,
   then the generation is marked `failed` with a code — never repaired.
4. `combine` (deterministic) merges the candidates into the open draft, or a copy of the
   approved persona.
5. The person reviews, edits and approves.

### Calibration

- Category caps: `USER_STATED` 0.95, `OBSERVED` 0.8, `INFERRED` 0.6.
- Model inferences: `confidence = cap × (0.6 + 0.4 × min(n, 3) / 3)` for _n_ cited items.
- Sources that agree (scales within 0.25, equal enums, overlapping lists) are combined —
  confidence-weighted mean for scales, union for lists — with +0.05 per extra source, capped.
- Sources that disagree: the stronger value is kept at **half** confidence and the attribute
  is flagged `needsReview`. VYRA does not pick a side silently.
- Anything the person set, confirmed or corrected is never changed by any later source.

## "Ask your AI" — questionnaire round trip

Many people already talk to an assistant that knows them. VYRA cannot (and does not try to)
read those accounts. Instead:

1. The person picks their assistant: ChatGPT, Gemini, Claude, DeepSeek, Copilot or another.
2. VYRA builds a questionnaire (`buildQuestionnairePrompt`, shared package) and the person
   copies it into their assistant. It asks for 1–5 answers, fixed options or "unknown" for
   each attribute, with a confidence and a one-line reason, as one JSON code block. It tells
   the assistant to leave out names, places, contact details and sensitive topics.
   Assistants that usually don't remember past chats get a warning in the app and a prompt
   that asks for "unknown" rather than guesses.
3. The person reads the answer and pastes it back. `POST /v1/me/persona/assistant-reflection`
   parses it **as data only** — it is never sent to a model, so instructions inside it have no
   effect. Unasked keys, invalid values and sensitive content are dropped. The reply itself is
   not stored or logged; only the parsed values and a redacted reason (≤ 200 characters) are.
4. Answers become `INFERRED` evidence with `sourceType ASSISTANT_REFLECTION` and the assistant
   name, confidence low/medium/high → 0.3/0.45/0.6, merged with the same `combine` step.

## Versions and storage

- Editing or adding sources writes to one open `DRAFT` version (opened from the approved one
  if needed). Approval makes it `APPROVED`, the previous one `SUPERSEDED`, and stores a
  768-dimension embedding in `vyra_vector.persona_embeddings`, replacing older ones.
- `persona_evidence` holds one short summary per reason — never source text.
- Withdrawing either AI consent deletes drafts immediately; the approved persona stays until
  the person deletes it (`DELETE /v1/me/persona`) or their account.

## Providers

`AI_PROVIDER=mock` (default, all tests): transparent keyword and interest rules; same input,
same output; SHA-256-seeded embeddings. `AI_PROVIDER=gemini` with `GEMINI_API_KEY`:
`@google/genai`, JSON-schema-constrained output, temperature 0, user material inside one
JSON-encoded `<member_data>` block; models `GEMINI_MODEL` (default `gemini-3.8-flash`) and
`GEMINI_EMBEDDING_MODEL` (default `gemini-embedding-001`, 768 dimensions, re-normalised).
`openai` is rejected at boot until implemented.

Private data is never used to train shared models.
