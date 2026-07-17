---
description: Install grok-build-hud dashboard + same-window multi-line status
---

# grok-build-hud setup

本仓库是 **Grok 插件**（`plugin.json`）。完整体验 = 插件 + 同窗口 tmux 状态条。

## 推荐：一键安装

在插件 / 仓库根目录：

```bash
bash scripts/install.sh
```

会：编译 → `npm link` → `--install-dashboard` → `grok plugin install . --trust`。

## 分步

```bash
npm install && npm run build
npm link
node bin/grok-build-hud.js --install-dashboard
node bin/grok-build-hud.js --theme auto
node bin/grok-build-hud.js --preset full
grok plugin install . --trust
grok plugin enable grok-build-hud
```

或：`npm run install-local`（仅 CLI + dashboard，不含插件注册）。

## Start Grok with HUD (same Terminal tab)

```bash
grok
# 兼容：grok-hud-run
```

You should see **2–3 rows** at the bottom (context + usage bars), not a second window.

## Hooks only (scrollback annotations)

```bash
node bin/grok-build-hud.js --install-hooks
```

Reload in Grok: `/hooks` then press `r`.

## Verify

```bash
grok-hud status
grok plugin details grok-build-hud
```
