---
title: Your first site
order: 2
---

# Your first site

From an empty directory to a deployed static site.

## 1. Scaffold

```bash
cli.sh init -n my-site -m website,ci,ai
```

This creates the base environment (justfile, devcontainer, git hooks), copies the starter site and
syncs the modules you listed:

| Module | What it adds |
|---|---|
| `website` (required) | the Astro site: `src/@walle/` engine, starter pages, configs, styles |
| `ci` | GitHub Actions workflows for lint, build, accessibility and deploy |
| `ai` | an `AGENTS.md` block and managed skills for AI coding agents |
| `backend` | example API routes that render on demand (needs `astro.adapter: "node"`) |

Then run `just walle-setup` once to install dependencies.

## 2. Configure the site

Everything a site says about itself lives in `src/configs/`:

| File | Holds |
|---|---|
| `app.json` | site identity (`website.*`), `astro` options, SEO, commerce, PWA, labels, map, embedded component choices |
| `navbar.json` | logo and navigation links |
| `footer.json` | footer links and social profiles |
| `theme.json` (optional) | palette, neutral scale, shadows, radii, spacing and fonts |

Each file has a JSON schema, and the build refuses an invalid file with a message naming the file
and the key (`just validate-configs` checks them without building).

Set `website.language` (for example `it-IT`): every date, price and number is formatted in that
locale. Translate walle's own interface strings (skip link, cart, filters, 404, and so on) in
`labels`; anything you leave out stays in English.

## 3. Make it yours

Start with `theme.json` for colors, fonts and radii, then follow [the customization
ladder](customize.md) for anything beyond that. Your own CSS goes in `src/styles/global.css`
inside `@layer site { }`, which always wins over walle.

## 4. Write pages and content

Pages go in `src/pages/`, blog posts in `src/content/posts/`. Build pages from walle components:

```astro
---
import { BaseLayout } from "@walle/layouts";
import { Hero, Section, Button } from "@walle/components";
---

<BaseLayout headerTitle="Welcome">
  <Hero
    title="Events in your town"
    subtitle="Every weekend, in one place."
    actions={[{ text: "See events", href: "/events" }]}
  />
  <Section title="How it works">
    <p>Add your event, we review it, it goes live.</p>
    <Button text="Submit an event" href="/submit" />
  </Section>
</BaseLayout>
```

## 5. Turn on what you need

All optional features are off until you enable them in `app.json`, and a feature that is off adds
nothing to the build:

| Feature | Key | Details |
|---|---|---|
| Shop or catalog | `commerce.mode`: `off`, `catalog`, `shop` | [E-commerce](../architecture/ecommerce.md) |
| Offline page | `pwa.enabled` plus `pwa.offline` | [PWA](../architecture/pwa.md) |
| Social preview images | `seo.ogImage` | [SEO](../architecture/seo.md) |
| RSS feeds | `seo.feeds` | [SEO](../architecture/seo.md) |
| Redirects | `astro.redirects` | [Configuration](../architecture/configuration.md) |
| Self-hosted fonts | `theme.json` `typography.fonts` | [Configuration](../architecture/configuration.md) |

A new site starts with OG images and a `posts` RSS feed enabled.

## 6. Run and ship

```bash
just dev     # dev server
just build   # production build in dist/
```

With the `ci` module, pushing to the default branch runs lint, build and the accessibility checks,
then deploys the static site. See [CI/CD](../architecture/ci-cd.md).

Keep secrets (Shopify tokens, build hooks) in environment variables and CI secrets, never in the
committed config. Only the public Shopify Storefront token belongs in the site bundle.

## 7. Stay current

When a new walle release lands, run `just walle-update`. It rewrites the `@walle/` engine only; your
pages, content, configs and styles are never touched. See [updating](updating.md).
