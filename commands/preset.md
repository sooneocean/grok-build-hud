---
description: Set Claude-HUD-style HUD preset (full / essential / minimal)
---

# HUD presets (Claude HUD parity)

```bash
# Full — model, git, context+usage dual bars, tools, agents, todos, diff stats (3 rows)
grok-build-hud --preset full
# or: grok-hud preset full

# Essential — dual bars + activity (2 rows)
grok-build-hud --preset essential

# Minimal — single dense row
grok-build-hud --preset minimal
```

Then refresh tmux (if already in a HUD session):

```bash
tmux source-file ~/.grok/hud/tmux.conf && tmux refresh-client -S
```
