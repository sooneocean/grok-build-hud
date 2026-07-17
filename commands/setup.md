---
description: Install grok-build-hud dashboard + same-window multi-line status
---

# grok-build-hud setup

One-time setup (from the plugin / repo root):

```bash
npm install && npm run build
# Preferred: full same-window HUD (tmux multi-line strip)
node bin/grok-build-hud.js --install-dashboard
node bin/grok-build-hud.js --theme auto
node bin/grok-build-hud.js --preset full
```

Or: `bash scripts/install.sh` / `npm run install-local`.

## Start Grok with HUD (same Terminal tab)

```bash
grok-hud-run
```

You should see **2–3 rows** at the bottom (context + usage bars), not a second window.

## Hooks only (scrollback annotations)

```bash
node bin/grok-build-hud.js --install-hooks
```

Reload in Grok: `/hooks` then press `r`.

Example annotation:

```text
[hud] ctx 30% 154k/500k │ turns 3 │ tools 78 │ live │ project
```

## Verify

```bash
grok-hud status
```
