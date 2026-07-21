---
name: walle-customize
description: Customize a walle-based site through the consumer zones without touching managed @walle/ paths. Use when changing theme, navigation, footer, fonts, components, routes, or content in a walle project.
metadata:
  author: harness-walle
  managed: "true"
---

# Customizing a walle site

Customize through the **consumer zones**. Never edit `@walle/`-namespaced paths — they are
overwritten on the next `just walle-update` (see `walle-update`).

## Where each change goes

| You want to change…                | Edit                                                          |
| ---------------------------------- | ------------------------------------------------------------- |
| Site metadata, SSR toggle          | `src/configs/app.json`                                        |
| Navigation / footer                | `src/configs/navbar.json`, `src/configs/footer.json`          |
| Theme tokens (colors, spacing)     | `src/configs/theme.json`                                      |
| Fonts, CSS variable overrides      | `src/styles/global.css`                                       |
| Routes / pages                     | `src/pages/`                                                  |
| Blog and content collections       | `src/content/`                                                |
| Project-specific components        | `src/components/`                                             |
| Astro integrations / native config | `astro.config.mjs` (inside the `defineWalleConfig({})` shell) |
| Dependencies and scripts           | `package.json`                                                |

## Rules

- Edit config JSON first. Most look-and-feel changes are config, not code.
- Override styling via CSS variables in `src/styles/global.css`, not by forking walle components.
- Use slots and the documented component props to extend layout; don't copy `@walle/` components
  into `src/components/` to patch them — your copy diverges and the original keeps updating.
- Keep `astro.config.mjs` thin: native Astro overrides go inside the `defineWalleConfig({})`
  shell so walle defaults still apply.

## Validate

```bash
just validate-configs   # config files against their schemas
just dev                # local dev server
just build              # production build
```

If a config change is rejected, check it against the schema in `schemas/` rather than editing the
schema (it is managed).

## Module-specific customization zones

### Backend (API routes)

If your project has the `backend` module, the SEED files in `src/pages/api/` and `src/middleware.ts` are yours to edit freely. Add new API routes under `src/pages/api/`. The middleware stub at `src/middleware.ts` is a starting point — extend it or replace it entirely.

SSR must be enabled for API routes to work. Check or enable it in `src/configs/app.json`:

```json
"astro": {
  "ssr": { "enabled": true, "adapter": "node" }
}
```

### Infrastructure (Terraform/OpenTofu)

If your project has the `infrastructure` module, the scaffold in `infrastructure/` is yours. The walle seed provides `main.tf`, `variables.tf`, `providers.tf`, `outputs.tf`, and `.gitignore`. Edit or extend them — `walle update` never touches this directory.

To switch providers or add resources, edit `providers.tf` (uncomment and pin the provider version) and `main.tf` (declare resources).

## When to use consumer components vs. @walle slots

Use `src/components/` for project-specific UI that does not belong in the design system (e.g. a feature-specific card, a domain widget). Use `@walle` slots (`<BaseLayout>`, `<Navbar slot="brand">`, etc.) to extend layout without forking managed files.

Never copy a `@walle/` component into `src/components/` to patch it — your copy diverges and the original keeps updating. Use CSS variable overrides or slot replacement instead.
