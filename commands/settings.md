---
description: Open Grok HUD settings (language, preset, aesthetic, optional chips)
---

# Settings

```bash
grok-hud settings
# or
grok-build-hud --settings
```

## Menu

| Key | Action |
|-----|--------|
| `1` | Language (en / 简体 / 繁體) |
| `2` | Preset full / essential / minimal |
| `3` | Status row count |
| `4` | Token breakdown on/off |
| `5` | Theme follow Grok |
| `6` | Align 窗/额 labels |
| `7` | Usage as remaining % |
| `8` | Preview strip |
| `9` | Aesthetic classic / **codex** / dense |
| `a` | Git file stats `!M +A` (opt-in) |
| `b` | Compaction count (opt-in) |
| `c` | Output speed tok/s (opt-in) |
| `d` | Git ↑↓ ahead/behind |
| `0` | Save & exit |
| `q` | Quit without save |

## Language shortcuts

```bash
grok-hud lang en   # English (default)
grok-hud lang zh   # 简体中文
grok-hud lang tw   # 繁體中文
```

Config file: `~/.grok/hud/config.json`

Also: `grok-hud info` prints live aesthetic + optional chip flags + data priority.
