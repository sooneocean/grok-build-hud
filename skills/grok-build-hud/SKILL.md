---
name: grok-build-hud
description: Explain and operate the Claude-HUD-style external status HUD for Grok Build (same-window multi-line context, quota, tools, todos, theme sync).
---

# grok-build-hud

Grok Build has **no** Claude Code statusline API. This package provides a Claude-HUD-like always-on strip via **same-window tmux status** plus optional scrollback annotations.

## What it shows

- Line 1: model · project · git · live · title · effort
- Line 2: context bar + tokens · weekly/monthly usage · time · turns · tools · errors · diff
- Line 3: tool activity · agents · todos · GrokBuild product share

Data sources (local):

- `~/.grok/sessions/**/signals.json` — context window
- `updates.jsonl` — tools / agents / todos
- `summary.json` — title, effort, model
- Grok auth → `cli-chat-proxy` billing for quota

## Install once

```bash
cd /path/to/grok-build-hud
bash scripts/install.sh
# or: npm run install-local
```

## Daily

```bash
grok-hud-run                              # Grok + bottom HUD (same tab)
grok-hud status                           # one-shot print
grok-build-hud --preset full|essential|minimal
grok-build-hud --theme auto               # follow Grok [ui].theme
grok-hud stop                             # stop dashboard daemon
```

## In-session slash commands (if plugin enabled)

- `/hud` `/status` `/quota` `/preset` `/setup` `/watch` — see `commands/`

## Config

`~/.grok/hud/config.json` — presets, `bold`, `barWidth`, display toggles.

Full docs: [README.md](../../README.md) · 中文: [README.zh-CN.md](../../README.zh-CN.md) · Claude migrate: [MIGRATION-FROM-CLAUDE.md](../../MIGRATION-FROM-CLAUDE.md)
