---
name: persona-engineering
description: How VYRA's AI persona works and how to change it safely. Use when adding or changing a persona attribute, an AI provider, the assistant questionnaire, calibration rules, or anything that sends user material to a model.
---

# Persona engineering

Read `docs/AI_PERSONA_ENGINE.md` first. Code: `packages/validation/src/persona.ts`,
`packages/validation/src/assistant-questionnaire.ts`, `apps/api/src/modules/ai/`,
`apps/api/src/modules/persona/`, `apps/mobile/src/features/persona/`.

## Adding or changing an attribute

1. Add it to `PERSONA_ATTRIBUTES` (scale, enum or list) with plain-language labels.
   Never add anything about health, religion, caste, ethnicity, sexuality, politics or
   finances — the catalogue test fails if you try.
2. If the change is incompatible with stored data, bump `PERSONA_SCHEMA_VERSION` and plan a
   migration of `persona_versions.attributes`.
3. If assistants should answer it, it is automatically in the questionnaire; bump
   `QUESTIONNAIRE_VERSION` when questions change so old replies are rejected cleanly.
4. Add mock-provider rules in `mock-ai-provider.ts` if a test needs it.
5. The mobile editor and review pick it up from the catalogue; check the label reads well.
6. Tests: validation (value schema), calibration if new merge rules, one e2e case.

## Rules

- Model output is `unknown` until `candidatesFromModel` filters it. Never trust, repair or
  pass through extra keys.
- Every inferred attribute needs evidence that exists in what the person gave us.
- Material sent to a model goes through `redact()` and `buildPersonaUserPrompt()` only.
- Pasted assistant replies are parsed, never sent to a model, never stored or logged.
- Nothing from AI is used until the person approves; their edits always win (`isLockedByPerson`).
- Consent: `AI_PERSONA_PROCESSING` for profile reading, `AI_IMPORT_PROCESSING` for pasted or
  imported material. Check it in the service, and again in the worker.
- Tests use `AI_PROVIDER=mock`. Never call a real provider from tests.
