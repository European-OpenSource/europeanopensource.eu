---
title: Style
order: 4
---

# Style

Walle's CSS lives in four cascade layers, declared in this fixed order:

```
@layer walle.base, walle.components, walle.utilities, site;
```

A rule in a later layer wins over any rule in an earlier layer regardless of specificity, so a
plain selector in `@layer site` beats walle without `!important` or specificity tricks.
Unlayered CSS beats every layer too, but a consumer should keep overrides inside `@layer site`
so the order stays explicit rather than accidental. `src/@walle/styles/layers.ts` is the single
source of truth for the order; `Head.astro` renders it as an inline `<style is:inline>` that is
the first child of `<head>`, and `styles/tokens.css` carries a redundant copy of the same
declaration for any page that bypasses `Head.astro`.

## The layers

| Layer | Contains |
|---|---|
| `walle.base` | `tokens.css` (every CSS variable and its default), `base.css` (resets, global element defaults, the reduced-motion kill switch) |
| `walle.components` | Every component's own scoped `<style>` block |
| `walle.utilities` | `utilities.css` (list-marker reset, `.sr-only`) and `prose.css` (markdown body styling) |
| `site` | Consumer CSS. Always ordered last, so it always wins |

`global.css` just imports the four files in that order; nothing else lives there.

## Dev vs. build

Astro's dev server and its production build inject stylesheets at different points during
rendering. The inline `@layer` declaration in `Head.astro` is deliberately a `<style is:inline>`
tag, not a bundled stylesheet, because Astro never repositions an inline style: it is always the
first `<head>` child in both `astro dev` and `astro build`. A bundled/hoisted `<link>` stylesheet
does move around between the two modes, which is exactly why the layer order can't be declared
that way; a component or a site file that tried to declare its own `@layer` statement would work
by accident, dependent on module load order, which differs between dev and build and is not
guaranteed either way. `tests/playwright/cascade.spec.ts`'s "declaration first" case is what
guards this: it fails if the inline declaration ever stops being the very first stylesheet a page
sees, in either mode.

## Tokens

Every neutral color, radius, shadow, font size and spacing value a component uses comes from a
CSS variable defined once in `tokens.css`, itself wired to an optional `theme.json` override
through a `var(--walle-<category>-<name>, <default>)` fallback chain:

```css
--primary: var(--walle-color-primary, #243b6b);
--surface: var(--white);
--shadow-md: var(--walle-shadow-md, 0 1px 3px rgba(0, 0, 0, 0.05), ...);
```

`theme.json` values are turned into the `--walle-*` half of that chain by a vite plugin
(`walleThemePlugin`, exposed as the virtual module `virtual:walle-theme.css`); the plain-named
half (`--primary`, `--surface`, `--shadow-md`, ...) is what components actually read. A
component never reads a `--walle-*` variable or `theme.json` directly.

There are three groups of tokens:

- **Palette and neutral**: brand colors (`--primary`/`--secondary`/`--alternative`, each with
  `-light`/`-dark`/`-contrast`; `-dark` is the link-hover and outline/inverse hover color, a
  filled button's hover background derives from `--button-bg` instead) and a gray scale (`--gray-light` through `--gray-darker`).
- **Semantic**: `--surface`, `--surface-alt`, `--text`, `--text-muted`, `--heading`, `--border`,
  `--link`, `--link-hover`, `--focus-ring`, `--disabled-opacity`, plus `--status-success`/
  `-warning`/`-danger` and their own `-contrast` pairs. Components reference **only** these for
  neutral colors, never the palette tokens directly.
- **Shape and type**: `--shadow-sm/md/lg`, `--radii-*` (via `theme.json radii.*`),
  `--transition`/`--transition-normal`, `--font-body`/`-heading`/`-mono`,
  `--font-size-h1`...`-xs`, `--space-xs`...`-4xl`.

See the [customization ladder](../get-started/customize.md) for how to override any of these
from a consumer project.

## The variant model

Every visual component that reads `--variant-*` emits `data-variant` on its own root (default
`primary`), and reads its variant colors from tokens set on the matching
`[data-variant="..."]` selector: `--variant-color`, `--variant-color-hover`, `--variant-bg`,
`--variant-bg-hover`, `--variant-fg`. Because each component emits its own attribute, the
nearest definition is always its own; parent variants never leak into a nested component.
`site` is a variant like any other, left empty by default for a consumer to define once (see
[components](components.md#variants-and-modifiers)).

Modifiers (`data-outline`, `data-filled`, `data-muted`, `data-inverse`) are emitted only when
their prop is `true`, never `"false"`. They remap which variant tokens a component maps onto its
own public properties; they never change the variant itself.

## Section wrapper: crossing the scoping boundary

`SectionWrapper`'s `[data-filled]` modifier redefines `--wrapper-bg`/`-fg` to recolor the
wrapper's own element, but that alone would not recolor plain content a consumer drops in its
default slot: base rules like `p { color: var(--text-muted) }` or
`code { background: var(--surface-alt) }` target those elements directly, and a directly-targeted
rule always beats a color merely inherited from an ancestor. Custom-property lookup isn't
selector-scoped, though: it walks the real DOM tree regardless of Astro's per-file scoping
attribute. Redefining the tokens those base rules actually read (`--text`, `--text-muted`,
`--heading`, `--surface-alt`, the link colors) on the wrapper itself makes them resolve
correctly for every real descendant, with no per-consumer `color: inherit` workaround needed. For
`[data-muted]`, those same tokens are left alone: `--surface-alt` (a near-white gray) already
sits at essentially the same contrast ratio against `--surface`, so nothing needs remapping.

The same mechanism (a `<style is:global>` block reading a scoped element's public custom
properties) is what lets `Map`'s global leaflet rules pick up `--map-marker-bg` and friends from
`.map__container`; see [components](components.md#map).
