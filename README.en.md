# grok-hud

**Live multi-line status strip for [Grok Build](https://x.ai/cli)**

> 中文文档（主 README）：[README.md](./README.md)

Always-on strip at the bottom of the **same Terminal tab** (tmux status — not a second window):

```text
Grok 4.5 · my-project · ●
ctx ██████░░░░ 50% (252k/500k) · i … o … c 99% · use 24% · t7 · ⚙212
◐ read_file… · ✓ grep ×3 · ▸ todos
```

| Feature | Description |
|---------|-------------|
| Context | Window % and token counts |
| Quota | Weekly/monthly usage (`grok login` required) |
| Tokens | Input / output / cache / reasoning from `turn_completed` |
| Activity | Tools, agents, todos |
| Theme | Follows Grok `[ui].theme` (not locked) |
| Multi-terminal | Independent session per tab |
| Language | Default **简体中文**; English / 繁體 available |

Repo: http://172.238.15.154:3000/Redredchen01/grok-hud

---

## Requirements

- Node.js 18+
- tmux (`brew install tmux` on macOS)
- Grok Build signed in (`grok login`)

---

## Install

```bash
git clone http://172.238.15.154:3000/Redredchen01/grok-hud.git
cd grok-hud
bash scripts/install.sh
```

Or:

```bash
npm install && npm run build && npm link
npm run install-local
```

Optional plugin:

```bash
grok plugin install . --trust
grok plugin enable grok-build-hud
```

PATH (if commands missing):

```bash
export PATH="$(npm prefix -g)/bin:$HOME/.local/bin:$PATH"
```

---

## Daily use

```bash
grok                          # Grok + bottom HUD (same tab)
GROK_NO_HUD=1 grok -p "hi"    # bare CLI
grok-hud status
grok-hud settings             # language / preset / rows
grok-hud lang en              # English labels
grok-hud lang zh              # 简体中文 (default)
grok-build-hud --theme auto   # follow Grok theme
grok-hud stop
```

Each Terminal tab gets an **independent** Grok session (unique tmux name).

---

## Configuration

`~/.grok/hud/config.json`

| Preset | Rows | Contents |
|--------|------|----------|
| **full** (default) | 3 | All fields |
| **essential** | 2 | Model/git + context/usage + activity |
| **minimal** | 1 | Dense single row |

`language`: `zh-Hans` (default) / `en` / `zh-Hant`

---

## How it works

Reads local `~/.grok/sessions/**`, uses existing Grok auth for billing, writes status files under `~/.grok/hud/`, displays via same-window tmux. Does **not** upload your code.

---

## Uninstall

```bash
grok-build-hud --uninstall-dashboard
grok-build-hud --uninstall-hooks
npm unlink -g grok-build-hud
```

---

## Develop

```bash
npm install
npm test
```

Primary documentation is **Chinese** ([README.md](./README.md)). Commit messages in English.

## License

MIT. Unofficial third-party tool; not affiliated with xAI.
