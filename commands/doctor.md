---
description: Run local Grok HUD health check (tmux, auth, dashboard, status)
---

# Doctor

```bash
grok-hud doctor
# or
grok-build-hud --doctor
```

Checks (local only, no network required for most):

| Check | Meaning |
|-------|---------|
| Node.js | ≥ 18 |
| tmux | required for same-window strip |
| CLI on PATH | `grok-hud` / `grok-build-hud` |
| Build (dist/) | compiled package |
| HUD config | `~/.grok/hud/config.json` parse |
| Grok auth | credentials for quota |
| Dashboard daemon | pid alive |
| Status files | `status.txt` freshness |
| Hooks | `~/.grok/hooks/grok-build-hud.json` |
| Plugin | installed-plugins version match |

Exit code: `0` if no **fail** (warnings still exit 0); `1` if any fail.

Also see: `grok-hud info` for aesthetic / chip flags.
