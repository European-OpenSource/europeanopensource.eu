---
title: Customize
order: 3
---

# Customize

Walle supports a fixed set of ways to change how it looks and behaves, listed here from the
broadest and cheapest to the most specific. Always use the first rung that does the job: each one
survives `walle-update`, and the higher you stay, the less of your site depends on walle's
internals.

## 1. `theme.json`

Site-wide design values. Every key is optional; anything you leave out keeps walle's default.

```json
{
  "palette": {
    "primary": "#1f3a5f",
    "primary-dark": "#152a45",
    "primary-contrast": "#ffffff",
    "heading": "#10223a"
  },
  "neutral": { "light": "#f4f5f7", "dark": "#4a5260" },
  "radii": { "md": "0.5rem", "lg": "0.75rem" },
  "shadow": { "md": "0 4px 16px rgb(0 0 0 / 0.08)" },
  "typography": {
    "fonts": [{ "role": "body", "name": "Inter", "provider": "google", "weights": [400, 700] }]
  }
}
```

`*-contrast` is the text color on a filled variant background: set it whenever you change a
variant color, so filled buttons, badges and sections keep readable text. Fonts listed in
`typography.fonts` are downloaded at build time and served from your own site; no request goes to
a font host. The `google` provider can serve different metrics than Google's own CSS API, so text
may set a little wider or narrower; the `fontsource` provider is the alternative when a family
must match its previous rendering.

Each font entry also takes a `fallback`: the generic family (`"serif"`, `"sans-serif"`,
`"monospace"`, or `"system-ui"`) shown while the real font loads. Set it to match the font's own
shape (`"serif"` for a serif body font, `"monospace"` for a mono font); Astro then generates a
metric-matched placeholder for that generic, so text does not visibly reflow once the real font
swaps in. Leaving it out defaults to `"sans-serif"`, which still avoids a layout shift for a
sans-serif font but can cause one for a serif or monospace font. Even matched to the closest
generic, the placeholder is an approximation (Astro's own metrics table only has one system font
per generic, e.g. Times New Roman for `"serif"`): expect the swap to shrink, not eliminate, the
shift.

A `display` on the same entry controls what the browser shows while the font is still
downloading (CSS `font-display`; one of `"auto"`, `"block"`, `"fallback"`, `"optional"`, or
`"swap"`; leaving it out keeps Astro's own default, `"swap"`). `"swap"` shows the fallback
immediately and always swaps to the real font once it arrives, which is when the reflow above
happens. `"optional"` gives the browser permission to skip that swap outright on a slow
connection, so a first visit on a bad connection may render entirely in the fallback font: no
shift, but not always the intended typeface either. Use `"optional"` when the shift matters more
than always showing the exact font; keep `"swap"` (the default) when the font is close to core
brand identity and should always eventually show, reflow or not.

## 2. Site-wide component custom properties

Every visual component publishes custom properties named `--<component>-<property>` on its root
class (`.button`, `.badge`, `.card`, `.site-header`, and so on). Set them once in
`src/styles/global.css`, inside `@layer site`, to restyle that component everywhere:

```css
@layer site {
  .button {
    --button-radius: 999px;
  }
  .site-header {
    --navbar-bg: var(--surface);
    --navbar-shadow: none;
  }
  .card {
    --card-radius: var(--radius-lg);
  }
}
```

One property covers every state (hover, focus, active are derived from it). The full list per
component is in [components](../architecture/components.md). Properties starting with `--_` are
internal and may change without notice.

## 3. Component props

Variants, modifiers and sizes are props, not classes:

```astro
<Button text="Buy" variant="secondary" />
<Button text="Read more" outline />
<Button text="Get started" inverse />            <!-- on a filled background -->
<Badge text="New" variant="alternative" muted />
<Section title="Pricing" variant="secondary" filled />
```

Variants are `primary`, `secondary`, `alternative` and `site`. `site` is yours to define: give it
colors once and use it wherever a component takes a variant.

```css
@layer site {
  [data-variant="site"] {
    --variant-color: #7a1f5c;
    --variant-color-hover: #5e1747;
    --variant-bg: #7a1f5c;
    --variant-bg-hover: #5e1747;
    --variant-fg: #ffffff;
  }
}
```

## 4. Instance class plus custom properties

To change one instance only, pass a class and set properties on it:

```astro
<Button text="Donate" class="donate-cta" />
```

```css
@layer site {
  .donate-cta {
    --button-bg: #b3261e;
    --button-padding-x: 2rem;
  }
}
```

Every component forwards `class`, `id` and any other HTML attribute to its root element.

## 5. Slots

Section components take `title`, `subtitle` and `tagline` as props or as named slots; a slot wins
over the prop of the same name, so rich markup needs no workaround:

```astro
<Section>
  <Fragment slot="title">Events in <em>your town</em></Fragment>
  <p>Content goes in the default slot.</p>
</Section>
```

Sections also have a `background` slot rendered behind the content.

## 6. Your own wrapper components

When you need the same combination in many places, wrap walle components in a component of your
own under `src/components/`. It keeps working across updates because it only uses the public API.

## 7. Replacing an embedded component

Walle's layouts embed a navbar, footer, card, breadcrumbs, page header and table of contents. You
can switch each to a built-in alternative or to your own file in `app.json`:

```json
{
  "components": {
    "navbar": "minimal",
    "card": "./src/components/EventCard.astro"
  }
}
```

A site path must start with `./` and point to a file under `src/`. To extend the original instead of
rewriting it, import walle's file by its path, never through `@walle/components`:

```astro
---
import BasicCard from "../@walle/components/features/Card/BasicCard.astro";
const props = Astro.props;
---

<div class="event-card">
  <BasicCard {...props} />
</div>
```

## Not supported

Setting properties other than the published custom properties on walle elements, and any selector
on walle's inner element classes (for example `.section-wrapper__inner`, `.card__content` or
`.cta-card`), `!important` on walle selectors, repeating a class to win specificity
(`.button.button.button`) and redefining walle tokens outside `theme.json` all break silently on
updates. If something can only be done that way, open an issue: it means a public property or prop
is missing.

## Why `@layer site` always wins

Walle's CSS lives in cascade layers declared in this order: `walle.base`, `walle.components`,
`walle.utilities`, `site`. A rule in a later layer beats any rule in an earlier layer regardless of
specificity, so a simple selector in `@layer site` overrides walle without tricks. Unlayered CSS
beats every layer too, but keep your styles in `@layer site` so the order stays explicit. See
[style](../architecture/style.md).
