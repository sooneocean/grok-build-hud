# grok-build-hud

**Third-party live status strip for [Grok Build](https://x.ai/cli)** — community-built, **not** an xAI official plugin

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
| Language | Default **English**; 简体中文 / 繁體 available |

Repo: http://172.238.15.154:3000/Redredchen01/grok-build-hud  
Plugin id: `grok-build-hud` · version in [`plugin.json`](./plugin.json)

> **Disclaimer:** Built and maintained by us (community / third-party). **Not** affiliated with, endorsed by, or part of xAI / official Grok Build. We only use Grok’s local plugin packaging (`plugin.json`, etc.) so you can `grok plugin install` from this repo.

---

## What it is

| Layer | Role |
|-------|------|
| **Identity** | **Third-party / community** tool — not xAI official |
| **Delivery** | Packaged for Grok’s **plugin mechanism** (`plugin.json` + `commands/` + `skills/` + `hooks/`) |
| **Runtime** | Node CLI + **same-window tmux status strip** |
| **Skill** | Bundled agent skill for in-session discovery |

One line: our own bottom status bar for Grok Build — context, quota, tokens, tools, todos — installable as a local Grok plugin.

---

## Requirements

- Grok Build CLI + `grok login`
- Node.js 18+ and npm
- tmux (`brew install tmux` on macOS)

---

## Install (recommended)

One script: **build CLI → install tmux HUD → register as a local (third-party) Grok plugin**.

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

### Register as a local Grok plugin (slash commands + skill + hooks)

Installs **this repo** into your machine’s Grok plugin directory — not an xAI official marketplace package.

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
grok-hud info                 # aesthetic + optional chips + data priority
grok-hud doctor               # local health check
grok-hud doctor --fix          # safe auto-repair
grok-hud set aesthetic=codex  # non-interactive config
grok-hud settings             # language / preset / aesthetic / chips a–e
grok-hud lang en|zh|tw
grok-build-hud --preset full|essential|minimal
grok-build-hud --theme auto
grok-hud stop
```

In-session (plugin enabled): `/hud` `/status` `/quota` `/preset` `/settings` `/setup` `/watch`

Each Terminal tab gets an **independent** Grok session.

---

## vs Claude Code HUD (capability map)

| Capability | Claude Code HUD (reference) | **Grok Build HUD (this project)** |
|------------|-----------------------------|-----------------------------------|
| Host | Built-in statusLine | No Grok statusline → **same-window tmux** |
| Context % | Yes | Yes (signals / estimate) |
| Quota + reset | Yes | Yes + `timeFormat` + usage sidecar |
| Token i/o/cache | Yes | Yes (`turn_completed`) |
| Tools / agents / todos | Yes | Yes |
| elementOrder / merge | Yes | Yes (0.4.1+) |
| Aesthetics | Yes | classic / **codex** / dense |
| Git file stats | Opt-in | Opt-in (0.7+, settings `a`) |
| Compaction count | Opt-in | Opt-in (0.7+, settings `b`) |
| Output tok/s | Opt-in | Opt-in (0.7+, settings `c`) |
| Multi-terminal | Env-dependent | **Isolated session per Terminal** |
| Official status | Community Claude plugin | **Third-party, not xAI official** |

Architecture inspiration only — **no copied source** from Claude HUD.

---

## Plugin layout

```text
plugin.json              # manifest
.grok-plugin/            # local marketplace metadata
commands/                # slash commands
skills/grok-build-hud/   # agent skill
hooks/hooks.json         # session hooks
bin/ + src/              # CLI + HUD runtime
scripts/install.sh       # one-shot installer (idempotent upgrade)
```

---

## Configuration

`~/.grok/hud/config.json`

| Preset | Rows | Contents |
|--------|------|----------|
| **full** (default) | 3 | All fields |
| **essential** | 2 | Model/git + context/usage + activity |
| **minimal** | 1 | Dense single row |

### Aesthetics (`aesthetic`)

| aesthetic | density | look |
|-----------|---------|------|
| **classic** | comfortable | pipe + block bars (compat) |
| **codex** (recommended) | compact | middot · thin · calm 窗+额 |
| **dense** | dense | 1-line chip |

### Optional chips (default off)

```jsonc
{
  "display": {
    "showGitFileStats": true,   // !M +A ✘D ?U
    "showCompactions": true,    // cmp×N after first compact
    "showSpeed": true           // tok/s
  }
}
```

Or toggle in `grok-hud settings` → **a / b / c / d**.

`language`: `en` (default) / `zh-Hans` / `zh-Hant`

Theme always tracks Grok `/theme` unless `GROK_HUD_LOCK=1`.

**Usage data priority:** live billing → cache → `usage-sidecar.json` → unavailable.

---

## How it works

Reads local `~/.grok/sessions/**`, uses existing Grok auth for billing, writes under `~/.grok/hud/`, displays via same-window tmux. Does **not** upload your code.

Upgrade in place (keeps your `config.json` aesthetic):

```bash
git pull && bash scripts/install.sh
```

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

MIT. **Third-party / community-built** — not affiliated with, endorsed by, or part of xAI. Quota APIs follow xAI and may change.
