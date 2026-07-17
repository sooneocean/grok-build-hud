# Changelog

## 0.3.0

### Highlights
- **Claude-HUD parity multi-line strip** (same Terminal window via tmux)
  - Line 1: model · project · git · live · title · effort
  - Line 2: Context bar + tokens · Usage/quota · time · turns · tools · errors · diff
  - Line 3: tool activity · agents · todos · product breakdown
- **Presets**: `full` / `essential` / `minimal` (Claude HUD naming)
- **Theme sync with Grok UI**: reads `~/.grok/config.toml` `[ui].theme`
  - Palettes: tokyonight, groknight, grokday, rosepinemoon, oscuramindnight
- **Bold + wide bars** for readability (`bold`, `barWidth` in config)
- **Quota** from real `cli-chat-proxy.grok.com` billing (weekly % + monthly + GrokBuild split)
- CLI: `grok-build-hud`, `grok-hud`, `grok-hud-run`
- One-shot installer: `bash scripts/install.sh` / `npm run setup`
- Docs: README + **README.zh-CN.md**, MIGRATION, CONTRIBUTING, troubleshooting

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
