# grok-build-hud

**Live multi-line status strip for [Grok Build](https://x.ai/cli).**

> 中文安装与使用说明：[README.zh-CN.md](./README.zh-CN.md)

Always-on strip in the **same Terminal window** (tmux status — not a second window):

```text
[Grok 4.5] · my-project git:(main*) · ●
窗/ctx ██████████░░░░ 70% (351k/500k) · 入/i · 出/o · 缓/c · 额/use 23% · 轮/t 16
◐ read_file… · ✓ grep ×3 · ▸ todos
```

Built for Grok Build sessions: context window, quota, **input/output/cache tokens**, tools, todos, git — with Chinese/English UI and theme follow.

---

## Requirements

- **Node.js 18+**
- **tmux** (`brew install tmux` on macOS)
- **Grok Build** CLI signed in (`grok login`)
- Any terminal that can host tmux (tested on Apple Terminal / iTerm)

---

## Install

### A. One-shot script (recommended)

```bash
git clone http://172.238.15.154:3000/Redredchen01/grok-hud.git
cd grok-hud
bash scripts/install.sh
```

This runs `npm install` → `build` → `npm link` → dashboard + hooks → `--theme auto` → `--preset full`.

### B. Manual steps

```bash
git clone http://172.238.15.154:3000/Redredchen01/grok-hud.git
cd grok-hud
npm install
npm run build
npm link          # puts grok-build-hud / grok-hud / grok-hud-run on PATH
npm run install-local
```

### C. From an already-cloned path

```bash
cd /path/to/grok-hud
bash scripts/install.sh
```

### D. As a Grok plugin (optional)

```bash
cd /path/to/grok-build-hud
npm install && npm run build
grok plugin install . --trust
grok plugin enable grok-build-hud
```

In Grok: `/hooks` → press `r` to reload.

### PATH fix (`command not found`)

```bash
# add to ~/.zshrc or ~/.bashrc
export PATH="$(npm prefix -g)/bin:$HOME/.local/bin:$PATH"
```

Then `source ~/.zshrc` and verify: `which grok-hud-run`.

---

## Daily use (same window — no second pane)

```bash
# Start Grok with the multi-line HUD at the bottom of THIS tab
grok
# (or: grok-hud-run)
```

| Row | Content |
|-----|---------|
| 1 | Model · project · git · live · title · effort |
| 2 | **Context** bar + tokens · **Usage/quota** · time · turns · tools · errors · diff |
| 3 | Tool activity · agents · todos · GrokBuild product share |

The strip refreshes about once per second while the session is open.

### Useful commands

```bash
grok-build-hud --once --follow-active   # print full HUD once
grok-hud status                         # same
grok-hud stop                           # stop background updater
grok-build-hud --preset full|essential|minimal
grok-build-hud --theme auto             # follow Grok [ui].theme
grok-build-hud --theme tokyonight       # lock palette
```

### Refresh tmux after config change

```bash
tmux source-file ~/.grok/hud/tmux.conf && tmux refresh-client -S
```

---

## Configuration

### Display preset & toggles

`~/.grok/hud/config.json`

| Preset | Rows | Contents |
|--------|------|----------|
| **full** (default) | 3 | Everything |
| **essential** | 2 | Model/git + context/usage + activity |
| **minimal** | 1 | Dense single row |

Key options:

```json
{
  "preset": "full",
  "statusLines": 3,
  "bold": true,
  "barWidth": 14,
  "pathLevels": 2,
  "display": {
    "showContextBar": true,
    "contextValue": "both",
    "showUsage": true,
    "showToolActivity": true,
    "showTodos": true,
    "showAgents": true,
    "showDiffStats": true
  }
}
```

### Theme (matches Grok UI)

Reads `~/.grok/config.toml`:

```toml
[ui]
theme = "tokyonight"   # also: groknight, grokday, rosepinemoon, oscuramindnight, auto
```

```bash
grok-build-hud --theme auto    # follow Grok config (default)
```

### Readability

- `bold: true` — bold values (default)
- `barWidth: 14` — thicker progress bars  

True **font size** is Terminal’s font (tmux cannot set a separate size for the status strip).

---

## How it works

```text
Grok sessions ──► ~/.grok/sessions/**/signals.json
              ──► updates.jsonl (tools / agents / todos)
              ──► summary.json  (title, effort, model)
auth.json     ──► cli-chat-proxy billing (weekly quota + monthly)
                      │
                      ▼
              dashboard daemon (~500ms)
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
   tmux-lines.txt  status.txt  hooks annotations
          │
          ▼
   same-window tmux status (1–3 rows)
```

No second window. No cloud upload of your code by this tool (read-only local session files + your existing Grok auth for billing).

---

## Settings (language)

```bash
grok-hud settings          # interactive UI
grok-hud lang zh           # 简体中文 (default)
grok-hud lang en           # English
```

---

## Uninstall

```bash
grok-build-hud --uninstall-dashboard
grok-build-hud --uninstall-hooks
npm unlink -g grok-build-hud   # if you used npm link
```

Optional cleanup: `~/.grok/hud/`, `~/.grok/hooks/grok-build-hud.json`.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `command not found` | Fix PATH (above) or run `node bin/grok-hud-run.js` |
| No bottom strip | Use `grok-hud-run`; install tmux; re-run `--install-dashboard` |
| Usage shows `—` | `grok login`, then `grok-hud status` |
| Colors clash with TUI | `grok-build-hud --theme auto` |
| Stale numbers | `grok-hud stop` then `grok-hud-run` |
| Text too small | Increase Terminal font; keep `bold` / `barWidth` |

---

## Development

```bash
npm install
npm test          # build + 40 unit tests
npm run build
grok plugin validate .   # if Grok CLI is available
```

See [CHANGELOG.md](./CHANGELOG.md) and [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

MIT

---

## Disclaimer

Third-party tool. Billing/quota display depends on xAI session auth and API shapes that may change. Not affiliated with xAI.
