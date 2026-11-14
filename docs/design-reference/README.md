# Design reference

## `app/` — real screens of the VYRA app

Captured on 14 November 2026 by `apps/landing/scripts/capture-app-screens.cjs`, which drives the
exported Expo web build against a local API at 390 × 844 (2× pixel density). Nothing is mocked
or retouched.

**No personal data.** The account is synthetic: the name "Asha", an `example.test` address, an
invented bio, and a plain colour gradient in place of a portrait. The script deletes the account
through the app when it finishes. The code-entry screen is not captured because the development
build prints the one-time code on it.

| File                                        | Screen                                                                    | State in the build                       |
| ------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------- |
| `01-welcome`                                | Welcome                                                                   | Built                                    |
| `02-sign-in`, `03-age`, `04-consent`        | Sign-in, age check, consent                                               | Built                                    |
| `05`–`09`, `15`–`17` (`onboarding-*`)       | Identity, photos, interests, intention, understand, location, preferences | Built                                    |
| `10`–`12` (`ask-ai-*`)                      | Ask your AI: pick, copy, paste                                            | Built                                    |
| `13-persona-review`, `14-persona-edit`      | Persona review and editor                                                 | Built                                    |
| `18-orbit-empty`, `19-discover-empty`       | Orbit and Discover                                                        | **Empty states**: screens not built yet  |
| `20-connections-empty`, `21-messages-empty` | Connections and Messages                                                  | **Empty states**: features not built yet |
| `22-you`, `23`–`24` (`persona-*`)           | You tab, persona suggestions, approved persona                            | Built                                    |
| `25-delete-confirm`                         | Delete account                                                            | Built                                    |

There is no compatibility screen in the app yet, so there is no screenshot of one. The website
shows the compatibility engine's real output as data instead
(`apps/landing/src/content/engine-sample.json`, written by `scripts/engine-sample.mjs`).

The app's accent is violet. The website uses cherry and oxblood (DECISIONS D-041), so the
screens are shown as they are, violet buttons included, not recoloured.

## `website/` — review screenshots of the marketing site

Production build, 14 November 2026. Full-page captures of the home and features pages at
desktop (1440) and mobile (390), the first screen of each, the mobile menu, and two further
inner pages. Regenerate with `pnpm --filter @vyra/landing visual:check`.
