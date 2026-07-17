---
description: Show live context window + quota bars (Claude-HUD style)
---

# /hud — live context + quota

Print the multi-line HUD for the active Grok session:

```bash
grok-hud status
# or:
grok-build-hud --once --follow-active --no-color
```

If CLIs are not on PATH (plugin-only install):

```bash
node "${GROK_PLUGIN_ROOT}/bin/grok-build-hud.js" --once --follow-active --no-color
```

Example:

```text
[Grok 4.5] │ my-project git:(main*) │ ● LIVE
Context ████████░░ 78% (392k/500k) │ Quota ██░░░░░░░░ 24% weekly · 4d
◐ read_file… | ✓ grep ×3
```

For always-on same-window strip: start with `grok-hud-run` (not a second window).
