# Technical research

Researched 13 November 2026. Versions were read from the npm registry and from freshly
scaffolded official templates (`create-expo-app@5`, `@nestjs/cli@12`), not from memory.

## Versions chosen

| Area       | Package                                 | Version          | Notes                                              |
| ---------- | --------------------------------------- | ---------------- | -------------------------------------------------- |
| Runtime    | Node.js                                 | 22.x (≥ 22.18)   | Required by Prisma 7 and Vitest 5                  |
| Workspace  | pnpm / turbo                            | 10.28 / 2.11     | pnpm 10 blocks install scripts unless allow-listed |
| Language   | TypeScript                              | ~6.0.3           | **Not 7** — see below                              |
| Mobile     | Expo SDK / React Native / React         | 58 / 0.88 / 19.3 | From the SDK 58 template                           |
| Navigation | expo-router                             | ~58.0            | Versioned with the SDK                             |
| Animation  | react-native-reanimated / worklets      | 4.7 / 0.13       | SDK-pinned                                         |
| Gestures   | react-native-gesture-handler            | ~3.3             | SDK-pinned (npm latest is 3.5)                     |
| Data       | @tanstack/react-query                   | 5.107            |                                                    |
| API        | NestJS                                  | 12.5             | ESM-only                                           |
| ORM        | Prisma (`prisma`, client, `adapter-pg`) | 7.10.1           | **Not 8** — see below                              |
| Database   | PostgreSQL / pgvector                   | 16 / 0.6         | 0.6 is Ubuntu 24.04's package; HNSW is available   |
| Cache      | Redis / ioredis                         | 7 / 6.0          |                                                    |
| Validation | Zod                                     | 4.6              | Implements Standard Schema                         |
| Tests      | Vitest                                  | 5.1              |                                                    |
| Lint       | oxlint                                  | 1.93             | What the Nest 12 template ships; also lints React  |

## Findings that change how we build

**TypeScript 7 is `latest` on npm but unusable here.** Expo's template pins `~6.0.3`, the Nest
CLI depends on `~6.0.2`, `@nestjs/swagger` accepts `^5.5 || ^6`, and `typescript-eslint` caps at
`<6.1`. The repo pins `~6.0.3`.

**Prisma's `latest` dist-tag points at `8.0.0-rc.33`.** The stable line is tagged `prev`
(7.10.1). We pin exact 7.10.1 versions and will move to 8 once it is a stable release.

**Prisma 7 specifics.** Connection URL lives in `prisma.config.ts`, not the schema. A driver
adapter (`@prisma/adapter-pg`) is mandatory. The `prisma-client` generator writes TypeScript to
an explicit output directory (`apps/api/src/generated/prisma`, git-ignored). `.env` loading is
manual (`dotenv/config`).

**Prisma cannot model pgvector indexes.** A `vector` column must be `Unsupported(...)`, and
Prisma then reports the HNSW index as drift and tries to drop it. Embeddings therefore live in
a separate `vyra_vector` schema that Prisma does not manage (decision D-006).

**`prisma migrate dev` blocks on drift** waiting for interactive input. Automation uses
`--create-only`, `migrate deploy` and `migrate diff --exit-code`.

**NestJS 12 is ESM-only.** Relative imports end in `.js`; tests are Vitest, not Jest. It ships a
`StandardSchemaValidationPipe`, so Zod schemas validate requests directly with no DTO classes.
`nestjs-zod` does not support Nest 12 and is not needed. Built-in `ConsoleLogger({ json: true })`
gives structured logs without a logging dependency.

**Expo SDK 58.** The template enables typed routes and the React Compiler, and ships an
`AGENTS.md` telling agents to read versioned docs. `Tabs` from `expo-router` is deprecated in
favour of `expo-router/js-tabs`; `expo-router/native-tabs` gives platform tab bars; we use the
headless `expo-router/ui` tabs so the bar is fully our own design. pnpm's default isolated
`node_modules` works with SDK 58 with no Metro config. Expo packages must be added with
`npx expo install` so versions match the SDK.

**React Native Web accessibility.** `accessibilityState={{ selected }}` did not produce
`aria-selected` in the web export; the `aria-selected` prop does. `accessible={false}` on an
`Svg` leaks to the DOM as an invalid attribute.

## AI data imports (to implement in Milestone 7)

- **ChatGPT**: no API exposes a user's conversation history. The supported route is the
  in-product data export (Settings → Data controls → Export), which e-mails a ZIP containing
  `conversations.json`. VYRA accepts that user-uploaded archive.
- **Gemini**: the supported route is Google Takeout ("My Activity" → Gemini Apps). The exact
  current archive layout must be verified against a real export before the parser is written.

Both are to be re-verified against current vendor documentation when the import work starts.

## Agent tooling available in this environment

- **Skills**: Anthropic document/artifact skills, `claude-api`, `code-review`,
  `security-review`, `run`. Expo's official plugin (`expo@claude-plugins-official`) is enabled
  for this project in `.claude/settings.json`, as Expo's own template does.
- **MCP**: GitHub (scoped to this repository), Figma, Canva, Google Drive, Magnific, Netlify.
  None is required for the build so far. No database or error-monitoring MCP is connected.
- **Verification**: Chromium + Playwright are installed, so the Expo web export can be
  screenshotted. There is no iOS simulator or Android emulator.

## Sources

- npm registry metadata for every package above (`npm view <pkg>`), 13 Nov 2026
- Expo SDK 58 template (`create-expo-app@5.0.0`) and its `AGENTS.md`; https://docs.expo.dev/llms.txt
- NestJS 12 template (`@nestjs/cli@12.0.13`) and its `AGENTS.md`; https://docs.nestjs.com/application/validation
- Prisma ORM v7 docs: https://www.prisma.io/docs/orm/v7 and the v7 upgrade guide,
  https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7
- Expo SDK 58 `bundledNativeModules.json` (github.com/expo/expo, `sdk-58` branch)
