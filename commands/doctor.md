---
description: Run local Grok HUD health check (tmux, auth, dashboard, status)
---

# Doctor

```bash
grok-hud doctor
grok-hud doctor --fix    # safe auto-repair
# or
grok-build-hud --doctor
grok-build-hud --doctor --fix
```

## `--fix` (safe only)

- ensure `config.json`
- install hooks if missing
- rewrite tmux conf + apply bar
- restart dashboard daemon
- force status refresh  

Does **not**: `brew install`, `grok login`, force-push, delete data.

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
