# Implementation status

Last updated: 14 November 2026, end of Milestone 2.

## Summary

| Milestone                     | Status                                            |
| ----------------------------- | ------------------------------------------------- |
| 0 — Audit and plan            | Done                                              |
| 1 — Foundation                | Done                                              |
| 2 — Design and authentication | Done, with the gaps listed below                  |
| 3 — AI Persona                | Not started (schema tables and design doc only)   |
| 4 — Compatibility             | Not started (weights, tables and design doc only) |
| 5–8                           | Not started                                       |

## What works today

A person can sign up with an e-mail address or phone number, prove they are an adult, give
consent, build a profile with photos, interests, intentions and discovery preferences, use the
app shell, edit everything from the You tab, hide themselves, sign out, sign back in, and
delete their account.

- **Authentication**: one-time codes, registration with age gate and consent, 15-minute access
  tokens, rotating refresh tokens with theft detection, logout.
- **Profile**: profile fields, relationship intentions (including a custom one), discovery
  preferences, interest catalogue (36 seeded) and selection, onboarding completion.
- **Photos**: upload judged by content, re-encoded with location data removed, up to six,
  reorder, delete, served only through signed short-lived URLs.
- **Account deletion**: personal data and files removed immediately.
- **Mobile**: welcome screen with brand animation, sign-in, code entry, age, consent, five
  onboarding steps, You tab with settings, delete confirmation. Component library: Button,
  TextField, OtpInput, SelectRow, Tag, Stepper, Toggle, BottomSheet, FormScreen, notices.
- **Foundation** (Milestone 1): monorepo, validated configuration, 32-table schema, health
  probes, rate limiting, error envelope, design tokens, CI workflow.

## What is deliberately not there

- **Sign-in codes are not delivered.** The development sender returns the code to the app,
  which shows it on screen. Production refuses to start in this mode.
- **Photos are stored on local disk.** Production refuses to start in this mode.
- **Terms of Service and Privacy Policy documents do not exist**; the consent screen has
  nothing to link to.
- Orbit, Discover, Connections and Messages are still empty states.
- No persona, compatibility, discovery, messaging, import, admin console.
- Onboarding has no AI-import or persona-review step yet (decision D-024).
- Photo moderation does not exist; photos are not yet shown to anyone but their owner.

## Verification (run 14 Nov 2026 in the cloud container)

| Check                             | Result                                                         |
| --------------------------------- | -------------------------------------------------------------- |
| `pnpm format:check`, `pnpm lint`  | Pass                                                           |
| `pnpm build`, `pnpm typecheck`    | Pass                                                           |
| `pnpm test`                       | Pass — 45 tests (validation 22, design-system 11, api 12)      |
| `pnpm test:e2e`                   | Pass — 64 tests against real PostgreSQL and Redis              |
| `prisma migrate diff --exit-code` | Pass — no drift, 2 migrations                                  |
| `expo export --platform web`      | Pass                                                           |
| `pnpm e2e:web`                    | Pass — 14 steps, 18 screenshots, no browser errors (see below) |

The API e2e suite covers: OTP hashing, enumeration resistance, per-destination and per-IP
limits, wrong/expired/replayed/superseded codes, attempt lock-out, under-18 refusal with
nothing stored, the 18th-birthday boundary, consent enforcement, forged and cross-purpose
tokens, refresh rotation, reuse revocation, logout, suspension, profile validation,
mass-assignment, upload content sniffing, EXIF/GPS removal, size and count limits,
duplicates, reorder, another person's photo (IDOR), signed-URL forgery/extension/swap/
traversal, onboarding gating, and full account deletion.

`pnpm e2e:web` drives the real exported app in Chromium against the real API: under-age
refusal, field validation, wrong then right code, age, consent, all five onboarding steps
with a real photo upload, the signed-in tabs, session restore after reload, editing from
Settings, the visibility toggle, layout at 320pt and 820pt without overflow, sign-out,
sign-in as a returning person, account deletion, and re-registration of the freed address.

Not verified: iOS and Android native builds (no simulator or emulator here) — including
Keychain storage, the native photo picker, keyboard avoidance and SMS code autofill; the
GitHub Actions workflow (has not run); Docker Compose; screen-reader behaviour on a device;
component-level mobile tests (none exist — the browser run is the UI test).

## Known issues and caveats

- Rate-limit counters are in process memory; fine for one instance only.
- `pnpm e2e:web` needs a minute between runs (it uses four of the five codes per minute).
- Typed routes: `apps/mobile/.expo/types` goes stale when routes change; delete it if
  typecheck complains about route strings.
- Photo reordering in the app is "show this one first", not drag and drop.
- The country code on the phone field is a pre-filled `+91`, not a country picker.
- Refresh on web uses `sessionStorage` (QA target only).
- A Gemini API key is still not saved in the environment. Needed for Milestone 3's real
  provider; the mock provider needs nothing.

## Resume here

```bash
pnpm services:start
pnpm install
cp .env.example apps/api/.env      # if apps/api/.env is missing
pnpm db:deploy
pnpm build
pnpm check && pnpm test:e2e
```

Then start Milestone 3 (`docs/IMPLEMENTATION_BACKLOG.md`): persona schema in
`@vyra/validation`, the `AiProvider` interface with the deterministic mock, then the
generation worker.
