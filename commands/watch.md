---
description: How to keep the HUD live (same-window recommended)
---

# Live HUD

## Recommended: same Terminal window

```bash
grok-hud-run
```

Starts Grok with a permanent multi-line status strip at the bottom (tmux). **No second window.**

## Optional: external watch in another pane

```bash
grok-build-hud --watch --follow-active --cwd "$(pwd)"
```

Short capture / tests:

```bash
grok-build-hud --watch --max-iterations 3 --interval 500
```

Single tmux status line (legacy):

```bash
grok-build-hud --tmux --no-color
```
