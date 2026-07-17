---
name: grok-build-hud
description: Grok Build 实时状态条（同窗口多行：上下文、配额、token、工具、待办；主题跟随；中英文设定）。
---

# grok-build-hud

**Grok Build 插件**：同窗口实时状态条（tmux）——上下文、配额、入/出/缓存 token、工具与待办。读本机会话文件与已有登录查配额，不另开窗口。

## What it shows

- Line 1: model · project · git · live · title · effort
- Line 2: context bar + tokens · weekly/monthly usage · time · turns · tools · errors · diff
- Line 3: tool activity · agents · todos · GrokBuild product share

Data sources (local):

- `~/.grok/sessions/**/signals.json` — context window
- `updates.jsonl` — tools / agents / todos / token usage
- `summary.json` — title, effort, model
- Grok auth → `cli-chat-proxy` billing for quota

## Install once (plugin + HUD)

```bash
git clone http://172.238.15.154:3000/Redredchen01/grok-build-hud.git
cd grok-build-hud
bash scripts/install.sh
```

One-shot: build CLI → install tmux dashboard → `grok plugin install . --trust`.

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

## In-session slash commands (plugin enabled)

- `/hud` `/status` `/quota` `/preset` `/setup` `/watch` `/settings` — see `commands/`

## Config

`~/.grok/hud/config.json` — language, presets, `bold`, `barWidth`, display toggles.

文档（中文主文档）：[README.md](../../README.md) · English: [README.en.md](../../README.en.md)
