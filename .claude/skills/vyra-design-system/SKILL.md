---
name: vyra-design-system
description: VYRA's visual language and component rules. Use when building or changing any mobile or admin UI — screens, components, icons, colours, typography, motion, empty/loading/error states.
---

# VYRA design system

Direction: dark luxury, contemporary editorial. It should look art-directed, not generated.

## Tokens (source of truth: `packages/design-system/src`)

- Import from `@vyra/design-system`. Never write a hex value, font size or duration in a screen.
- Colour is semantic. On any one screen:
  - `accent` (violet) appears once: the primary action or the "you are here" marker.
  - `chemistry` / `chemistryText` (burgundy) is reserved for compatibility and connection moments.
  - Everything else is `textPrimary` / `textSecondary` on `background` / `surface`.
- Type: `display*` variants are the serif (Instrument Serif) for headlines only. Interface text
  is Manrope. Use the `<Text variant tone>` primitive in `apps/mobile/src/components/text.tsx`.
- Spacing is the `space` scale. Radii are small on purpose (`radius.m` is the default for
  controls); `radius.full` only for avatars and true pills.
- New colour pairings must pass the contrast test in `packages/design-system/src/tokens.spec.ts`
  (WCAG AA, 4.5:1). Add the pairing to the test.

## Composition rules

- Separate content with whitespace and hairlines (`color.border`), not boxes. A card needs a
  reason: it is tappable as a unit, or it floats above other content.
- Prefer asymmetry and a strong typographic hierarchy over centred, evenly weighted blocks.
- One idea per screen region. No decorative charts; a visualisation must encode real data.
- Photography is large and edge-aware. Never crop faces with overlays.
- Icons are our own line set (`components/tab-icons.tsx`): 24pt grid, 1.6 stroke, round caps.
  No emoji as interface icons.

## Banned

Purple gradients, glassmorphism as a default surface, glowing borders, pill/badge clusters,
identical stacked dashboard sections, chat-bubble UI for things that are not conversations.

## States

Every data-driven view ships loading, empty, error and offline states. Empty states say what
will appear and why it is empty, in the product's voice — short, direct, no exclamation marks.
Never convey state by colour alone; pair it with text or an icon.

## Motion and accessibility

- Durations and easings come from `motion.ts`. Each animation must explain a state change.
- Read the reduced-motion preference and pass it through `resolveDuration`; movement collapses
  to instant, opacity may still fade.
- Touch targets ≥ `MIN_TOUCH_TARGET` (44pt). Interactive elements get `role` and `aria-label`;
  use `aria-selected` / `aria-checked` (these map correctly on web and native).
- Decorative SVG: wrap in a `View` with `aria-hidden` — do not put `accessible={false}` on `Svg`
  (it leaks to the DOM on web).
- Layouts must hold at 320pt wide and with large text; screens scroll rather than clip.

## Verify

Run the API with `CORS_ORIGINS=http://localhost:8099`, then
`pnpm --filter @vyra/mobile export:web && pnpm e2e:web <dir>` and look at the screenshots.
Add a step to `scripts/e2e-web.cjs` for every new screen.
