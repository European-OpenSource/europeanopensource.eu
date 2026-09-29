---
title: Skills
order: 3
---

# Skills

The `ai` module installs managed skills under `.claude/skills/@walle/`. They are overwritten on
every update, so they always describe the installed walle version.

| Skill | Use it when | What it covers |
|---|---|---|
| `walle-customize` | changing theme, colors, fonts, component styling, navigation, labels, features, pages or content | the customization ladder in order, where each change goes, the optional features and their `app.json` keys, language and labels, validation |
| `walle-update` | pulling a new release or touching a file that might be managed | what is managed, the update commands, what is preserved, and how to find and remove workarounds the new release makes unnecessary |

Both skills follow the same public contract as [Customize](../get-started/customize.md) and
[Updating](../get-started/updating.md): when a skill and the wiki disagree, the wiki is the
reference and the skill is a bug.

To add skills of your own, put them outside `@walle/` (for example `.claude/skills/my-skill/`):
updates never touch them.
