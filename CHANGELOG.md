# Changelog

## 1.7.0

### Stability — correct caches, observable daemon
- **Fingerprint completeness**: `sessionInputFingerprint` includes
  `chat_history.jsonl` / `prompt_context.json` / `system_prompt.txt` so
  first-turn estimate context cannot freeze under pre-skip / snap cache.
- **Pre-skip rebind**: skip-load ticks still `rebindSnapshotRuntime` (live +
  git) and re-paint when `sessionRenderKey` changes — unstaged git dirtiness
  no longer stuck forever.
- **Cache bounds**: snap + events file caches soft-cap 64 (LRU-ish); missing
  events file drops cache entry.
- **Sessions index stamp**: includes one-level child dir mtimes (nested new
  sessions under existing workspace parent).
- **Clear consistency**: config mtime change uses `clearAllHotPathCaches`
  (same set as theme).
- **Daemon**: rate-limited errors → `~/.grok/hud/dashboard.log`; refuse dual
  writer when another live dashboard owns pid; abort after 50 consecutive
  refresh failures (no silent zombie).
- Tests: `tests/stability.test.ts`.

## 1.6.0

### Deep hot-path optimization
- **Single-pass updates parse**: `parseUpdatesLines({ onObject })` folds
  turn_completed tokens into the same `JSON.parse` as tools/agents/todos
  (no second line scan in `parseUpdatesBundle`).
- **`loadHudConfig` mtime cache**: skip re-parse of `config.json` when mtime
  unchanged; `saveHudConfig` updates the entry.
- **`loadActiveSessions` mtime cache** + **`findSessionDirById` dir index**
  (stamp on sessions root listing; miss rebuilds once).
- **`parseEventsFile` mtime+size cache** for large `events.jsonl` tails.
- **`clearAllHotPathCaches()`**: one shot for bench / theme force; config
  stamp still clears write caches + hud-config cache.
- Tests cover multi-turn token parity, config/events/active/session-dir caches.

## 1.5.0

### Cache correctness + bench
- **Config bust**: `config.json` mtime is part of pre-skip key; on change,
  dashboard write/session caches clear so `set` / aesthetic apply next tick.
- **Prune**: drop caches for dead sessions; soft cap 48 entries (daemon memory).
- **`grok-hud bench [N]`**: cold vs warm `loadSnapshot` micro-benchmark.
- Theme change also clears git + snapshot caches.

## 1.4.0

### Performance — pre-load dashboard skip
- **Pre-load skip key**: if session files + live + git stamp + usage unchanged,
  dashboard **skips `loadSnapshot` entirely** (not only skip write).
- **OSC title cache**: rewrite Terminal title only when the title string changes.
- `sessionSourceFingerprint` aliases shared `sessionInputFingerprint`.
- Idle multi-terminal ticks do less JSON/git work when nothing moved.

## 1.3.0

### Performance — dashboard tick hot path
- **Single-read `updates.jsonl`**: `parseUpdatesBundle` feeds tools + tokens
  (no double open/parse per tick). Large files tail-capped.
- **Git cache**: 2.5s TTL + HEAD/index stamp invalidation (`readGitInfo`).
- **Snapshot mtime cache**: skip re-parse when session files unchanged; still
  refreshes live/pid/git on cache hit.
- **Speed tracker**: only runs when `display.showSpeed` is on (default off).

## 1.2.0

### Release tooling + layout set
- **`scripts/release.sh --tag`**: create annotated `vX.Y.Z`; with `--push` also
  push tags to gitea + github.
- **`set elementOrder` / `projectLineOrder` / `mergeGroups` / `lineLayout`**:
  e.g. `elementOrder=project,context,usage,tools`,
  `mergeGroups=context,usage;tools,agents` (or `none`).
- **`scripts/smoke.sh`** + `npm run smoke`: version / info / doctor / get quick check.
- `get` supports printing order lists as CSV.

## 1.1.0

### CLI — get + richer set + release
- **`grok-hud get [key]`**: read one config value, full JSON, or `--keys`.
- **More `set` keys**: `barWidth`, `pathLevels`, `density`, `bold`,
  `tokenReveal`, thresholds, `tokenDigits` / `tokenScope` / `contextValue` /
  `usageValue`.
- **`scripts/release.sh`**: version bump (package + plugin), CHANGELOG stub,
  `npm test`, commit; optional `--push` for gitea+github.
- **`PRIVACY.md`**: no telemetry; only local files + optional billing via Grok auth.

## 1.0.0

### Productization — doctor fix + non-interactive set
- **`grok-hud doctor --fix`**: safe local repair (config, hooks, tmux conf,
  dashboard restart, status refresh). No brew / no login / no destructive ops.
- **`grok-hud set key=value`**: non-interactive config  
  (`aesthetic=codex`, `showSpeed=on`, `autoDenseBelow=60`, …) then refresh status.
- Commands: `commands/set.md`, doctor docs updated.
- Milestone: A–D roadmap + aesthetics + Phase C + doctor/set surface complete.

## 0.9.0

### Enhancement pack — doctor, live preview, auto-dense
- **`grok-hud doctor`**: local health check (Node, tmux, CLI, build, config,
  auth, dashboard pid, status freshness, hooks, plugin version). Exit 1 on fail.
- **Settings preview**: uses **live** session when available (`live` vs `fixture`
  label); still falls back to sample data.
- **`autoDenseBelow`**: when pane width &lt; N cols, paint as dense chip for that
  frame only (does not rewrite config). Default **60** for codex/dense aesthetic;
  **0** (off) for classic. Toggle in settings **`e`**.
- Command doc `commands/doctor.md`; info prints `autoDenseBelow`.

## 0.8.0

### Phase D — docs, settings polish, idempotent install
- **Settings a/b/c/d**: toggle git file stats, compactions, speed, ahead/behind
  without editing JSON (preview sample includes those chips when on).
- **README capability map** (Chinese + English): Claude HUD vs Grok Build HUD.
- **README.en.md** synced: aesthetics, optional chips, data priority, `grok-hud info`.
- **`scripts/install.sh` idempotent**: re-run keeps existing `config.json` aesthetic
  (no forced `--preset full` on upgrade); still rebuilds CLI + dashboard + plugin.
- **`grok-hud info`**: lists Phase C optional chip on/off flags.
- Skill + `/settings` command docs updated for 0.7–0.8 surface.

## 0.7.0

### Phase C remainder — opt-in chips & dashboard skip
- **Git file stats** (`display.showGitFileStats`, default off): porcelain chip  
  `!M +A ✘D ?U` next to `git:(branch)`.
- **`showGitAheadBehind`**: gate for `↑N ↓N` (classic full still on; essential/dense off).
- **Compaction count** (`display.showCompactions`, default off): shows `压N` / `cmp×N` after first compact (from `signals.compactionCount`).
- **Output speed** (`display.showSpeed`, default off): `tok/s` from successive output-token samples (`speed-cache/` per session).
- **Dashboard skip-write**: in-process render key — skip status rewrite when session + usage identity unchanged (complements content-fp).
- Tests for porcelain parse, speed window, render keys.

## 0.6.0

### Design aesthetics (Wave D4 — CodexBar-class usage chips)
- **Compact usage chip**: `额 24% · 3h` (period word omitted on codex/dense when reset is shown).
- **Calm emphasis gate**: `usageEmphasisThreshold` (codex/dense default **80**) — usage only
  bold/severity-colors when pressure ≥ threshold; context always uses the full ladder.
- **`timeFormat`**: `relative` | `absolute` | `both` (e.g. `3h·14:30`).
- **`resetsAt`**: billing normalizer keeps ISO wall-clock; `format-reset-time` builds chip tails.
- **Usage sidecar**: writes `~/.grok/hud/usage-sidecar.json` on successful billing fetch;
  falls back to sidecar when live billing/auth misses (`externalUsagePath` / freshness ms).

### Design aesthetics (Wave D5 — polish & docs)
- **`grok-hud info`**: prints aesthetic, density, thresholds, and data priority.
- **Content fingerprint**: status file writes skip disk I/O when payload unchanged (`.content-fp`).
- **README** aesthetic comparison table; `/hud` command docs data priority.
- **Golden tests**: aesthetic × language smoke + reset/sidecar/fingerprint unit tests.

## 0.5.0

### Design aesthetics (Wave D3 — dense chips & stable width)
- **Dense chip line**: one scannable row  
  `[G4.5] · path · ● · 窗42% · 额24% · ◐read_file`  
  (`aesthetic: dense` / `density: dense`).
- **CJK-aware layout**: `visibleLen` / `trimVisible` / `fitSegments` use
  visual cell width (Chinese = 2) after stripping tmux styles.
- **Resize hysteresis**: width only updates when it moves by ≥2 columns
  (stops strip thrashing while dragging the window).
- **Multi-session list**: `--all` dims (or indents) non-primary sessions.

## 0.4.4

### Design aesthetics (Wave D2 — semantic color & calm live)
- **Unified severity ladder** for context *and* usage bars/percents:
  `ok < warningThreshold ≤ warn < criticalThreshold ≤ crit` (default 70/90).
- **Usage %** uses the same severity colors as context (by *used* pressure).
- **`colors.*` overrides** in `config.json` (hex) merge onto the active palette.
- **THEME_CODEX_LIGHT** for light Grok themes under `aesthetic: codex`.
- **Calm live mark**: solid accent ● / muted ○ — no blink; softer on paper.
- **miniBar** respects `barStyle` glyphs + configurable thresholds.

## 0.4.3

### Design aesthetics (Wave D1 — main-sight calm)
- **Health line** under `codex` / `dense`: only **context + usage** (窗+额).
  Meta (turns/tools/time/Δ) no longer crowds the primary glance row.
- **GrokBuild share** attaches to the usage fragment tail (not a separate meta chip).
- **Effort chrome**: under codex/dense show `high` instead of `effort:high`.
- **essential preset**: middot + compact + short tokens + reveal gate 70 + no title/effort on identity line.
- **codex aesthetic**: mergeGroups `[["context","usage"]]` only; statusLines 2.

## 0.4.2

### Design aesthetics (Codex App–inspired, Wave D0)
- **Docs**: `docs/DESIGN-CODEX-AESTHETICS.md` — full multi-wave todo plan
  (calm chrome, density, semantic color, chip layout).
- **`aesthetic`**: `classic` | `codex` | `dense` via config or
  `grok-hud settings` → `9` (applies density/separator/bar/token gate).
- **`separator`**: `middot` · `pipe` │ `space`
- **`barStyle`**: `block` █░ | `thin` ━─ | `dot` ●○
- **`tokenRevealAtContextPercent`**: hide token wall until ctx hot (codex: 70).
- **THEME_CODEX**: zinc neutrals + emerald accent; used when aesthetic=codex
  on dark Grok themes.
- Existing installs stay **classic** until you switch (no surprise restyle).

## 0.4.1

### Features (Phase B — Claude-style info architecture)
- **elementOrder**: configure which body blocks appear and in which order
  (`project`, `context`, `usage`, `tokens`, `meta`, `tools`, `agents`, `todos`).
- **mergeGroups**: adjacent elements in the same group share a line (default
  context+usage+tokens+meta). Set `mergeGroups: []` to put context and usage
  on separate lines.
- **projectLineOrder**: reorder first-line segments (`model`, `project`,
  `live`, `title`, `effort`); explicit order is respected fully.
- **alignLabels**: pad 窗/额 (ctx/use) to the same visual width before bars.
- **contextValue: remaining** and **usageValue: remaining** display free % of
  the window / quota.
- **Settings preview** (`grok-hud settings` → `8`): sample strip with current
  options; toggles for align labels (`6`) and usage remaining (`7`).
- **Agents line**: show up to 2 subagents with type detail (`scout`) and status.

### Docs
- Config keys documented in CHANGELOG; full README table follows in 0.5.

## 0.4.0

### Architecture (Phase A)
- **Single compose pipeline**: plain multi-line HUD text now comes from
  `src/render/compose.ts`. `formatStatusBlock` and CLI `renderHud` share it
  (tmux still applies its own width-adaptive coloring adapter).
- **Visual width helpers** (`src/render/width.ts`): CJK-aware cell width and
  truncation foundation for Phase B label-align / elementOrder.
- Live/stale labels in the plain status block follow i18n (`在线`/`闲置`).

### Tests
- `compose.test.ts`: compose ≡ formatStatusBlock; width unit tests.

## 0.3.15

### Fixes
- **Context stuck at 0%** when Grok never writes `signals.json` (common mid-turn
  and on some long sessions): estimate context from `chat_history` /
  `prompt_context` / `system_prompt` sizes; pull turn/tool counts from
  `events.jsonl` and take the max with signals so mid-turn stays fresh.
- **Activity row noise**: stop treating `agent_message_chunk` /
  `agent_thought_chunk` as agents; only show real `subagent_spawned` /
  `subagent_finished` workers.
- **Project label**: paths under `$HOME` show as `~/…` instead of `Users/dex`.
- **Duration**: fall back to summary `created_at` when signals duration is 0.
- Tests: pin `maxWidth` in status-parity so narrow tmux panes don’t flake.

## 0.3.14

### Config
- **Default language is English** (`en`). Switch to 简体中文 / 繁體 via
  `grok-hud settings` or `grok-hud lang zh` / `lang tw`.

## 0.3.13

### Fixes
- **New window context leak**: brand-new Terminal no longer shows the previous
  session’s high ctx%. Root causes fixed:
  1. tmux status **no longer falls back** to global `~/.grok/hud/tmux-*.txt`
  2. new tmux instances are **seeded at ctx 0%**
  3. session ranking ignores `signals.json` mtime keepalive and prefers newest
     `opened_at` among live sessions
  4. stronger pid/tty → tmux binding via `resolveTmuxSessionForGrok`

## 0.3.12

### Repo / docs
- **Gitea rename**: `Redredchen01/grok-hud` → `Redredchen01/grok-build-hud`
  (same host). Clone URL, remotes, package/plugin homepage, and all docs updated.
- CLI short aliases (`grok-hud`, `grok-hud-run`) unchanged.
- **Disclaimer**: docs clarify this is a **third-party / community** project,
  not an xAI official plugin; “official plugin format” wording removed.

## 0.3.11

### Docs / packaging
- **Plugin-first positioning**: README / README.en present this as a **Grok plugin**
  (manifest + commands + skills + hooks) with CLI/tmux as the runtime, not an
  optional add-on.
- **Install**: `scripts/install.sh` now registers the plugin via
  `grok plugin install . --trust` + `enable` after building the dashboard.
- Clarified plugin-only vs full HUD (dashboard) install paths; FAQ and
  CONTRIBUTING / skill / setup command docs aligned.
- Bump package + `plugin.json` to 0.3.11; marketplace description cleaned.

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
