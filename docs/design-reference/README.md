# Design reference

## `app/` — real screens of the VYRA app

Captured on 14 November 2026 by `apps/landing/scripts/capture-app-screens.cjs`, which drives the
exported Expo web build against a local API at 390 × 844 (2× pixel density). Nothing is mocked
or retouched.

**No personal data.** The account is synthetic: the name "Asha", an `example.test` address, an
invented bio, and a plain colour gradient in place of a portrait. The script deletes the account
through the app when it finishes, and deletes the second invented person through the API. The code-entry screen is not captured because the development
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

The app shows estimated alignment in words with reasons (see `27-person-profile`); it has no
per-dimension breakdown screen. For that, the website shows the compatibility engine's real
output as data
(`apps/landing/src/content/engine-sample.json`, written by `scripts/engine-sample.mjs`).

The app's accent is violet. The website uses cherry and oxblood (DECISIONS D-041), so the
screens are shown as they are, violet buttons included, not recoloured.

## `website/` — review screenshots of the marketing site

Production build, 14 November 2026. Full-page captures of the home and features pages at
desktop (1440) and mobile (390), the first screen of each, the mobile menu, the About page,
the Learn hub and an article, and two further inner pages. Regenerate with `pnpm --filter @vyra/landing visual:check`.

## Stock imagery used on the website

Eight stock photographs and seven icons, selected on 15 November 2026 from Magnific's library
(AI-generated images excluded) for a Gen-Z, India-first, editorial feel. They are pictures of
models and are never presented as VYRA members. Authors, source pages and alt text are in
`apps/landing/src/content/photos.ts`; the same credits are on the website at `/about#image-credits`.

| Photograph                                                                                                                                  | Author        |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Woman with her phone in red neon light                                                                                                      | teksomolika   |
| Couple sharing a dessert in a restaurant; woman looking at her phone in a restaurant; friends laughing over pizza                           | ASphotofamily |
| Woman checking her phone on a night street; friends taking a selfie at night; couple walking and talking at night; couple laughing in a bar | Magnific      |

Icons: persona (hari-sabana), compatibility (Iconir), privacy (yaicon), chat (Nur syifa
fauziah), AI (Magnific), photo (afif fudin), location (prinda895).

Selection notes: the stock halftone and sticker vectors were previewed and not used, because their
artwork carries demo text and a loud look that does not suit the brand; the halftone, rings and
sticker on the site are drawn in CSS and SVG instead. The downloads drew no credits from the
account's shared pool (balance 82,663 before and after). The licence terms were not read; see the
note in `apps/landing/README.md`.
