# Migrating from Claude HUD → Grok Build HUD

This plugin is designed so Claude Code users can switch to Grok Build **without relearning status UX**.

## Side-by-side map

| Claude HUD | Grok Build HUD | Notes |
|------------|----------------|-------|
| Native statusline under prompt | **tmux multi-line status** in the **same Terminal window** | Grok has no statusline API; this is the supported equivalent |
| `[Opus] │ project git:(main*)` | `[Grok 4.5] │ project git:(main*)` | Same line-1 shape |
| `Context ████ 45%` | `Context ████ 45% (224k/500k)` | Native `signals.json` tokens |
| `Usage ██ 25% (1h / 5h)` | `Usage ██ 23% weekly · 4d left` | Grok weekly quota + monthly credits |
| Tools activity line | `◐ read_file … \| ✓ grep ×3` | From `updates.jsonl` |
| Agents line | `◐ explore …` / subagent titles | Best-effort from session updates |
| Todos `▸ task (2/5)` | `▸ task (2/5)` | From `todo_write` events |
| Presets Full / Essential / Minimal | `preset: full\|essential\|minimal` | Same intent |
| `/claude-hud:setup` | `grok-build-hud --install-dashboard` + `grok-hud-run` | One-time |
| `/claude-hud:configure` | edit `~/.grok/hud/config.json` or `--preset` | |
| Theme follows Claude UI | Theme follows **Grok `[ui].theme`** (tokyonight, grokday, …) | |

## 5-minute migrate checklist

1. Install Node 18+ and tmux (`brew install tmux`).
2. Install HUD:
   ```bash
   git clone https://github.com/sooneocean/grok-build-hud.git
   cd grok-build-hud
   bash scripts/install.sh
   ```
   Or from an existing clone: `npm run install-local` after `npm link`.
3. Start Grok **in the same Terminal tab** with bottom HUD:
   ```bash
   grok-hud-run
   ```
4. You should see **2–3 status rows** (Claude-HUD style), not a second window.
5. Verify once: `grok-hud status`

## Mental model (why not identical)

Claude Code ships a **statusline hook** that redraws under the prompt.  
Grok Build does not. We use a **same-window tmux status strip** that:

- stays always visible
- does not open a second window
- uses real Grok session signals + billing (same sources as `/context` and `/usage`)

## Config file

`~/.grok/hud/config.json` — presets and display toggles (Claude-HUD-like options).

```bash
grok-build-hud --preset full       # everything
grok-build-hud --preset essential  # model/ctx/usage/tools/todos
grok-build-hud --preset minimal    # model + context + usage only
```

## Command cheatsheet

| Claude habit | Grok equivalent |
|--------------|-----------------|
| Glance HUD | bottom strip (always on with `grok-hud-run`) |
| `/context` | bottom Context bar **or** `/context` |
| rate-limit bar | Usage / quota bar (weekly + product split) |
| open configure | `~/.grok/hud/config.json` or `--preset` |

## Why this helps Grok grow

Claude users already trained on **context bar + usage bar + tools/todos**.  
Matching that literacy lowers switch cost: same glances, same panic thresholds (70% / 90% context), same session hygiene — on Grok’s speed and pricing.
