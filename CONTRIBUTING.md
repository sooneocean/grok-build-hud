# Contributing

## Setup

```bash
git clone http://172.238.15.154:3000/Redredchen01/grok-hud.git
cd grok-hud
npm install
npm test
```

## Layout

| Path | Role |
|------|------|
| `src/` | TypeScript sources (session, billing, status, tmux, theme, CLI) |
| `bin/` | CLI entrypoints (`grok-build-hud`, `grok-hud`, `grok-hud-run`, hook) |
| `tests/` | Node built-in test runner (`node --test`) |
| `fixtures/` | Session + billing samples for tests |
| `commands/` / `skills/` | Grok plugin surface |
| `scripts/install.sh` | One-shot local install |

## Rules of thumb

- Prefer reading **local** `~/.grok/sessions/**` over inventing APIs.
- Billing must **degrade gracefully** when offline / unauthenticated (never throw in render path).
- Keep the HUD **same-window** (tmux status). Do not require a second Terminal window by default.
- Add or update a test when changing parse/normalize/render behaviour.
- Commit messages in English; user-facing docs may be EN + ZH.

## Before a PR

```bash
npm test
```

All 40 tests should pass.
