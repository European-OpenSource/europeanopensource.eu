---
title: Astrobook
order: 5
---

# Astrobook

Walle ships a visual component catalog powered by [Astrobook](https://github.com/ocavue/astrobook). It is **repo-internal dev tooling**: it is not synced to consumer projects and is never included in the site build.

---

## Starting the catalog

```bash
just astrobook
```

Opens the catalog at `http://localhost:4321/<basePath>/astrobook` (the repo's own base path is `/harness-walle`). Story preview pages live at `<basePath>/astrobook/stories/<module>/<story>`: always use the base-prefixed form; the unprefixed one answers inconsistently in dev depending on the `Accept` header. The `just dev` and `just build` targets are unaffected: Astrobook only mounts when the `WALLE_ASTROBOOK` env var is set, which the `astrobook` just target handles.

---

## Story files

Stories live under the top-level `astrobook/` directory (outside `src/@walle/`, so they are never seeded to consumers). Each story file follows the `*.stories.ts` naming convention, grouped by area: `elements/`, `features/` (including `Navbar/`, `Map/`, `Card/`, `Blog/`, `Sections/`), and `contract/` for the cascade-override demo used by `cascade.spec.ts`.

Each component variant gets its own story file (e.g. `Navbar.stories.ts` for `standard`, `Navbar.minimal.stories.ts` for `minimal`).

---

## Story format

Every story file **must** import `StoryWrapper` and declare it as a decorator. `StoryWrapper` injects `@walle/styles/global.css` so CSS variables and typography are defined: without it, components render unstyled.

```ts
import type { ComponentProps } from "astro/types";
import Button from "@walle/components/elements/Button.astro";
import StoryWrapper from "../StoryWrapper.astro";

type ButtonProps = ComponentProps<typeof Button>;

export default {
  component: Button,
  decorators: [{ component: StoryWrapper }],
};

export const Primary = { args: { text: "Primary", variant: "primary" } satisfies ButtonProps };
export const Secondary = { args: { text: "Secondary", variant: "secondary" } satisfies ButtonProps };
export const Outline = { args: { text: "Outline", outline: true } satisfies ButtonProps };
```

- `export default`: registers the component and sets the decorator.
- Each named export is one preview card. The key becomes the label.
- `args` are the component props. Use `satisfies ComponentProps<typeof X>` for type safety.

---

## Adding a story

Every new `@walle` component or variant **must** ship with a story. No exceptions.

1. Create `astrobook/<group>/<Component>.stories.ts`.
2. Import the concrete `.astro` file (not a resolver, unless you want to test variant routing).
3. Import `StoryWrapper` and add `decorators: [{ component: StoryWrapper }]` to the default export.
4. Export one named preview per variant/size/notable state with realistic `args`.
5. Run `just astrobook-update-snapshots` to generate the visual baseline.

Components that need slot content (Carousel, SectionColumns, CollectionFilters) use a
story-only `<Name>Demo.astro` wrapper next to the story file that provides sample children:
Astrobook passes props, not slots.

The a11y and visual suites **auto-discover** stories from the `astrobook/` directory
(`tests/playwright/storyRoutes.ts`): a new story is covered by both gates with no extra
configuration.

For a new variant, create a separate file: `astrobook/features/Footer.newvariant.stories.ts` importing `Footer.newvariant.astro` directly.

No registration step is required: Astrobook picks up `*.stories.*` files automatically from the `astrobook/` directory.

---

## Test suites over the stories

Stories double as the fixtures for the Playwright suites that share `playwright.astrobook.config.ts` (routes auto-discovered by `tests/playwright/storyRoutes.ts`, one entry per story export):

```bash
just a11y-test                    # axe-core gate + 320px reflow check (blocking in CI)
just astrobook-test               # visual regression against stored baselines
just astrobook-update-snapshots   # regenerate baselines after intentional changes
```

- **`a11y-test`** runs axe-core on every story preview page plus the demo-site pages
  (layout-level checks: skip link, landmarks) and fails on serious/critical violations.
  A component without a story is invisible to the gate, which is why stories are mandatory.
- **`astrobook-test`** screenshots every story and compares against baselines in
  `tests/playwright/snapshots/` (committed to git). If a test fails because of an intentional
  visual change, update the baselines and commit them with the code change.

Two more suites use the same astrobook stories but run against their own filenames directly
(`yarn playwright test --config playwright.astrobook.config.ts <file>`): `cascade.spec.ts`
(cascade-layer override behavior) and `map.spec.ts` (leaflet lazy-load behavior): see
[testing](testing.md).

Both suites fail loudly if a page renders astrobook's not-found fallback, so story route
drift cannot silently turn the gates into no-ops.
