---
description: Show live Grok Build context + quota status strip
---

# HUD status

```bash
grok-hud status
# or
grok-build-hud --once --follow-active --no-color

# aesthetic + data priority (D5)
grok-hud info
```

Prints the multi-line status (context, usage, tokens, tools) once.

For always-on same-window strip: start with `grok` (or `grok-hud-run`).

## Aesthetic modes

| aesthetic | density | look |
|-----------|---------|------|
| **classic** | comfortable | full labels, pipe sep, block bars (compat) |
| **codex**（推荐） | compact | middot · thin bars · calm health line (窗+额) |
| **dense** | dense | 1-line chip, space sep, dots |

Switch: `grok-hud settings` → aesthetic，或编辑 `~/.grok/hud/config.json`：

```json
{ "aesthetic": "codex" }
```

## Data priority

**Usage（额）**

1. Live billing (`cli-chat-proxy` / xAI) → also writes `~/.grok/hud/usage-sidecar.json`
2. In-memory / disk billing cache
3. External sidecar (`externalUsagePath` or default usage-sidecar.json, freshness ~5 min)
4. Unavailable chip

**Context（窗）**

1. Session `signals.json` window
2. Event / turn estimates
3. 0%

`grok-hud info` prints the live aesthetic fields + this priority list.
