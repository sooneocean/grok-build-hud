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

- ensure / **repair** `config.json` (invalid JSON → quarantine `config.json.bad-*` + default)
- **clear stale** `dashboard.pid` / `dashboard.lock` (only if daemon not live)
- **rotate** oversized `dashboard.log` → `.log.1` (default ≥1MB)
- install hooks if missing
- rewrite tmux conf + apply bar
- restart dashboard daemon
- force status refresh  

Does **not**: `brew install`, `grok login`, force-push, delete unrelated data.

Checks (local only, no network required for most):

| Check | Meaning |
|-------|---------|
| Node.js | ≥ 18 |
| tmux | required for same-window strip |
| CLI on PATH | `grok-hud` / `grok-build-hud` |
| Build (dist/) | compiled package |
| HUD config | `~/.grok/hud/config.json` parse (**fail** if invalid JSON) |
| Grok auth | credentials for quota |
| Dashboard daemon | pid alive; **warn** on stale pid file |
| Dashboard log | recent `refresh error` lines in `dashboard.log` (last 15m) |
| Status files | `status.txt` freshness |
| Hooks | `~/.grok/hooks/grok-build-hud.json` |
| Plugin | installed-plugins version match |

Exit code: `0` if no **fail** (warnings still exit 0); `1` if any fail.

Also see: `grok-hud info` for aesthetic / chip flags.
