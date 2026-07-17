---
name: grok-build-hud
description: Explain and operate the Grok Build live status HUD (same-window multi-line context, quota, tokens, tools, todos, theme sync, Chinese/English settings).
---

# grok-build-hud

Always-on status strip for **Grok Build**: multi-line bar in the **same Terminal tab** (tmux status) plus optional scrollback annotations. Reads local session files and your Grok auth for quota — no second window required.

## What it shows

- Line 1: model · project · git · live · title · effort
- Line 2: context bar + tokens · weekly/monthly usage · time · turns · tools · errors · diff
- Line 3: tool activity · agents · todos · GrokBuild product share

Data sources (local):

- `~/.grok/sessions/**/signals.json` — context window
- `updates.jsonl` — tools / agents / todos / token usage
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
grok                              # wrapped: Grok + bottom HUD (same tab)
grok-hud status                   # one-shot print
grok-hud settings                 # language (中/英), preset, rows
grok-hud lang zh|en|tw
grok-build-hud --preset full|essential|minimal
grok-build-hud --theme auto       # follow Grok [ui].theme
grok-hud stop                     # stop dashboard daemon
```

## In-session slash commands (if plugin enabled)

- `/hud` `/status` `/quota` `/preset` `/setup` `/watch` `/settings` — see `commands/`

## Config

`~/.grok/hud/config.json` — language, presets, `bold`, `barWidth`, display toggles.

Full docs: [README.md](../../README.md) · 中文: [README.zh-CN.md](../../README.zh-CN.md)
