# AI Persona Engine

Status: **designed, not implemented** (Milestone 3). The storage for it exists
(`personas`, `persona_versions`, `persona_evidence`, `ai_imports`).

## What a persona is

A structured, versioned description of how someone communicates, socialises and wants to
relate — built from what they told us and approved by them. It is a working model for
matching, not a psychological assessment, and the product never presents it as one.

## Attribute record

Every attribute, in every version, carries:

| Field              | Meaning                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `value`            | Typed per attribute (scale 0–1, enum, or list)                                                                |
| `confidence`       | 0–1, calibrated (below)                                                                                       |
| `evidenceCategory` | `OBSERVED`, `INFERRED` or `USER_STATED`                                                                       |
| `sourceType`       | `PROFILE`, `PHOTO`, `CHATGPT_IMPORT`, `GEMINI_IMPORT`, `INTEREST_SELECTION`, `INTEGRATION`, `USER_CORRECTION` |
| `updatedAt`        | When this value was last set                                                                                  |
| `confirmation`     | `unreviewed`, `confirmed` or `corrected`                                                                      |

An attribute with no evidence is **unknown** and is stored as absent, not as a default value.

Planned attribute groups: social energy, communication style, emotional expression,
intellectual curiosity, lifestyle, adventure orientation, romantic preferences, relationship
intention, interests, user-confirmed boundaries.

## Pipeline

1. **Collect** permitted sources: profile fields, selected interests, approved import
   extracts, earlier corrections.
2. **Extract evidence** (worker): the provider returns candidate attributes, each with a
   short evidence summary, as JSON matching a Zod schema. Invalid output is rejected and
   retried once, then failed — never repaired by guesswork.
3. **Calibrate** deterministically: confidence is capped by evidence category
   (stated > observed > inferred) and by evidence count; contradictory evidence lowers
   confidence and flags the attribute for the user rather than picking a side.
4. **Draft** a new `persona_versions` row (`DRAFT`).
5. **Review**: the user sees observed, inferred and unknown separately, edits or removes
   anything, and approves.
6. **Approve**: the version becomes `APPROVED`, the previous one `SUPERSEDED`, an embedding is
   computed, and cached compatibility for this user is naturally invalidated.

User corrections always win and are stored as `USER_STATED` / `USER_CORRECTION` at high
confidence.

## Guardrails

- No inference of sensitive traits: health, religion, caste, ethnicity, sexual orientation,
  political opinion, finances. The schema has no fields for them and the extraction prompt
  forbids them; a post-filter drops anything that slips through.
- Imported content is untrusted input. It is redacted for secrets and identifiers, passed as
  delimited data, and instructions inside it are ignored by construction (the model is asked
  only to fill a fixed schema).
- Source conversations are never shown to other users and never stored beyond the retention
  window. Only short derived summaries persist.
- Private data is never used to train shared models.

## Providers

`AiProvider` interface, chosen by `AI_PROVIDER`: `mock` (deterministic, default, used in all
tests), `gemini`, `openai`. Real providers are only reported as working after a real call
succeeds with a configured key.
