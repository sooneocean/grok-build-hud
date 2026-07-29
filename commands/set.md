---
description: Non-interactive HUD config set (aesthetic, chips, language)
---

# Set config

```bash
grok-hud set aesthetic=codex
grok-hud set language=zh showSpeed=on showGitFileStats=true
grok-hud set autoDenseBelow=60
```

Saves `~/.grok/hud/config.json`, refreshes tmux conf + status.

Keys include: `aesthetic`, `preset`, `language`, `autoDenseBelow`, `timeFormat`,
`usageEmphasisThreshold`, `showGitFileStats`, `showCompactions`, `showSpeed`, …

Interactive: `grok-hud settings` · inspect: `grok-hud info` · health: `grok-hud doctor`
