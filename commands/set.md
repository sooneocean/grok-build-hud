---
description: Non-interactive HUD config set (aesthetic, chips, language)
---

# Set / get config

```bash
grok-hud set aesthetic=codex
grok-hud set language=zh showSpeed=on showGitFileStats=true
grok-hud set autoDenseBelow=60 barWidth=10

grok-hud get aesthetic
grok-hud get display.showSpeed
grok-hud get              # full JSON
grok-hud get --keys       # list settable keys
```

Saves `~/.grok/hud/config.json`, refreshes tmux conf + status.

Keys: aesthetic, preset, language, density, barWidth, pathLevels, tokenReveal,
thresholds, tokenDigits, chips (`showGitFileStats` / `showCompactions` / `showSpeed`),
layout lists:

```bash
grok-hud set elementOrder=project,context,usage,tools
grok-hud set projectLineOrder=model,project,live
grok-hud set mergeGroups=context,usage;tools,agents
grok-hud set mergeGroups=none
```

Interactive: `grok-hud settings` · inspect: `grok-hud info` · health: `grok-hud doctor`  
Privacy: [PRIVACY.md](../PRIVACY.md) — no telemetry.
