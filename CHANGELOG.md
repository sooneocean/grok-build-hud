# Changelog

## 0.3.10

### Docs / repo
- **中文 README 为主**：`README.md` 为完整中文文档；英文移至 `README.en.md`。
- 删除 `README.zh-CN.md`，避免双主文档分叉。
- CONTRIBUTING、package/plugin 描述、skill 链接同步中文优先。

## 0.3.9

### Docs / positioning
- **Product copy**: README / skill / package / plugin descriptions now present
  this as a **standalone Grok Build** live status strip (context, quota, tokens,
  tools, multi-terminal). Removed third-party comparison and migration docs.

## 0.3.8

### Features
- **Settings UI** (`grok-hud settings`): interactive menu for language, preset,
  status rows, token breakdown. Default language **简体中文**; switch to
  English / 繁體. Shortcuts: `grok-hud lang zh` / `grok-hud lang en`.
- Status strip labels localized (窗/额/入/出/缓 vs ctx/use/i/o/c).

## 0.3.7

### Fixes
- **Theme follows Grok, never locked by default**: HUD palette always tracks
  `~/.grok/config.toml [ui].theme` (and auto→OS light/dark maps). Changing
  `/theme` in Grok re-paints the strip (~1s). Optional lock only with
  `GROK_HUD_LOCK=1`. Install resets any legacy locked palette to follow mode.
- Theme fingerprint includes auto maps + system appearance so light/dark
  toggles rewrite tmux chrome, not only palette name.

## 0.3.6

### Fixes
- **GrokDay readability**: paper strip background (`#f4f1ea`), near-black ink,
  darker labels/seps. Light themes **never use tmux `dim`** (it washed text out
  on white). Labels use italic + bold slate instead.
- Theme auto→grokday now paints a solid status bar so colours actually switch
  away from dark Tokyo-style greys.

## 0.3.5

### Features
- **Width-adaptive HUD**: layout follows each Terminal/tmux `client_width`
  (xs/sm/md/lg). Bars, rows, and fields drop by priority so the strip never
  overflows the window.
- **Typography hierarchy** (terminal can't change font size — use styles):
  - labels: dim + *italic*
  - primary numbers / model: **bold**
  - secondary (path, tools): italic
  - separators: dim middots (less noisy than repeated `│`)
  - tokens: compact `i` / `o` / `c` with mixed colours (not one bold wall)

## 0.3.4

### Fixes
- **Parallel Terminals = independent sessions**: `grok` no longer attaches to a
  shared tmux session named `grok-hud` (`-A`). Each Terminal gets a unique
  tmux session + its own Grok conversation.
- **Per-session HUD bars**: status files under `~/.grok/hud/tmux/<session>/`;
  dashboard updates every live session, not only the newest.
- **No title broadcast**: Apple Terminal custom title only updates the matching
  tty — never every tab.

## 0.3.3

### Fixes
- **Lifecycle = open Terminal, not machine boot**: HUD daemon is ensured when
  an interactive shell starts (`~/.zshrc` hook). Login LaunchAgent is no longer
  KeepAlive/RunAtLoad — `grok` + Terminal open is the primary path.

### Features
- **IN / OUT / CACHE exact token numbers** from `turn_completed` usage in
  `updates.jsonl`. HUD shows full digits (e.g. `IN 974,820 · OUT 15,706 ·
  CACHE 944,000 (97%) · REASON 9,717`) plus optional session ΣTOK sum.
  Also written to `status.json` as `lastTurnTokens` / `sessionTokens`.

## 0.3.2

### Features
- **`grok` = start with HUD**: install wraps `~/.grok/bin/grok` so plain `grok`
  opens the same-window tmux strip. Real binary kept at `~/.grok/bin/grok-real`.
  Escape: `GROK_NO_HUD=1 grok …` (also auto-bare for `-p`, pipes, `login`, etc.).
- **Login LaunchAgent**: `com.dex.grok-hud-dashboard` uses modern
  `launchctl bootstrap/kickstart` so the status updater really starts at login.

## 0.3.1

### Fixes
- **HUD stuck at old ctx% after `/new`**: when multiple Grok tabs are live,
  prefer the *most recently active* session instead of the first entry in
  `active_sessions.json` (which keeps the older tab first). Dashboard, hooks,
  and `--follow-active` all share this ranking.

## 0.3.0

### Highlights
- **Multi-line live status strip** (same Terminal window via tmux)
  - Line 1: model · project · git · live · title · effort
  - Line 2: Context bar + tokens · Usage/quota · time · turns · tools · errors · diff
  - Line 3: tool activity · agents · todos · product breakdown
- **Presets**: `full` / `essential` / `minimal`
- **Theme sync with Grok UI**: reads `~/.grok/config.toml` `[ui].theme`
  - Palettes: tokyonight, groknight, grokday, rosepinemoon, oscuramindnight
- **Bold + wide bars** for readability (`bold`, `barWidth` in config)
- **Quota** from real `cli-chat-proxy.grok.com` billing (weekly % + monthly + GrokBuild split)
- CLI: `grok-build-hud`, `grok-hud`, `grok-hud-run`
- One-shot installer: `bash scripts/install.sh` / `npm run setup`
- Docs: README + **README.zh-CN.md**, CONTRIBUTING, troubleshooting

### Fixes
- Single dashboard daemon (no multi-writer fights)
- Theme follows Grok TUI, not only Terminal.app profile
- PATH / install docs for “command not found”

## 0.2.0

- Same-window tmux HUD
- Hooks + status files
- Billing integration

## 0.1.0

- Initial one-shot / watch CLI
