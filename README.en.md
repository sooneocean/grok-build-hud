# grok-build-hud

**Live multi-line status strip for [Grok Build](https://x.ai/cli) — shipped as a Grok plugin**

> Primary docs (Chinese): [README.md](./README.md)

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

Repo: http://172.238.15.154:3000/Redredchen01/grok-build-hud  
Plugin id: `grok-build-hud` · version in [`plugin.json`](./plugin.json)

---

## What it is

| Layer | Role |
|-------|------|
| **Delivery** | **Grok plugin** (`plugin.json` + `commands/` + `skills/` + `hooks/`) |
| **Runtime** | Node CLI + **same-window tmux status strip** |
| **Skill** | Bundled agent skill for in-session discovery |

One line: a bottom status bar for Grok Build — context, quota, tokens, tools, todos.

---

## Requirements

- Grok Build CLI + `grok login`
- Node.js 18+ and npm
- tmux (`brew install tmux` on macOS)

---

## Install (recommended)

One script: **build CLI → install tmux HUD → register as Grok plugin**.

```bash
git clone http://172.238.15.154:3000/Redredchen01/grok-build-hud.git
cd grok-build-hud
bash scripts/install.sh
```

Then:

```bash
grok                 # Grok + bottom HUD (same tab)
grok-hud status
grok-hud settings
```

Reload hooks in Grok: `/hooks` then `r` if needed.

### PATH (if commands missing)

```bash
export PATH="$(npm prefix -g)/bin:$HOME/.local/bin:$PATH"
```

---

## Install pieces

### CLI + same-window strip only

```bash
npm install && npm run build && npm link
npm run install-local
```

### Register as Grok plugin (slash commands + skill + hooks)

Build first (`dist/` is required by hooks):

```bash
npm install && npm run build
grok plugin install . --trust
grok plugin enable grok-build-hud
grok plugin validate .
```

> Plugin-only install gives `/hud` etc. and scrollback annotations, **not** the multi-line tmux bar. Use `install.sh` for the full experience.

### Update

```bash
git pull && bash scripts/install.sh
# or: grok plugin update grok-build-hud
```

---

## Daily use

```bash
grok                          # Grok + bottom HUD
GROK_NO_HUD=1 grok -p "hi"    # bare CLI
grok-hud status
grok-hud settings             # language / preset / rows
grok-hud lang en|zh|tw
grok-build-hud --preset full|essential|minimal
grok-build-hud --theme auto
grok-hud stop
```

In-session (plugin enabled): `/hud` `/status` `/quota` `/preset` `/settings` `/setup` `/watch`

Each Terminal tab gets an **independent** Grok session.

---

## Plugin layout

```text
plugin.json              # manifest
.grok-plugin/            # local marketplace metadata
commands/                # slash commands
skills/grok-build-hud/   # agent skill
hooks/hooks.json         # session hooks
bin/ + src/              # CLI + HUD runtime
scripts/install.sh       # one-shot installer
```

---

## Configuration

`~/.grok/hud/config.json`

| Preset | Rows | Contents |
|--------|------|----------|
| **full** (default) | 3 | All fields |
| **essential** | 2 | Model/git + context/usage + activity |
| **minimal** | 1 | Dense single row |

`language`: `zh-Hans` (default) / `en` / `zh-Hant`

Theme always tracks Grok `/theme` unless `GROK_HUD_LOCK=1`.

---

## How it works

Reads local `~/.grok/sessions/**`, uses existing Grok auth for billing, writes under `~/.grok/hud/`, displays via same-window tmux. Does **not** upload your code.

---

## Uninstall

```bash
grok-build-hud --uninstall-dashboard
grok-build-hud --uninstall-hooks
grok plugin uninstall grok-build-hud
npm unlink -g grok-build-hud
```

---

## Develop

```bash
npm install
npm test
npm run plugin:validate
```

Primary documentation is **Chinese** ([README.md](./README.md)). Commit messages in English.

## License

MIT. Unofficial third-party tool; not affiliated with xAI.
