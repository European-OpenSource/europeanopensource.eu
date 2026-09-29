---
title: AI
order: 1
---

# AI

The `ai` module prepares a walle site for AI coding agents (Claude Code, Codex, Copilot and others
that read `AGENTS.md`). It is on by default at `cli.sh init` (`--no-ai` skips it) and can be added
later with `cli.sh add ai`.

It installs two things, both managed and refreshed by `just walle-update`:

| What | Where | Page |
|---|---|---|
| A walle block in the project's agent instructions | `AGENTS.md`, between `[walle:START]` and `[walle:END]` | [AGENTS.md block](agents-md.md) |
| Managed skills | `.claude/skills/@walle/` | [Skills](skills.md) |

Everything outside the markers in `AGENTS.md`, and any skill of your own outside `@walle/`, stays
yours and survives updates.
